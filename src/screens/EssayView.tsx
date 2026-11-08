// One essay: its title band, where the pencil and eraser in graphite dust turn with the visitor's
// hand, and three tabs, Comments, Check my revision, Note for your teacher.

import { lazy, Suspense, useState } from "react";

import { Orbit } from "../art/Orbit";
import { BAND_TURN } from "../art/sheets";
import { takeFresh } from "../lib/fresh";
import { getEssay, useEssays } from "../lib/store";
import { follow, usePath } from "../router";
import { CommentsTab } from "./CommentsTab";

const CheckTab = lazy(() => import("./CheckTab"));
const NoteTab = lazy(() => import("./NoteTab"));

const TABS = [
  { id: "comments", label: "Comments" },
  { id: "check", label: "Check my revision" },
  { id: "note", label: "Note for your teacher" },
] as const;

export function EssayView({ id }: { id: string }): React.JSX.Element {
  useEssays();
  const path = usePath();
  const [photos] = useState(() => takeFresh(id));
  const essay = getEssay(id);
  const tab = new URLSearchParams(path.split("?")[1] ?? "").get("tab") ?? "comments";
  if (essay === undefined) {
    return (
      <section className="lost">
        <h1>This essay isn&rsquo;t in this browser</h1>
        <p>Essays are saved only in the browser that scanned them. Either it was deleted, or it was scanned on another device.</p>
        <a className="btn" href="/essays" onClick={follow}>
          Open My essays
        </a>
      </section>
    );
  }
  const latest = essay.rounds[essay.rounds.length - 1];
  return (
    <article className="essay">
      <header className="band">
        <Orbit className="band-art" still="/assets/turn-band.webp" {...BAND_TURN} />
        <div className="band-text">
          <h1>{essay.title}</h1>
          <p className="band-meta">
            {essay.marks.length} {essay.marks.length === 1 ? "comment" : "comments"}
            {latest === undefined ? ", not checked yet" : `, round ${String(latest.n)}: ${String(latest.verdicts.filter((v) => v.ticked).length)} of ${String(essay.marks.length)} answered`}
          </p>
        </div>
        <nav className="tabs essay-tabs" aria-label="Essay">
          {TABS.map((t) => (
            <a key={t.id} href={t.id === "comments" ? `/e/${id}` : `/e/${id}?tab=${t.id}`} onClick={follow} aria-current={tab === t.id ? "page" : undefined}>
              {t.label}
            </a>
          ))}
        </nav>
      </header>
      <Suspense fallback={<div className="loading-screen" aria-label="Loading" />}>
        {tab === "check" ? <CheckTab essay={essay} /> : tab === "note" ? <NoteTab essay={essay} /> : <CommentsTab essay={essay} photos={photos} />}
      </Suspense>
    </article>
  );
}
