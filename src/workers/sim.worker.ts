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

interface RecentNote {
  degree: number; // Scale degree 0-11
  time: number; // When it was played
  agentId: number; // Who played it
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

  // Core Energy Properties (Step 1)
  speakingEnergy: number; // Current speaking energy 0-1
  maxSpeakingEnergy: number; // Individual capacity 0.7-1.0
  speakingCost: number; // Energy consumed per note 0.15-0.25
  rechargeRate: number; // Passive recovery per second 0.08-0.12

  // Territory & Foraging System (Step 2)
  territoryPhase: number; // Location in environment 0-2π
  forageEfficiency: number; // Food finding ability 0.5-1.0
  lastForageTime: number; // Timestamp of last successful forage
  isForaging: boolean; // Currently searching for food

  // Social Status System (Step 3)
  socialStatus: number; // Reputation from interactions 0-1
  statusDecayRate: number; // How fast status fades without interaction
  lastSocialTime: number; // When last gained/lost status

  // Emergent Learning System
  recentNotes: RecentNote[]; // Last 2-3 notes this agent played
  degreeWeights: number[]; // Learned preferences for scale degrees (12 elements for chromatic)
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
  type:
    | "start"
    | "stop"
    | "audioTime"
    | "envUpdate"
    | "phases"
    | "notes"
    | "setParameter"
    | "requestAudioTime"
    | "visualization";
  phases?: PhaseSnapshot;
  notes?: NoteEvent[];
  environment?: EnvironmentState;
  audioTime?: number; // For audioTime messages
  parameterName?: string; // For setParameter messages
  parameterValue?: number; // For setParameter messages
  visualization?: import("../types/visualization").SimulationSnapshot; // For visualization messages
}

/**
 * PitchField - Maps agents to musical notes with pentatonic harmony
 */
class PitchField {
  private tonic: number = 220; // A3 as tonic in Hz
  private baseOctave: number = 4; // Reference octave
  private lookAhead: number = 0.1; // Look-ahead time for note scheduling
  private currentLightLevel: number = 0.5;

  // Conversation clustering state
  private conversationHistory: Array<{ time: number; agentId: number }> = [];
  private lastConversationEnd: number = 0;
  private conversationCooldown: number = 15.0; // 15 seconds of silence between conversations (was 6)
  private responseWindows = [2.0, 1.5, 1.0, 0.8]; // Decreasing response windows

  constructor() {}

  /**
   * Update the current light level for day/night tonal center shifts
   */
  updateLightLevel(lightLevel: number): void {
    this.currentLightLevel = lightLevel;
  }

  /**
   * Get chromatic scale (all 12 semitones) - let agents discover their own scales
   */
  getChromaticScale(): number[] {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // All 12 semitones
  }

  /**
   * Get tonal center based on day/night - but agents choose their own intervals
   * Day: A major feel, Night: A minor feel (but not enforced)
   */
  getCurrentTonicShift(): number {
    // Subtle tonal center shift based on light level
    // Day (light > 0.5): no shift (A = 220Hz base)
    // Night (light <= 0.5): minor 3rd shift (C = ~261Hz feel)
    return this.currentLightLevel > 0.5 ? 0 : 3; // 0 or 3 semitones shift
  }

  /**
   * Generate notes from agents that cross beat boundaries
   */
  generateNotes(
    agents: KuramotoAgent[],
    currentAudioTime: number,
    lightLevel: number, // Add light level for day/night pentatonic switching
    onSpeaking?: (
      speakerId: number,
      note: NoteEvent,
      conversationHistory: Array<{ time: number; agentId: number }>
    ) => void
  ): NoteEvent[] {
    const notes: NoteEvent[] = [];

    // Update pitch field with current light level for day/night scale switching
    this.updateLightLevel(lightLevel);

    // Clean up old conversation history
    this.cleanupOldConversation(currentAudioTime);

    for (const agent of agents) {
      if (this.didCrossBeat(agent.lastBeatPhase, agent.beatPhase)) {
        if (this.shouldEmitNote(agent, agents, currentAudioTime)) {
          const note = this.createNoteFromAgent(
            agent,
            currentAudioTime,
            agents
          );
          notes.push(note);

          // Record this agent's participation in the conversation
          this.conversationHistory.push({
            time: currentAudioTime,
            agentId: agent.id,
          });

          // Call social benefits callback if provided (Step 5)
          if (onSpeaking) {
            onSpeaking(agent.id, note, this.conversationHistory);
          }
        }
      }
    }
    return notes;
  }

