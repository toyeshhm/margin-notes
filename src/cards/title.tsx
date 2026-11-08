import { createRoot } from "react-dom/client";

import "../tokens.css";
import { cards } from "./content";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <main>
    <h1>{cards.title}</h1>
    <p>{cards.tagline}</p>
  </main>,
);
