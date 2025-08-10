/**
 * Audio Context Service
 * Provides a singleton AudioContext with interactive latency hint
 * and helpers for managing audio state
 */

import { environmentService } from './env';

class AudioService {
  private _context: AudioContext | null = null;
  private _isRunning = false;
  private _environmentLoaded = false;

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
      
      // Start the environment audio
      environmentService.start();
      
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
}

// Export singleton instance
export const audioService = new AudioService();

// Export the class for potential testing
export { AudioService };
