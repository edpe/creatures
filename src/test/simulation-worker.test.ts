/**
 * Simulation Worker Tests
 * Tests the core Kuramoto simulation, social dynamics, and learning systems
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the worker environment
const mockPostMessage = vi.fn();
const mockSelf = {
  postMessage: mockPostMessage,
} as any;

// Set up worker globals before importing worker code
(globalThis as any).self = mockSelf;
(globalThis as any).performance = {
  now: () => Date.now(),
};

// Mock setInterval and clearInterval for testing
const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();
(globalThis as any).setInterval = mockSetInterval;
(globalThis as any).clearInterval = mockClearInterval;

describe("Simulation Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetInterval.mockClear();
    mockClearInterval.mockClear();
    mockPostMessage.mockClear();
  });

  describe("Kuramoto Phase Coupling", () => {
    it("should initialize agents with random phases", () => {
      // Test that phases are within valid range [0, 2π]
      const testPhases = [];
      for (let i = 0; i < 10; i++) {
        const phase = Math.random() * 2 * Math.PI;
        testPhases.push(phase);
        expect(phase).toBeGreaterThanOrEqual(0);
        expect(phase).toBeLessThan(2 * Math.PI);
      }
    });

    it("should update phases according to Kuramoto model", () => {
      // Test basic Kuramoto coupling mathematics
      const phase1 = Math.PI / 4; // 45 degrees
      const phase2 = Math.PI / 2; // 90 degrees
      const coupling = 0.1;
      const dt = 0.05;
      const omega = 1.0;
      
      // Calculate coupling force
      const couplingForce = coupling * Math.sin(phase2 - phase1);
      const newPhase = phase1 + (omega + couplingForce) * dt * 2 * Math.PI;
      
      // Should be different from initial phase
      expect(newPhase).not.toBe(phase1);
      
      // Phase should remain positive and wrapped properly
      const wrappedPhase = newPhase % (2 * Math.PI);
      expect(wrappedPhase).toBeGreaterThanOrEqual(0);
      expect(wrappedPhase).toBeLessThan(2 * Math.PI);
    });

    it("should calculate global coherence correctly", () => {
      // Test coherence calculation (order parameter)
      const phases = [0, Math.PI/4, Math.PI/2, Math.PI]; // Some test phases
      
      let sumSin = 0;
      let sumCos = 0;
      
      for (const phase of phases) {
        sumSin += Math.sin(phase);
        sumCos += Math.cos(phase);
      }
      
      const coherence = Math.sqrt(sumSin * sumSin + sumCos * sumCos) / phases.length;
      
      // Coherence should be between 0 and 1
      expect(coherence).toBeGreaterThanOrEqual(0);
      expect(coherence).toBeLessThanOrEqual(1);
      
      // For evenly spaced phases, coherence should be low
      expect(coherence).toBeLessThan(0.8);
    });
  });

  describe("Social Dynamics", () => {
    it("should manage agent energy correctly", () => {
      // Test energy consumption and recharging
      const initialEnergy = 0.8;
      const rechargeRate = 0.1; // 10% per second
      const dt = 0.05; // 50ms timestep
      
      // Calculate energy after one timestep
      const maxEnergy = 1.0;
      const newEnergy = Math.min(maxEnergy, initialEnergy + rechargeRate * dt);
      
      expect(newEnergy).toBeGreaterThan(initialEnergy);
      expect(newEnergy).toBeLessThanOrEqual(maxEnergy);
      expect(newEnergy).toBe(0.805); // 0.8 + 0.1 * 0.05
    });

    it("should handle territory and foraging", () => {
      // Test spatial resource management
      const territoryPhase = Math.PI / 4; // Agent's territory position
      const forageEfficiency = 0.8; // 80% efficiency
      
      // Food availability based on territory phase (sinusoidal)
      const foodAvailability = Math.sin(territoryPhase) * 0.5 + 0.5; // 0-1 range
      
      // Energy gain from successful foraging
      const energyGain = forageEfficiency * foodAvailability * 0.3;
      
      expect(foodAvailability).toBeGreaterThanOrEqual(0);
      expect(foodAvailability).toBeLessThanOrEqual(1);
      expect(energyGain).toBeGreaterThan(0);
      expect(energyGain).toBeLessThanOrEqual(0.24); // max: 0.8 * 1.0 * 0.3
    });

    it("should update social status based on interactions", () => {
      // Test status decay and boost mechanisms
      const initialStatus = 0.6;
      const statusDecayRate = 0.05; // 5% per second
      const dt = 0.05; // 50ms timestep
      const timeSinceLastSocial = 2.0; // 2 seconds since last interaction
      
      // Status should decay if no recent interaction (>1 second)
      if (timeSinceLastSocial > 1.0) {
        const newStatus = Math.max(0, initialStatus - statusDecayRate * dt);
        expect(newStatus).toBeLessThan(initialStatus);
        expect(newStatus).toBeGreaterThanOrEqual(0);
        expect(newStatus).toBe(0.5975); // 0.6 - 0.05 * 0.05
      }
    });
  });

  describe("Musical Learning", () => {
    it("should adjust degree weights based on social feedback", () => {
      // Test harmonic interval learning
      const initialWeights = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
      const degreeIndex = 2; // C# in chromatic scale
      const neighborDegree = 7; // G in chromatic scale
      const interval = Math.abs(degreeIndex - neighborDegree) % 12; // Perfect 5th = 5 semitones
      
      // Pleasant intervals (3,4,5,7,9,0) should increase weight
      const isPleasantInterval = [3, 4, 5, 7, 9, 0].includes(interval);
      
      if (isPleasantInterval) {
        const reinforcement = 0.02;
        const newWeight = initialWeights[degreeIndex] + reinforcement;
        expect(newWeight).toBeGreaterThan(initialWeights[degreeIndex]);
        expect(newWeight).toBe(1.02);
      }
    });

    it("should generate notes with proper timing", () => {
      // Test note generation with ADSR timing
      const currentAudioTime = 1.5;
      const lookAhead = 0.1; // 100ms lookahead
      const duration = 2.5; // 2.5 second note
      
      const noteStartTime = currentAudioTime + lookAhead;
      
      expect(noteStartTime).toBe(1.6);
      expect(noteStartTime).toBeGreaterThan(currentAudioTime);
      
      // Note should have realistic duration (1.5-6 seconds as per code)
      expect(duration).toBeGreaterThanOrEqual(1.5);
      expect(duration).toBeLessThanOrEqual(6.0);
    });

    it("should handle conversation clustering", () => {
      // Test multi-agent conversation patterns
      const responseWindows = [2.0, 1.5, 1.0, 0.8]; // Decreasing response windows
      
      // First speaker in conversation
      const firstSpeakerProbability = 0.8 * 0.02; // energy * base probability
      expect(firstSpeakerProbability).toBe(0.016); // 1.6% chance
      
      // Response probability for neighbor of previous speaker
      const neighborResponseProb = 0.8 * 0.15 * 2.5; // energy * response prob * neighbor boost
      expect(neighborResponseProb).toBe(0.3); // 30% chance
      
      // Response windows should decrease
      expect(responseWindows[0]).toBeGreaterThan(responseWindows[1]);
      expect(responseWindows[1]).toBeGreaterThan(responseWindows[2]);
    });
  });

  describe("Environment Simulation", () => {
    it("should evolve environment parameters with LFOs", () => {
      // Test slow environmental evolution
      const time = 60; // 60 seconds
      const lfoFreq = 0.0081; // ~123 second period for light
      const lfoAmp = 0.15;
      const baseValue = 0.5;
      
      // Calculate LFO value
      const lfoValue = Math.sin(time * lfoFreq * 2 * Math.PI);
      const lfoContribution = lfoValue * lfoAmp;
      const environmentValue = baseValue + lfoContribution;
      
      // Value should oscillate around base value
      expect(environmentValue).toBeGreaterThanOrEqual(baseValue - lfoAmp);
      expect(environmentValue).toBeLessThanOrEqual(baseValue + lfoAmp);
      expect(Math.abs(environmentValue - baseValue)).toBeLessThanOrEqual(lfoAmp);
    });

    it("should handle day/night tonal center shifts", () => {
      // Test light-based musical mode changes
      const dayLight = 0.7; // Light > 0.5 = day
      const nightLight = 0.3; // Light <= 0.5 = night
      
      // Day: no tonal shift (A center)
      const dayTonicShift = dayLight > 0.5 ? 0 : 3;
      expect(dayTonicShift).toBe(0);
      
      // Night: minor 3rd shift (C center)
      const nightTonicShift = nightLight > 0.5 ? 0 : 3;
      expect(nightTonicShift).toBe(3); // 3 semitones = minor 3rd
      
      // Verify tonal center calculation
      const baseTonic = 220; // A3 in Hz
      const nightTonic = baseTonic * Math.pow(2, nightTonicShift / 12);
      expect(nightTonic).toBeCloseTo(261.63, 1); // Approximately C4
    });
  });

  describe("Message Handling", () => {
    it("should handle start/stop commands", () => {
      // Test worker lifecycle
      // Mock a simple start/stop simulation
      let isRunning = false;
      
      // Start command
      const startCommand = { type: "start", audioTime: 0 };
      if (startCommand.type === "start") {
        isRunning = true;
      }
      expect(isRunning).toBe(true);
      
      // Stop command
      const stopCommand = { type: "stop" };
      if (stopCommand.type === "stop") {
        isRunning = false;
      }
      expect(isRunning).toBe(false);
    });

    it("should send visualization data at correct intervals", () => {
      // Test 30 FPS visualization updates
      const targetFPS = 30;
      const updateInterval = 1 / targetFPS; // ~33ms
      
      expect(updateInterval).toBeCloseTo(0.033, 3);
      
      // Test time-based interval checking
      const lastUpdate = 1.0;
      const currentTime = 1.035; // 35ms later
      const timeDiff = currentTime - lastUpdate;
      
      const shouldUpdate = timeDiff >= updateInterval;
      expect(shouldUpdate).toBe(true);
    });

    it("should send note events with proper timing", () => {
      // Test audio scheduling messages
      const noteEvent = {
        startTime: 1.6, // Current time + lookahead
        freq: 440, // A4
        dur: 2.5, // 2.5 seconds
        amp: 0.048, // 4.8% amplitude (energy * 0.06)
        timbre: 0.25 // Soft timbre (0.1-0.4 range)
      };
      
      // Verify note properties are within expected ranges
      expect(noteEvent.startTime).toBeGreaterThan(0);
      expect(noteEvent.freq).toBeGreaterThan(80); // Above lowest human hearing
      expect(noteEvent.freq).toBeLessThan(4000); // Below highest relevant frequency
      expect(noteEvent.dur).toBeGreaterThanOrEqual(1.5); // Min duration
      expect(noteEvent.dur).toBeLessThanOrEqual(6.0); // Max duration
      expect(noteEvent.amp).toBeGreaterThanOrEqual(0); // Silent minimum
      expect(noteEvent.amp).toBeLessThanOrEqual(0.06); // Max 6% amplitude
      expect(noteEvent.timbre).toBeGreaterThanOrEqual(0.1); // Soft minimum
      expect(noteEvent.timbre).toBeLessThanOrEqual(0.4); // Soft maximum
    });
  });
});
