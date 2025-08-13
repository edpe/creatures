/**
 * Control Panel Component
 * Minimal controls for PitchField parameters and audio system
 */
import React, { useState, useEffect, useCallback } from "react";
import { audioService } from "../audio/ctx";
import { environmentService } from "../audio/env";
import "./ControlPanel.css";

interface ControlPanelProps {
  onParameterChange?: (param: string, value: number) => void;
}

interface AudioLoad {
  activeVoices: number;
  cpuLoad: number; // 0-1 estimate
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onParameterChange,
}) => {
  // Audio state
  const [isRunning, setIsRunning] = useState(false);
  const [audioLoad, setAudioLoad] = useState<AudioLoad>({
    activeVoices: 0,
    cpuLoad: 0,
  });

  // Control parameters
  const [agentCount, setAgentCount] = useState(16);
  const [ambienceLevel, setAmbienceLevel] = useState(0.7);
  const [tonicMidi, setTonicMidi] = useState(57); // A3 = MIDI 57
  const [tempoBias, setTempoBias] = useState(1.0);
  const [couplingStrength, setCouplingStrength] = useState(0.15);

  // Creature behavior parameters
  const [speakingProbability, setSpeakingProbability] = useState(0.05); // 5% base chance (0.05 = 5%)
  const [conversationCooldown, setConversationCooldown] = useState(8); // 8 seconds
  const [responseProbability, setResponseProbability] = useState(0.25); // 25% response chance (0.25 = 25%)
  const [minNoteDuration, setMinNoteDuration] = useState(1.5); // 1.5 seconds
  const [maxNoteDuration, setMaxNoteDuration] = useState(6.0); // 6.0 seconds
  const [noteAmplitude, setNoteAmplitude] = useState(0.15); // 15% max amplitude (0.15 = 15%)
  const [octaveVariation, setOctaveVariation] = useState(0.1); // ±0.1 octave
  const [microtonalVariation, setMicrotonalVariation] = useState(25); // ±25 cents

  // Audio effects parameters
  const [delayTime, setDelayTime] = useState(0.15); // 150ms delay
  const [delayFeedback, setDelayFeedback] = useState(0.25); // 25% feedback
  const [delayMix, setDelayMix] = useState(0.2); // 20% wet signal
  const [reverbDecay, setReverbDecay] = useState(0.5); // 50% decay
  const [reverbMix, setReverbMix] = useState(0.15); // 15% wet signal

  // Audio load monitoring
  useEffect(() => {
    let loadInterval: number;

    if (isRunning) {
      loadInterval = setInterval(() => {
        // Simple heuristic: estimate load from current voices and context state
        const voices = Math.floor(Math.random() * 8) + 2; // Mock for now
        const cpu = Math.min(voices / 32, 1.0); // Normalize to max 32 voices

        setAudioLoad((prev) => ({
          activeVoices: Math.round(prev.activeVoices * 0.8 + voices * 0.2), // Moving average
          cpuLoad: prev.cpuLoad * 0.9 + cpu * 0.1,
        }));
      }, 250);
    }

    return () => {
      if (loadInterval) clearInterval(loadInterval);
    };
  }, [isRunning]);

  // Handle start/stop with mobile audio unlock
  const handleStartStop = useCallback(async () => {
    try {
      if (!isRunning) {
        // Ensure user gesture for iOS audio unlock
        await audioService.start();
        setIsRunning(true);
      } else {
        await audioService.stop();
        setIsRunning(false);
        setAudioLoad({ activeVoices: 0, cpuLoad: 0 });
      }
    } catch (error) {
      console.error("Failed to start/stop audio:", error);
      alert("Failed to start audio. Please try again.");
    }
  }, [isRunning]);

  // Handle reset
  const handleReset = useCallback(async () => {
    if (isRunning) {
      await audioService.stop();
    }

    // Reset all parameters to defaults
    setAgentCount(16);
    setAmbienceLevel(0.7);
    setTonicMidi(57);
    setTempoBias(1.0);
    setCouplingStrength(0.15);
    setIsRunning(false);
    setAudioLoad({ activeVoices: 0, cpuLoad: 0 });

    // Notify parent of parameter changes
    onParameterChange?.("agentCount", 16);
    onParameterChange?.("ambienceLevel", 0.7);
    onParameterChange?.("tonicMidi", 57);
    onParameterChange?.("tempoBias", 1.0);
    onParameterChange?.("couplingStrength", 0.15);
  }, [isRunning, onParameterChange]);

  // Parameter change handlers
  const handleAgentCountChange = useCallback(
    (value: number) => {
      setAgentCount(value);
      onParameterChange?.("agentCount", value);
    },
    [onParameterChange]
  );

  const handleAmbienceLevelChange = useCallback(
    (value: number) => {
      setAmbienceLevel(value);
      onParameterChange?.("ambienceLevel", value);

      // Update environment gain immediately if running
      if (isRunning && environmentService) {
        environmentService.setMasterGain(value);
      }
    },
    [isRunning, onParameterChange]
  );

  const handleTonicMidiChange = useCallback(
    (value: number) => {
      setTonicMidi(value);
      onParameterChange?.("tonicMidi", value);
    },
    [onParameterChange]
  );

  const handleTempoBiasChange = useCallback(
    (value: number) => {
      setTempoBias(value);
      onParameterChange?.("tempoBias", value);
    },
    [onParameterChange]
  );

  const handleCouplingStrengthChange = useCallback(
    (value: number) => {
      setCouplingStrength(value);
      onParameterChange?.("couplingStrength", value);
    },
    [onParameterChange]
  );

  // Creature behavior parameter handlers
  const handleSpeakingProbabilityChange = useCallback(
    (value: number) => {
      setSpeakingProbability(value);
      onParameterChange?.("speakingProbability", value);
    },
    [onParameterChange]
  );

  const handleConversationCooldownChange = useCallback(
    (value: number) => {
      setConversationCooldown(value);
      onParameterChange?.("conversationCooldown", value);
    },
    [onParameterChange]
  );

  const handleResponseProbabilityChange = useCallback(
    (value: number) => {
      setResponseProbability(value);
      onParameterChange?.("responseProbability", value);
    },
    [onParameterChange]
  );

  const handleMinNoteDurationChange = useCallback(
    (value: number) => {
      setMinNoteDuration(value);
      onParameterChange?.("minNoteDuration", value);
    },
    [onParameterChange]
  );

  const handleMaxNoteDurationChange = useCallback(
    (value: number) => {
      setMaxNoteDuration(value);
      onParameterChange?.("maxNoteDuration", value);
    },
    [onParameterChange]
  );

  const handleNoteAmplitudeChange = useCallback(
    (value: number) => {
      setNoteAmplitude(value);
      onParameterChange?.("noteAmplitude", value);
    },
    [onParameterChange]
  );

  const handleOctaveVariationChange = useCallback(
    (value: number) => {
      setOctaveVariation(value);
      onParameterChange?.("octaveVariation", value);
    },
    [onParameterChange]
  );

  const handleMicrotonalVariationChange = useCallback(
    (value: number) => {
      setMicrotonalVariation(value);
      onParameterChange?.("microtonalVariation", value);
    },
    [onParameterChange]
  );

  // Audio effects parameter handlers
  const handleDelayTimeChange = useCallback(
    (value: number) => {
      setDelayTime(value);
      onParameterChange?.("delayTime", value);
    },
    [onParameterChange]
  );

  const handleDelayFeedbackChange = useCallback(
    (value: number) => {
      setDelayFeedback(value);
      onParameterChange?.("delayFeedback", value);
    },
    [onParameterChange]
  );

  const handleDelayMixChange = useCallback(
    (value: number) => {
      setDelayMix(value);
      onParameterChange?.("delayMix", value);
    },
    [onParameterChange]
  );

  const handleReverbDecayChange = useCallback(
    (value: number) => {
      setReverbDecay(value);
      onParameterChange?.("reverbDecay", value);
    },
    [onParameterChange]
  );

  const handleReverbMixChange = useCallback(
    (value: number) => {
      setReverbMix(value);
      onParameterChange?.("reverbMix", value);
    },
    [onParameterChange]
  );

  // Convert MIDI to note name for display
  const midiToNoteName = (midi: number): string => {
    const notes = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const octave = Math.floor(midi / 12) - 1;
    const note = notes[midi % 12];
    return `${note}${octave}`;
  };

  return (
    <div className="control-panel">
      <div className="control-header">
        <h3>🎵 Creatures Audio</h3>
        <div className="audio-status">
          <div
            className={`status-indicator ${isRunning ? "running" : "stopped"}`}
          />
          <span>{isRunning ? "Running" : "Stopped"}</span>
        </div>
      </div>

      {/* Audio Load Display */}
      <div className="load-display">
        <div className="load-item">
          <span>Voices:</span>
          <span className="load-value">{audioLoad.activeVoices}</span>
        </div>
        <div className="load-item">
          <span>CPU:</span>
          <div className="load-bar">
            <div
              className="load-fill"
              style={{ width: `${audioLoad.cpuLoad * 100}%` }}
            />
          </div>
          <span className="load-value">
            {Math.round(audioLoad.cpuLoad * 100)}%
          </span>
        </div>
      </div>

      {/* Control Sliders */}
      <div className="controls-grid">
        <div className="control-group">
          <label>Agents: {agentCount}</label>
          <input
            type="range"
            min="4"
            max="32"
            step="1"
            value={agentCount}
            onChange={(e) => handleAgentCountChange(Number(e.target.value))}
            disabled={isRunning}
          />
        </div>

        <div className="control-group">
          <label>Ambience: {Math.round(ambienceLevel * 100)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={ambienceLevel}
            onChange={(e) => handleAmbienceLevelChange(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Tonic: {midiToNoteName(tonicMidi)}</label>
          <input
            type="range"
            min="48"
            max="72"
            step="1"
            value={tonicMidi}
            onChange={(e) => handleTonicMidiChange(Number(e.target.value))}
            disabled={isRunning}
          />
        </div>

        <div className="control-group">
          <label>Tempo: {tempoBias.toFixed(2)}x</label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.01"
            value={tempoBias}
            onChange={(e) => handleTempoBiasChange(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Coupling: {couplingStrength.toFixed(3)}</label>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.001"
            value={couplingStrength}
            onChange={(e) =>
              handleCouplingStrengthChange(Number(e.target.value))
            }
          />
        </div>

        {/* Creature Behavior Controls */}
        <div className="control-group">
          <label>
            Speaking Probability: {(speakingProbability * 100).toFixed(1)}%
          </label>
          <input
            type="range"
            min="0"
            max="0.2"
            step="0.001"
            value={speakingProbability}
            onChange={(e) =>
              handleSpeakingProbabilityChange(Number(e.target.value))
            }
          />
        </div>

        <div className="control-group">
          <label>
            Conversation Cooldown: {conversationCooldown.toFixed(1)}s
          </label>
          <input
            type="range"
            min="5"
            max="30"
            step="0.5"
            value={conversationCooldown}
            onChange={(e) =>
              handleConversationCooldownChange(Number(e.target.value))
            }
          />
        </div>

        <div className="control-group">
          <label>
            Response Probability: {(responseProbability * 100).toFixed(1)}%
          </label>
          <input
            type="range"
            min="0"
            max="0.8"
            step="0.01"
            value={responseProbability}
            onChange={(e) =>
              handleResponseProbabilityChange(Number(e.target.value))
            }
          />
        </div>

        <div className="control-group">
          <label>Min Note Duration: {minNoteDuration.toFixed(1)}s</label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={minNoteDuration}
            onChange={(e) =>
              handleMinNoteDurationChange(Number(e.target.value))
            }
          />
        </div>

        <div className="control-group">
          <label>Max Note Duration: {maxNoteDuration.toFixed(1)}s</label>
          <input
            type="range"
            min="3"
            max="10"
            step="0.1"
            value={maxNoteDuration}
            onChange={(e) =>
              handleMaxNoteDurationChange(Number(e.target.value))
            }
          />
        </div>

        <div className="control-group">
          <label>Note Amplitude: {(noteAmplitude * 100).toFixed(1)}%</label>
          <input
            type="range"
            min="0"
            max="0.2"
            step="0.001"
            value={noteAmplitude}
            onChange={(e) => handleNoteAmplitudeChange(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Octave Variation: ±{octaveVariation.toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.01"
            value={octaveVariation}
            onChange={(e) =>
              handleOctaveVariationChange(Number(e.target.value))
            }
          />
        </div>

        <div className="control-group">
          <label>
            Microtonal Variation: ±{microtonalVariation.toFixed(0)} cents
          </label>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={microtonalVariation}
            onChange={(e) =>
              handleMicrotonalVariationChange(Number(e.target.value))
            }
          />
        </div>

        {/* Audio Effects Controls */}
        <div className="control-group">
          <label>Delay Time: {(delayTime * 1000).toFixed(0)}ms</label>
          <input
            type="range"
            min="0.01"
            max="4.0"
            step="0.01"
            value={delayTime}
            onChange={(e) => handleDelayTimeChange(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Delay Feedback: {(delayFeedback * 100).toFixed(0)}%</label>
          <input
            type="range"
            min="0"
            max="0.95"
            step="0.01"
            value={delayFeedback}
            onChange={(e) => handleDelayFeedbackChange(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Delay Mix: {(delayMix * 100).toFixed(0)}%</label>
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.01"
            value={delayMix}
            onChange={(e) => handleDelayMixChange(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Reverb Decay: {(reverbDecay * 100).toFixed(0)}%</label>
          <input
            type="range"
            min="0.1"
            max="0.99"
            step="0.01"
            value={reverbDecay}
            onChange={(e) => handleReverbDecayChange(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Reverb Mix: {(reverbMix * 100).toFixed(0)}%</label>
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.01"
            value={reverbMix}
            onChange={(e) => handleReverbMixChange(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button
          className={`primary-button ${isRunning ? "stop" : "start"}`}
          onClick={handleStartStop}
        >
          {isRunning ? "⏹ Stop" : "▶ Start"}
        </button>

        <button className="secondary-button" onClick={handleReset}>
          🔄 Reset
        </button>

        <button
          className="secondary-button"
          onClick={() => {
            console.log("[BUTTON] Test Note button clicked");
            // Import and test a note
            import("../audio/creatures").then(({ creaturesService }) => {
              console.log("[BUTTON] Calling creaturesService.testNote()");
              creaturesService.testNote();
            });
          }}
        >
          🎵 Test Note
        </button>
      </div>

      {/* Mobile Audio Hint */}
      {!isRunning && (
        <div className="mobile-hint">
          <small>💡 Tap Start to unlock audio on mobile devices</small>
        </div>
      )}
    </div>
  );
};
