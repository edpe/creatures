/**
 * CreatureProcessor - AudioWorklet for polyphonic voice synthesis
 * Handles batched note events with sample-accurate timing
 */

// Voice states
const VOICE_IDLE = 0;
const VOICE_ATTACK = 1;
const VOICE_SUSTAIN = 2;
const VOICE_RELEASE = 3;

class Voice {
  constructor(id) {
    this.id = id;
    this.state = VOICE_IDLE;
    
    // Pure oscillator state
    this.phase = 0;
    this.freq = 440;
    this.waveType = 'sine'; // 'sine', 'square', 'saw'
    
    // Multi-stage envelope state (ADSR)
    this.envLevel = 0;
    this.envStage = 'idle'; // 'attack', 'decay', 'sustain', 'release'
    this.attackTime = 0.02;  // Very soft attack (20ms)
    this.decayTime = 0.1;    // Gentle decay (100ms)
    this.sustainLevel = 0.4; // Lower sustain level
    this.releaseTime = 1.5;  // Long, smooth release
    this.envTimer = 0;
    
    // Note parameters
    this.amp = 0;
    this.timbre = 0.5; // Controls wave type selection
    this.noteDuration = 0;
    
    // Soft lowpass filter state
    this.filterState = 0;
    this.filterCutoff = 0.05; // Much darker filter
    
    // Timing
    this.startFrame = 0;
    this.endFrame = 0;
  }

  noteOn(startFrame, freq, dur, amp, timbre) {
    this.state = VOICE_ATTACK;
    this.freq = freq;
    this.amp = amp * 2.0; // Increase volume significantly for debugging
    this.timbre = Math.max(0, Math.min(1, timbre));
    this.startFrame = startFrame;
    this.endFrame = startFrame + dur;
    this.noteDuration = dur;
    
    // Select wave type based on timbre
    if (this.timbre < 0.33) {
      this.waveType = 'sine';    // Pure, soft sine waves
    } else if (this.timbre < 0.67) {
      this.waveType = 'square';  // Soft square waves
    } else {
      this.waveType = 'saw';     // Gentle saw waves
    }
    
    // Very dark filter for all wave types
    this.filterCutoff = 0.02 + this.timbre * 0.03; // Much darker range
    
    // Start gentle ADSR envelope
    this.envLevel = 0;
    this.envStage = 'attack';
    this.envTimer = 0;
  }

  noteOff() {
    if (this.state === VOICE_IDLE) return;
    
    this.state = VOICE_RELEASE;
    this.envStage = 'release';
    this.envTimer = 0;
  }

  process(currentFrame, sampleRate) {
    if (this.state === VOICE_IDLE) return 0;
    
    // Check if note should end (but allow release to finish naturally)
    if (currentFrame >= this.endFrame && this.envStage !== 'release') {
      this.noteOff();
    }
    
    // Update ADSR envelope
    this.updateEnvelope(sampleRate);
    
    // Generate audio if envelope is active
    if (this.envLevel <= 0.001) {
      if (this.envStage === 'release') {
        this.state = VOICE_IDLE;
        this.envStage = 'idle';
      }
      return 0;
    }
    
    // Generate pure waveform
    const sample = this.generateSample(sampleRate);
    
    // Apply envelope and amplitude
    return sample * this.envLevel * this.amp;
  }

  updateEnvelope(sampleRate) {
    const dt = 1.0 / sampleRate;
    this.envTimer += dt;
    
    switch (this.envStage) {
      case 'attack':
        // Exponential attack for very smooth onset
        this.envLevel = 1.0 - Math.exp(-this.envTimer / (this.attackTime * 0.3));
        if (this.envTimer >= this.attackTime) {
          this.envStage = 'decay';
          this.envTimer = 0;
        }
        break;
        
      case 'decay':
        // Smooth decay to sustain level
        const decayProgress = this.envTimer / this.decayTime;
        this.envLevel = this.sustainLevel + (1.0 - this.sustainLevel) * Math.exp(-decayProgress * 3);
        if (this.envTimer >= this.decayTime) {
          this.envStage = 'sustain';
          this.envLevel = this.sustainLevel;
        }
        break;
        
      case 'sustain':
        // Hold at sustain level
        this.envLevel = this.sustainLevel;
        break;
        
      case 'release':
        // Very smooth exponential release
        this.envLevel = this.sustainLevel * Math.exp(-this.envTimer / (this.releaseTime * 0.5));
        if (this.envLevel <= 0.001) {
          this.envLevel = 0;
          this.envStage = 'idle';
        }
        break;
    }
  }

