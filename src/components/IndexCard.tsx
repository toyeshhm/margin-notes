// The index card: every comment, item by item. On the Comments tab each item has the teacher's mark
// and plain words; once a round is checked, each item shows its tick and quote, or its reason.

import { useEffect, useRef } from "react";

import type { Essay, Round, Verdict } from "../lib/types";
import { allSentences } from "../lib/text";
import { Hand, Tick } from "./Hand";

interface Props {
  essay: Essay;
  open: number | undefined;
  onOpen: (n: number) => void;
  round?: Round;
  onMove?: (n: number) => void;
  onBeforeAfter?: (n: number) => void;
  // Seconds after which each row arrives (the scan's reveal); empty when nothing animates.
  arrive?: Map<number, number> | undefined;
  header: React.ReactNode;
}

export function answered(round: Round): number {
  return round.verdicts.filter((v) => v.ticked).length;
}

function Verdict({ v, write, delay }: { v: Verdict; write: boolean; delay: number }): React.JSX.Element {
  if (v.ticked && v.removed) {
    return (
      <div className="verdict ok">
        <Tick write={write} delay={delay} seed={v.n} />
        <p className="quote">Removed in your revision</p>
      </div>
    );
  }
  if (v.ticked) {
    return (
      <div className="verdict ok">
        <Tick write={write} delay={delay} seed={v.n} />
        <p className="quote">&ldquo;{v.quote}&rdquo;</p>
      </div>
    );
  }
  return (
    <div className="verdict no">
      <span className="not-yet">Not yet</span>
      <p className="reason">
        {v.reason}
        {v.quoteNotFound && <span className="tag">quote not found</span>}
      </p>
    </div>
  );
}

export function IndexCard({ essay, open, onOpen, round, onMove, onBeforeAfter, arrive, header }: Props): React.JSX.Element {
  const text = new Map(allSentences(essay.paragraphs).map((s) => [s.id, s.text]));
  const verdicts = new Map(round?.verdicts.map((v) => [v.n, v]));
  // A comment opened from its pin may be off screen: bring its row into view.
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    card.current?.querySelector(".row.open")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);
  return (
    <section className="card" aria-label="Comments" ref={card}>
      <header className="card-head">{header}</header>
      <ol className="card-rows">
        {essay.marks.map((m, i) => {
          const v = verdicts.get(m.n);
          const isOpen = m.n === open;
          const at = arrive?.get(m.n);
          const typed = m.kind === "comment";
          return (
            <li
              key={m.n}
              className={`row${typed ? " typed" : ""}${isOpen ? " open" : ""}${v === undefined ? "" : v.ticked ? " ticked" : " missed"}${at === undefined ? "" : " arriving"}`}
              style={at === undefined ? undefined : { animationDelay: `${at.toFixed(2)}s` }}
            >
              <button type="button" className="row-main" aria-expanded={isOpen} onClick={() => {
                onOpen(m.n);
              }}>
                <span className="row-n">{m.n}</span>
                <span className="row-mark">
                  <Hand words={m.words} typed={typed} size={typed ? 15 : 17} />
                </span>
                {v === undefined ? (
                  <span className="row-plain">
                    {m.plain === undefined ? (
                      <span className="no-plain">No plain words yet: the reading models didn&rsquo;t answer when this was read.</span>
                    ) : (
                      <>
                        <strong>{m.plain.meaning}</strong> {m.plain.todo}
                      </>
                    )}
                  </span>
                ) : (
                  <span className="row-plain">
                    <Verdict v={v} write={at !== undefined} delay={(at ?? 0) + 0.2 + i * 0} />
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="row-more">
                  <p>
                    Your teacher wrote: <strong className="teacher-words">{m.words}</strong>
                  </p>
                  <p className="on">
                    On <q>{text.get(m.sentenceId) ?? m.near}</q>
                  </p>
                  {v?.ticked === true && onBeforeAfter !== undefined && (
                    <button type="button" className="btn quiet small" onClick={() => {
                      onBeforeAfter(m.n);
                    }}>
                      Before and after
                    </button>
                  )}
                  {v === undefined && onMove !== undefined && (
                    <button type="button" className="btn quiet small" onClick={() => {
                      onMove(m.n);
                    }}>
                      Move this pin
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
