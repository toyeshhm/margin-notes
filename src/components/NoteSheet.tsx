// The note for a teacher: one row per comment, the teacher's mark in red, the sentence it was on, then
// what the student changed, quoted from the new draft. The same sheet prints, and opens read-only from a shared link.

import type { Note } from "../../api/note";
import { Hand } from "./Hand";

export function NoteSheet({ note }: { note: Note }): React.JSX.Element {
  const done = note.rows.filter((r) => r.quote !== "" || r.removed).length;
  return (
    <article className="note-sheet">
      <header>
        <h2>{note.title}</h2>
        <p>
          Revision notes, round {note.round}: {done} of {note.rows.length} comments answered. Each row has your mark, the sentence it was on, and what I changed it to.
        </p>
      </header>
      <ol>
        {note.rows.map((r) => (
          <li key={r.n}>
            <span className="note-n">{r.n}</span>
            <span className="note-mark">
              <Hand words={r.mark} typed={r.typed} size={17} />
            </span>
            <span className="note-change">
              {r.before !== "" && <span className={r.quote !== "" || r.removed ? "note-before struck" : "note-before"}>{r.before}</span>}
              {r.removed ? <span>I removed this sentence.</span> : r.quote !== "" ? <q>{r.quote}</q> : <span className="not-yet-text">Not yet answered</span>}
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}
