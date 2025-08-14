# Creatures Audio App

A React + Vite TypeScript application featuring intelligent musical creatures that generate ambient soundscapes through emergent social behavior and advanced audio synthesis.

## Core Features

### 🎵 **Intelligent Musical Creatures**
- **16 Autonomous Agents**: Each creature has unique characteristics (size, energy, social status)
- **Emergent Learning**: Creatures learn musical preferences through social interaction
- **Conversation System**: Multi-turn conversations with social energy dynamics
- **ADSR Envelope Synthesis**: Realistic note attack, decay, sustain, and release phases
- **Real-time Visualization**: See creatures pulse and move as they make music

### 🧠 **Advanced AI Systems**
- **Kuramoto Phase Coupling**: Weakly coupled oscillators create natural rhythm synchronization
- **Social Hierarchy**: Dynamic status system affects creature behavior and movement
- **Territory & Foraging**: Energy management through spatial resource gathering
- **Chromatic Learning**: 12-tone musical scale learning with harmonic preference development
- **Conversational Intelligence**: Context-aware multi-agent communication patterns

### 🎨 **Dynamic Visualization**
- **Social Movement**: Creatures move based on attraction/repulsion dynamics
- **Status Visualization**: Size, borders, and connections reflect social hierarchy
- **Envelope-Matched Effects**: Visual pulses sync precisely with audio note durations
- **Real-time Connections**: See social relationships between nearby creatures
- **Beat Pulse Background**: Global rhythm visualization with coherence tracking

### 🔊 **Professional Audio Engine**
- **Web Audio Worklets**: High-performance, low-latency audio processing
- **Multi-Voice Synthesis**: Up to 4 simultaneous creature voices with individual ADSR
- **Microtonal Accuracy**: Precise frequency control with subtle pitch variations
- **Environmental Audio**: Pink noise and drone synthesis for ambient atmosphere
- **Dynamic Range**: Conservative -12 dBFS headroom with professional audio standards

## Creature Behavior System

### 🎭 **Social Dynamics**
- **Energy Management**: Creatures consume energy when speaking, recharge over time
- **Status Hierarchy**: Dynamic social ranking affects movement and influence
- **Territory System**: Spatial foraging for energy resources
- **Conversation Clustering**: Multi-agent conversations with response windows
- **Validation Rewards**: Social feedback mechanisms for cooperative behavior

### 🎼 **Musical Intelligence**
- **Emergent Learning**: 12-degree chromatic scale preference development
- **Harmonic Awareness**: Creatures learn pleasant intervals (3rds, 4ths, 5ths)
- **Stepwise Motion**: Bias toward melodic movement over large leaps
- **Innovation**: 1% chance for creative exploration of new musical territory
- **Day/Night Modes**: Tonal center shifts based on environmental light levels

### 🌍 **Environmental Simulation**
- **Multi-Parameter System**: Light, wind, humidity, temperature with slow LFO evolution
- **Organic Variation**: Random walk + sine wave combination for natural breathing
- **78-137 Second Cycles**: Very slow environmental changes for meditative experience
- **Audio Scheduling**: 100ms look-ahead prevents dropouts and glitches

## Technical Architecture

### 🔧 **Audio Processing**
```
Audio Context
├── Environment Worklet (Pink noise + drone synthesis)
├── Creature Worklet (4-voice ADSR synthesis)
└── Master Gain (User-controlled volume)
```

### 🧮 **Computation Pipeline**
```
Simulation Worker (50ms updates)
├── Kuramoto Phase Coupling
├── Social Behavior Simulation  
├── Note Generation & Learning
├── Movement Dynamics
└── Visualization Data → React Component
```

### 📊 **Data Flow**
```
Worker Thread                    Main Thread
──────────────                  ─────────────
Environment Sim    ──postMessage──>  Audio Worklets
Kuramoto Model     ──postMessage──>  Visualization
Social Dynamics    ──postMessage──>  React UI
Movement System    ──postMessage──>  Canvas Renderer
```

## Project Structure

