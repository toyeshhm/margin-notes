// Try a sample: a tray of marked essays written for the app. Each opens straight onto its index
// card from a scan saved in the repo (made by a real run of the scan on its photos or Word file),
// so it works without any AI call. Its photos or Word file can be downloaded to try the scan. The
// page photos shift a little under the visitor's hand, like prints on a table.

import { useState } from "react";

import { DriftImg } from "../art/DriftImg";
import { setFresh } from "../lib/fresh";
import { newId, saveEssay, useEssays } from "../lib/store";
import type { Essay } from "../lib/types";
import { log } from "../log";
import { go } from "../router";
import { samples } from "../samples";

type Saved = Pick<Essay, "title" | "source" | "paragraphs" | "marks">;

export default function Samples(): React.JSX.Element {
  const essays = useEssays();
  const [busy, setBusy] = useState<string | undefined>();
  const [problem, setProblem] = useState("");

  const open = async (id: string): Promise<void> => {
    const existing = essays.find((e) => e.sampleId === id);
    if (existing !== undefined) {
      go(`/e/${existing.id}`);
      return;
    }
    setBusy(id);
    setProblem("");
    try {
      const response = await fetch(`/samples/${id}.json`);
      if (!response.ok) throw new Error(`sample ${id}: ${String(response.status)}`);
      const saved = (await response.json()) as Saved;
      const essay: Essay = { ...saved, id: newId(), sampleId: id, rounds: [], createdAt: new Date().toISOString() };
      saveEssay(essay);
      setFresh({ id: essay.id, photos: [] });
      go(`/e/${essay.id}`);
    } catch (error) {
      log("error", "sample did not open", { error: String(error) });
      setProblem("That sample didn't open. Check your connection and try again.");
      setBusy(undefined);
    }
  };

  return (
    <section className="screen samples">
      <div className="screen-head">
        <h1>Try a sample</h1>
        <p className="screen-lede">Three essays written for Margin Notes and marked the way teachers mark. Open one to see its comments, then paste its revision to check it.</p>
      </div>
      {problem !== "" && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      <ul className="tray">
        {samples.map((s, i) => (
          <li key={s.id} className="tray-item" style={{ "--tilt": `${String([-1.2, 0.8, -0.4][i % 3] ?? 0)}deg` } as React.CSSProperties}>
            <button type="button" className="sample" disabled={busy !== undefined} onClick={() => void open(s.id)}>
              <span className="sample-page" aria-hidden="true">
                {s.source === "photos" ? (
                  <DriftImg src={`/samples/${s.files[0] ?? ""}`} depth={[10, -8, 12][i % 3] ?? 10} lazy />
                ) : (
                  <>
                    <span className="sample-lines" />
                    {s.comments.slice(0, 3).map((c, k) => (
                      <span key={c.n} className="sample-bubble" style={{ top: `${String(16 + k * 24)}%` }}>
                        {c.words}
                      </span>
                    ))}
                  </>
                )}
              </span>
              <span className="sample-title">{s.title}</span>
              <span className="sample-what">{s.what}</span>
              <span className="sample-open">{busy === s.id ? "Opening" : essays.some((e) => e.sampleId === s.id) ? "Open it again" : "Open it"}</span>
            </button>
            <p className="sample-files">
              {s.files.map((f) => (
                <a key={f} href={`/samples/${f}`} download>
                  Download {f.endsWith(".docx") ? "the Word file" : `page ${f.replace(/\D/g, "")} photo`}
                </a>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
