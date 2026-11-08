// Scan an essay: page photos (read by the vision model) or a Word file (read here, in the browser).

import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "../lib/api";
import { NotAnEssay, scanPhotos } from "../lib/build";
import { readWordFile } from "../lib/docx";
import { setFresh } from "../lib/fresh";
import { saveEssay } from "../lib/store";
import { log } from "../log";
import { follow, go, usePath } from "../router";

const MAX_PHOTOS = 4;

type Status = { kind: "idle" } | { kind: "reading"; page: number; total: number; step: "page" | "plain" } | { kind: "error"; message: string; allowance: boolean };

function Problem({ status }: { status: Status }): React.JSX.Element | null {
  if (status.kind !== "error") return null;
  return (
    <p className="problem" role="alert">
      {status.message}{" "}
      {status.allowance && (
        <a href="/samples" onClick={follow}>
          Open a sample instead
        </a>
      )}
    </p>
  );
}

function errorStatus(error: unknown): Status {
  if (error instanceof NotAnEssay) return { kind: "error", message: error.message, allowance: false };
  if (error instanceof ApiError) return { kind: "error", message: error.message, allowance: error.kind === "allowance" };
  log("error", "scan failed", { error: String(error) });
  return { kind: "error", message: error instanceof Error ? error.message : "That didn't work. Try again.", allowance: false };
}

function Photos(): React.JSX.Element {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(
    () => () => {
      for (const u of urls) URL.revokeObjectURL(u);
    },
    [urls],
  );

  const add = (list: FileList | null): void => {
    const images = [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
    if (list !== null && list.length > 0 && images.length === 0) {
      setStatus({ kind: "error", message: "Those aren't photos. Choose JPEG, PNG or WebP pictures of the pages.", allowance: false });
      return;
    }
    const next = [...files, ...images].slice(0, MAX_PHOTOS);
    if (files.length + images.length > MAX_PHOTOS) setStatus({ kind: "error", message: `Up to ${String(MAX_PHOTOS)} pages at a time. The first ${String(MAX_PHOTOS)} are kept.`, allowance: false });
    else setStatus({ kind: "idle" });
    setFiles(next);
  };

  const read = async (): Promise<void> => {
    setStatus({ kind: "reading", page: 1, total: files.length, step: "page" });
    try {
      const { essay, photos } = await scanPhotos(files, (page, total) => {
        setStatus({ kind: "reading", page, total, step: page > total ? "plain" : "page" });
      });
      saveEssay(essay);
      setFresh({ id: essay.id, photos });
      go(`/e/${essay.id}`);
    } catch (error) {
      setStatus(errorStatus(error));
    }
  };

  const reading = status.kind === "reading";
  return (
    <div className="scan-photos">
      <div
        className={`drop${over ? " over" : ""}${files.length > 0 ? " has" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => {
          setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
      >
        {files.length === 0 ? (
          <div className="drop-empty">
            <p className="drop-title">Drop a photo of each marked page here</p>
            <p>One to four pages, in order. Typed essays marked by hand, in any colour of pen.</p>
            <button type="button" className="btn" onClick={() => input.current?.click()}>
              Choose photos
            </button>
          </div>
        ) : (
          <ol className="prints">
            {urls.map((u, i) => (
              <li key={u} className={`print${reading && status.page === i + 1 ? " reading" : ""}${reading && status.page > i + 1 ? " read" : ""}`} style={{ "--tilt": `${String((i % 2 === 0 ? -1 : 1) * (1.5 + i))}deg` } as React.CSSProperties}>
                <img src={u} alt={`Page ${String(i + 1)}`} />
                <span className="print-n">Page {i + 1}</span>
                {!reading && (
                  <button type="button" className="print-remove" aria-label={`Remove page ${String(i + 1)}`} onClick={() => {
                    setFiles(files.filter((_, k) => k !== i));
                  }}>
                    Remove
                  </button>
                )}
                {reading && status.page === i + 1 && <span className="scanline" aria-hidden="true" />}
              </li>
            ))}
            {files.length < MAX_PHOTOS && !reading && (
              <li className="print add">
                <button type="button" onClick={() => input.current?.click()}>
                  Add a page
                </button>
              </li>
            )}
          </ol>
        )}
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => {
          add(e.currentTarget.files);
          e.currentTarget.value = "";
        }} />
      </div>
      <div className="scan-actions">
        <button type="button" className="btn" disabled={files.length === 0 || reading} onClick={() => void read()}>
          Read the marks
        </button>
        <p className="progress" aria-live="polite">
          {reading ? (status.step === "plain" ? "Putting each comment in plain words" : `Reading page ${String(status.page)} of ${String(status.total)}`) : files.length === 0 ? "No photos yet." : `${String(files.length)} ${files.length === 1 ? "page" : "pages"} ready.`}
        </p>
      </div>
      <Problem status={status} />
    </div>
  );
}

function WordFile(): React.JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const open = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return;
    if (!/\.docx$/i.test(file.name)) {
      setStatus({ kind: "error", message: "That isn't a Word file. Choose a .docx file.", allowance: false });
      return;
    }
    setStatus({ kind: "reading", page: 1, total: 1, step: "plain" });
    try {
      const essay = await readWordFile(file);
      saveEssay(essay);
      setFresh({ id: essay.id, photos: [] });
      go(`/e/${essay.id}`);
    } catch (error) {
      setStatus(errorStatus(error));
    }
  };
  return (
    <div className="scan-word">
      <div
        className={`drop${over ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => {
          setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void open(e.dataTransfer.files[0]);
        }}
      >
        <div className="drop-empty">
          <p className="drop-title">Drop a Word file with your teacher&rsquo;s comments</p>
          <p className="hint">From Google Docs: File, Download, Microsoft Word</p>
          <button type="button" className="btn" disabled={status.kind === "reading"} onClick={() => input.current?.click()}>
            Choose a Word file
          </button>
          <p className="progress" aria-live="polite">
            {status.kind === "reading" ? "Reading the comments and putting each in plain words" : "The file is read here, in your browser."}
          </p>
        </div>
        <input ref={input} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(e) => {
          void open(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }} />
      </div>
      <Problem status={status} />
    </div>
  );
}

export function Scan(): React.JSX.Element {
  const path = usePath();
  const word = path.includes("tab=word");
  return (
    <section className="screen scan">
      <div className="screen-head">
        <h1>Scan an essay</h1>
        <div className="tabs" role="tablist" aria-label="What to scan">
          <a role="tab" href="/scan" onClick={follow} aria-selected={!word} aria-current={!word ? "page" : undefined}>
            Photos
          </a>
          <a role="tab" href="/scan?tab=word" onClick={follow} aria-selected={word} aria-current={word ? "page" : undefined}>
            Word file
          </a>
        </div>
      </div>
      {word ? <WordFile /> : <Photos />}
      <p className="aside">
        No marked essay to hand?{" "}
        <a href="/samples" onClick={follow}>
          Try a sample
        </a>
        , or download its page photos there.
      </p>
    </section>
  );
}
