// The marking key: one reference card per common teacher mark, written in the teacher's hand; the
// mark lifts and writes itself again when the hand comes over its card. /api/explain starts every
// plain-words line from these same entries.

import { useRewrite } from "../art/rewrite";
import { Hand } from "../components/Hand";
import { markingKey, type KeyEntry } from "../lib/markingKey";

function KeyCard({ entry, tilt }: { entry: KeyEntry; tilt: number }): React.JSX.Element {
  const [round, again] = useRewrite(1.4);
  const also = entry.also.filter((a) => !a.endsWith("."));
  return (
    <li className="key-card lifts" style={{ "--tilt": `${String(tilt)}deg` } as React.CSSProperties} onPointerEnter={again}>
      <span className="key-mark">
        <Hand key={round} words={entry.mark} size={30} write={round > 0} />
      </span>
      <p className="key-meaning">{entry.meaning}</p>
      <p className="key-todo">{entry.todo}</p>
      {also.length > 0 && <p className="key-also">Also written {also.slice(0, 3).join(", ")}</p>}
    </li>
  );
}

export default function MarkingKey(): React.JSX.Element {
  return (
    <section className="screen key">
      <div className="screen-head">
        <h1>Marking key</h1>
        <p className="screen-lede">What common teacher shorthand means, and what it usually asks you to do. Every plain-words line in Margin Notes starts here.</p>
      </div>
      <ul className="key-grid">
        {markingKey.map((k, i) => (
          <KeyCard key={k.mark} entry={k} tilt={(((i * 37) % 5) - 2) * 0.4} />
        ))}
      </ul>
    </section>
  );
}
