/**
 * Creatures Audio Service
 * Loads and manages the CreatureProcessor worklet for polyphonic synthesis
 */

export interface NoteEvent {
  startTime: number; // Audio time in seconds
  freq: number; // Frequency in Hz
  dur: number; // Duration in seconds
  amp: number; // Amplitude 0-1
  timbre: number; // Timbre parameter 0-1
}

export interface NoteBatch {
  type: "notes";
  events: NoteEvent[];
}

class CreaturesService {
  private workletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private isLoaded = false;
  private audioContext: AudioContext | null = null;

  /**
   * Initialize the creatures worklet
   */
  async initialize(audioContext: AudioContext): Promise<void> {
    try {
      this.audioContext = audioContext;

      // Load the worklet module
      await audioContext.audioWorklet.addModule(
        "/worklets/creature-processor.js"
      );

      // Create the worklet node
      this.workletNode = new AudioWorkletNode(
        audioContext,
        "creature-processor",
        {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2], // Stereo output
        }
      );

      // Create a gain node for volume control
      this.gainNode = audioContext.createGain();
      this.gainNode.gain.value = 0.7; // Conservative level

      // Connect the worklet to the gain node
      this.workletNode.connect(this.gainNode);

      this.isLoaded = true;
      console.log("Creatures worklet loaded successfully");
    } catch (error) {
      console.error("Failed to load creatures worklet:", error);
      throw error;
    }
  }

  /**
   * Start the creatures audio (connect to destination)
   */
  start(): void {
    if (!this.isLoaded || !this.gainNode || !this.audioContext) {
      throw new Error("Creatures service not initialized");
    }

    // Connect to the audio context destination
    this.gainNode.connect(this.audioContext.destination);
  }

  /**
   * Stop the creatures audio (disconnect from destination)
   */
  stop(): void {
    if (!this.isLoaded || !this.gainNode) {
      return;
    }

    this.gainNode.disconnect();
  }

  /**
   * Schedule a batch of note events
   */
  schedule(batch: NoteBatch): void {
    if (!this.workletNode) {
      console.warn("Cannot schedule notes: worklet not loaded");
      return;
    }

    // Send the batch to the worklet
    this.workletNode.port.postMessage(batch);
  }

  /**
   * Schedule a single note event (convenience method)
   */
  playNote(
    startTime: number,
    freq: number,
    dur: number,
    amp: number = 0.5,
    timbre: number = 0.5
  ): void {
    const batch: NoteBatch = {
      type: "notes",
      events: [{ startTime, freq, dur, amp, timbre }],
    };
    this.schedule(batch);
  }

  /**
   * Set master gain
   */
  setGain(gain: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, gain));
    }
  }

  /**
   * Set audio effect parameter in the worklet
   */
  setEffectParameter(param: string, value: number): void {
    if (!this.workletNode) {
      console.warn("Cannot set effect parameter: worklet not loaded");
      return;
    }

    // Send parameter update to the worklet
    this.workletNode.port.postMessage({
      type: "setEffectParameter",
      parameterName: param,
      parameterValue: value,
    });
  }

  /**
   * Test method: play a single note immediately for debugging
   */
  testNote(): void {
    if (!this.audioContext) {
      console.warn("Cannot test note: audio context not available");
      return;
    }

    const currentTime = this.audioContext.currentTime;
    console.log(`[TEST NOTE] Starting test note at audio time: ${currentTime}`);

    this.playNote(
      currentTime + 0.1, // Start in 100ms
      440, // A4
      2.0, // 2 second duration
      0.5, // Medium amplitude
      0.3 // Medium timbre (sine wave)
    );

    console.log(`[TEST NOTE] Test note scheduled for ${currentTime + 0.1}`);
  }

  /**
   * Check if the service is loaded and ready
   */
  get loaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Get current audio context time
   */
  get currentTime(): number {
    return this.audioContext?.currentTime ?? 0;
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
export const creaturesService = new CreaturesService();

// Export the class for potential testing
export { CreaturesService };
