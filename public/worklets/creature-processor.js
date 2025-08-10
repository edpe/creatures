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
    
    // Oscillator state for 2-op FM
    this.carrierPhase = 0;
    this.modulatorPhase = 0;
    this.freq = 440;
    this.modRatio = 1.5; // Modulator frequency ratio
    this.modDepth = 0;   // FM modulation depth
    
    // Envelope state
    this.envLevel = 0;
    this.envTarget = 0;
    this.envRate = 0;
    this.sustainLevel = 0.6;
    
    // Note parameters
    this.amp = 0;
    this.timbre = 0.5; // Controls modulation depth and filter
    this.releaseTime = 0;
    
    // One-pole filter state
    this.filterState = 0;
    this.filterCutoff = 0.1;
    
    // Timing
    this.startFrame = 0;
    this.endFrame = 0;
  }

  noteOn(startFrame, freq, dur, amp, timbre) {
    this.state = VOICE_ATTACK;
    this.freq = freq;
    this.amp = amp;
    this.timbre = Math.max(0, Math.min(1, timbre));
    this.startFrame = startFrame;
    this.endFrame = startFrame + dur;
    
    // Set envelope parameters based on timbre
    this.modDepth = this.timbre * 0.8; // Reduced modulation depth for softer sound
    this.filterCutoff = 0.08 + this.timbre * 0.2; // Darker filter for warmth
    
    // Gentler attack
    this.envTarget = this.sustainLevel;
    this.envRate = 0.005; // Slower attack rate for softer onset
  }

  noteOff() {
    if (this.state === VOICE_IDLE) return;
    
    this.state = VOICE_RELEASE;
    this.envTarget = 0;
    this.envRate = 0.001; // Slower release rate for smoother fade
  }

  process(currentFrame, sampleRate) {
    if (this.state === VOICE_IDLE) return 0;
    
    // Check if note should end
    if (currentFrame >= this.endFrame && this.state !== VOICE_RELEASE) {
      this.noteOff();
    }
    
    // Update envelope
    this.updateEnvelope();
    
    // Generate audio if envelope is active
    if (this.envLevel <= 0.001) {
      if (this.state === VOICE_RELEASE) {
        this.state = VOICE_IDLE;
      }
      return 0;
    }
    
    // 2-op FM synthesis
    const sample = this.generateSample(sampleRate);
    
    // Apply envelope and amplitude
    return sample * this.envLevel * this.amp;
  }

  updateEnvelope() {
    // Simple linear envelope
    if (this.envLevel < this.envTarget) {
      this.envLevel += this.envRate;
      if (this.envLevel >= this.envTarget) {
        this.envLevel = this.envTarget;
        if (this.state === VOICE_ATTACK) {
          this.state = VOICE_SUSTAIN;
        }
      }
    } else if (this.envLevel > this.envTarget) {
      this.envLevel -= this.envRate;
      if (this.envLevel <= this.envTarget) {
        this.envLevel = this.envTarget;
      }
    }
  }

  generateSample(sampleRate) {
    // Update oscillator phases
    const carrierIncrement = (this.freq * 2 * Math.PI) / sampleRate;
    const modulatorIncrement = (this.freq * this.modRatio * 2 * Math.PI) / sampleRate;
    
    this.modulatorPhase += modulatorIncrement;
    if (this.modulatorPhase > 2 * Math.PI) this.modulatorPhase -= 2 * Math.PI;
    
    // FM modulation
    const modulator = Math.sin(this.modulatorPhase);
    const modulation = modulator * this.modDepth;
    
    this.carrierPhase += carrierIncrement + modulation;
    if (this.carrierPhase > 2 * Math.PI) this.carrierPhase -= 2 * Math.PI;
    
    // Generate carrier with gentle harmonic content
    let carrier;
    if (this.timbre < 0.3) {
      // Pure sine wave for gentle sound
      carrier = Math.sin(this.carrierPhase);
    } else if (this.timbre < 0.7) {
      // Soft blend between sine and triangle
      const sine = Math.sin(this.carrierPhase);
      const t = this.carrierPhase / (2 * Math.PI);
      const triangle = t < 0.5 ? (4 * t - 1) : (3 - 4 * t);
      const blend = (this.timbre - 0.3) / 0.4; // 0-1 range
      carrier = sine * (1 - blend * 0.3) + triangle * blend * 0.2;
    } else {
      // Soft triangle with reduced harmonics
      const t = this.carrierPhase / (2 * Math.PI);
      carrier = t < 0.5 ? (4 * t - 1) : (3 - 4 * t);
      carrier *= 0.4; // Much gentler level
    }
    
    // Apply one-pole lowpass filter
    this.filterState += (carrier - this.filterState) * this.filterCutoff;
    
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
    
    // Listen for note batches
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    
    console.log(`CreatureProcessor initialized with ${this.numVoices} voices`);
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
      
      console.log(`Queued ${data.events.length} note events`);
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const blockSize = output[0].length;
    
    // Process each sample
    for (let i = 0; i < blockSize; i++) {
      const frameIndex = currentFrame + i;
      
      // Check for new note events
      this.processNoteEvents(frameIndex);
      
      // Generate audio from all active voices
      let sample = 0;
      for (const voice of this.voices) {
        sample += voice.process(frameIndex, sampleRate);
      }
      
      // Apply gentle limiting and output to both channels
      sample = Math.tanh(sample * 0.8) * 0.6; // Reduced gain for gentler sound
      
      if (output.length > 0) output[0][i] = sample;
      if (output.length > 1) output[1][i] = sample;
    }
    
    return true;
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
