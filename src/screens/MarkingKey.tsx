// The marking key: one reference card per common teacher mark, written in the teacher's hand.
// /api/explain starts every plain-words line from these same entries.

import { Hand } from "../components/Hand";
import { markingKey } from "../lib/markingKey";

export default function MarkingKey(): React.JSX.Element {
  return (
    <section className="screen key">
      <div className="screen-head">
        <h1>Marking key</h1>
        <p className="screen-lede">What common teacher shorthand means, and what it usually asks you to do. Every plain-words line in Margin Notes starts here.</p>
      </div>
      <ul className="key-grid">
        {markingKey.map((k, i) => (
          <li key={k.mark} className="key-card" style={{ "--tilt": `${String((((i * 37) % 5) - 2) * 0.4)}deg` } as React.CSSProperties}>
            <span className="key-mark">
              <Hand words={k.mark} size={30} />
            </span>
            <p className="key-meaning">{k.meaning}</p>
            <p className="key-todo">{k.todo}</p>
            {k.also.some((a) => !a.endsWith(".")) && <p className="key-also">Also written {k.also.filter((a) => !a.endsWith(".")).slice(0, 3).join(", ")}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