```
/
├── public/
│   └── worklets/
│       ├── environment-processor.js    # Pink noise + drone synthesis
│       └── creature-processor.js       # 4-voice ADSR creature synthesis
├── src/
│   ├── audio/
│   │   ├── ctx.ts                     # Audio context service
│   │   └── env.ts                     # Worklet management + worker integration
│   ├── components/
│   │   └── Visualiser.tsx             # Real-time creature visualization
│   ├── types/
│   │   └── visualization.ts           # Type definitions for agent data
│   ├── workers/
│   │   └── sim.worker.ts              # Complete creature simulation system
│   ├── App.tsx                        # Main React component
│   ├── App.css                        # Styles
│   ├── main.tsx                       # App entry point
│   ├── index.css                      # Global styles
│   └── vite-env.d.ts                  # Worker type definitions
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Interactive Features

### 🎮 **Real-Time Controls**
- **Master Volume**: User-controlled audio level
- **Start/Stop**: Audio context management with user gesture compliance
- **Visual Feedback**: Live creature status, energy levels, and social connections

### 👁️ **Complete Visual System Guide**

The visualization system provides real-time insight into the complex social and musical dynamics of the creature ecosystem. Every visual element has meaning and corresponds to underlying behavioral systems.

#### **🎨 Creature Representation**
- **Circle Size**: Dynamic sizing based on both intrinsic agent size (0-1) and social status
  - Base radius: 5-20 pixels depending on agent's natural size
  - Status modifier: High-status creatures appear 60% larger, low-status 30% smaller
  - Creates natural visual hierarchy reflecting social dominance

- **Color System**: Multi-layered HSL color encoding
  - **Hue**: Base energy level (0-360°) - red = low energy, green = medium, blue = high
  - **Playing State**: When making sounds, hue shifts to represent musical note (timbre 0-1 → 0-360°)
  - **Saturation**: 50-100% based on musical timbre - more colorful = more harmonic content
  - **Lightness**: 40-70% based on energy level - brighter = more energetic

- **Border Effects**: Social status indicators
  - **High Status** (>0.6): Gold borders (45° hue) with thick lines (up to 3px)
  - **Low Status** (<0.4): Red borders (0° hue) with thin lines (1px)
  - **Alpha**: Border opacity reflects status strength (0.6 + status × 0.4)

#### **🔊 Audio-Visual Synchronization**
- **Envelope-Matched Pulses**: Visual effects precisely sync with audio ADSR envelopes
  - **Attack Phase** (5% of note): Rapid visual brightness increase
  - **Decay Phase** (15% of note): Fall to 70% sustain level  
  - **Sustain Phase** (70% of note): Stable visual intensity
  - **Release Phase** (10% of note): Smooth fade to silence
  - Creates perfect audio-visual correspondence

- **Ripple Effects**: Concentric rings emanating from playing creatures
  - **3 Ripple Layers**: Each with decreasing alpha and increasing radius
  - **Envelope Scaling**: Ripple size and intensity based on note envelope
  - **Color Matching**: Ripples use same hue as creature's current musical note

- **Glow Effects**: Dynamic shadow/glow around playing creatures
  - **Shadow Color**: Matches current musical hue at 100% saturation
  - **Blur Radius**: 0-40px based on envelope intensity
  - **Duration**: Active only during actual note playback

#### **🤝 Social Dynamics Visualization**
- **Connection Lines**: Real-time social relationship indicators
  - **Green Lines**: Positive social interactions (mutual benefit)
  - **Red Lines**: Negative interactions (competition/repulsion)
  - **Line Width**: Relationship strength (1-4px)
  - **Alpha**: Interaction frequency and recent activity
  - **Distance Threshold**: Only shown for nearby creatures (within social range)

- **Movement Patterns**: Physics-based social positioning
  - **Attraction Forces**: High-status creatures draw others toward them
  - **Repulsion Forces**: Overcrowding and low-status avoidance
  - **Centering Force**: Prevents ecosystem drift beyond viewing area
  - **Random Walk**: Small-scale exploration and natural variation
  - **Velocity Visualization**: Trailing effects show movement direction

#### **🌍 Resource & Territory System**
- **Resource Zones**: Colored arcs around the territorial circle
  - **Color Coding**: Red (scarce) → Yellow (moderate) → Green (abundant)
  - **24 Zones**: Complete 360° resource map sampled at 15° intervals
  - **Alpha Variation**: 0.3-0.7 transparency based on abundance level
  - **Sinusoidal Distribution**: Resources follow mathematical abundance curve

- **Territory Indicators**: Individual agent resource-seeking positions
  - **Blue Dots**: Normal territory markers showing where each agent is "looking"
  - **Brightness**: Reflects foraging efficiency (30-80% lightness)
  - **Position**: Agent's current territoryPhase around the resource circle
  - **Updates**: Continuously moves as agents explore their territory

- **Foraging Status**: Active resource gathering visualization
  - **Pulsing Green Circles**: Active foragers get animated 3-7px green indicators
  - **Orbital Particles**: 3 rotating particles around foraging creatures
  - **Pulse Timing**: Synchronized with real-time timestamp for natural rhythm
  - **Efficiency Indicators**: Small colored dots showing foraging skill level

#### **🔄 Environmental Representation**
- **Parameter Bars**: Real-time environmental state (top-left corner)
  - **Light**: Yellow bar (affects day/night musical modes)
  - **Wind**: Blue bar (atmospheric variation)
  - **Humidity**: Green bar (moisture levels)
  - **Temperature**: Orange bar (thermal variation)
  - **Update Frequency**: Every 200ms with smooth LFO + random walk evolution

- **Beat Pulse Background**: Global rhythm synchronization
  - **Ring Pulse**: Subtle expanding ring at canvas center
  - **Coherence-Based**: Alpha = 0.3 × phase coherence level
  - **Color**: Light blue (200° hue) for calming background effect
  - **Radius**: Proportional to global beat phase state

#### **⚡ Real-Time Status Effects**
- **Foraging Animations**: Multi-layered effects for resource gathering
  - **Primary Glow**: Pulsing green outline (120° hue) around foraging creatures
  - **Particle System**: 3 orbiting resource particles with physics-based rotation
  - **Pulse Intensity**: 0.5 + 0.5 × sin(time) for natural breathing effect
  - **Layered Alpha**: Multiple transparency levels for depth

- **Social Energy Visualization**: Behavioral state indicators
  - **Speaking Energy**: Affects creature brightness and activity level
  - **Energy Depletion**: Dimmer creatures indicate low energy reserves
  - **Recharge Cycles**: Gradual brightness recovery during rest periods
  - **Status Decay**: Visual indication of social standing changes

#### **🎵 Musical Learning Indicators**
- **Timbre Representation**: Current musical content visualization
  - **Hue Mapping**: Last played note degree (0-11) mapped to color wheel
  - **Scale Learning**: Visual indication of harmonic preference development
  - **Innovation Events**: Color shifts during musical exploration (1% chance)
  - **Memory Visualization**: Recent note history affects color stability

#### **🔍 Debug & Analysis Features**
- **Phase Coherence Display**: Kuramoto model synchronization level
- **Global Beat Tracking**: Collective rhythm state in degrees  
- **Agent ID Labels**: Numeric identifiers for behavior tracking
- **Performance Monitoring**: Frame rate and update frequency display
- **Interaction Logging**: Console output for social events and musical decisions

The entire visualization system updates at 60fps with smooth interpolation, providing real-time insight into one of the most complex artificial life systems ever implemented in a web browser. Every pixel has meaning, every color represents data, and every movement reflects the underlying social and musical intelligence of the creature ecosystem.

### 🔬 **Debug Information**
- **Phase Coherence**: Kuramoto model synchronization level (0-1)
- **Global Beat Phase**: Collective rhythm state in degrees
- **Agent Count**: Number of active creatures (16)
- **Note Generation Logs**: Real-time musical event tracking
- **Social Interaction Logs**: Conversation and status change events

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser** to `http://localhost:5173`

