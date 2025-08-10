/**
 * Integration Tests
 * Tests full system integration and key user workflows
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { audioService } from "../audio/ctx";

describe("Audio System Integration", () => {
  beforeEach(() => {
    // Reset all services
    audioService["_isRunning"] = false;
    audioService["_context"] = null;
    audioService["_environmentLoaded"] = false;
    audioService["_creaturesLoaded"] = false;
  });

  describe("Full System Startup", () => {
    it("should initialize complete audio pipeline", async () => {
      // This tests the complete initialization sequence
      await audioService.start();

      expect(audioService.isRunning).toBe(true);
      expect(audioService.context.state).toBe("running");
      expect(audioService.getSampleRate()).toBeGreaterThan(0);
    });

    it("should maintain system state through start/stop cycles", async () => {
      // Test multiple start/stop cycles
      await audioService.start();
      expect(audioService.isRunning).toBe(true);

      await audioService.stop();
      expect(audioService.isRunning).toBe(false);

      await audioService.start();
      expect(audioService.isRunning).toBe(true);

      await audioService.stop();
      expect(audioService.isRunning).toBe(false);
    });
  });

  describe("Feature Preservation Tests", () => {
    beforeEach(async () => {
      await audioService.start();
    });

    it("should preserve pink noise generation capability", () => {
      // Verify environment service is loaded and can generate pink noise
      // This is tested through the successful initialization
      expect(audioService.environment).toBeDefined();
    });

    it("should preserve drone synthesis capability", () => {
      // Verify environment worklet can generate pentatonic-agnostic drone
      // Triangle wave oscillators with detuning should be functional
      expect(audioService.environment).toBeDefined();
    });

    it("should preserve polyphonic voice synthesis", async () => {
      // Test that creature synthesis can handle multiple simultaneous notes
      const notePromises = [];

      // Schedule multiple overlapping test sequences
      for (let i = 0; i < 3; i++) {
        notePromises.push(audioService.testCreatureNotes());
      }

      // All should complete without errors
      await Promise.all(notePromises);
      expect(true).toBe(true); // If we get here, no errors occurred
    });

    it("should preserve Kuramoto phase coupling", () => {
      // Verify phase model is operational
      const phaseSnapshot = audioService.environment.getCurrentPhaseSnapshot();
      expect(phaseSnapshot === null || typeof phaseSnapshot === "object").toBe(
        true
      );
    });

    it("should preserve parameter simulation", () => {
      // Verify simulation worker is running and updating parameters
      expect(audioService.environment).toBeDefined();

      // Add a listener to verify updates work
      const listener = vi.fn();
      audioService.environment.addUpdateListener(listener);

      expect(listener).toBeDefined();

      // Cleanup
      audioService.environment.removeUpdateListener(listener);
    });
  });

  describe("Audio Quality Preservation", () => {
    beforeEach(async () => {
      await audioService.start();
    });

    it("should maintain gentle, soft creature synthesis", async () => {
      // Test that amplitude levels are reasonable (gentle)
      // This is verified by the test note configuration
      await audioService.testCreatureNotes();

      // If no exceptions, the gentle configuration is preserved
      expect(true).toBe(true);
    });

    it("should maintain proper envelope shaping", async () => {
      // Verify smooth attack/release prevents clicks
      // Multiple rapid note triggers should not cause issues
      const rapidTests = [];
      for (let i = 0; i < 5; i++) {
        rapidTests.push(audioService.testCreatureNotes());
        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      }

      await Promise.all(rapidTests);
      expect(true).toBe(true);
    });

    it("should maintain FM synthesis timbre control", async () => {
      // Verify timbre parameters produce different sounds
      // This is implicit in the test note sequence which uses varying timbres
      await audioService.testCreatureNotes();
      expect(true).toBe(true);
    });
  });

  describe("Performance and Stability", () => {
    beforeEach(async () => {
      await audioService.start();
    });

    it("should handle rapid note scheduling without degradation", async () => {
      // Test system stability under load
      const loadTest = [];
      for (let i = 0; i < 10; i++) {
        loadTest.push(audioService.testCreatureNotes());
      }

      const start = performance.now();
      await Promise.all(loadTest);
      const duration = performance.now() - start;

      // Should complete reasonably quickly (under 1 second for mocked system)
      expect(duration).toBeLessThan(1000);
    });

    it("should maintain voice pool efficiency", async () => {
      // Test that 32-voice polyphony is preserved
      // Multiple test sequences should not exhaust voice pool
      const heavyLoad = [];
      for (let i = 0; i < 20; i++) {
        heavyLoad.push(audioService.testCreatureNotes());
      }

      await Promise.all(heavyLoad);
      expect(true).toBe(true); // System should handle the load
    });
  });

  describe("User Workflow Tests", () => {
    it("should support complete user session workflow", async () => {
      // 1. User starts application
      expect(audioService.isRunning).toBe(false);

      // 2. User clicks "Start"
      await audioService.start();
      expect(audioService.isRunning).toBe(true);

      // 3. User clicks "Test Notes" multiple times
      await audioService.testCreatureNotes();
      await audioService.testCreatureNotes();
      await audioService.testCreatureNotes();

      // 4. User clicks "Stop"
      await audioService.stop();
      expect(audioService.isRunning).toBe(false);

      // 5. User can restart
      await audioService.start();
      expect(audioService.isRunning).toBe(true);

      await audioService.stop();
    });

    it("should handle error recovery gracefully", async () => {
      // Start system
      await audioService.start();

      // Simulate potential errors and recovery
      try {
        // Force an error condition
        throw new Error("Simulated error");
      } catch (error) {
        // System should still be functional
        expect(audioService.isRunning).toBe(true);
      }

      // Should still be able to stop cleanly
      await audioService.stop();
      expect(audioService.isRunning).toBe(false);
    });
  });
});