  /**
   * Clean up old conversation history
   */
  private cleanupOldConversation(currentTime: number): void {
    // Remove conversation entries older than the cooldown period
    this.conversationHistory = this.conversationHistory.filter(
      (entry) => currentTime - entry.time <= 10.0 // Keep 10 seconds of history
    );

    // Update conversation end time if conversation has been quiet
    if (this.conversationHistory.length > 0) {
      const lastEntry =
        this.conversationHistory[this.conversationHistory.length - 1];
      if (currentTime - lastEntry.time > 3.0) {
        this.lastConversationEnd = lastEntry.time;
      }
    }
  }

  /**
   * Get the current conversation state
   */
  private getConversationState(currentTime: number): {
    isInCooldown: boolean;
    conversationPosition: number; // 0 = first speaker, 1 = second, etc.
    timeSinceLastSpeaker: number;
  } {
    const timeSinceEnd = currentTime - this.lastConversationEnd;
    const isInCooldown = timeSinceEnd < this.conversationCooldown;

    // Filter recent conversation (within last 8 seconds)
    const recentHistory = this.conversationHistory.filter(
      (entry) => currentTime - entry.time <= 8.0
    );

    const conversationPosition = recentHistory.length;
    const timeSinceLastSpeaker =
      recentHistory.length > 0
        ? currentTime - recentHistory[recentHistory.length - 1].time
        : Infinity;

    return { isInCooldown, conversationPosition, timeSinceLastSpeaker };
  }

