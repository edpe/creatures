/**
 * Audio Context Service Tests
 * Tests core audio functionality and service lifecycle
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the creatures service
vi.mock("../audio/creatures", () => ({
  creaturesService: {
    schedule: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

// Mock the environment service
vi.mock("../audio/env", () => ({
  environmentService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    addUpdateListener: vi.fn(),
    removeUpdateListener: vi.fn(),
    getCurrentPhaseSnapshot: vi.fn().mockReturnValue(null),
  },
}));

import { audioService } from "../audio/ctx";
import { creaturesService } from "../audio/creatures";
import { environmentService } from "../audio/env";

describe("AudioService", () => {
  beforeEach(() => {
    // Reset service state
    audioService["_isRunning"] = false;
    audioService["_context"] = null;
    audioService["_environmentLoaded"] = false;
    audioService["_creaturesLoaded"] = false;

    // Reset mocks
    (creaturesService.schedule as any).mockClear();
    (creaturesService.initialize as any).mockClear();
    (creaturesService.start as any).mockClear();
    (creaturesService.stop as any).mockClear();

    (environmentService.initialize as any).mockClear();
    (environmentService.start as any).mockClear();
    (environmentService.stop as any).mockClear();
  });

  describe("Context Creation", () => {
    it("should create AudioContext with interactive latency hint", () => {
      const context = audioService.context;
      expect(context).toBeDefined();
      expect(context.state).toBe("suspended");
    });

    it("should return same context instance (singleton)", () => {
      const context1 = audioService.context;
      const context2 = audioService.context;
      expect(context1).toBe(context2);
    });

    it("should report correct sample rate", () => {
      const sampleRate = audioService.getSampleRate();
      expect(sampleRate).toBe(48000);
    });
  });

  describe("Service Lifecycle", () => {
    it("should start services and resume context", async () => {
      expect(audioService.isRunning).toBe(false);

      await audioService.start();

      expect(audioService.isRunning).toBe(true);
      expect(audioService.context.state).toBe("running");
    });

    it("should stop services and suspend context", async () => {
      await audioService.start();
      expect(audioService.isRunning).toBe(true);

      await audioService.stop();

      expect(audioService.isRunning).toBe(false);
      expect(audioService.context.state).toBe("suspended");
    });

    it("should handle start errors gracefully", async () => {
      // Mock context.resume to throw
      const originalResume = audioService.context.resume;
      audioService.context.resume = vi
        .fn()
        .mockRejectedValue(new Error("Mock error"));

      await expect(audioService.start()).rejects.toThrow("Mock error");

      // Restore
      audioService.context.resume = originalResume;
    });
  });

  describe("State Management", () => {
    it("should report correct state", async () => {
      expect(audioService.getState()).toBe("suspended");

      await audioService.start();
      expect(audioService.getState()).toBe("running");

      await audioService.stop();
      expect(audioService.getState()).toBe("suspended");
    });

    it("should track running state correctly", async () => {
      expect(audioService.isRunning).toBe(false);

      await audioService.start();
      expect(audioService.isRunning).toBe(true);

      await audioService.stop();
      expect(audioService.isRunning).toBe(false);
    });
  });

  describe("Test Harness", () => {
    it("should schedule test notes when running", async () => {
      await audioService.start();

      // Clear any previous calls
      (creaturesService.schedule as any).mockClear();

      await audioService.testCreatureNotes();

      expect(creaturesService.schedule).toHaveBeenCalledWith({
        type: "notes",
        events: expect.arrayContaining([
          expect.objectContaining({
            freq: 261.63, // C4
            amp: expect.any(Number),
            dur: expect.any(Number),
            startTime: expect.any(Number),
            timbre: expect.any(Number),
          }),
        ]),
      });
    });

    it("should not schedule notes when not running", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await audioService.testCreatureNotes();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Audio context not running - cannot test creature notes"
      );
      consoleSpy.mockRestore();
    });

    it("should schedule exactly 5 pentatonic notes", async () => {
      await audioService.start();

      // Clear any previous calls
      (creaturesService.schedule as any).mockClear();

      await audioService.testCreatureNotes();

      expect(creaturesService.schedule).toHaveBeenCalledWith({
        type: "notes",
        events: expect.arrayContaining([
          expect.objectContaining({ freq: 261.63 }), // C4
          expect.objectContaining({ freq: 293.66 }), // D4
          expect.objectContaining({ freq: 329.63 }), // E4
          expect.objectContaining({ freq: 392.0 }), // G4
          expect.objectContaining({ freq: 440.0 }), // A4
        ]),
      });

      const call = (creaturesService.schedule as any).mock.calls[0][0];
      expect(call.events).toHaveLength(5);
    });
  });
});
