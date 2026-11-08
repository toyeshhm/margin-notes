import { createRoot } from "react-dom/client";

import "../tokens.css";
import { cards } from "./content";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <main>
    <p>{cards.url}</p>
    <ul>
      {cards.sponsors.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ul>
  </main>,
);
