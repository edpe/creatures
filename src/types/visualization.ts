/**
 * Visualization data types for real-time simulation display
 */

export interface AgentVisualization {
  id: number;
  x: number; // Canvas position 0-1
  y: number; // Canvas position 0-1
  size: number; // Agent size 0-1
  energy: number; // Energy level 0-1
  timbre: number; // Current timbre 0-1
  isPlaying: boolean; // Currently playing a note
  playingUntil: number; // Timestamp when note flash should end
  noteStartTime: number; // When the current note started (audio time)
  noteDuration: number; // Duration of the current note in seconds
  hue: number; // Color hue 0-360 degrees
  socialStatus: number; // Social status 0-1 for movement dynamics
}

export interface EnvironmentVisualization {
  light: number; // 0-1
  wind: number; // 0-1
  humidity: number; // 0-1
  temperature: number; // 0-1
}

export interface BeatVisualization {
  globalPhase: number; // Global beat phase 0-2π
  coherence: number; // Phase coherence 0-1
  intensity: number; // Beat pulse intensity 0-1
}

export interface SimulationSnapshot {
  timestamp: number;
  agents: AgentVisualization[];
  environment: EnvironmentVisualization;
  beat: BeatVisualization;
}
