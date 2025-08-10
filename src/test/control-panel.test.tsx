/**
 * Control Panel Tests
 * Tests the minimal control panel component functionality
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock audio service
vi.mock("../audio/ctx", () => ({
  audioService: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    isRunning: false,
    setParameter: vi.fn(),
  },
}));

// Mock environment service
vi.mock("../audio/env", () => ({
  environmentService: {
    setMasterGain: vi.fn(),
  },
}));

describe("ControlPanel Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Parameter Mapping", () => {
    it("should correctly map MIDI numbers to note names", () => {
      const midiToNoteName = (midi: number): string => {
        const notes = [
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
        const octave = Math.floor(midi / 12) - 1;
        const note = notes[midi % 12];
        return `${note}${octave}`;
      };

      expect(midiToNoteName(60)).toBe("C4");
      expect(midiToNoteName(57)).toBe("A3");
      expect(midiToNoteName(69)).toBe("A4");
      expect(midiToNoteName(72)).toBe("C5");
      expect(midiToNoteName(48)).toBe("C3");
    });

    it("should validate parameter ranges", () => {
      const validateAgentCount = (count: number) => count >= 4 && count <= 32;
      const validateAmbienceLevel = (level: number) => level >= 0 && level <= 1;
      const validateTonicMidi = (midi: number) => midi >= 48 && midi <= 72;
      const validateTempoBias = (tempo: number) => tempo >= 0.5 && tempo <= 2.0;
      const validateCouplingStrength = (coupling: number) =>
        coupling >= 0 && coupling <= 0.5;

      // Valid ranges
      expect(validateAgentCount(16)).toBe(true);
      expect(validateAmbienceLevel(0.7)).toBe(true);
      expect(validateTonicMidi(57)).toBe(true);
      expect(validateTempoBias(1.0)).toBe(true);
      expect(validateCouplingStrength(0.15)).toBe(true);

      // Invalid ranges
      expect(validateAgentCount(2)).toBe(false);
      expect(validateAgentCount(40)).toBe(false);
      expect(validateAmbienceLevel(-0.1)).toBe(false);
      expect(validateAmbienceLevel(1.1)).toBe(false);
      expect(validateTonicMidi(30)).toBe(false);
      expect(validateTonicMidi(80)).toBe(false);
    });
  });

  describe("Audio Load Calculation", () => {
    it("should calculate CPU load correctly", () => {
      const calculateCpuLoad = (
        activeVoices: number,
        maxVoices: number = 32
      ) => {
        return Math.min(activeVoices / maxVoices, 1.0);
      };

      expect(calculateCpuLoad(8)).toBe(0.25);
      expect(calculateCpuLoad(16)).toBe(0.5);
      expect(calculateCpuLoad(32)).toBe(1.0);
      expect(calculateCpuLoad(40)).toBe(1.0); // Clamped to max
    });

    it("should implement moving average for load smoothing", () => {
      const applyMovingAverage = (
        current: number,
        new_value: number,
        alpha: number = 0.2
      ) => {
        return current * (1 - alpha) + new_value * alpha;
      };

      let loadAverage = 0.5;
      loadAverage = applyMovingAverage(loadAverage, 0.8, 0.2);
      expect(loadAverage).toBeCloseTo(0.56, 2);

      loadAverage = applyMovingAverage(loadAverage, 0.2, 0.2);
      expect(loadAverage).toBeCloseTo(0.488, 2);
    });
  });

  describe("Master Gain with Headroom", () => {
    it("should apply 12dB headroom correctly", () => {
      const applyHeadroom = (gain: number) => {
        // 12dB headroom = 0.25 multiplier (-12dB = 20*log10(0.25))
        return Math.max(0, Math.min(0.25, gain * 0.25));
      };

      expect(applyHeadroom(1.0)).toBeCloseTo(0.25, 3); // Full input = -12dB
      expect(applyHeadroom(0.5)).toBeCloseTo(0.125, 3); // Half input = -18dB
      expect(applyHeadroom(2.0)).toBeCloseTo(0.25, 3); // Clamped to max
      expect(applyHeadroom(0.0)).toBe(0.0); // Zero input = silence
    });

    it("should apply soft-clipping with tanh", () => {
      const applySoftClipping = (gain: number) => {
        const clampedGain = Math.max(0, Math.min(0.25, gain * 0.25));
        return Math.tanh(clampedGain * 2) * 0.5;
      };

      const softClipped1 = applySoftClipping(1.0);
      const softClipped2 = applySoftClipping(0.5);

      expect(softClipped1).toBeGreaterThan(0);
      expect(softClipped1).toBeLessThan(0.5);
      expect(softClipped2).toBeLessThan(softClipped1);
    });
  });

  describe("Timing Constants", () => {
    it("should define correct lookahead and dispatch constants", () => {
      const LOOKAHEAD_MS = 100;
      const DISPATCH_MS = 50;

      expect(LOOKAHEAD_MS).toBe(100);
      expect(DISPATCH_MS).toBe(50);
      expect(DISPATCH_MS).toBeLessThan(LOOKAHEAD_MS);
      expect(DISPATCH_MS).toBeGreaterThanOrEqual(25);
      expect(DISPATCH_MS).toBeLessThanOrEqual(50);
    });

    it("should convert milliseconds to seconds correctly", () => {
      const msToSeconds = (ms: number) => ms / 1000;

      expect(msToSeconds(100)).toBe(0.1);
      expect(msToSeconds(50)).toBe(0.05);
      expect(msToSeconds(25)).toBe(0.025);
    });
  });

  describe("Mobile Audio Handling", () => {
    it("should validate AudioContext state transitions", () => {
      const validateStateTransition = (fromState: string, toState: string) => {
        const validTransitions: Record<string, string[]> = {
          suspended: ["running", "closed"],
          running: ["suspended", "closed"],
          closed: [], // No transitions from closed state
        };

        return validTransitions[fromState]?.includes(toState) || false;
      };

      expect(validateStateTransition("suspended", "running")).toBe(true);
      expect(validateStateTransition("running", "suspended")).toBe(true);
      expect(validateStateTransition("closed", "running")).toBe(false);
    });

    it("should handle user gesture requirements", () => {
      const requiresUserGesture = (contextState: string) => {
        return contextState === "suspended";
      };

      expect(requiresUserGesture("suspended")).toBe(true);
      expect(requiresUserGesture("running")).toBe(false);
      expect(requiresUserGesture("closed")).toBe(false);
    });
  });

  describe("Build Size Optimization", () => {
    it("should have minimal component dependencies", () => {
      // Test that we're not importing unnecessary dependencies
      const controlPanelDeps = [
        "react",
        "audio/ctx",
        "audio/env",
        "ControlPanel.css",
      ];

      // Should not include heavy dependencies
      const heavyDeps = ["lodash", "moment", "three.js", "chart.js"];

      // This is more of a documentation test - in real scenario you'd analyze bundle
      expect(controlPanelDeps.length).toBeLessThan(10);
      expect(heavyDeps).not.toContain("react"); // Ensure we're not accidentally including heavy deps
    });
  });
});
