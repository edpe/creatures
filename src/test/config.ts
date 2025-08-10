/**
 * Test Configuration and Documentation
 *
 * This test suite preserves the core features of the Creatures Audio App:
 *
 * ## Core Features Tested:
 *
 * 1. **AudioContext Management**
 *    - Singleton pattern with interactive latency
 *    - Proper start/stop lifecycle
 *    - Error handling and recovery
 *
 * 2. **Environment Audio System**
 *    - Pink noise generation (Voss-McCartney algorithm)
 *    - Pentatonic-agnostic drone synthesis (triangle waves)
 *    - Parameter simulation with 200ms updates
 *    - Kuramoto phase coupling model
 *
 * 3. **Creature Synthesis System**
 *    - 32-voice polyphonic synthesis
 *    - 2-operator FM synthesis
 *    - Sample-accurate note scheduling
 *    - Voice pooling and allocation
 *    - Gentle envelope shaping
 *
 * 4. **Integration Features**
 *    - Dual worklet architecture
 *    - Web Worker simulation
 *    - Parameter look-ahead scheduling
 *    - Smooth parameter interpolation
 *
 * ## Quality Assurance:
 *
 * - Gentle, soft audio output (no harsh tones)
 * - Click-free envelope transitions
 * - Stable performance under load
 * - Clean voice allocation/deallocation
 *
 * ## User Workflows:
 *
 * - Start → Test Notes → Stop cycle
 * - Multiple test note sequences
 * - Error recovery scenarios
 * - Performance stress testing
 *
 * Run tests with: npm run test
 * Run with UI: npm run test:ui
 * Run once: npm run test:run
 */

export const TEST_CONFIG = {
  features: {
    pinkNoise: true,
    droneGeneration: true,
    polyphonicSynthesis: true,
    kuramotoPhase: true,
    parameterSimulation: true,
    gentleEnvelopes: true,
    sampleAccurateTiming: true,
    voicePooling: true,
  },

  performance: {
    maxVoices: 32,
    lookAheadTime: 0.1, // 100ms
    updateRate: 200, // Environment updates every 200ms
    phaseRate: 50, // Phase updates every 50ms
  },

  audio: {
    sampleRate: 48000,
    latencyHint: "interactive",
    blockSize: 128,
  },
};
