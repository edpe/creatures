/**
 * Environment Audio Service
 * Loads and manages the EnvironmentWorklet for ambient sound generation
 * Receives updates from simulation worker and applies them with look-ahead
 */

import SimWorker from "../workers/sim.worker.ts?worker";
import { creaturesService } from "./creatures";

export interface EnvironmentParameters {
  light: number;
  wind: number;
  humidity: number;
  temperature: number;
  masterGain: number;
}

export interface PhaseSnapshot {
  tAudio: number;
  agents: Array<{
    id: number;
    beatPhase: number;
    phrasePhase: number;
  }>;
  globalBeatPhase: number;
}

interface NoteEvent {
  startTime: number; // Audio time in seconds
  freq: number; // Frequency in Hz
  dur: number; // Duration in seconds
  amp: number; // Amplitude 0-1
  timbre: number; // Timbre parameter 0-1
}

interface NoteBatch {
  type: "notes";
  events: NoteEvent[];
}

interface WorkerMessage {
  type: "start" | "stop" | "update" | "phase" | "notes";
  data?: Omit<EnvironmentParameters, "masterGain"> | PhaseSnapshot | NoteBatch;
}

class EnvironmentService {
  private workletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private isLoaded = false;
  private audioContext: AudioContext | null = null;
  private simWorker: Worker | null = null;
  private isSimulationRunning = false;

  // Look-ahead time for parameter scheduling (100ms as specified)
  private readonly LOOK_AHEAD_TIME = 0.1;
  
  // Timing constants for scheduling
  public static readonly LOOKAHEAD_MS = 100;
  public static readonly DISPATCH_MS = 50;

  // Event listeners for parameter updates
  private updateListeners: ((
    params: Omit<EnvironmentParameters, "masterGain">
  ) => void)[] = [];

  // Phase snapshot storage
  private currentPhaseSnapshot: PhaseSnapshot | null = null;

