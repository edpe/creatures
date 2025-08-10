/**
 * Simulation Worker - Updates environment state continuously
 * Generates slowly evolving environment parameters using LFOs and random walk
 * Implements Kuramoto phase model for weakly coupled oscillators
 */

interface EnvironmentState {
  light: number;
  wind: number;
  humidity: number;
  temperature: number;
}

interface KuramotoAgent {
  id: number;
  beatPhase: number; // Phase for beat timing
  phrasePhase: number; // Phase for phrase structure
  beatOmega: number; // Natural beat frequency
  phraseOmega: number; // Natural phrase frequency
}

interface PhaseSnapshot {
  tAudio: number; // Audio time reference
  agents: Array<{
    id: number;
    beatPhase: number;
    phrasePhase: number;
  }>;
  globalBeatPhase: number; // Average beat phase for convenience
}

interface WorkerMessage {
  type: "start" | "stop" | "update" | "phase";
  data?: EnvironmentState | PhaseSnapshot;
}

class KuramotoSimulator {
  private agents: KuramotoAgent[] = [];
  private numAgents: number = 8; // Configurable number of agents
  private coupling: number = 0.15; // Weak coupling strength
  private dt: number = 0.05; // 50ms time step

  constructor() {
    this.initializeAgents();
  }

  private initializeAgents(): void {
    this.agents = [];

    for (let i = 0; i < this.numAgents; i++) {
      const agent: KuramotoAgent = {
        id: i,
        beatPhase: Math.random() * 2 * Math.PI, // Random initial phase
        phrasePhase: Math.random() * 2 * Math.PI,
        // Slightly different natural frequencies for each agent
        beatOmega: 1.0 + (Math.random() - 0.5) * 0.1, // ~1 Hz ± 5%
        phraseOmega: 0.25 + (Math.random() - 0.5) * 0.02, // ~0.25 Hz ± 1%
      };
      this.agents.push(agent);
    }

    console.log(`Initialized ${this.numAgents} Kuramoto agents`);
  }

  start(audioStartTime: number): void {
    console.log(`Kuramoto simulation started at audio time ${audioStartTime}`);
  }

  update(currentTime: number): PhaseSnapshot {
    // Update phases using Kuramoto model
    this.updatePhases();

    // Create snapshot
    const snapshot: PhaseSnapshot = {
      tAudio: currentTime,
      agents: this.agents.map((agent) => ({
        id: agent.id,
        beatPhase: agent.beatPhase,
        phrasePhase: agent.phrasePhase,
      })),
      globalBeatPhase: this.computeGlobalBeatPhase(),
    };

    return snapshot;
  }

  private updatePhases(): void {
    // Store current phases for coupling calculations
    const currentBeatPhases = this.agents.map((a) => a.beatPhase);
    const currentPhrasePhases = this.agents.map((a) => a.phrasePhase);

    // Update each agent using Kuramoto model
    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];

      // Calculate coupling for beat phase (ring topology)
      const leftNeighbor = (i - 1 + this.numAgents) % this.numAgents;
      const rightNeighbor = (i + 1) % this.numAgents;

      const beatCoupling =
        this.coupling *
        (Math.sin(currentBeatPhases[leftNeighbor] - currentBeatPhases[i]) +
          Math.sin(currentBeatPhases[rightNeighbor] - currentBeatPhases[i]));

      const phraseCoupling =
        this.coupling *
        0.5 *
        (Math.sin(currentPhrasePhases[leftNeighbor] - currentPhrasePhases[i]) +
          Math.sin(
            currentPhrasePhases[rightNeighbor] - currentPhrasePhases[i]
          ));

      // Update phases with natural frequency + coupling
      agent.beatPhase +=
        (agent.beatOmega + beatCoupling) * this.dt * 2 * Math.PI;
      agent.phrasePhase +=
        (agent.phraseOmega + phraseCoupling) * this.dt * 2 * Math.PI;

