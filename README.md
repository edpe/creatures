# Creatures Audio App

A minimal React + Vite TypeScript project for a fully client-side audio application with ambient environment sounds.

## Features

- **AudioContext Bootstrap**: Resumes on user gesture with interactive latency hint
- **Environment Worklet**: Generates quiet ambient bed with:
  - Pink noise using Voss-McCartney algorithm
  - Gentle drone tones with triangle waves
  - Environmental parameter control (light, wind, humidity, temperature)
  - Conservative levels with -12 dBFS headroom

## Project Structure

```
/
├── public/
│   └── worklets/
│       └── environment-processor.js    # AudioWorklet processor
├── src/
│   ├── audio/
│   │   ├── ctx.ts                     # Audio context service
│   │   └── env.ts                     # Environment worklet loader
│   ├── App.tsx                        # Main React component
│   ├── App.css                        # Styles
│   ├── main.tsx                       # App entry point
│   └── index.css                      # Global styles
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

4. Click "Start" to initialize the audio context

5. Use the environment parameter sliders to control the ambient bed:
   - **Light**: Affects filter brightness
   - **Wind**: Controls wind noise level
   - **Humidity**: Adds to ambient noise
   - **Temperature**: Slightly detunes the drone
   - **Master Gain**: Overall volume control

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
✅ Clicking Start changes status to "running"
✅ Environment parameter sliders audibly affect the ambient bed
✅ Overall level maintains conservative headroom
