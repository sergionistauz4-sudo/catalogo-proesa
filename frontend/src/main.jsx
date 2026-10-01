// main.jsx — Punto de entrada de React
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Reset CSS mínimo (sin frameworks externos)
const style = document.createElement("style");
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    background: #F8F9FF;
  }
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button { opacity: 1; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #F0F0F0; }
  ::-webkit-scrollbar-thumb { background: #CCCCCC; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #AAAAAA; }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
  @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes subir   { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