  generateSample(sampleRate) {
    // Update oscillator phase
    const phaseIncrement = (this.freq * 2 * Math.PI) / sampleRate;
    this.phase += phaseIncrement;
    if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
    
    let sample;
    
    switch (this.waveType) {
      case 'sine':
        // Pure sine wave - softest possible sound
        sample = Math.sin(this.phase);
        break;
        
      case 'square':
        // Soft square wave with rounded edges
        const squareBase = this.phase < Math.PI ? 1 : -1;
        // Apply gentle lowpass to remove harshness
        sample = squareBase * 0.6;
        break;
        
      case 'saw':
        // Gentle sawtooth with reduced harmonics
        const t = this.phase / (2 * Math.PI);
        sample = (2 * t - 1) * 0.5; // Much gentler level
        break;
        
      default:
        sample = Math.sin(this.phase);
    }
    
    // Apply multi-stage lowpass filtering for extra smoothness
    this.filterState += (sample - this.filterState) * this.filterCutoff;
    const filtered = this.filterState;
    
    // Second stage of filtering for ultra-smooth sound
    this.filterState += (filtered - this.filterState) * this.filterCutoff * 0.5;
    
    return this.filterState;
  }

  isActive() {
    return this.state !== VOICE_IDLE;
  }
}

class CreatureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Voice pool
    this.voices = [];
    this.numVoices = 32;
    
    // Initialize voices
    for (let i = 0; i < this.numVoices; i++) {
      this.voices.push(new Voice(i));
    }
    
    // Note event queue
    this.noteEvents = [];
    
    // Frame counter for timing
    this.currentFrame = 0;
    
    // Reverb state (simple comb filter + allpass)
    this.reverbDelayLines = [];
    this.reverbAllpass = [];
    this.initializeReverb();
    
    // Delay effect state
    this.delayBuffer = new Float32Array(Math.round(48000 * 0.25)); // 250ms max delay
    this.delayBuffer.fill(0); // Initialize to silence
    this.delayWritePos = 0;
    this.delayTime = 0.15; // 150ms delay
    this.delayFeedback = 0.25; // Gentle feedback
    this.delayMix = 0.2; // Subtle delay mix
    
    // Listen for note batches
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    
    console.log(`CreatureProcessor initialized with ${this.numVoices} voices, reverb, and delay`);
  }
  
  initializeReverb() {
    // Reverb parameters for a warm, spacious sound
    const combDelayTimes = [0.03, 0.032, 0.034, 0.037]; // Various comb delays
    const allpassDelayTimes = [0.005, 0.017]; // Allpass delays for diffusion
    
    // Initialize comb filters
    for (let i = 0; i < combDelayTimes.length; i++) {
      const delayLength = Math.round(48000 * combDelayTimes[i]);
      const buffer = new Float32Array(delayLength);
      buffer.fill(0); // Initialize to silence
      this.reverbDelayLines.push({
        buffer,
        writePos: 0,
        feedback: 0.5, // Moderate feedback for warmth
        damping: 0.2,  // High frequency damping
        lastOutput: 0  // Initialize damping state
      });
    }
    
    // Initialize allpass filters
    for (let i = 0; i < allpassDelayTimes.length; i++) {
      const delayLength = Math.round(48000 * allpassDelayTimes[i]);
      const buffer = new Float32Array(delayLength);
      buffer.fill(0); // Initialize to silence
      this.reverbAllpass.push({
        buffer,
        writePos: 0,
        gain: 0.7
      });
    }
  }

  handleMessage(data) {
    if (data.type === 'notes' && data.events) {
      // Add events to queue, converting time to frames
      for (const event of data.events) {
        const startFrame = Math.round(event.startTime * sampleRate);
        const durFrames = Math.round(event.dur * sampleRate);
        
        this.noteEvents.push({
          startFrame,
          freq: event.freq,
          dur: durFrames,
          amp: event.amp,
          timbre: event.timbre
        });
      }
      
      // Sort by start time
      this.noteEvents.sort((a, b) => a.startFrame - b.startFrame);
      
      console.log(`Queued ${data.events.length} note events from agents`);
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const blockSize = output[0].length;
    
    // Process each sample
    for (let i = 0; i < blockSize; i++) {
      const frameIndex = this.currentFrame + i;
      
      // Check for new note events
      this.processNoteEvents(frameIndex);
      
      // Generate dry audio from all active voices
      let drySample = 0;
      for (const voice of this.voices) {
        drySample += voice.process(frameIndex, sampleRate);
      }
      
      // Apply gentle limiting to dry signal
      drySample = Math.tanh(drySample * 0.5) * 0.4;
      
      // Safety check for NaN/Infinity
      if (!isFinite(drySample)) drySample = 0;
      
      // Apply delay effect
      const delayedSample = this.processDelay(drySample);
      
      // Apply reverb effect
      const reverbSample = this.processReverb(drySample + delayedSample * 0.3);
      
      // Mix dry, delay, and reverb
      const wetSample = drySample * 1.0 + delayedSample * this.delayMix + reverbSample * 0.6;
      
      // Final safety check and gentle limiting - increase overall output
      let finalSample = Math.tanh(wetSample * 1.5) * 0.8;
      if (!isFinite(finalSample)) finalSample = 0;
      
      if (output.length > 0) output[0][i] = finalSample;
      if (output.length > 1) output[1][i] = finalSample;
    }
    
    // Update frame counter
    this.currentFrame += blockSize;
    
    return true;
  }
  
  processDelay(input) {
    // Safety check
    if (!isFinite(input)) input = 0;
    
    const delaySamples = Math.round(this.delayTime * 48000);
    const readPos = (this.delayWritePos - delaySamples + this.delayBuffer.length) % this.delayBuffer.length;
    
    const delayedSample = this.delayBuffer[readPos] || 0;
    
    // Write input + feedback to delay buffer with safety check
    const feedbackSample = input + delayedSample * this.delayFeedback;
    this.delayBuffer[this.delayWritePos] = isFinite(feedbackSample) ? feedbackSample : 0;
    this.delayWritePos = (this.delayWritePos + 1) % this.delayBuffer.length;
    
    return isFinite(delayedSample) ? delayedSample : 0;
  }
  
  processReverb(input) {
    // Safety check
    if (!isFinite(input)) input = 0;
    
    let reverbSample = 0;
    
    // Process through comb filters
    for (const comb of this.reverbDelayLines) {
      const delayedSample = comb.buffer[comb.writePos] || 0;
      
      // Apply damping (simple lowpass) with safety checks
      const dampedFeedback = delayedSample * comb.feedback * (1 - comb.damping) + 
                            (comb.lastOutput || 0) * comb.damping;
      comb.lastOutput = isFinite(dampedFeedback) ? dampedFeedback : 0;
      
      const newSample = input + comb.lastOutput;
      comb.buffer[comb.writePos] = isFinite(newSample) ? newSample : 0;
      comb.writePos = (comb.writePos + 1) % comb.buffer.length;
      
      if (isFinite(delayedSample)) {
        reverbSample += delayedSample;
      }
    }
    
    // Process through allpass filters for diffusion
    for (const allpass of this.reverbAllpass) {
      const delayedSample = allpass.buffer[allpass.writePos] || 0;
      const newSample = reverbSample + delayedSample * allpass.gain;
      allpass.buffer[allpass.writePos] = isFinite(newSample) ? newSample : 0;
      reverbSample = delayedSample - reverbSample * allpass.gain;
      allpass.writePos = (allpass.writePos + 1) % allpass.buffer.length;
      
      if (!isFinite(reverbSample)) reverbSample = 0;
    }
    
    return isFinite(reverbSample) ? reverbSample * 0.15 : 0; // Gentle reverb level
  }

  processNoteEvents(currentFrame) {
    // Process events that should start now
    while (this.noteEvents.length > 0 && this.noteEvents[0].startFrame <= currentFrame) {
      const event = this.noteEvents.shift();
      this.triggerNote(event);
    }
  }

  triggerNote(event) {
    // Find an idle voice
    let voice = null;
    for (const v of this.voices) {
      if (!v.isActive()) {
        voice = v;
        break;
      }
    }
    
    // If no idle voice, steal the oldest
    if (!voice) {
      let oldestFrame = Infinity;
      for (const v of this.voices) {
        if (v.startFrame < oldestFrame) {
          oldestFrame = v.startFrame;
          voice = v;
        }
      }
    }
    
    if (voice) {
      voice.noteOn(
        event.startFrame,
        event.freq,
        event.dur,
        event.amp,
        event.timbre
      );
    } else {
      console.warn('CreatureProcessor: No voice available for note');
    }
  }
}

registerProcessor('creature-processor', CreatureProcessor);
