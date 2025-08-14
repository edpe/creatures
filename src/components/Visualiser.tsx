import React, { useEffect, useRef, useState } from "react";
import type { SimulationSnapshot } from "../types/visualization";

interface VisualiserProps {
  width?: number;
  height?: number;
  className?: string;
  snapshot?: SimulationSnapshot | null;
}

export const Visualiser: React.FC<VisualiserProps> = ({
  width = 800,
  height = 600,
  className = "",
  snapshot: propSnapshot,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);

  // Pre-computed positions for agents (avoid allocations in render loop)
  const agentPositions = useRef<Array<{ x: number; y: number }>>([]);

  // Update snapshot when prop changes
  useEffect(() => {
    if (propSnapshot) {
      setSnapshot(propSnapshot);
    }
  }, [propSnapshot]);

  // Initialize agent positions in a circle layout
  useEffect(() => {
    const numAgents = 16;
    const centerX = 0.5;
    const centerY = 0.5;
    const radius = 0.3;

    agentPositions.current = Array.from({ length: numAgents }, (_, i) => {
      const angle = (i / numAgents) * 2 * Math.PI;
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = (timestamp: number) => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      if (snapshot) {
        renderVisualization(ctx, snapshot, timestamp);
      } else {
        // Show "waiting for data" state
        renderWaitingState(ctx, timestamp);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [snapshot, width, height]);

  const renderVisualization = (
    ctx: CanvasRenderingContext2D,
    snapshot: SimulationSnapshot,
    timestamp: number
  ) => {
    // Performance: avoid allocations in render loop
    ctx.save();

    // 1. Render beat pulse background
    renderBeatPulse(ctx, snapshot.beat, timestamp);

    // 2. Render environment bars
    renderEnvironmentBars(ctx, snapshot.environment);

    // 3. Render agents
    renderAgents(ctx, snapshot.agents, snapshot, timestamp);

    ctx.restore();
  };

  const renderBeatPulse = (
    ctx: CanvasRenderingContext2D,
    beat: SimulationSnapshot["beat"],
    _timestamp: number
  ) => {
    if (!beat) return;

    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const maxRadius = Math.min(width, height) * 0.4;

    // Beat pulse intensity based on phase
    const pulseIntensity =
      (Math.sin(beat.globalPhase) + 1) * 0.5 * beat.coherence;
    const radius = maxRadius * (0.8 + pulseIntensity * 0.2);

    // Draw subtle ring pulse
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = `hsla(200, 50%, 70%, ${pulseIntensity * 0.3})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const renderEnvironmentBars = (
    ctx: CanvasRenderingContext2D,
    env: SimulationSnapshot["environment"]
  ) => {
    if (!env) return;

    const barWidth = 100;
    const barHeight = 8;
    const startX = 20;
    const startY = 20;
    const spacing = 15;

    const params = [
      { label: "Light", value: env.light, color: "#FFD700" },
      { label: "Wind", value: env.wind, color: "#87CEEB" },
      { label: "Humidity", value: env.humidity, color: "#98FB98" },
      { label: "Temperature", value: env.temperature, color: "#FFA07A" },
    ];

    ctx.font = "12px Arial";
    params.forEach((param, i) => {
      const y = startY + i * spacing;

      // Background bar
      ctx.fillStyle = "#333";
      ctx.fillRect(startX, y, barWidth, barHeight);

      // Value bar
      ctx.fillStyle = param.color;
      ctx.fillRect(startX, y, barWidth * param.value, barHeight);

      // Label
      ctx.fillStyle = "#fff";
      ctx.fillText(param.label, startX + barWidth + 10, y + barHeight - 1);
    });
  };

  const renderAgents = (
    ctx: CanvasRenderingContext2D,
    agents: SimulationSnapshot["agents"],
    snapshot: SimulationSnapshot,
    timestamp: number
  ) => {
    if (!agents) return;

    agents.forEach((agent, i) => {
      const pos = agentPositions.current[i];
      if (!pos) return;

      const x = pos.x * width;
      const y = pos.y * height;
      let radius = 5 + agent.size * 15; // Base radius: 5-20px

      // Color based on energy/timbre and musical note
      let hue = agent.energy * 360; // Base hue from energy

      // If playing, shift hue based on timbre (which represents musical note)
      if (agent.isPlaying && timestamp < agent.playingUntil) {
        // Map timbre (0-1) to a full color wheel for note visualization
        hue = agent.timbre * 360;
      }

      const saturation = 50 + agent.timbre * 50; // 50-100% saturation
      let lightness = 40 + agent.energy * 30; // 40-70% lightness

      // Enhanced effects when playing
      let alpha = 0.8;
      let pulseRadius = radius;

      // Debug: Log agent playing status and timing
      if (agent.isPlaying) {
        console.log(
          `[RENDER] Agent ${
            agent.id
          } playing: start=${agent.noteStartTime.toFixed(
            3
          )}, duration=${agent.noteDuration.toFixed(
            3
          )}, current=${snapshot?.timestamp.toFixed(3)}`
        );
      }

      // Check if agent should be visually playing based on note timing
      let isVisuallyPlaying = false;
      if (agent.noteStartTime > 0 && agent.noteDuration > 0 && snapshot) {
        const noteElapsed = snapshot.timestamp - agent.noteStartTime;
        const noteEnded = noteElapsed > agent.noteDuration;
        isVisuallyPlaying = noteElapsed >= 0 && !noteEnded;

        if (isVisuallyPlaying) {
          console.log(
            `[VISUAL-PLAYING] Agent ${
              agent.id
            }: noteElapsed=${noteElapsed.toFixed(
              3
            )}, duration=${agent.noteDuration.toFixed(3)}, playing=true`
          );
        }
      }

      if (
        agent.isPlaying &&
        agent.noteStartTime > 0 &&
        agent.noteDuration > 0 &&
        snapshot
      ) {
        // Calculate envelope based on note timing (matching audio ADSR)
        const noteElapsed = snapshot.timestamp - agent.noteStartTime;

        // Handle look-ahead: if note hasn't started yet, show no envelope
        if (noteElapsed < 0) {
          console.log(
            `[ENVELOPE] Agent ${
              agent.id
            }: Note not started yet (elapsed=${noteElapsed.toFixed(
              3
            )}), skipping envelope`
          );
          // Skip envelope effects for notes that haven't started
        } else {
          const noteProgress = Math.max(
            0,
            Math.min(1, noteElapsed / agent.noteDuration)
          );

          // ADSR envelope: Attack(5%) -> Decay(15%) -> Sustain(70%) -> Release(10%)
          let envelope = 0;
          if (noteProgress < 0.05) {
            // Attack: rapid rise
            envelope = noteProgress / 0.05;
          } else if (noteProgress < 0.2) {
            // Decay: fall to sustain level
            const decayProgress = (noteProgress - 0.05) / 0.15;
            envelope = 1 - decayProgress * 0.3; // Drop to 70% sustain
          } else if (noteProgress < 0.9) {
            // Sustain: hold at 70%
            envelope = 0.7;
          } else {
            // Release: fade out
            const releaseProgress = (noteProgress - 0.9) / 0.1;
            envelope = 0.7 * (1 - releaseProgress);
          }

          // Apply envelope to visual effects
          const baseIntensity = Math.max(0.1, envelope);
          pulseRadius = radius * (1 + baseIntensity * 0.8); // Size based on envelope

          // Debug: Log envelope calculation
          console.log(
            `[ENVELOPE] Agent ${agent.id}: noteElapsed=${noteElapsed.toFixed(
              3
            )}, noteProgress=${noteProgress.toFixed(
              3
            )}, envelope=${envelope.toFixed(
              3
            )}, baseIntensity=${baseIntensity.toFixed(3)}`
          );

          // Brightness based on envelope
          lightness = Math.min(90, lightness + baseIntensity * 50);
          alpha = 0.8 + baseIntensity * 0.2;

          // Glow effect based on envelope
          ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
          ctx.shadowBlur = baseIntensity * 40;

          // Draw ripple effects with envelope intensity
          for (let ripple = 0; ripple < 3; ripple++) {
            const rippleRadius =
              radius + (ripple + 1) * 15 + baseIntensity * 20;
            const rippleAlpha = baseIntensity * (0.5 - ripple * 0.15);

            if (rippleAlpha > 0) {
              ctx.beginPath();
              ctx.arc(x, y, rippleRadius, 0, 2 * Math.PI);
              ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${rippleAlpha})`;
              ctx.lineWidth = Math.max(1, 4 - ripple);
              ctx.stroke();
            }
          }
        }
      }

      // Use timing-based visual playing for longer duration effects
      if (isVisuallyPlaying) {
        // Make the agent noticeably larger and brighter when playing
        pulseRadius = radius * 1.5;
        lightness = Math.min(90, lightness + 30);
        alpha = 1.0;

        // Add a bright glow
        ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
        ctx.shadowBlur = 20;

        // Add simple ripple
        ctx.beginPath();
        ctx.arc(x, y, radius + 20, 0, 2 * Math.PI);
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.6)`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw main agent circle
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, 2 * Math.PI);
      ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
      ctx.fill();

      // Add a subtle border for better definition
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${Math.min(
        lightness + 20,
        100
      )}%, 0.6)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Agent ID label with better contrast
      ctx.fillStyle = lightness > 60 ? "#000" : "#fff";
      ctx.font = "500 10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(agent.id.toString(), x, y + 3);

      // Reset shadow
      ctx.shadowBlur = 0;
    });
  };

  const renderWaitingState = (
    ctx: CanvasRenderingContext2D,
    timestamp: number
  ) => {
    // Show a pulsing "waiting" indicator
    ctx.save();

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // Pulsing circle in center
    const centerX = width / 2;
    const centerY = height / 2;
    const pulse = 0.5 + 0.3 * Math.sin(timestamp * 0.003);
    const radius = 20 + pulse * 10;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = `hsla(240, 50%, 60%, ${pulse})`;
    ctx.fill();

    // Text
    ctx.fillStyle = "#666";
    ctx.font = "16px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Waiting for audio data...", centerX, centerY + 50);

    ctx.restore();
  };

  return (
    <div className={`visualiser ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          border: "1px solid #333",
          borderRadius: "8px",
          backgroundColor: "#111",
        }}
      />
    </div>
  );
};

export default Visualiser;
