// Global Error Catcher for troubleshooting Vercel deployments
window.onerror = (message, source, lineno, colno, error) => {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; margin: 20px; font-family: sans-serif;">
        <h2 style="margin-top: 0;">Runtime Error Detected</h2>
        <p><strong>Message:</strong> ${message}</p>
        <p><strong>Source:</strong> ${source}</p>
        <p><strong>Line:</strong> ${lineno}:${colno}</p>
        <pre style="background: #eee; padding: 10px; overflow: auto;">${error?.stack || 'No stack trace available'}</pre>
        <p style="font-size: 0.8em; margin-top: 20px;">Vite Mode: ${import.meta.env.MODE}</p>
      </div>
    `;
  }
};

window.onunhandledrejection = (event) => {
  console.error("Unhandled promise rejection:", event.reason);
};

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Root element not found");
  
  createRoot(rootElement).render(<App />);
} catch (error: any) {
  console.error("Failed to render app:", error);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="padding: 20px; color: red;"><h1>App Crash</h1><pre>${error.message}\n${error.stack}</pre></div>`;
  }
}
