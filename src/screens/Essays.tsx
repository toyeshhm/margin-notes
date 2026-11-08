// My essays: a drawer of folders, one per essay in this browser, each with its latest round.

import { useState } from "react";

import { Hand } from "../components/Hand";
import { deleteEssay, storageWorks, useEssays } from "../lib/store";
import { follow } from "../router";

export default function Essays(): React.JSX.Element {
  const essays = useEssays();
  const [confirm, setConfirm] = useState<string | undefined>();
  return (
    <section className="screen essays">
      <div className="screen-head">
        <h1>My essays</h1>
        <p className="screen-lede">Every essay you scanned in this browser, with each round you checked. Nothing here is on a server.</p>
      </div>
      {!storageWorks && <p className="problem">This browser isn&rsquo;t letting Margin Notes save, so essays last only until you close the tab.</p>}
      {essays.length === 0 ? (
        <div className="empty-drawer">
          <Hand words="?" size={64} />
          <p>No essays yet. Scan one, or open a sample to see how it works.</p>
          <div className="actions">
            <a className="btn" href="/scan" onClick={follow}>
              Scan an essay
            </a>
            <a className="btn quiet" href="/samples" onClick={follow}>
              Try a sample
            </a>
          </div>
        </div>
      ) : (
        <ul className="drawer">
          {essays.map((e) => {
            const latest = e.rounds[e.rounds.length - 1];
            const done = latest?.verdicts.filter((v) => v.ticked).length ?? 0;
            return (
              <li key={e.id} className="folder">
                <a className="folder-main" href={`/e/${e.id}`} onClick={follow}>
                  <span className="folder-title">{e.title}</span>
                  <span className="folder-round">{latest === undefined ? "Not checked yet" : `Round ${String(latest.n)}`}</span>
                  <span className={`folder-progress${latest !== undefined && done === e.marks.length ? " all" : ""}`}>
                    {latest === undefined ? `${String(e.marks.length)} comments` : `${String(done)} of ${String(e.marks.length)} answered`}
                  </span>
                </a>
                {e.rounds.length > 0 && (
                  <ol className="folder-rounds" aria-label={`Rounds of ${e.title}`}>
                    {e.rounds.map((r) => (
                      <li key={r.n}>
                        <a href={`/e/${e.id}?tab=check&round=${String(r.n)}`} onClick={follow}>
                          Round {r.n}: {r.verdicts.filter((v) => v.ticked).length} of {e.marks.length}
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="folder-delete">
                  {confirm === e.id ? (
                    <>
                      <span>Delete this essay and its rounds from this browser?</span>
                      <button type="button" className="btn small danger" onClick={() => {
                        deleteEssay(e.id);
                        setConfirm(undefined);
                      }}>
                        Delete it
                      </button>
                      <button type="button" className="btn quiet small" onClick={() => {
                        setConfirm(undefined);
                      }}>
                        Keep it
                      </button>
                    </>
                  ) : (
                    <button type="button" className="link" onClick={() => {
                      setConfirm(e.id);
                    }}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
