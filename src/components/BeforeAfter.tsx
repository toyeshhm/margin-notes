// Before and after: the marked sentence with the teacher's mark, beside its new version (or both
// halves of a split one) with the changed words highlighted.

import { useEffect, useRef } from "react";

import { changedWords } from "../lib/diff";
import { allSentences } from "../lib/text";
import type { Essay, Round } from "../lib/types";
import { Hand } from "./Hand";

export function BeforeAfter({ essay, round, n, onClose }: { essay: Essay; round: Round; n: number; onClose: () => void }): React.JSX.Element | null {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const mark = essay.marks.find((m) => m.n === n);
  const v = round.verdicts.find((x) => x.n === n);
  if (mark === undefined || v === undefined) return null;
  const before = allSentences(essay.paragraphs).find((s) => s.id === mark.sentenceId)?.text ?? mark.near;
  return (
    <dialog ref={dialog} className="before-after" aria-labelledby="ba-title" onClose={onClose} onClick={(e) => {
      if (e.target === e.currentTarget) dialog.current?.close();
    }}>
      <header>
        <h2 id="ba-title">Before and after</h2>
        <button type="button" className="btn quiet small" onClick={() => dialog.current?.close()}>
          Close
        </button>
      </header>
      <div className="ba-cols">
        <section>
          <h3>Before</h3>
          <p className="ba-mark">
            <Hand words={mark.words} typed={mark.kind === "comment"} size={20} />
          </p>
          <p className="ba-text">{before}</p>
        </section>
        <section>
          <h3>After, round {round.n}</h3>
          {v.removed ? (
            <p className="ba-text removed">
              <s>{before}</s> Removed in your revision
            </p>
          ) : (
            v.after.map((s, i) => (
              <p key={i} className="ba-text">
                {changedWords(before, s).map((r, k) => (
                  <span key={k}>
                    {r.changed ? <mark>{r.text}</mark> : r.text}{" "}
                  </span>
                ))}
              </p>
            ))
          )}
        </section>
      </div>
    </dialog>
  );
}