      // Wrap phases to [0, 2π]
      agent.beatPhase = agent.beatPhase % (2 * Math.PI);
      agent.phrasePhase = agent.phrasePhase % (2 * Math.PI);

      // Ensure positive phases
      if (agent.beatPhase < 0) agent.beatPhase += 2 * Math.PI;
      if (agent.phrasePhase < 0) agent.phrasePhase += 2 * Math.PI;
    }
  }

  private computeGlobalBeatPhase(): number {
    // Compute circular mean of beat phases
    let sumSin = 0;
    let sumCos = 0;

    for (const agent of this.agents) {
      sumSin += Math.sin(agent.beatPhase);
      sumCos += Math.cos(agent.beatPhase);
    }

    const meanPhase = Math.atan2(
      sumSin / this.numAgents,
      sumCos / this.numAgents
    );
    return meanPhase < 0 ? meanPhase + 2 * Math.PI : meanPhase;
  }

  // Dynamic coupling control for testing synchrony/divergence
  setCoupling(newCoupling: number): void {
    this.coupling = Math.max(0, Math.min(1, newCoupling));
    console.log(`Kuramoto coupling set to ${this.coupling.toFixed(3)}`);
  }
}

class EnvironmentSimulator {
  private isRunning = false;
  private envIntervalId: number | null = null;
  private phaseIntervalId: number | null = null;
  private time = 0;
  private audioStartTime = 0;

  // Kuramoto phase simulator
  private kuramotoSim = new KuramotoSimulator();

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
    this.audioStartTime = performance.now() / 1000; // Convert to seconds

    // Start Kuramoto simulation
    this.kuramotoSim.start(this.audioStartTime);

    // Update environment every 200ms as specified
    this.envIntervalId = setInterval(() => {
      this.updateEnvironmentState();
      this.postEnvironmentUpdate();
    }, 200) as unknown as number;

    // Update phases every 50ms for Kuramoto model
    this.phaseIntervalId = setInterval(() => {
      this.updatePhases();
    }, 50) as unknown as number;

    console.log("Environment and Kuramoto simulators started");
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.envIntervalId !== null) {
      clearInterval(this.envIntervalId);
      this.envIntervalId = null;
    }

    if (this.phaseIntervalId !== null) {
      clearInterval(this.phaseIntervalId);
      this.phaseIntervalId = null;
    }

    console.log("Environment and Kuramoto simulators stopped");
  }

  private updateEnvironmentState(): void {
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

  private postEnvironmentUpdate(): void {
    const message: WorkerMessage = {
      type: "update",
      data: { ...this.state },
    };

    self.postMessage(message);
  }

  private updatePhases(): void {
    const currentAudioTime =
      this.audioStartTime + (performance.now() / 1000 - this.audioStartTime);
    const snapshot = this.kuramotoSim.update(currentAudioTime);

    const message: WorkerMessage = {
      type: "phase",
      data: snapshot,
    };

    self.postMessage(message);

    // Log synchrony info occasionally (every 2 seconds)
    if (Math.floor(currentAudioTime * 20) % 40 === 0) {
      this.logSynchronyInfo(snapshot);
    }
  }

  private logSynchronyInfo(snapshot: PhaseSnapshot): void {
    // Calculate phase coherence (order parameter)
    let sumSin = 0;
    let sumCos = 0;

    for (const agent of snapshot.agents) {
      sumSin += Math.sin(agent.beatPhase);
      sumCos += Math.cos(agent.beatPhase);
    }

    const coherence =
      Math.sqrt(sumSin * sumSin + sumCos * sumCos) / snapshot.agents.length;
    const globalPhase = ((snapshot.globalBeatPhase * 180) / Math.PI).toFixed(1);

    console.log(
      `Kuramoto: coherence=${coherence.toFixed(3)}, globalPhase=${globalPhase}°`
    );
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
