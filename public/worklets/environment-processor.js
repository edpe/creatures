/**
 * EnvironmentProcessor - AudioWorklet for ambient environment sounds
 * Generates quiet ambient bed with pink noise and gentle drone
 */

class EnvironmentProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'light',
        defaultValue: 0.5,
        minValue: 0.0,
        maxValue: 1.0,
        automationRate: 'k-rate'
      },
      {
        name: 'wind',
        defaultValue: 0.3,
        minValue: 0.0,
        maxValue: 1.0,
        automationRate: 'k-rate'
      },
      {
        name: 'humidity',
        defaultValue: 0.6,
        minValue: 0.0,
        maxValue: 1.0,
        automationRate: 'k-rate'
      },
      {
        name: 'temperature',
        defaultValue: 0.4,
        minValue: 0.0,
        maxValue: 1.0,
        automationRate: 'k-rate'
      },
      {
        name: 'masterGain',
        defaultValue: 0.15, // Conservative level for -12dBFS headroom
        minValue: 0.0,
        maxValue: 0.5,
        automationRate: 'k-rate'
      }
    ];
  }

  constructor() {
    super();
    
    // Pink noise state (Voss-McCartney algorithm)
    this.pinkState = new Array(7).fill(0);
    this.pinkRange = 128;
    
    // Drone oscillators state
    this.dronePhase1 = 0;
    this.dronePhase2 = 0;
    this.droneFreq1 = 65.4; // C2
    this.droneFreq2 = 98.0; // G2 (fifth)
    
    // Low-pass filter state
    this.lpfState = 0;
    this.lpfCutoff = 0.02; // Very gentle filtering
    
    // Smoothing for parameters (1-3 second smoothing)
    this.smoothingRate = 0.002; // Approximately 2 second smoothing at 44.1kHz
    this.smoothedParams = {
      light: 0.5,
      wind: 0.3,
      humidity: 0.6,
      temperature: 0.4,
      masterGain: 0.15
    };
    
    // Wow/flutter LFO
    this.lfoPhase = 0;
    this.lfoRate = 0.1; // Very slow modulation
  }

  // Pink noise generator using Voss-McCartney algorithm
  generatePinkNoise() {
    let white = Math.random() * 2 - 1;
    
    // Apply Voss-McCartney algorithm
    this.pinkState[0] = 0.99886 * this.pinkState[0] + white * 0.0555179;
    this.pinkState[1] = 0.99332 * this.pinkState[1] + white * 0.0750759;
    this.pinkState[2] = 0.96900 * this.pinkState[2] + white * 0.1538520;
    this.pinkState[3] = 0.86650 * this.pinkState[3] + white * 0.3104856;
    this.pinkState[4] = 0.55000 * this.pinkState[4] + white * 0.5329522;
    this.pinkState[5] = -0.7616 * this.pinkState[5] - white * 0.0168980;
    
    let pink = this.pinkState[0] + this.pinkState[1] + this.pinkState[2] + 
               this.pinkState[3] + this.pinkState[4] + this.pinkState[5] + 
               this.pinkState[6] + white * 0.5362;
    
    this.pinkState[6] = white * 0.115926;
    
    return pink * 0.11; // Scale down for gentle level
  }

  // Simple triangle wave with BLEP-like characteristics
  generateTriangle(phase) {
    let t = phase % (2 * Math.PI);
    let triangle;
    
    if (t < Math.PI) {
      triangle = (2 * t / Math.PI) - 1;
    } else {
      triangle = 3 - (2 * t / Math.PI);
    }
    
    // Simple anti-aliasing approximation
    return triangle * 0.7; // Reduce level
  }

  // Smooth parameter changes
  smoothParameters(currentParams) {
    for (let param in this.smoothedParams) {
      let target = currentParams[param][0]; // Get first value from parameter array
      this.smoothedParams[param] += (target - this.smoothedParams[param]) * this.smoothingRate;
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const blockSize = output[0].length;
    
    // Smooth parameter changes
    this.smoothParameters(parameters);
    
    const { light, wind, humidity, temperature, masterGain } = this.smoothedParams;
    
    // Calculate modulation amounts based on environment parameters
    const noiseLevel = wind * 0.3 + humidity * 0.2; // Wind and humidity affect noise
    const droneDetune = (temperature - 0.5) * 0.02; // Temperature affects tuning slightly
    const brightness = light * 0.5 + 0.3; // Light affects filter brightness
    
    // Update LFO for wow/flutter
    const lfoIncrement = (this.lfoRate * 2 * Math.PI) / sampleRate;
    
    for (let i = 0; i < blockSize; i++) {
      // Generate pink noise
      const noise = this.generatePinkNoise() * noiseLevel;
      
      // Update LFO phase
      this.lfoPhase += lfoIncrement;
      if (this.lfoPhase > 2 * Math.PI) this.lfoPhase -= 2 * Math.PI;
      
      // Slight wow/flutter modulation
      const lfoValue = Math.sin(this.lfoPhase) * 0.001; // Very subtle
      
      // Generate drone tones with slight modulation
      const freq1Mod = this.droneFreq1 * (1 + droneDetune + lfoValue);
      const freq2Mod = this.droneFreq2 * (1 + droneDetune * 0.7 + lfoValue * 0.8);
      
      const phase1Increment = (freq1Mod * 2 * Math.PI) / sampleRate;
      const phase2Increment = (freq2Mod * 2 * Math.PI) / sampleRate;
      
      this.dronePhase1 += phase1Increment;
      this.dronePhase2 += phase2Increment;
      
      if (this.dronePhase1 > 2 * Math.PI) this.dronePhase1 -= 2 * Math.PI;
      if (this.dronePhase2 > 2 * Math.PI) this.dronePhase2 -= 2 * Math.PI;
      
      // Generate triangle waves
      const drone1 = this.generateTriangle(this.dronePhase1);
      const drone2 = this.generateTriangle(this.dronePhase2);
      
      // Mix drone tones - increased level for better audibility
      const droneMix = (drone1 * 0.6 + drone2 * 0.4) * 0.25; // Increased from 0.08
      
      // Combine noise and drone
      let sample = noise + droneMix;
      
      // Apply low-pass filter with brightness control
      const cutoffMod = this.lpfCutoff * (brightness * 2); // Light affects brightness
      this.lpfState += (sample - this.lpfState) * cutoffMod;
      sample = this.lpfState;
      
      // Apply master gain
      sample *= masterGain;
      
      // Debug: Occasionally log output level
      if (Math.random() < 0.00001) { // Very rare logging
        console.log(`Environment output: ${sample.toFixed(4)}, noise: ${noise.toFixed(4)}, drone: ${droneMix.toFixed(4)}`);
      }
      
      // Output to both channels (mono to stereo)
      if (output.length > 0) output[0][i] = sample;
      if (output.length > 1) output[1][i] = sample;
    }
    
    return true;
  }
}

registerProcessor('environment-processor', EnvironmentProcessor);