  /**
   * Check if agent crossed a beat boundary (phase wrapped around 2π)
   * Much more selective - only check major beat positions
   */
  private didCrossBeat(lastPhase: number, currentPhase: number): boolean {
    // Only check major beat positions (every quarter cycle instead of every eighth)
    const beatPositions = [0, Math.PI]; // Only 2 beats per cycle instead of 4

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
   * Probabilistic note emission with conversation clustering
   */
  private shouldEmitNote(
    agent: { id: number; energy: number },
    agents: Array<{ id: number }>,
    currentTime: number
  ): boolean {
    const { isInCooldown, conversationPosition, timeSinceLastSpeaker } =
      this.getConversationState(currentTime);

    // During cooldown, no one speaks (conversation has ended)
    if (isInCooldown) {
      return false;
    }

    // First speaker: base probability from agent energy
    if (conversationPosition === 0) {
      const baseProbability = agent.energy * 0.02; // 2% base chance (much reduced from 8%)
      return Math.random() < baseProbability;
    }

    // Subsequent speakers: must be within response window
    if (conversationPosition < this.responseWindows.length) {
      const windowTime = this.responseWindows[conversationPosition - 1];

      if (timeSinceLastSpeaker <= windowTime) {
        // Higher probability for neighbors of previous speaker
        const recentHistory = this.conversationHistory.filter(
          (entry) => currentTime - entry.time <= 8.0
        );
        const lastSpeaker = recentHistory[recentHistory.length - 1];

        let probability = agent.energy * 0.15; // Reduced response probability (was 0.3)

        if (lastSpeaker) {
          const agentCount = agents.length;
          const lastId = lastSpeaker.agentId;
          const currentId = agent.id;

          // Check if this agent is a neighbor of the last speaker
          const leftNeighbor = (lastId - 1 + agentCount) % agentCount;
          const rightNeighbor = (lastId + 1) % agentCount;

          if (currentId === leftNeighbor || currentId === rightNeighbor) {
            probability *= 2.5; // Neighbors are more likely to respond
          }
        }

        return Math.random() < Math.min(probability, 0.6);
      }
    }

    return false;
  }

  /**
   * Create a note event from an agent's properties using emergent learning
   */
  private createNoteFromAgent(
    agent: KuramotoAgent,
    currentAudioTime: number,
    allAgents: KuramotoAgent[]
  ): NoteEvent {
    // Use chromatic scale (all 12 semitones) - let agents discover harmony
    const currentScale = this.getChromaticScale();

    // Select degree using learned weights + stepwise motion bias + innovation
    const degreeIndex = this.selectDegreeWithLearning(
      agent,
      currentScale,
      allAgents,
      currentAudioTime
    );
    const degree = currentScale[degreeIndex];

    // Apply subtle tonal center shift based on day/night
    const tonicShift = this.getCurrentTonicShift();
    const adjustedDegree = (degree + tonicShift) % 12;

    // Map agent size to octave band with small random walk
    const octave = this.getOctaveFromSize(agent.size);

    // Calculate frequency: tonic * 2^(octave-4) * 2^(adjustedDegree/12)
    const baseFrequency =
      this.tonic *
      Math.pow(2, octave - this.baseOctave) *
      Math.pow(2, adjustedDegree / 12);

    // Add subtle microtonal variation (within 1/8 tone = ~25 cents)
    // 1/8 tone = 1/96 octave, so multiply by 2^(±1/96)
    const microtonalVariation = (Math.random() - 0.5) * (2 / 96); // ±1/96 octave
    const frequency = baseFrequency * Math.pow(2, microtonalVariation);

    // Very long, deeply contemplative durations (1.5-6 seconds)
    const duration = 1.5 + Math.random() * 4.5;

    // Extremely gentle amplitudes - barely-audible whispers
    const amplitude = agent.energy * 0.06; // Max 6% (was 12%)

    // Create note record for learning (use original degree before tonic shift)
    const noteRecord: RecentNote = {
      degree: degree,
      time: currentAudioTime,
      agentId: agent.id,
    };

    // Update agent's learning state
    this.updateAgentLearning(agent, noteRecord, allAgents, currentAudioTime);

    // Log any notes being generated to debug creature activity
    const modeType =
      this.currentLightLevel > 0.5 ? "day (A center)" : "night (C center)";
    const noteNames = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const noteName = noteNames[adjustedDegree % 12];

    console.log(
      `[WORKER] Generated note: ${frequency.toFixed(
        2
      )}Hz (${noteName}${octave}, degree=${adjustedDegree}, ${modeType}) from agent ${
        agent.id
      } at time ${currentAudioTime}, amp=${amplitude.toFixed(3)}`
    );

    // Softer, more mellow timbres - less harsh FM
    const timbre = 0.1 + Math.random() * 0.3; // 0.1-0.4 range (was 0.3-0.7)

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
    // Very small random walk (±0.1 octave) to keep octaves clean
    const randomWalk = (Math.random() - 0.5) * 0.2;

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

  /**
   * Select scale degree using learned weights, stepwise motion bias, and innovation
   */
  private selectDegreeWithLearning(
    agent: KuramotoAgent,
    currentScale: number[],
    _allAgents: KuramotoAgent[], // Used in future extensions
    _currentTime: number // Used in future extensions
  ): number {
    // 1% innovation chance - pick completely random degree
    if (Math.random() < 0.01) {
      return Math.floor(Math.random() * currentScale.length);
    }

    // Calculate weights for each degree index
    const weights = [...agent.degreeWeights];

    // Apply stepwise motion bias (70% bias toward ±1-2 scale steps)
    if (agent.recentNotes.length > 0) {
      const lastNote = agent.recentNotes[agent.recentNotes.length - 1];
      const lastDegreeIndex = currentScale.indexOf(lastNote.degree);

      if (lastDegreeIndex !== -1) {
        // Boost nearby degrees with 70% bias
        for (let i = 0; i < currentScale.length; i++) {
          const distance = Math.abs(i - lastDegreeIndex);
          if (distance === 1 || distance === 2) {
            weights[i] *= 1.7; // 70% boost for stepwise motion
          } else if (distance > 2) {
            weights[i] *= 0.3; // 30% chance for leaps
          }
        }
      }
    }

    // Normalize weights
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = weights.map((w) => w / totalWeight);

    // Weighted random selection
    const random = Math.random();
    let cumulative = 0;
    for (let i = 0; i < normalizedWeights.length; i++) {
      cumulative += normalizedWeights[i];
      if (random <= cumulative) {
        return i;
      }
    }

    // Fallback
    return Math.floor(Math.random() * currentScale.length);
  }

  /**
   * Update agent's learning state after playing a note
   */
  private updateAgentLearning(
    agent: KuramotoAgent,
    noteRecord: RecentNote,
    allAgents: KuramotoAgent[],
    currentTime: number
  ): void {
    // Add to recent notes (keep last 2-3)
    agent.recentNotes.push(noteRecord);
    if (agent.recentNotes.length > 3) {
      agent.recentNotes.shift();
    }

    // Sample neighbor notes within 300ms window
    const neighborNotes: RecentNote[] = [];
    for (const otherAgent of allAgents) {
      if (otherAgent.id === agent.id) continue;

      for (const note of otherAgent.recentNotes) {
        const timeDiff = Math.abs(note.time - currentTime);
        if (timeDiff <= 0.3) {
          // 300ms window
          neighborNotes.push(note);
        }
      }
    }

    // Analyze harmonic intervals and adjust weights
    const currentScale = this.getChromaticScale();
    const currentDegreeIndex = currentScale.indexOf(noteRecord.degree);

    if (currentDegreeIndex !== -1 && neighborNotes.length > 0) {
      for (const neighborNote of neighborNotes) {
        const interval = Math.abs(noteRecord.degree - neighborNote.degree) % 12;

        // Pleasant intervals: 3,4,5,7,9,12 semitones (minor 3rd, major 3rd, perfect 4th, perfect 5th, major 6th, octave)
        if ([3, 4, 5, 7, 9, 0].includes(interval)) {
          // Reinforce this degree (+0.02 weight)
          agent.degreeWeights[currentDegreeIndex] += 0.02;
        }

        // Penalty for crowded minor seconds (1 semitone) if local density is high
        if (interval === 1 && neighborNotes.length >= 2) {
          // Slight penalty (-0.01) for crowded minor seconds
          agent.degreeWeights[currentDegreeIndex] -= 0.01;
        }
      }
    }

    // Normalize weights to prevent runaway values
    const totalWeight = agent.degreeWeights.reduce((sum, w) => sum + w, 0);
    if (totalWeight > 0) {
      agent.degreeWeights = agent.degreeWeights.map((w) =>
        Math.max(0.1, (w / totalWeight) * 12)
      ); // Keep weights between 0.1-2.0 for 12 degrees
    }

    // Occasional logging of learning state
    if (Math.random() < 0.05) {
      // 5% chance to log
      console.log(
        `[LEARNING] Agent ${agent.id} weights: [${agent.degreeWeights
          .map((w) => w.toFixed(2))
          .join(", ")}], recent notes: ${agent.recentNotes.length}`
      );
    }
  }
}

class KuramotoSimulator {
  private agents: KuramotoAgent[] = [];
  private numAgents: number = 16; // Increase to ~16 as specified
  private coupling: number = 0.15; // Weak coupling strength
  private dt: number = 0.05; // 50ms time step
  private pitchField: PitchField = new PitchField();
  private currentlyPlayingAgents = new Set<number>();
  private currentNotes = new Map<
    number,
    { startTime: number; duration: number }
  >();

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
        energy: 0.1 + Math.random() * 0.3, // Lower energy 0.1-0.4 (was 0.3-0.7) - more contemplative
        lastBeatPhase: 0,

        // Steps 1-3: Energy Management, Territory, and Social Status
        speakingEnergy: 0.7 + Math.random() * 0.3, // Start with 70-100% speaking energy
        maxSpeakingEnergy: 0.7 + Math.random() * 0.3, // Individual capacity 70-100%
        speakingCost: 0.15 + Math.random() * 0.1, // Energy per note 15-25%
        rechargeRate: 0.08 + Math.random() * 0.04, // Recovery 8-12% per second
        territoryPhase: Math.random() * 2 * Math.PI, // Random territory location
        forageEfficiency: 0.5 + Math.random() * 0.5, // Food finding ability 50-100%
        lastForageTime: 0, // Never foraged yet
        isForaging: false, // Not currently foraging
        socialStatus: 0.3 + Math.random() * 0.4, // Start with moderate status 30-70%
        statusDecayRate: 0.05 + Math.random() * 0.03, // Status decay 5-8% per second
        lastSocialTime: 0, // Never had social interaction yet

        // Emergent Learning System - start with neutral preferences for all 12 chromatic degrees
        recentNotes: [], // No recent notes yet
        degreeWeights: [
          1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
        ], // Equal weight for all 12 chromatic degrees
      };
      this.agents.push(agent);
    }

