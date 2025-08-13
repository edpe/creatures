// import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // Temporarily disable StrictMode to test if it's causing double execution
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);
