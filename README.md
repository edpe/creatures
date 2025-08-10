# Creatures Audio App

A minimal React + Vite TypeScript project for a fully client-side audio application with ambient environment sounds driven by continuous simulation.

## Features

- **AudioContext Bootstrap**: Resumes on user gesture with interactive latency hint
- **Environment Worklet**: Generates quiet ambient bed with:
  - Pink noise using Voss-McCartney algorithm
  - Gentle drone tones with triangle waves
  - Environmental parameter control (light, wind, humidity, temperature)
  - Conservative levels with -12 dBFS headroom
- **Simulation Worker**: Continuously evolves environment parameters using:
  - Very slow LFOs with different periods (78-137 seconds)
  - Random walk for organic variation
  - 200ms update interval with 100ms audio look-ahead
  - No UI jank - runs entirely in background worker

## Project Structure

```
/
├── public/
│   └── worklets/
│       └── environment-processor.js    # AudioWorklet processor
├── src/
│   ├── audio/
│   │   ├── ctx.ts                     # Audio context service
│   │   └── env.ts                     # Environment worklet loader + worker integration
│   ├── workers/
│   │   └── sim.worker.ts              # Environment simulation worker
│   ├── App.tsx                        # Main React component
│   ├── App.css                        # Styles
│   ├── main.tsx                       # App entry point
│   ├── index.css                      # Global styles
│   └── vite-env.d.ts                  # Worker type definitions
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`

4. Click "Start" to initialize the audio context and begin simulation

5. Watch the environment parameters evolve automatically:
   - **Light**: Affects filter brightness (simulated - orange slider)
   - **Wind**: Controls wind noise level (simulated - orange slider)
   - **Humidity**: Adds to ambient noise (simulated - orange slider)
   - **Temperature**: Slightly detunes the drone (simulated - orange slider)
   - **Master Gain**: Overall volume control (manual - blue slider)

The first four parameters are continuously updated by the simulation worker using slow LFOs and random walk, creating a naturally breathing ambient environment. Only the Master Gain slider remains under manual control.

## Simulation Features

- **Web Worker**: Runs simulation in background thread (no UI blocking)
- **Slow Evolution**: Parameters change over 1-2 minute timescales
- **Organic Variation**: Random walk + LFO combination creates natural feel
- **Audio Scheduling**: 100ms look-ahead prevents audio dropouts
- **Raw postMessage**: Simple worker communication without external libraries

## Audio Features

- **Pink Noise**: Low-CPU Voss-McCartney algorithm
- **Drone Synthesis**: Two triangle wave oscillators with gentle filtering
- **Parameter Smoothing**: 1-3 second smoothing for all parameters
- **Wow/Flutter**: Subtle modulation for organic feel
- **Conservative Levels**: Maintains -12 dBFS headroom

## Build

```bash
npm run build
```

## Acceptance Criteria

✅ Build runs without errors  
✅ Clicking Start changes status to "running" and begins simulation  
✅ Environment parameters evolve automatically via Web Worker  
✅ The ambient bed subtly breathes over time with no UI jank  
✅ 100ms look-ahead scheduling prevents audio dropouts  
✅ Overall level maintains conservative headroom