    console.log(
      `Initialized ${this.numAgents} Kuramoto agents with energy, territory, social systems & emergent learning`
    );
  }

  start(audioStartTime: number): void {
    console.log(`Kuramoto simulation started at audio time ${audioStartTime}`);
  }

  update(
    currentTime: number,
    lightLevel?: number
  ): { snapshot: PhaseSnapshot; notes: NoteEvent[] } {
    // Update energy management first (Step 4)
    this.updateEnergyManagement(currentTime);

    // Clear previously playing agents (they only "play" for one cycle)
    this.currentlyPlayingAgents.clear();

    // Clean up old note information for agents that have finished playing
    for (const [agentId, noteInfo] of this.currentNotes.entries()) {
      if (currentTime > noteInfo.startTime + noteInfo.duration) {
        this.currentNotes.delete(agentId);
      }
    }

    // Update phases using Kuramoto model
    this.updatePhases(); // Generate notes from agents that crossed beat boundaries
    const notes = this.pitchField.generateNotes(
      this.agents, // Pass full agents array for learning system
      currentTime,
      lightLevel || 0.5, // Default to neutral light level if not provided
      // Apply social benefits when agents speak (Step 5)
      (
        speakerId: number,
        note: NoteEvent,
        conversationHistory: Array<{ time: number; agentId: number }>
      ) => {
        // Track that this agent is currently playing
        console.log(
          `[SPEAKER] Agent ${speakerId} is speaking at time ${currentTime}, duration: ${note.dur.toFixed(
            3
          )}s`
        );
        this.currentlyPlayingAgents.add(speakerId);

        // Store note information for visualization
        this.currentNotes.set(speakerId, {
          startTime: note.startTime,
          duration: note.dur,
        });
        console.log(
          `[NOTE-INFO] Stored for agent ${speakerId}: start=${note.startTime.toFixed(
            3
          )}, dur=${note.dur.toFixed(3)}`
        );

        this.applySocialBenefitsFromSpeaking(
          speakerId,
          conversationHistory,
          currentTime
        );
      }
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

  /**
   * Update energy management for all agents (Step 4)
   * Handles recharging, foraging, and status decay
   */
  private updateEnergyManagement(currentTime: number): void {
    for (const agent of this.agents) {
      // 1. Natural speaking energy recharge
      agent.speakingEnergy = Math.min(
        agent.maxSpeakingEnergy,
        agent.speakingEnergy + agent.rechargeRate * this.dt
      );

      // 2. Attempt foraging if conditions are right
      this.attemptForaging(agent, currentTime);

      // 3. Social status decay over time
      const timeSinceLastSocial = currentTime - agent.lastSocialTime;
      if (timeSinceLastSocial > 1.0) {
        // Only decay after 1 second of no interaction
        agent.socialStatus = Math.max(
          0,
          agent.socialStatus - agent.statusDecayRate * this.dt
        );
      }
    }
  }

  /**
   * Attempt foraging for an agent (Step 4)
   */
  private attemptForaging(agent: KuramotoAgent, currentTime: number): void {
    // Can't forage while speaking energy is full
    if (agent.speakingEnergy >= agent.maxSpeakingEnergy * 0.95) {
      agent.isForaging = false;
      return;
    }

    // Foraging cooldown - can't forage too frequently
    const timeSinceLastForage = currentTime - agent.lastForageTime;
    if (timeSinceLastForage < 2.0) {
      return;
    }

    // Update territory phase (agents move through their territory)
    agent.territoryPhase += 0.5 * this.dt * 2 * Math.PI; // Moderate territory movement

    // Check if food is available at current territory location
    const foodAvailability = Math.sin(agent.territoryPhase) * 0.5 + 0.5; // 0-1 based on territory phase
    const foragingThreshold = 0.7; // Food must be abundant

    if (foodAvailability > foragingThreshold && !agent.isForaging) {
      // Start foraging
      agent.isForaging = true;

      // Successful forage - restore energy
      const energyGain = agent.forageEfficiency * foodAvailability * 0.3;
      agent.speakingEnergy = Math.min(
        agent.maxSpeakingEnergy,
        agent.speakingEnergy + energyGain
      );

      // Foraging also boosts social status (confident foragers gain respect)
      agent.socialStatus = Math.min(1.0, agent.socialStatus + energyGain * 0.2);
      agent.lastForageTime = currentTime;
      agent.lastSocialTime = currentTime; // Foraging is a social signal
    } else if (foodAvailability <= 0.3) {
      // Poor foraging conditions - stop foraging
      agent.isForaging = false;
    }
  }

  /**
   * Consume speaking energy when an agent speaks (Step 4)
   * Will be used in Step 6 when integrating with conversation system
   */
  // @ts-ignore - Will be used in Step 6
  private consumeSpeakingEnergy(agentId: number, amount: number): void {
    const agent = this.agents.find((a) => a.id === agentId);
    if (agent) {
      agent.speakingEnergy = Math.max(0, agent.speakingEnergy - amount);
      agent.lastSocialTime = Date.now() / 1000; // Update social activity time
    }
  }

  /**
   * Apply social energy benefits when an agent speaks (Step 5)
   * Provides social feeding, validation rewards, and listener benefits
   */
  private applySocialBenefitsFromSpeaking(
    speakerId: number,
    conversationHistory: Array<{ time: number; agentId: number }>,
    currentTime: number
  ): void {
    const speaker = this.agents.find((a) => a.id === speakerId);
    if (!speaker) return;

    // 1. Social feeding - energy bonus for speaking near others
    const nearbyAgents = this.agents.filter((other) => {
      if (other.id === speakerId) return false;
      const phaseDiff = Math.abs(speaker.beatPhase - other.beatPhase);
      const normalizedDiff = Math.min(phaseDiff, 2 * Math.PI - phaseDiff);
      return normalizedDiff < Math.PI / 3; // Within 60 degrees
    });

    if (nearbyAgents.length > 0) {
      const socialFeedingBonus = Math.min(0.1, nearbyAgents.length * 0.02);
      speaker.speakingEnergy = Math.min(
        speaker.maxSpeakingEnergy,
        speaker.speakingEnergy + socialFeedingBonus
      );
    }

    // 2. Validation rewards - check if others responded to this speaker recently
    this.checkForValidationRewards(speaker, conversationHistory, currentTime);

    // 3. Apply benefits to listeners
    this.applySocialBenefitsToListeners(speaker, nearbyAgents, currentTime);

    // Update speaker's social activity time
    speaker.lastSocialTime = currentTime;
  }

  /**
   * Check for validation rewards when others respond to a speaker (Step 5)
   */
  private checkForValidationRewards(
    speaker: KuramotoAgent,
    conversationHistory: Array<{ time: number; agentId: number }>,
    currentTime: number
  ): void {
    // Look for recent responses to this speaker (within last 3 seconds)
    const recentResponses = conversationHistory.filter((entry) => {
      return (
        entry.agentId !== speaker.id &&
        currentTime - entry.time <= 3.0 &&
        currentTime - entry.time >= 0.1 // Not immediate
      );
    });

    if (recentResponses.length > 0) {
      // Find the responder to give them validation energy
      const mostRecentResponse = recentResponses[recentResponses.length - 1];
      const responder = this.agents.find(
        (a) => a.id === mostRecentResponse.agentId
      );

      if (responder) {
        // Validation energy boost based on responder's status
        const validationBonus = 0.08 * responder.socialStatus;
        speaker.speakingEnergy = Math.min(
          speaker.maxSpeakingEnergy,
          speaker.speakingEnergy + validationBonus
        );

        // Small status boost for being validated
        speaker.socialStatus = Math.min(
          1.0,
          speaker.socialStatus + validationBonus * 0.5
        );
      }
    }
  }

  /**
   * Apply energy benefits to listeners based on speaker's status (Step 5)
   */
  private applySocialBenefitsToListeners(
    speaker: KuramotoAgent,
    nearbyAgents: KuramotoAgent[],
    currentTime: number
  ): void {
    // Give small energy trickle to nearby listeners based on speaker's status
    const listenerBonus = 0.02 * speaker.socialStatus;

    for (const listener of nearbyAgents) {
      // Don't give benefits to agents currently foraging (they're distracted)
      if (!listener.isForaging) {
        listener.speakingEnergy = Math.min(
          listener.maxSpeakingEnergy,
          listener.speakingEnergy + listenerBonus
        );
        listener.lastSocialTime = currentTime;
      }
    }
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

  // Getter for agents (needed for visualization)
  get agentsList(): KuramotoAgent[] {
    return this.agents;
  }

  // Getter for currently playing agents (needed for visualization)
  get currentlyPlaying(): Set<number> {
    return this.currentlyPlayingAgents;
  }

  // Getter for current note information (needed for visualization)
  get currentNoteInfo(): Map<number, { startTime: number; duration: number }> {
    return this.currentNotes;
  }
}

class EnvironmentSimulator {
  private isRunning = false;
  private envIntervalId: number | null = null;
  private phaseIntervalId: number | null = null;
  private time = 0;
  private audioStartTime = 0;
  private lastVisualizationTime = 0;

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
      type: "envUpdate",
      environment: { ...this.state },
    };

    self.postMessage(message);
  }

  private updatePhases(): void {
    // Post a request for current audio context time
    self.postMessage({
      type: "requestAudioTime",
    });
  }

  updatePhasesWithAudioTime(currentAudioTime: number): void {
    // Pass current light level to the simulator for day/night pentatonic switching
    const result = this.kuramotoSim.update(currentAudioTime, this.state.light);

    // Post phase snapshot
    const phaseMessage: WorkerMessage = {
      type: "phases",
      phases: result.snapshot,
    };
    self.postMessage(phaseMessage);

    // Post notes if any were generated
    if (result.notes.length > 0) {
      const notesMessage: WorkerMessage = {
        type: "notes",
        notes: result.notes,
      };
      self.postMessage(notesMessage);
    }

    // Post visualization data (at 30 FPS - every ~33ms)
    if (currentAudioTime - this.lastVisualizationTime >= 0.033) {
      this.lastVisualizationTime = currentAudioTime;
      const vizSnapshot = this.generateVisualizationSnapshot(
        currentAudioTime,
        result.snapshot
      );
      const vizMessage: WorkerMessage = {
        type: "visualization",
        visualization: vizSnapshot,
      };
      self.postMessage(vizMessage);
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

  private generateVisualizationSnapshot(
    currentTime: number,
    snapshot: PhaseSnapshot
  ): import("../types/visualization").SimulationSnapshot {
    // Calculate global coherence
    let sumSin = 0;
    let sumCos = 0;
    for (const agent of snapshot.agents) {
      sumSin += Math.sin(agent.beatPhase);
      sumCos += Math.cos(agent.beatPhase);
    }
    const coherence =
      Math.sqrt(sumSin * sumSin + sumCos * sumCos) / snapshot.agents.length;

    // Generate agent visualizations
    const agentViz = this.kuramotoSim.agentsList.map((agent, i) => {
      // Check if this agent is currently playing
      const isPlaying = this.kuramotoSim.currentlyPlaying.has(agent.id);

      // Get note information for this agent
      const noteInfo = this.kuramotoSim.currentNoteInfo.get(agent.id);

      if (noteInfo) {
        console.log(
          `[VIZ-GEN] Agent ${agent.id}: noteStart=${noteInfo.startTime.toFixed(
            3
          )}, noteDur=${noteInfo.duration.toFixed(
            3
          )}, currentTime=${currentTime.toFixed(3)}`
        );
      }

      return {
        id: agent.id,
        x:
          0.5 +
          Math.cos((i / this.kuramotoSim.agentsList.length) * 2 * Math.PI) *
            0.3,
        y:
          0.5 +
          Math.sin((i / this.kuramotoSim.agentsList.length) * 2 * Math.PI) *
            0.3,
        size: agent.size,
        energy: agent.energy,
        timbre:
          agent.recentNotes.length > 0
            ? agent.recentNotes[agent.recentNotes.length - 1].degree / 12
            : 0.5,
        isPlaying,
        playingUntil: isPlaying ? currentTime + 0.5 : 0, // Flash for 500ms (0.5 seconds)
        noteStartTime: noteInfo ? noteInfo.startTime : 0,
        noteDuration: noteInfo ? noteInfo.duration : 0,
        hue: agent.energy * 360,
      };
    });

    return {
      timestamp: currentTime,
      agents: agentViz,
      environment: {
        light: this.state.light,
        wind: this.state.wind,
        humidity: this.state.humidity,
        temperature: this.state.temperature,
      },
      beat: {
        globalPhase: snapshot.globalBeatPhase,
        coherence,
        intensity: coherence * (0.5 + Math.sin(snapshot.globalBeatPhase) * 0.5),
      },
    };
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

    case "audioTime":
      if (event.data.audioTime !== undefined) {
        simulator.updatePhasesWithAudioTime(event.data.audioTime);
      }
      break;

    case "setParameter":
      if (
        event.data.parameterName !== undefined &&
        event.data.parameterValue !== undefined
      ) {
        handleParameterChange(
          event.data.parameterName,
          event.data.parameterValue
        );
      }
      break;

    default:
      console.warn("Unknown message type:", type);
  }
});

// Handle parameter changes for creature behavior
function handleParameterChange(parameterName: string, value: number): void {
  // TODO: Update creature behavior parameters dynamically
  console.log(`Parameter ${parameterName} changed to ${value}`);
  // This will be expanded to actually modify the behavior parameters
}

// Export for TypeScript (though not used in worker context)
export {};
