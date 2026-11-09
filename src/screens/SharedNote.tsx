// A note opened from its shared link: read-only, with nothing else from the essay.

import { useEffect, useState } from "react";

import type { Note } from "../../api/note";
import { Hand } from "../components/Hand";
import { NoteSheet } from "../components/NoteSheet";
import { loadNote } from "../lib/api";

export default function SharedNote({ id }: { id: string }): React.JSX.Element {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "ready"; note: Note } | { kind: "error"; message: string }>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    loadNote(id).then(
      (note) => {
        if (live) setState({ kind: "ready", note });
      },
      (error: unknown) => {
        if (live) setState({ kind: "error", message: error instanceof Error ? error.message : "This note couldn't be opened." });
      },
    );
    return () => {
      live = false;
    };
  }, [id]);
  return (
    <div className="shared">
      <header className="shared-head">
        <a className="wordmark" href="/">
          Margin Notes
        </a>
        <span>A student&rsquo;s revision note, shared with you</span>
        <button type="button" className="btn quiet small" onClick={() => {
          window.print();
        }}>
          Print the note
        </button>
      </header>
      {state.kind === "loading" && <div className="note-sheet loading-sheet" aria-label="Loading the note" />}
      {state.kind === "error" && (
        <section className="lost">
          <span className="lost-mark" aria-hidden="true">
            <Hand words="?" size={72} write />
          </span>
          <h1>No note here</h1>
          <p>{state.message}</p>
        </section>
      )}
      {state.kind === "ready" && <NoteSheet note={state.note} />}
    </div>
  );
}
