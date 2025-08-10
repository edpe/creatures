import { useState, useCallback, useEffect } from "react";
import { audioService } from "./audio/ctx";
import type { EnvironmentParameters } from "./audio/env";
import "./App.css";

function App() {
  const [status, setStatus] = useState<"stopped" | "running">("stopped");
  const [isLoading, setIsLoading] = useState(false);

  // Environment parameters state (now updated by worker)
  const [envParams, setEnvParams] = useState({
    light: 0.5,
    wind: 0.3,
    humidity: 0.6,
    temperature: 0.4,
    masterGain: 0.15,
  });

  // Track simulation status
  const [isSimulating, setIsSimulating] = useState(false);

  // Kuramoto phase info for display
  const [phaseInfo, setPhaseInfo] = useState<{
    globalPhase: number;
    coherence: number;
    agentCount: number;
  } | null>(null);

  const handleStart = useCallback(async () => {
    setIsLoading(true);
    try {
      await audioService.start();
      setStatus("running");
      setIsSimulating(true);
    } catch (error) {
      console.error("Failed to start audio:", error);
      alert("Failed to start audio context. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStop = useCallback(async () => {
    setIsLoading(true);
    try {
      await audioService.stop();
      setStatus("stopped");
      setIsSimulating(false);
    } catch (error) {
      console.error("Failed to stop audio:", error);
      alert("Failed to stop audio context. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTestNotes = useCallback(async () => {
    try {
      await audioService.testCreatureNotes();
    } catch (error) {
      console.error("Failed to test creature notes:", error);
      alert("Failed to test creature notes. Make sure audio is running.");
    }
  }, []);

  // Handle environment parameter changes
  const handleEnvParamChange = useCallback(
    (param: keyof typeof envParams, value: number) => {
      setEnvParams((prev) => {
        const newParams = { ...prev, [param]: value };

        // Update the audio worklet if running (only for manual changes, not worker updates)
        if (status === "running" && param === "masterGain") {
          audioService.environment.setParameters({ [param]: value });
        }

        return newParams;
      });
    },
    [status]
  );

  // Listen for parameter updates from simulation worker
  useEffect(() => {
    const handleWorkerUpdate = (
      params: Omit<EnvironmentParameters, "masterGain">
    ) => {
      setEnvParams((prev) => ({
        ...prev,
        ...params,
      }));
    };

    audioService.environment.addUpdateListener(handleWorkerUpdate);

    return () => {
      audioService.environment.removeUpdateListener(handleWorkerUpdate);
    };
  }, []);

  // Poll for phase information when simulation is running
  useEffect(() => {
    if (!isSimulating) {
      setPhaseInfo(null);
      return;
    }

    const interval = setInterval(() => {
      const snapshot = audioService.environment.getCurrentPhaseSnapshot();
      if (snapshot) {
        // Calculate coherence (order parameter)
        let sumSin = 0;
        let sumCos = 0;

        for (const agent of snapshot.agents) {
          sumSin += Math.sin(agent.beatPhase);
          sumCos += Math.cos(agent.beatPhase);
        }

        const coherence =
          Math.sqrt(sumSin * sumSin + sumCos * sumCos) / snapshot.agents.length;

        setPhaseInfo({
          globalPhase: snapshot.globalBeatPhase,
          coherence,
          agentCount: snapshot.agents.length,
        });
      }
    }, 500); // Update UI every 500ms

    return () => clearInterval(interval);
  }, [isSimulating]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Creatures Audio App</h1>
        <div className="audio-controls">
          <div className="status">
            Status: <span className={`status-text ${status}`}>{status}</span>
          </div>

          <div className="controls">
            <button
              onClick={handleStart}
              disabled={status === "running" || isLoading}
              className="btn btn-start"
            >
              {isLoading ? "Starting..." : "Start"}
            </button>

            <button
              onClick={handleStop}
              disabled={status === "stopped" || isLoading}
              className="btn btn-stop"
            >
              {isLoading ? "Stopping..." : "Stop"}
            </button>

            <button
              onClick={handleTestNotes}
              disabled={status !== "running" || isLoading}
              className="btn btn-test"
            >
              Test Notes
            </button>
          </div>

          <div className="info">
            <p>
              Click Start to initialize the audio context with user gesture.
            </p>
            <p>
              Sample Rate:{" "}
              {audioService.context ? audioService.getSampleRate() : "N/A"} Hz
            </p>
            <p>Latency Hint: Interactive</p>
            {phaseInfo && (
              <>
                <p>Kuramoto Agents: {phaseInfo.agentCount}</p>
                <p>Phase Coherence: {phaseInfo.coherence.toFixed(3)}</p>
                <p>
                  Global Beat Phase:{" "}
                  {((phaseInfo.globalPhase * 180) / Math.PI).toFixed(1)}°
                </p>
              </>
            )}
          </div>

          {/* Environment Controls */}
          <div className="environment-controls">
            <h3>
              Environment Parameters{" "}
              {isSimulating && (
                <span className="sim-indicator">(Simulated)</span>
              )}
            </h3>
            <div className="param-grid">
              <div className="param-control">
                <label htmlFor="light">
                  Light: {(envParams.light * 100).toFixed(0)}%
                </label>
                <input
                  id="light"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={envParams.light}
                  onChange={(e) =>
                    handleEnvParamChange("light", parseFloat(e.target.value))
                  }
                  disabled={true} // Always disabled - controlled by simulation
                  className="simulated"
                />
              </div>

              <div className="param-control">
                <label htmlFor="wind">
                  Wind: {(envParams.wind * 100).toFixed(0)}%
                </label>
                <input
                  id="wind"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={envParams.wind}
                  onChange={(e) =>
                    handleEnvParamChange("wind", parseFloat(e.target.value))
                  }
                  disabled={true} // Always disabled - controlled by simulation
                  className="simulated"
                />
              </div>

              <div className="param-control">
                <label htmlFor="humidity">
                  Humidity: {(envParams.humidity * 100).toFixed(0)}%
                </label>
                <input
                  id="humidity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={envParams.humidity}
                  onChange={(e) =>
                    handleEnvParamChange("humidity", parseFloat(e.target.value))
                  }
                  disabled={true} // Always disabled - controlled by simulation
                  className="simulated"
                />
              </div>

              <div className="param-control">
                <label htmlFor="temperature">
                  Temperature: {(envParams.temperature * 100).toFixed(0)}%
                </label>
                <input
                  id="temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={envParams.temperature}
                  onChange={(e) =>
                    handleEnvParamChange(
                      "temperature",
                      parseFloat(e.target.value)
                    )
                  }
                  disabled={true} // Always disabled - controlled by simulation
                  className="simulated"
                />
              </div>

              <div className="param-control">
                <label htmlFor="masterGain">
                  Master Gain: {(envParams.masterGain * 100).toFixed(0)}%
                </label>
                <input
                  id="masterGain"
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.01"
                  value={envParams.masterGain}
                  onChange={(e) =>
                    handleEnvParamChange(
                      "masterGain",
                      parseFloat(e.target.value)
                    )
                  }
                  disabled={status === "stopped"}
                  className="manual"
                />
              </div>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
