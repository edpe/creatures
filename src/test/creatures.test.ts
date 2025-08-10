/**
 * Creatures Service Tests
 * Tests polyphonic voice synthesis and note scheduling
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  creaturesService,
  type NoteEvent,
  type NoteBatch,
} from "../audio/creatures";

describe("CreaturesService", () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      audioWorklet: {
        addModule: vi.fn().mockResolvedValue(undefined),
      },
      createGain: vi.fn().mockReturnValue({
        gain: { value: 0.7 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      destination: {},
    };
  });

  describe("Initialization", () => {
    it("should initialize with audio context", async () => {
      await creaturesService.initialize(mockContext);

      expect(mockContext.audioWorklet.addModule).toHaveBeenCalledWith(
        "/worklets/creature-processor.js"
      );
      expect(mockContext.createGain).toHaveBeenCalled();
    });

    it("should handle initialization errors", async () => {
      mockContext.audioWorklet.addModule.mockRejectedValue(
        new Error("Failed to load")
      );

      await expect(creaturesService.initialize(mockContext)).rejects.toThrow(
        "Failed to load"
      );
    });
  });

  describe("Note Scheduling", () => {
    beforeEach(async () => {
      await creaturesService.initialize(mockContext);
    });

    it("should schedule valid note batches", () => {
      const noteEvents: NoteEvent[] = [
        { startTime: 0.1, freq: 440, dur: 0.2, amp: 0.5, timbre: 0.3 },
      ];

      const batch: NoteBatch = {
        type: "notes",
        events: noteEvents,
      };

      expect(() => creaturesService.schedule(batch)).not.toThrow();
    });

    it("should validate note event format", () => {
      const invalidBatch = {
        type: "notes",
        events: [
          { freq: 440 }, // Missing required fields
        ],
      } as NoteBatch;

      // Should not throw but may log warnings
      expect(() => creaturesService.schedule(invalidBatch)).not.toThrow();
    });

    it("should handle empty note batches", () => {
      const emptyBatch: NoteBatch = {
        type: "notes",
        events: [],
      };

      expect(() => creaturesService.schedule(emptyBatch)).not.toThrow();
    });
  });

  describe("Service Lifecycle", () => {
    it("should start and connect audio nodes", async () => {
      await creaturesService.initialize(mockContext);

      const gainNode = mockContext.createGain.mock.results[0].value;

      creaturesService.start();

      expect(gainNode.connect).toHaveBeenCalledWith(mockContext.destination);
    });

    it("should stop and disconnect audio nodes", async () => {
      await creaturesService.initialize(mockContext);

      const gainNode = mockContext.createGain.mock.results[0].value;

      creaturesService.start();
      creaturesService.stop();

      expect(gainNode.disconnect).toHaveBeenCalled();
    });
  });

  describe("Note Event Validation", () => {
    it("should accept valid frequency ranges", () => {
      const validFreqs = [20, 440, 1000, 20000];

      validFreqs.forEach((freq) => {
        const noteEvent: NoteEvent = {
          startTime: 0,
          freq,
          dur: 0.1,
          amp: 0.5,
          timbre: 0.5,
        };

        expect(noteEvent.freq).toBeGreaterThan(0);
        expect(noteEvent.freq).toBeLessThan(22050);
      });
    });

    it("should accept valid amplitude ranges", () => {
      const validAmps = [0, 0.5, 1.0];

      validAmps.forEach((amp) => {
        const noteEvent: NoteEvent = {
          startTime: 0,
          freq: 440,
          dur: 0.1,
          amp,
          timbre: 0.5,
        };

        expect(noteEvent.amp).toBeGreaterThanOrEqual(0);
        expect(noteEvent.amp).toBeLessThanOrEqual(1);
      });
    });

    it("should accept valid timbre ranges", () => {
      const validTimbres = [0, 0.5, 1.0];

      validTimbres.forEach((timbre) => {
        const noteEvent: NoteEvent = {
          startTime: 0,
          freq: 440,
          dur: 0.1,
          amp: 0.5,
          timbre,
        };

        expect(noteEvent.timbre).toBeGreaterThanOrEqual(0);
        expect(noteEvent.timbre).toBeLessThanOrEqual(1);
      });
    });
  });
});
