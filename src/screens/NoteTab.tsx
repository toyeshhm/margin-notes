// Note for your teacher: the sheet for the latest round, with Print and Copy link. Copy link saves
// only the note (marks and quotes, never the essay) and copies a read-only link to it.

import { useState } from "react";

import type { Note } from "../../api/note";
import { NoteSheet } from "../components/NoteSheet";
import { saveNote } from "../lib/api";
import type { Essay } from "../lib/types";
import { follow } from "../router";

export function noteFor(essay: Essay): Note | undefined {
  const round = essay.rounds[essay.rounds.length - 1];
  if (round === undefined) return undefined;
  const verdicts = new Map(round.verdicts.map((v) => [v.n, v]));
  return {
    title: essay.title,
    round: round.n,
    rows: essay.marks.map((m) => {
      const v = verdicts.get(m.n);
      return { n: m.n, mark: m.words, typed: m.kind === "comment", quote: v?.ticked === true ? v.quote : "", removed: v?.ticked === true && v.removed };
    }),
  };
}

export default function NoteTab({ essay }: { essay: Essay }): React.JSX.Element {
  const [state, setState] = useState<{ kind: "idle" } | { kind: "saving" } | { kind: "copied"; url: string } | { kind: "shown"; url: string } | { kind: "error"; message: string }>({ kind: "idle" });
  const note = noteFor(essay);
  if (note === undefined) {
    return (
      <div className="screen note-empty">
        <p>
          The note quotes what you changed for each comment, so check your revision first.{" "}
          <a href={`/e/${essay.id}?tab=check`} onClick={follow}>
            Check my revision
          </a>
        </p>
      </div>
    );
  }
  const copy = async (): Promise<void> => {
    setState({ kind: "saving" });
    try {
      const id = await saveNote(note);
      const url = `${location.origin}/n/${id}`;
      try {
        await navigator.clipboard.writeText(url);
        setState({ kind: "copied", url });
      } catch {
        // Some browsers refuse clipboard access; the link is shown to copy by hand instead.
        setState({ kind: "shown", url });
      }
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "The link wasn't made. Try again." });
    }
  };
  return (
    <div className="note-tab">
      <div className="note-actions">
        <button type="button" className="btn" disabled={state.kind === "saving"} onClick={() => void copy()}>
          {state.kind === "saving" ? "Making the link" : "Copy link"}
        </button>
        <button type="button" className="btn quiet" onClick={() => {
          window.print();
        }}>
          Print
        </button>
        <p className="note-status" role="status">
          {state.kind === "copied" && (
            <>
              <strong>Link copied.</strong> It opens this note, read-only, and nothing else from your essay.
            </>
          )}
          {state.kind === "shown" && (
            <>
              Copy this link: <a href={state.url}>{state.url}</a>
            </>
          )}
          {state.kind === "error" && <span className="problem-inline">{state.message}</span>}
        </p>
      </div>
      <NoteSheet note={note} />
    </div>
  );
}
