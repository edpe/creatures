import { useState, useCallback } from "react";
import { audioService } from "./audio/ctx";
import "./App.css";

function App() {
  const [status, setStatus] = useState<"stopped" | "running">("stopped");
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = useCallback(async () => {
    setIsLoading(true);
    try {
      await audioService.start();
      setStatus("running");
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
    } catch (error) {
      console.error("Failed to stop audio:", error);
      alert("Failed to stop audio context. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

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
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