4. **Click "Start"** to initialize the audio context and begin the creature simulation

5. **Watch the ecosystem emerge:**
   - Creatures will begin moving and forming social groups
   - Listen for gentle musical conversations as they interact
   - Observe visual pulses that sync perfectly with audio notes
   - Notice how high-status creatures attract followers
   - See the environment parameters slowly evolve over time

6. **Adjust the Master Gain** slider to your preferred listening level

## What You'll Experience

### 🎧 **Audio Experience**
- **Ambient Foundation**: Subtle pink noise and drone tones create a meditative base
- **Creature Voices**: Soft, contemplative musical notes with 1.5-6 second durations
- **Harmonic Evolution**: Creatures gradually develop musical preferences through learning
- **Social Rhythms**: Conversation patterns create natural musical phrases
- **Environmental Breathing**: Slow parameter changes over 1-2 minute cycles

### 👀 **Visual Experience**  
- **Living Ecosystem**: 16 creatures moving in realistic social formations
- **Status Dynamics**: Watch social hierarchies form and evolve
- **Musical Visualization**: Precise visual timing matching audio envelopes
- **Connection Networks**: See social relationships between nearby creatures
- **Environmental Flow**: Slow-breathing background pulse reflecting global rhythm

### 🧘 **Intended Use**
- **Ambient Background**: Perfect for work, study, or meditation
- **Generative Art**: Ever-changing audio-visual composition
- **System Observation**: Fascinating emergence of complex behavior from simple rules
- **Relaxation**: Gentle, non-intrusive soundscape for stress relief

