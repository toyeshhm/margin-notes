import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { initMotion } from "./motion";
import "./tokens.css";
import "./paper.css";
import "./app.css";
import "./screens.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
initMotion();
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
