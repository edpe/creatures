/**
 * Environment Audio Service
 * Loads and manages the EnvironmentWorklet for ambient sound generation
 */

export interface EnvironmentParameters {
  light: number;
  wind: number;
  humidity: number;
  temperature: number;
  masterGain: number;
}

class EnvironmentService {
  private workletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private isLoaded = false;
  private audioContext: AudioContext | null = null;

  /**
   * Initialize the environment worklet
   */
  async initialize(audioContext: AudioContext): Promise<void> {
    try {
      this.audioContext = audioContext;
      
      // Load the worklet module
      await audioContext.audioWorklet.addModule('/worklets/environment-processor.js');
      
      // Create the worklet node
      this.workletNode = new AudioWorkletNode(audioContext, 'environment-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2], // Stereo output
      });

      // Create a gain node for additional volume control
      this.gainNode = audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Connect the worklet to the gain node
      this.workletNode.connect(this.gainNode);
      
      this.isLoaded = true;
      console.log('Environment worklet loaded successfully');
    } catch (error) {
      console.error('Failed to load environment worklet:', error);
      throw error;
    }
  }

  /**
   * Start the environment audio (connect to destination)
   */
  start(): void {
    if (!this.isLoaded || !this.gainNode || !this.audioContext) {
      throw new Error('Environment service not initialized');
    }

    // Connect to the audio context destination
    this.gainNode.connect(this.audioContext.destination);
  }

  /**
   * Stop the environment audio (disconnect from destination)
   */
  stop(): void {
    if (!this.isLoaded || !this.gainNode) {
      return;
    }

    this.gainNode.disconnect();
  }

  /**
   * Update environment parameters
   */
  setParameters(params: Partial<EnvironmentParameters>): void {
    if (!this.workletNode) {
      console.warn('Cannot set parameters: worklet not loaded');
      return;
    }

    // Update each parameter if provided
    if (params.light !== undefined) {
      this.workletNode.parameters.get('light')?.setValueAtTime(
        params.light, 
        this.audioContext!.currentTime
      );
    }
    
    if (params.wind !== undefined) {
      this.workletNode.parameters.get('wind')?.setValueAtTime(
        params.wind, 
        this.audioContext!.currentTime
      );
    }
    
    if (params.humidity !== undefined) {
      this.workletNode.parameters.get('humidity')?.setValueAtTime(
        params.humidity, 
        this.audioContext!.currentTime
      );
    }
    
    if (params.temperature !== undefined) {
      this.workletNode.parameters.get('temperature')?.setValueAtTime(
        params.temperature, 
        this.audioContext!.currentTime
      );
    }
    
    if (params.masterGain !== undefined) {
      this.workletNode.parameters.get('masterGain')?.setValueAtTime(
        params.masterGain, 
        this.audioContext!.currentTime
      );
    }
  }

  /**
   * Get current parameter values
   */
  getParameters(): EnvironmentParameters {
    if (!this.workletNode) {
      // Return defaults if not loaded
      return {
        light: 0.5,
        wind: 0.3,
        humidity: 0.6,
        temperature: 0.4,
        masterGain: 0.15
      };
    }

    return {
      light: this.workletNode.parameters.get('light')?.value ?? 0.5,
      wind: this.workletNode.parameters.get('wind')?.value ?? 0.3,
      humidity: this.workletNode.parameters.get('humidity')?.value ?? 0.6,
      temperature: this.workletNode.parameters.get('temperature')?.value ?? 0.4,
      masterGain: this.workletNode.parameters.get('masterGain')?.value ?? 0.15
    };
  }

  /**
   * Check if the service is loaded and ready
   */
  get loaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    
    if (this.workletNode) {
      this.workletNode.disconnect();
    }
    
    this.workletNode = null;
    this.gainNode = null;
    this.audioContext = null;
    this.isLoaded = false;
  }
}

// Export singleton instance
export const environmentService = new EnvironmentService();

// Export the class for potential testing
export { EnvironmentService };
