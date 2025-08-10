/**
 * Test setup file
 * Mocks AudioContext and related Web Audio API interfaces
 */
import { vi } from "vitest";

// Mock Worker class that will be used for both global Worker and SimWorker
class MockWorkerClass {
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public scriptURL?: string, public options?: WorkerOptions) {}

  postMessage(message: any) {
    // Echo back for testing
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: message } as MessageEvent);
      }
    }, 0);
  }

  addEventListener(type: string, listener: EventListener) {
    if (type === "message" && typeof listener === "function") {
      this.onmessage = listener as any;
    }
  }

  removeEventListener(type: string, _listener: EventListener) {
    if (type === "message") {
      this.onmessage = null;
    }
  }

  terminate() {}
}

// Mock AudioContext and related APIs
class MockAudioContext {
  state: AudioContextState = "suspended";
  sampleRate = 48000;
  currentTime = 0;
  destination = {};

  constructor() {
    this.currentTime = 0;
  }

  async resume() {
    this.state = "running";
  }

  async suspend() {
    this.state = "suspended";
  }

  createGain() {
    return {
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  async addModule() {
    // Mock worklet loading
    return Promise.resolve();
  }

  get audioWorklet() {
    return {
      addModule: this.addModule.bind(this),
    };
  }
}

class MockAudioWorkletNode {
  port = {
    postMessage: vi.fn(),
    onmessage: null,
  };

  connect = vi.fn();
  disconnect = vi.fn();

  constructor(
    public context: MockAudioContext,
    public processorName: string,
    public options?: any
  ) {}
}

// Global mocks
globalThis.AudioContext = MockAudioContext as any;
globalThis.AudioWorkletNode = MockAudioWorkletNode as any;

// Mock Worker
globalThis.Worker = MockWorkerClass as any;

// Mock the SimWorker import specifically
vi.mock("../workers/sim.worker.ts?worker", () => {
  return {
    default: MockWorkerClass,
  };
});

// Console setup for cleaner test output
console.log = vi.fn();
console.warn = vi.fn();
console.error = vi.fn();
