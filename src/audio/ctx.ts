/**
 * Audio Context Service
 * Provides a singleton AudioContext with interactive latency hint
 * and helpers for managing audio state
 */

import { environmentService } from "./env";
import { creaturesService } from "./creatures";

class AudioService {
  private _context: AudioContext | null = null;
  private _isRunning = false;
  private _environmentLoaded = false;
  private _creaturesLoaded = false;
  
  // Parameter storage for real-time control
  private _parameters = {
    agentCount: 16,
    ambienceLevel: 0.7,
    tonicMidi: 57, // A3
    tempoBias: 1.0,
    couplingStrength: 0.15,
  };

  /**
   * Get the singleton AudioContext instance
   * Creates it if it doesn't exist with interactive latency hint
   */
  get context(): AudioContext {
    if (!this._context) {
      this._context = new AudioContext({
        latencyHint: "interactive",
      });
    }
    return this._context;
  }

  /**
   * Get the current running state
   */
  get isRunning(): boolean {
    return this._isRunning && this.context.state === "running";
  }

  /**
   * Start the audio context
   * Resumes the context if it's suspended (required for user gesture)
   */
  async start(): Promise<void> {
    try {
      if (this.context.state === "suspended") {
        await this.context.resume();
      }

      // Initialize environment service if not already loaded
      if (!this._environmentLoaded) {
        await environmentService.initialize(this.context);
        this._environmentLoaded = true;
      }

      // Initialize creatures service if not already loaded
      if (!this._creaturesLoaded) {
        await creaturesService.initialize(this.context);
        this._creaturesLoaded = true;
      }

      // Start both services
      environmentService.start();
      creaturesService.start();

      this._isRunning = true;
    } catch (error) {
      console.error("Failed to start audio context:", error);
      throw error;
    }
  }
  /**
   * Stop the audio context
   * Suspends the context to save resources
   */
  async stop(): Promise<void> {
    try {
      // Stop the environment audio
      environmentService.stop();
      // Stop the creatures audio
      creaturesService.stop();

      if (this.context.state === "running") {
        await this.context.suspend();
      }
      this._isRunning = false;
    } catch (error) {
      console.error("Failed to stop audio context:", error);
      throw error;
    }
  }

  /**
   * Get current audio context state
   */
  getState(): AudioContextState {
    return this.context.state;
  }

  /**
   * Test harness: Schedule a handful of notes in the next 200ms
   * Creates a pleasant pentatonic sequence to test creature synthesis
   */
  async testCreatureNotes(): Promise<void> {
    if (!this._isRunning) {
      console.warn("Audio context not running - cannot test creature notes");
      return;
    }

    const now = this.context.currentTime;
    const noteEvents = [
      // Gentle pentatonic sequence: C4, D4, E4, G4, A4
      { startTime: now + 0.01, freq: 261.63, dur: 0.15, amp: 0.4, timbre: 0.2 }, // C4
      {
        startTime: now + 0.05,
        freq: 293.66,
        dur: 0.12,
        amp: 0.3,
        timbre: 0.15,
      }, // D4
      {
        startTime: now + 0.09,
        freq: 329.63,
        dur: 0.18,
        amp: 0.5,
        timbre: 0.25,
      }, // E4
      { startTime: now + 0.13, freq: 392.0, dur: 0.14, amp: 0.35, timbre: 0.1 }, // G4
      {
        startTime: now + 0.17,
        freq: 440.0,
        dur: 0.16,
        amp: 0.45,
        timbre: 0.18,
      }, // A4
    ];
    const batch = {
      type: "notes" as const,
      events: noteEvents,
    };

    creaturesService.schedule(batch);
    console.log(
      `Scheduled ${noteEvents.length} test notes starting at ${now.toFixed(3)}s`
    );
  }

  /**
   * Get current sample rate
   */
  getSampleRate(): number {
    return this.context.sampleRate;
  }

  /**
   * Get environment service instance
   */
  get environment() {
    return environmentService;
  }

  /**
   * Update a control parameter
   */
  setParameter(param: string, value: number): void {
    if (param in this._parameters) {
      (this._parameters as any)[param] = value;
      
      // Apply parameter changes to running services
      switch (param) {
        case 'ambienceLevel':
          environmentService.setMasterGain(value);
          break;
        case 'couplingStrength':
          // TODO: Send to worker via message
          break;
        case 'tempoBias':
          // TODO: Send to worker via message
          break;
        // agentCount and tonicMidi require restart
      }
    }
  }

  /**
   * Get a control parameter value
   */
  getParameter(param: string): number {
    return (this._parameters as any)[param] || 0;
  }

  /**
   * Get all parameters
   */
  getAllParameters() {
    return { ...this._parameters };
  }

  /**
   * Force audio context resume for mobile unlock
   */
  async forceResume(): Promise<void> {
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }
}

// Export singleton instance
export const audioService = new AudioService();

// Export the class for potential testing
export { AudioService };
