/**
 * Simulation Worker - Updates environment state continuously
 * Generates slowly evolving environment parameters using LFOs and random walk
 */

interface EnvironmentState {
  light: number;
  wind: number;
  humidity: number;
  temperature: number;
}

interface WorkerMessage {
  type: "start" | "stop" | "update";
  data?: EnvironmentState;
}

class EnvironmentSimulator {
  private isRunning = false;
  private intervalId: number | null = null;
  private time = 0;

  // Current state
  private state: EnvironmentState = {
    light: 0.5,
    wind: 0.3,
    humidity: 0.6,
    temperature: 0.4,
  };

  // LFO frequencies (very slow, in Hz)
  private lfoFreqs = {
    light: 0.0081, // ~123 second period
    wind: 0.0127, // ~78 second period
    humidity: 0.0095, // ~105 second period
    temperature: 0.0073, // ~137 second period
  };

  // Random walk parameters
  private walkAmounts = {
    light: 0.001,
    wind: 0.0015,
    humidity: 0.0012,
    temperature: 0.0008,
  };

  // LFO amplitudes
  private lfoAmps = {
    light: 0.15,
    wind: 0.2,
    humidity: 0.18,
    temperature: 0.12,
  };

  // Base values (centers for oscillation)
  private baseValues = {
    light: 0.5,
    wind: 0.3,
    humidity: 0.6,
    temperature: 0.4,
  };

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.time = 0;

    // Update every 200ms as specified
    this.intervalId = setInterval(() => {
      this.updateState();
      this.postUpdate();
    }, 200) as unknown as number;

    console.log("Environment simulator started");
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log("Environment simulator stopped");
  }

  private updateState(): void {
    // Increment time (in seconds)
    this.time += 0.2;

    // Update each parameter with LFO + random walk
    for (const param in this.state) {
      const key = param as keyof EnvironmentState;

      // LFO component
      const lfoValue = Math.sin(this.time * this.lfoFreqs[key] * 2 * Math.PI);
      const lfoContribution = lfoValue * this.lfoAmps[key];

      // Random walk component
      const randomWalk = (Math.random() - 0.5) * this.walkAmounts[key];

      // Update base value with random walk (with bounds)
      this.baseValues[key] += randomWalk;
      this.baseValues[key] = Math.max(0.1, Math.min(0.9, this.baseValues[key]));

      // Combine base + LFO
      let newValue = this.baseValues[key] + lfoContribution;

      // Clamp to 0-1 range
      newValue = Math.max(0.0, Math.min(1.0, newValue));

      this.state[key] = newValue;
    }
  }

  private postUpdate(): void {
    const message: WorkerMessage = {
      type: "update",
      data: { ...this.state },
    };

    self.postMessage(message);
  }
}

// Create simulator instance
const simulator = new EnvironmentSimulator();

// Handle messages from main thread
self.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  switch (type) {
    case "start":
      simulator.start();
      break;

    case "stop":
      simulator.stop();
      break;

    default:
      console.warn("Unknown message type:", type);
  }
});

// Export for TypeScript (though not used in worker context)
export {};
