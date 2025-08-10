import { useState, useCallback, useEffect } from "react";
import { audioService } from "./audio/ctx";
import { ControlPanel } from "./components/ControlPanel";
import type { EnvironmentParameters } from "./audio/env";
import "./App.css";

function App() {
  const [envParams, setEnvParams] = useState({
    light: 0.5,
    wind: 0.3,
    humidity: 0.6,
    temperature: 0.4,
    masterGain: 0.15,
  });

  // Handle parameter changes from control panel
  const handleParameterChange = useCallback((param: string, value: number) => {
    audioService.setParameter(param, value);
  }, []);

  // Listen for environment parameter updates from worker
  useEffect(() => {
    const handleEnvUpdate = (
      params: Omit<EnvironmentParameters, "masterGain">
    ) => {
      setEnvParams((prev) => ({
        ...prev,
        ...params,
      }));
    };

    audioService.environment.onUpdate(handleEnvUpdate);

    return () => {
      // Cleanup listener if needed
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🌊 Creatures Audio</h1>
        <p className="subtitle">
          Generative ambient music with Kuramoto oscillators
        </p>
      </header>

      <main className="app-main">
        <ControlPanel onParameterChange={handleParameterChange} />

        {/* Environment visualization */}
        <div className="env-display">
          <h3>🌍 Environment State</h3>
          <div className="env-grid">
            <div className="env-param">
              <span className="env-label">🌞 Light</span>
              <div className="env-bar">
                <div
                  className="env-fill light"
                  style={{ width: `${envParams.light * 100}%` }}
                />
              </div>
              <span className="env-value">
                {Math.round(envParams.light * 100)}%
              </span>
            </div>

            <div className="env-param">
              <span className="env-label">💨 Wind</span>
              <div className="env-bar">
                <div
                  className="env-fill wind"
                  style={{ width: `${envParams.wind * 100}%` }}
                />
              </div>
              <span className="env-value">
                {Math.round(envParams.wind * 100)}%
              </span>
            </div>

            <div className="env-param">
              <span className="env-label">💧 Humidity</span>
              <div className="env-bar">
                <div
                  className="env-fill humidity"
                  style={{ width: `${envParams.humidity * 100}%` }}
                />
              </div>
              <span className="env-value">
                {Math.round(envParams.humidity * 100)}%
              </span>
            </div>

            <div className="env-param">
              <span className="env-label">🌡️ Temperature</span>
              <div className="env-bar">
                <div
                  className="env-fill temperature"
                  style={{ width: `${envParams.temperature * 100}%` }}
                />
              </div>
              <span className="env-value">
                {Math.round(envParams.temperature * 100)}%
              </span>
            </div>
          </div>
          <p className="env-note">
            <small>
              Environment parameters evolve automatically via simulation worker
            </small>
          </p>
        </div>
      </main>

      <footer className="app-footer">
        <small>
          Powered by Web Audio API • Real-time synthesis • No samples • Mobile
          optimized
        </small>
      </footer>
    </div>
  );
}

export default App;
