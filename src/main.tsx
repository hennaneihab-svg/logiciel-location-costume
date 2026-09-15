import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Initialisation du thème AVANT le rendu React pour éviter le flash ──
const savedTheme = localStorage.getItem("theme-store");
try {
  const parsed = savedTheme ? JSON.parse(savedTheme) : null;
  const theme: string = parsed?.state?.theme ?? "dark";
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
} catch {
  document.documentElement.classList.add("dark");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
