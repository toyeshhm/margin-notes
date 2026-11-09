// Check my revision: paste the revised draft, check every comment against it, and keep each round.
// The draft shows beside the card with each answering quote underlined in green.

import { useState } from "react";

import { BeforeAfter } from "../components/BeforeAfter";
import { answered, IndexCard } from "../components/IndexCard";
import { ApiError, check } from "../lib/api";
import { updateEssay } from "../lib/store";
import { allSentences } from "../lib/text";
import type { Essay, Round } from "../lib/types";
import { log } from "../log";
import { samples } from "../samples";

// The draft as paragraphs, with every ticked quote marked so it can be underlined.
function DraftView({ round }: { round: Round }): React.JSX.Element {
  const quotes = round.verdicts.filter((v) => v.ticked && v.quote !== "").map((v) => v.quote);
  const paragraphs = round.draft.split(/\n\s*\n/).filter((p) => p.trim() !== "");
  // Case and quote styles folded one character for one, so positions still line up with the text.
  const fold = (t: string): string => t.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2010-\u2015]/g, "-");
  const mark = (text: string): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let rest = text.replace(/\s+/g, " ");
    for (;;) {
      let best: { at: number; length: number } | undefined;
      for (const q of quotes) {
        const needle = fold(q.replace(/\s+/g, " ").trim());
        const at = fold(rest).indexOf(needle);
        if (needle !== "" && at >= 0 && (best === undefined || at < best.at)) best = { at, length: needle.length };
      }
      if (best === undefined) break;
      out.push(rest.slice(0, best.at), <mark key={out.length}>{rest.slice(best.at, best.at + best.length)}</mark>);
      rest = rest.slice(best.at + best.length);
    }
    out.push(rest);
    return out;
  };
  return (
    <div className="draft paper" style={{ "--u": "1px" } as React.CSSProperties}>
      <p className="draft-label">Your revision, round {round.n}</p>
      {paragraphs.map((p, i) => {
        const lines = p.split("\n").filter((l) => l.trim() !== "");
        return lines.length > 1 ? (
          lines.map((l, k) => (
            <p key={`${String(i)}-${String(k)}`} className="flush">
              {mark(l)}
            </p>
          ))
        ) : (
          <p key={i}>{mark(p)}</p>
        );
      })}
    </div>
  );
}

export default function CheckTab({ essay }: { essay: Essay }): React.JSX.Element {
  const sample = samples.find((s) => s.id === essay.sampleId);
  const latest = essay.rounds[essay.rounds.length - 1];
  const [draft, setDraft] = useState("");
  const asked = Number(new URLSearchParams(location.search).get("round"));
  const [viewing, setViewing] = useState<number | undefined>(essay.rounds.some((r) => r.n === asked) ? asked : latest?.n);
  const [open, setOpen] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [fresh, setFresh] = useState<number | undefined>();
  const [pair, setPair] = useState<number | undefined>();
  const round = essay.rounds.find((r) => r.n === viewing);
  const nextSample = sample?.revisions[Math.min(essay.rounds.length, sample.revisions.length - 1)];

  const run = async (): Promise<void> => {
    if (draft.trim().split(/\s+/).length < 20) {
      setProblem("Paste your whole revised essay, not just a sentence or two.");
      return;
    }
    setBusy(true);
    setProblem("");
    try {
      const k = sample?.revisions.indexOf(draft) ?? -1;
      const verdicts = await check(
        {
          sentences: allSentences(essay.paragraphs).map((s) => ({ id: s.id, text: s.text })),
          draft,
          comments: essay.marks.map((m) => ({ n: m.n, words: m.words, meaning: m.plain === undefined ? m.words : `${m.plain.meaning} ${m.plain.todo}`, sentenceId: m.sentenceId })),
        },
        sample !== undefined && k >= 0 ? `/samples/${sample.id}-check-${String(k + 1)}.json` : undefined,
      );
      const n = essay.rounds.length + 1;
      updateEssay(essay.id, (e) => ({ ...e, rounds: [...e.rounds, { n, at: new Date().toISOString(), draft, verdicts }] }));
      setViewing(n);
      setFresh(n);
      setDraft("");
    } catch (error) {
      if (!(error instanceof ApiError)) log("error", "check failed", { error: String(error) });
      setProblem(error instanceof Error ? error.message : "The check didn't finish. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const arrive = fresh !== undefined && fresh === viewing && round !== undefined ? new Map(round.verdicts.map((v, i) => [v.n, 0.2 + i * 0.32])) : undefined;
  return (
    <div className="essay-body check">
      <div className="pages">
        <form
          className="revise"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <label htmlFor="draft" className="revise-label">
            {essay.rounds.length === 0 ? "Paste your revised essay" : "Paste your newest draft"}
          </label>
          <p className="hint">Your draft is sent to NVIDIA, Groq or Cloudflare to be checked. The draft isn’t kept; the sentences that answer each comment are.</p>
          <textarea
            id="draft"
            value={draft}
            required
            rows={essay.rounds.length === 0 ? 12 : 6}
            placeholder="Your whole essay, as you rewrote it"
            onChange={(e) => {
              setDraft(e.currentTarget.value);
            }}
          />
          <div className="revise-actions">
            <button type="submit" className="btn" disabled={busy || draft.trim() === ""}>
              {busy ? "Checking every comment, up to a minute" : essay.rounds.length === 0 ? "Check it" : "Check again"}
            </button>
            {nextSample !== undefined && (
              <button type="button" className="btn quiet" disabled={busy} onClick={() => {
                setDraft(nextSample);
                setProblem("");
              }}>
                Paste the sample&rsquo;s revision
              </button>
            )}
          </div>
          {problem !== "" && (
            <p className="problem" role="alert">
              {problem}
            </p>
          )}
        </form>
        {round !== undefined && <DraftView round={round} />}
      </div>
      {round === undefined ? (
        <section className="card empty-card">
          <header className="card-head">
            <h2 className="count">Not checked yet</h2>
          </header>
          <p className="empty-note">
            Paste your revision and press <strong>Check it</strong>. Each of the {essay.marks.length} comments gets a green tick that quotes the new sentence answering it, or stays red with the reason.
          </p>
        </section>
      ) : (
        <IndexCard
          essay={essay}
          open={open}
          onOpen={(n) => {
            setOpen(n === open ? undefined : n);
          }}
          round={round}
          arrive={arrive}
          onBeforeAfter={setPair}
          header={
            <>
              <h2 className="count">Round {round.n}</h2>
              <p className="answered">
                {answered(round)} of {essay.marks.length} answered
              </p>
              {essay.rounds.length > 1 && (
                <div className="rounds" role="group" aria-label="Rounds">
                  {essay.rounds.map((r) => (
                    <button key={r.n} type="button" className="round-pick" aria-pressed={r.n === viewing} onClick={() => {
                      setViewing(r.n);
                      setFresh(undefined);
                    }}>
                      Round {r.n}
                    </button>
                  ))}
                </div>
              )}
            </>
          }
        />
      )}
      {pair !== undefined && round !== undefined && (
        <BeforeAfter
          essay={essay}
          round={round}
          n={pair}
          onClose={() => {
            setPair(undefined);
          }}
        />
      )}
    </div>
  );
}