  /**
   * Initialize the environment worklet
   */
  async initialize(audioContext: AudioContext): Promise<void> {
    try {
      this.audioContext = audioContext;

      // Load the worklet module
      await audioContext.audioWorklet.addModule(
        "/worklets/environment-processor.js"
      );

      // Create the worklet node
      this.workletNode = new AudioWorkletNode(
        audioContext,
        "environment-processor",
        {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2], // Stereo output
        }
      );

      // Create a gain node for additional volume control
      this.gainNode = audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Connect the worklet to the gain node
      this.workletNode.connect(this.gainNode);

      // Initialize the simulation worker
      this.initializeWorker();

      this.isLoaded = true;
      console.log("Environment worklet loaded successfully");
    } catch (error) {
      console.error("Failed to load environment worklet:", error);
      throw error;
    }
  }

  /**
   * Initialize the simulation worker
   */
  private initializeWorker(): void {
    this.simWorker = new SimWorker();

    if (this.simWorker) {
      this.simWorker.addEventListener(
        "message",
        (event: MessageEvent<WorkerMessage>) => {
          this.handleWorkerMessage(event.data);
        }
      );

      this.simWorker.addEventListener("error", (error) => {
        console.error("Simulation worker error:", error);
      });
    }
  }

  /**
   * Handle messages from the simulation worker
   */
  private handleWorkerMessage(message: WorkerMessage): void {
    if (message.type === "update" && message.data) {
      // Environment parameter update
      const envData = message.data as Omit<EnvironmentParameters, "masterGain">;
      this.applyWorkerUpdate(envData);

      // Notify listeners
      this.updateListeners.forEach((listener) => listener(envData));
    } else if (message.type === "phase" && message.data) {
      // Phase snapshot update
      const phaseData = message.data as PhaseSnapshot;
      this.currentPhaseSnapshot = phaseData;

      // Could emit phase events here if needed for UI
      // For now, just store the snapshot for future note scheduling
    } else if (message.type === "notes" && message.data) {
      // Note batch from agent beat crossings
      const noteBatch = message.data as NoteBatch;
      this.forwardNotesToCreatures(noteBatch);
    }
  }

  /**
   * Forward note batches to the creatures service
   */
  private forwardNotesToCreatures(noteBatch: NoteBatch): void {
    try {
      creaturesService.schedule(noteBatch);
      console.log(
        `Forwarded ${noteBatch.events.length} notes from agents to creatures`
      );
    } catch (error) {
      console.error("Failed to forward notes to creatures service:", error);
    }
  }

  /**
   * Apply parameter updates from worker with look-ahead scheduling
   */
  private applyWorkerUpdate(
    params: Omit<EnvironmentParameters, "masterGain">
  ): void {
    if (!this.workletNode || !this.audioContext) {
      return;
    }

    const scheduleTime = this.audioContext.currentTime + this.LOOK_AHEAD_TIME;

    // Schedule parameter changes with look-ahead
    this.workletNode.parameters
      .get("light")
      ?.setValueAtTime(params.light, scheduleTime);
    this.workletNode.parameters
      .get("wind")
      ?.setValueAtTime(params.wind, scheduleTime);
    this.workletNode.parameters
      .get("humidity")
      ?.setValueAtTime(params.humidity, scheduleTime);
    this.workletNode.parameters
      .get("temperature")
      ?.setValueAtTime(params.temperature, scheduleTime);
  }

  /**
   * Start the environment audio (connect to destination)
   */
  start(): void {
    if (!this.isLoaded || !this.gainNode || !this.audioContext) {
      throw new Error("Environment service not initialized");
    }

    // Connect to the audio context destination
    this.gainNode.connect(this.audioContext.destination);

    // Start the simulation worker
    this.startSimulation();
  }

  /**
   * Stop the environment audio (disconnect from destination)
   */
  stop(): void {
    if (!this.isLoaded || !this.gainNode) {
      return;
    }

    this.gainNode.disconnect();

    // Stop the simulation worker
    this.stopSimulation();
  }

  /**
   * Start the simulation worker
   */
  startSimulation(): void {
    if (this.simWorker && !this.isSimulationRunning) {
      this.simWorker.postMessage({ type: "start" });
      this.isSimulationRunning = true;
      console.log("Environment simulation started");
    }
  }

  /**
   * Stop the simulation worker
   */
  stopSimulation(): void {
    if (this.simWorker && this.isSimulationRunning) {
      this.simWorker.postMessage({ type: "stop" });
      this.isSimulationRunning = false;
      console.log("Environment simulation stopped");
    }
  }

  /**
   * Update environment parameters
   */
  setParameters(params: Partial<EnvironmentParameters>): void {
    if (!this.workletNode) {
      console.warn("Cannot set parameters: worklet not loaded");
      return;
    }

    // Update each parameter if provided
    if (params.light !== undefined) {
      this.workletNode.parameters
        .get("light")
        ?.setValueAtTime(params.light, this.audioContext!.currentTime);
    }

    if (params.wind !== undefined) {
      this.workletNode.parameters
        .get("wind")
        ?.setValueAtTime(params.wind, this.audioContext!.currentTime);
    }

    if (params.humidity !== undefined) {
      this.workletNode.parameters
        .get("humidity")
        ?.setValueAtTime(params.humidity, this.audioContext!.currentTime);
    }

    if (params.temperature !== undefined) {
      this.workletNode.parameters
        .get("temperature")
        ?.setValueAtTime(params.temperature, this.audioContext!.currentTime);
    }

    if (params.masterGain !== undefined) {
      this.workletNode.parameters
        .get("masterGain")
        ?.setValueAtTime(params.masterGain, this.audioContext!.currentTime);
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
        masterGain: 0.15,
      };
    }

    return {
      light: this.workletNode.parameters.get("light")?.value ?? 0.5,
      wind: this.workletNode.parameters.get("wind")?.value ?? 0.3,
      humidity: this.workletNode.parameters.get("humidity")?.value ?? 0.6,
      temperature: this.workletNode.parameters.get("temperature")?.value ?? 0.4,
      masterGain: this.workletNode.parameters.get("masterGain")?.value ?? 0.15,
    };
  }

  /**
   * Check if the service is loaded and ready
   */
  get loaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Add listener for parameter updates from simulation worker
   */
  addUpdateListener(
    listener: (params: Omit<EnvironmentParameters, "masterGain">) => void
  ): void {
    this.updateListeners.push(listener);
  }

  /**
   * Remove listener for parameter updates
   */
  removeUpdateListener(
    listener: (params: Omit<EnvironmentParameters, "masterGain">) => void
  ): void {
    const index = this.updateListeners.indexOf(listener);
    if (index > -1) {
      this.updateListeners.splice(index, 1);
    }
  }

  /**
   * Get current phase snapshot from Kuramoto simulation
   */
  getCurrentPhaseSnapshot(): PhaseSnapshot | null {
    return this.currentPhaseSnapshot;
  }

  /**
   * Add a listener for environment parameter updates
   */
  onUpdate(
    listener: (params: Omit<EnvironmentParameters, "masterGain">) => void
  ): void {
    this.updateListeners.push(listener);
  }

  /**
   * Remove a listener for environment parameter updates
   */
  offUpdate(
    listener: (params: Omit<EnvironmentParameters, "masterGain">) => void
  ): void {
    const index = this.updateListeners.indexOf(listener);
    if (index > -1) {
      this.updateListeners.splice(index, 1);
    }
  }
  setMasterGain(gain: number): void {
    if (!this.gainNode) {
      return;
    }

    // Clamp to leave ~12 dB headroom (0.25 = -12dB)
    const clampedGain = Math.max(0, Math.min(0.25, gain * 0.25));
    
    // Apply soft-clipping curve for gentle limiting
    const softClipped = Math.tanh(clampedGain * 2) * 0.5;
    
    this.gainNode.gain.setValueAtTime(softClipped, this.audioContext?.currentTime || 0);
  }

  /**
   * Get current master gain level
   */
  getMasterGain(): number {
    return this.gainNode?.gain.value || 0;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Stop simulation first
    this.stopSimulation();

    // Terminate worker
    if (this.simWorker) {
      this.simWorker.terminate();
      this.simWorker = null;
    }

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
    this.isSimulationRunning = false;
  }
}

// Export singleton instance
export const environmentService = new EnvironmentService();

// Export the class for potential testing
export { EnvironmentService };
