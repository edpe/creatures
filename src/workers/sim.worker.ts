/**
 * Simulation Worker - Updates environment state continuously
 * Generates slowly evolving environment parameters using LFOs and random walk
 * Implements Kuramoto phase model for weakly coupled oscillators
 * Includes PitchField for agent-to-note mapping with pentatonic harmony
 */

interface EnvironmentState {
  light: number;
  wind: number;
  humidity: number;
  temperature: number;
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

interface KuramotoAgent {
  id: number;
  beatPhase: number; // Phase for beat timing
  phrasePhase: number; // Phase for phrase structure
  beatOmega: number; // Natural beat frequency
  phraseOmega: number; // Natural phrase frequency
  size: number; // Agent size 0-1 (affects octave choice)
  energy: number; // Agent energy 0-1 (affects amplitude)
  lastBeatPhase: number; // Previous beat phase for crossing detection
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
  type: "start" | "stop" | "update" | "phase" | "notes";
  data?: EnvironmentState | PhaseSnapshot | NoteBatch;
}

/**
 * PitchField - Maps agents to musical notes with pentatonic harmony
 */
class PitchField {
  private tonic: number = 220; // A3 as tonic in Hz
  private pentatonicDegrees: number[] = [0, 2, 4, 7, 9]; // Major pentatonic intervals
  private baseOctave: number = 4; // Reference octave (A4 = 440Hz)
  private lookAhead: number = 0.1; // 100ms look-ahead for scheduling

  constructor() {}

  /**
   * Generate notes from agents that cross beat boundaries
   */
  generateNotes(
    agents: Array<{
      id: number;
      beatPhase: number;
      size: number;
      energy: number;
      lastBeatPhase: number;
    }>,
    currentAudioTime: number
  ): NoteEvent[] {
    const notes: NoteEvent[] = [];

    for (const agent of agents) {
      if (this.didCrossBeat(agent.lastBeatPhase, agent.beatPhase)) {
        if (this.shouldEmitNote(agent.energy)) {
          const note = this.createNoteFromAgent(agent, currentAudioTime);
          notes.push(note);
        }
      }
    }

    return notes;
  }

  /**
   * Check if agent crossed a beat boundary (phase wrapped around 2π)
   */
  private didCrossBeat(lastPhase: number, currentPhase: number): boolean {
    // Detect if we crossed 0 (2π boundary) or specific beat positions
    const beatPositions = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]; // 4 beats per cycle

    for (const beatPos of beatPositions) {
      if (this.crossedPhase(lastPhase, currentPhase, beatPos)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if phase crossed a specific threshold
   */
  private crossedPhase(
    lastPhase: number,
    currentPhase: number,
    threshold: number
  ): boolean {
    // Handle phase wrapping
    if (lastPhase > currentPhase) {
      // Phase wrapped around 2π
      return lastPhase > threshold || currentPhase <= threshold;
    } else {
      // Normal phase progression
      return lastPhase <= threshold && currentPhase > threshold;
    }
  }

  /**
   * Probabilistic note emission based on agent energy
   */
  private shouldEmitNote(energy: number): boolean {
    // Higher energy = higher probability
    const probability = energy * 0.6; // Max 60% chance per beat
    return Math.random() < probability;
  }

  /**
   * Create a note event from an agent's properties
   */
  private createNoteFromAgent(
    agent: { id: number; size: number; energy: number },
    currentAudioTime: number
  ): NoteEvent {
    // Pick a pentatonic degree (uniform distribution)
    const degreeIndex = Math.floor(
      Math.random() * this.pentatonicDegrees.length
    );
    const degree = this.pentatonicDegrees[degreeIndex];

    // Map agent size to octave band with small random walk
    const octave = this.getOctaveFromSize(agent.size);

    // Calculate frequency: tonic * 2^(octave-4) * 2^(degree/12)
    const frequency =
      this.tonic *
      Math.pow(2, octave - this.baseOctave) *
      Math.pow(2, degree / 12);

    // Duration between 0.3-1.6 seconds
    const duration = 0.3 + Math.random() * 1.3;

    // Amplitude from agent energy (gentle range)
    const amplitude = agent.energy * 0.4; // Max 40% for gentle sound

    // Timbre variation (slight FM ratio variation)
    const timbre = 0.3 + Math.random() * 0.4; // 0.3-0.7 range

    return {
      startTime: currentAudioTime + this.lookAhead,
      freq: frequency,
      dur: duration,
      amp: amplitude,
      timbre: timbre,
    };
  }

  /**
   * Map agent size to octave band: small→high, medium→mid, large→low
   */
  private getOctaveFromSize(size: number): number {
    // Add small random walk (±0.5 octave)
    const randomWalk = (Math.random() - 0.5) * 1.0;

    if (size < 0.33) {
      // Small agents: octaves 5-6 (high)
      return 5.5 + randomWalk;
    } else if (size < 0.67) {
      // Medium agents: octaves 4-5 (mid)
      return 4.5 + randomWalk;
    } else {
      // Large agents: octaves 3-4 (low)
      return 3.5 + randomWalk;
    }
  }
}

class KuramotoSimulator {
  private agents: KuramotoAgent[] = [];
  private numAgents: number = 16; // Increase to ~16 as specified
  private coupling: number = 0.15; // Weak coupling strength
  private dt: number = 0.05; // 50ms time step
  private pitchField: PitchField = new PitchField();

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
        size: Math.random(), // Random size 0-1
        energy: 0.3 + Math.random() * 0.4, // Energy 0.3-0.7 for gentle notes
        lastBeatPhase: 0,
      };
      this.agents.push(agent);
    }

    console.log(
      `Initialized ${this.numAgents} Kuramoto agents with PitchField mapping`
    );
  }

  start(audioStartTime: number): void {
    console.log(`Kuramoto simulation started at audio time ${audioStartTime}`);
  }

  update(currentTime: number): { snapshot: PhaseSnapshot; notes: NoteEvent[] } {
    // Store last beat phases before update
    const lastBeatPhases = this.agents.map((a) => a.lastBeatPhase);

    // Update phases using Kuramoto model
    this.updatePhases();

    // Generate notes from agents that crossed beat boundaries
    const notes = this.pitchField.generateNotes(
      this.agents.map((agent) => ({
        id: agent.id,
        beatPhase: agent.beatPhase,
        size: agent.size,
        energy: agent.energy,
        lastBeatPhase: agent.lastBeatPhase,
      })),
      currentTime
    );

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

    return { snapshot, notes };
  }

  private updatePhases(): void {
    // Store current phases for coupling calculations and beat crossing detection
    const currentBeatPhases = this.agents.map((a) => a.beatPhase);
    const currentPhrasePhases = this.agents.map((a) => a.phrasePhase);

    // Update each agent using Kuramoto model
    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];

      // Store last beat phase for beat crossing detection
      agent.lastBeatPhase = agent.beatPhase;

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
    const result = this.kuramotoSim.update(currentAudioTime);

    // Post phase snapshot
    const phaseMessage: WorkerMessage = {
      type: "phase",
      data: result.snapshot,
    };
    self.postMessage(phaseMessage);

    // Post notes if any were generated
    if (result.notes.length > 0) {
      const notesMessage: WorkerMessage = {
        type: "notes",
        data: {
          type: "notes",
          events: result.notes,
        },
      };
      self.postMessage(notesMessage);
    }

    // Log synchrony info occasionally (every 2 seconds)
    if (Math.floor(currentAudioTime * 20) % 40 === 0) {
      this.logSynchronyInfo(result.snapshot);
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