## Advanced Features

### 🤖 **AI & Machine Learning**
- **Reinforcement Learning**: Creatures adjust musical preferences based on social feedback
- **Emergent Harmony**: No pre-programmed scales - harmony emerges from social interaction
- **Adaptive Behavior**: Movement patterns evolve based on social success/failure
- **Memory Systems**: Creatures remember recent musical interactions and social events

### 🎵 **Musical Systems**
- **Microtonal Precision**: Subtle pitch variations within 1/8 tone accuracy
- **Dynamic Timbres**: Soft FM synthesis with evolving harmonic content
- **Conversation Structure**: Multi-turn musical dialogues with response timing
- **Chromatic Freedom**: Full 12-tone exploration with learned harmonic biases

### ⚙️ **Performance Optimizations**
- **Web Workers**: All heavy computation off the main thread
- **Audio Worklets**: Sample-accurate, low-latency audio processing
- **RequestAnimationFrame**: Smooth 60fps visualization without blocking
- **Memory Management**: Pre-allocated buffers and object pooling
- **Efficient Rendering**: Canvas optimizations for 16+ moving objects

## Build & Deployment

```bash
# Development build
npm run dev

# Production build  
npm run build

# Preview production build
npm run preview
```

The built application is fully client-side and can be deployed to any static hosting service (Netlify, Vercel, GitHub Pages, etc.).

## Acceptance Criteria

✅ **Core Audio System**
- Build runs without errors  
- Clicking Start initializes audio context and begins simulation  
- Environment parameters evolve automatically via Web Worker  
- Audio maintains conservative headroom with no distortion
- 100ms look-ahead scheduling prevents dropouts

✅ **Kuramoto Phase Coupling**  
- 16 agents show synchrony/divergence behavior
- Phase coherence tracking demonstrates coupling strength
- Ring topology with nearest-neighbor interactions
- Natural frequency variation creates organic rhythm

✅ **Creature Intelligence**
- Social hierarchy system with dynamic status updates
- Territory and foraging for energy management  
- Multi-agent conversation patterns with response windows
- Emergent learning of musical scale preferences
- Harmonic interval recognition and preference development

✅ **Advanced Visualization**
- Real-time creature movement based on social dynamics
- Visual pulse effects synchronized to audio envelope timing
- Social connection lines between interacting creatures
- Status-based visual styling (size, borders, colors)
- Environmental parameter visualization with slow breathing

✅ **Professional Audio Quality**
- ADSR envelope synthesis for realistic note shaping
- 4-voice polyphonic creature synthesis
- Pink noise and drone ambient bed
- Microtonal accuracy with pitch variation
- Professional dynamic range management

## Research & Inspiration

This project explores several cutting-edge areas:

- **Emergent Behavior**: Complex social patterns from simple local rules
- **Musical AI**: Machine learning applied to harmonic and melodic generation  
- **Phase Coupling**: Kuramoto model applications in musical timing
- **Spatial Audio**: Position-based sound synthesis and social acoustics
- **Generative Systems**: Long-form composition through autonomous agents

The system demonstrates how relatively simple behavioral rules can create rich, evolving musical experiences that feel organic and purposeful without explicit composition or arrangement.
