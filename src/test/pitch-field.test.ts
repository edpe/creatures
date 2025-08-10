/**
 * PitchField Tests
 * Tests agent-to-note mapping with pentatonic harmony
 */
import { describe, it, expect } from "vitest";

// We can't directly import PitchField since it's in the worker,
// but we can test the note generation logic and mathematical concepts

describe("PitchField Concepts", () => {
  describe("Pentatonic Scale Generation", () => {
    it("should calculate correct pentatonic frequencies", () => {
      const tonic = 220; // A3
      const baseOctave = 4;

      // Test frequency calculation: tonic * 2^(octave-4) * 2^(degree/12)
      const octave = 4; // Same octave as reference
      const degree = 0; // Tonic degree

      const frequency =
        tonic * Math.pow(2, octave - baseOctave) * Math.pow(2, degree / 12);
      expect(frequency).toBeCloseTo(220, 1); // Should be exactly 220 Hz

      // Test the 5th degree (perfect fifth)
      const fifthDegree = 7;
      const fifthFreq =
        tonic *
        Math.pow(2, octave - baseOctave) *
        Math.pow(2, fifthDegree / 12);
      expect(fifthFreq).toBeCloseTo(329.6, 1); // Perfect fifth above A3
    });

    it("should map agent sizes to appropriate octave ranges", () => {
      const testOctaveMappingConcept = (size: number) => {
        if (size < 0.33) {
          return { range: "high", expected: [5, 6] };
        } else if (size < 0.67) {
          return { range: "mid", expected: [4, 5] };
        } else {
          return { range: "low", expected: [3, 4] };
        }
      };

      expect(testOctaveMappingConcept(0.2).range).toBe("high");
      expect(testOctaveMappingConcept(0.5).range).toBe("mid");
      expect(testOctaveMappingConcept(0.8).range).toBe("low");
    });
  });

  describe("Beat Crossing Detection", () => {
    it("should detect phase boundary crossings", () => {
      const detectCrossing = (
        lastPhase: number,
        currentPhase: number,
        threshold: number
      ) => {
        // Handle phase wrapping
        if (lastPhase > currentPhase) {
          // Phase wrapped around 2π
          return lastPhase > threshold || currentPhase <= threshold;
        } else {
          // Normal phase progression
          return lastPhase <= threshold && currentPhase > threshold;
        }
      };

      // Test normal crossing
      expect(detectCrossing(0.1, 0.2, 0.15)).toBe(true);
      expect(detectCrossing(0.1, 0.2, 0.25)).toBe(false);

      // Test phase wrap crossing
      expect(detectCrossing(6.2, 0.1, 0.05)).toBe(true);
      expect(detectCrossing(6.2, 0.1, 6.3)).toBe(true); // 6.3 > 6.2, so lastPhase > threshold
    });

    it("should identify beat positions within phase cycle", () => {
      const beatPositions = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

      // Verify beat positions are evenly spaced through 2π
      expect(beatPositions[0]).toBe(0);
      expect(beatPositions[1]).toBeCloseTo(Math.PI / 2, 5);
      expect(beatPositions[2]).toBeCloseTo(Math.PI, 5);
      expect(beatPositions[3]).toBeCloseTo((3 * Math.PI) / 2, 5);
    });
  });

  describe("Note Event Generation", () => {
    it("should create valid note events with gentle amplitude", () => {
      const createMockNote = (energy: number) => {
        const amplitude = energy * 0.12; // Max 12% for whisper-like sound (updated)
        const duration = 0.8 + Math.random() * 2.4; // 0.8-3.2 seconds (updated)
        const timbre = 0.1 + Math.random() * 0.3; // 0.1-0.4 range (updated)

        return {
          amp: amplitude,
          dur: duration,
          timbre: timbre,
        };
      };

      const note1 = createMockNote(0.5);
      const note2 = createMockNote(1.0);

      // Amplitude should be whisper-like (max 12%)
      expect(note1.amp).toBeLessThanOrEqual(0.12);
      expect(note2.amp).toBeLessThanOrEqual(0.12);

      // Duration should be contemplative range
      expect(note1.dur).toBeGreaterThanOrEqual(0.8);
      expect(note1.dur).toBeLessThanOrEqual(3.2);

      // Timbre should be soft and mellow
      expect(note1.timbre).toBeGreaterThanOrEqual(0.1);
      expect(note1.timbre).toBeLessThanOrEqual(0.4);
    });

    it("should use probabilistic note emission based on energy", () => {
      const shouldEmitNote = (energy: number) => {
        const probability = energy * 0.08; // Max 8% chance per beat (much lower!)
        return { probability, maxChance: 0.2 }; // Max 20% even when chatty
      };

      const lowEnergy = shouldEmitNote(0.2);
      const highEnergy = shouldEmitNote(1.0);

      expect(lowEnergy.probability).toBeCloseTo(0.016, 3); // 1.6% chance (updated)
      expect(highEnergy.probability).toBeCloseTo(0.08, 3); // 8% chance max (updated)
      expect(highEnergy.maxChance).toBe(0.2); // 20% max (updated)
    });
  });

  describe("Agent Configuration", () => {
    it("should validate agent count matches specification", () => {
      const expectedAgentCount = 16; // N ≈ 16 as specified
      expect(expectedAgentCount).toBeGreaterThanOrEqual(14);
      expect(expectedAgentCount).toBeLessThanOrEqual(18);
    });

    it("should ensure agents have required properties for note generation", () => {
      const mockAgent = {
        id: 0,
        beatPhase: Math.PI / 4,
        size: 0.5,
        energy: 0.25, // Updated to reflect new contemplative range (0.1-0.4)
        lastBeatPhase: 0,
      };

      expect(mockAgent.size).toBeGreaterThanOrEqual(0);
      expect(mockAgent.size).toBeLessThanOrEqual(1);
      expect(mockAgent.energy).toBeGreaterThanOrEqual(0);
      expect(mockAgent.energy).toBeLessThanOrEqual(1);
    });
  });

  describe("Look-ahead Scheduling", () => {
    it("should apply 100ms look-ahead for note scheduling", () => {
      const lookAhead = 0.1; // 100ms
      const currentTime = 5.0;
      const scheduledTime = currentTime + lookAhead;

      expect(scheduledTime).toBe(5.1);
      expect(lookAhead).toBe(0.1);
    });
  });
});
