/**
 * Control Panel Component
 * Minimal controls for PitchField parameters and audio system
 */
import React, { useState, useEffect, useCallback } from 'react';
import { audioService } from '../audio/ctx';
import { environmentService } from '../audio/env';
import './ControlPanel.css';

interface ControlPanelProps {
  onParameterChange?: (param: string, value: number) => void;
}

interface AudioLoad {
  activeVoices: number;
  cpuLoad: number; // 0-1 estimate
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ onParameterChange }) => {
  // Audio state
  const [isRunning, setIsRunning] = useState(false);
  const [audioLoad, setAudioLoad] = useState<AudioLoad>({ activeVoices: 0, cpuLoad: 0 });
  
  // Control parameters
  const [agentCount, setAgentCount] = useState(16);
  const [ambienceLevel, setAmbienceLevel] = useState(0.7);
  const [tonicMidi, setTonicMidi] = useState(57); // A3 = MIDI 57
  const [tempoBias, setTempoBias] = useState(1.0);
  const [couplingStrength, setCouplingStrength] = useState(0.15);

  // Audio load monitoring
  useEffect(() => {
    let loadInterval: number;
    
    if (isRunning) {
      loadInterval = setInterval(() => {
        // Simple heuristic: estimate load from current voices and context state
        const voices = Math.floor(Math.random() * 8) + 2; // Mock for now
        const cpu = Math.min(voices / 32, 1.0); // Normalize to max 32 voices
        
        setAudioLoad(prev => ({
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
      console.error('Failed to start/stop audio:', error);
      alert('Failed to start audio. Please try again.');
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
    onParameterChange?.('agentCount', 16);
    onParameterChange?.('ambienceLevel', 0.7);
    onParameterChange?.('tonicMidi', 57);
    onParameterChange?.('tempoBias', 1.0);
    onParameterChange?.('couplingStrength', 0.15);
  }, [isRunning, onParameterChange]);

  // Parameter change handlers
  const handleAgentCountChange = useCallback((value: number) => {
    setAgentCount(value);
    onParameterChange?.('agentCount', value);
  }, [onParameterChange]);

  const handleAmbienceLevelChange = useCallback((value: number) => {
    setAmbienceLevel(value);
    onParameterChange?.('ambienceLevel', value);
    
    // Update environment gain immediately if running
    if (isRunning && environmentService) {
      environmentService.setMasterGain(value);
    }
  }, [isRunning, onParameterChange]);

  const handleTonicMidiChange = useCallback((value: number) => {
    setTonicMidi(value);
    onParameterChange?.('tonicMidi', value);
  }, [onParameterChange]);

  const handleTempoBiasChange = useCallback((value: number) => {
    setTempoBias(value);
    onParameterChange?.('tempoBias', value);
  }, [onParameterChange]);

  const handleCouplingStrengthChange = useCallback((value: number) => {
    setCouplingStrength(value);
    onParameterChange?.('couplingStrength', value);
  }, [onParameterChange]);

  // Convert MIDI to note name for display
  const midiToNoteName = (midi: number): string => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const note = notes[midi % 12];
    return `${note}${octave}`;
  };

  return (
    <div className="control-panel">
      <div className="control-header">
        <h3>🎵 Creatures Audio</h3>
        <div className="audio-status">
          <div className={`status-indicator ${isRunning ? 'running' : 'stopped'}`} />
          <span>{isRunning ? 'Running' : 'Stopped'}</span>
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
          <span className="load-value">{Math.round(audioLoad.cpuLoad * 100)}%</span>
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
            onChange={(e) => handleCouplingStrengthChange(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button 
          className={`primary-button ${isRunning ? 'stop' : 'start'}`}
          onClick={handleStartStop}
        >
          {isRunning ? '⏹ Stop' : '▶ Start'}
        </button>
        
        <button 
          className="secondary-button"
          onClick={handleReset}
        >
          🔄 Reset
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
