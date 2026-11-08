// One typed page of an essay with the teacher's marks redrawn in red pen at their words, and a
// numbered pin beside each marked sentence. Pins drag to another sentence; the open comment's
// sentence is lit.

import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";

import { anchors, drawMarks, type InkMark } from "../ink/marks";
import { findSpan } from "../lib/text";
import type { Essay, Mark } from "../lib/types";

interface Props {
  essay: Essay;
  page: number;
  width: number;
  open: number | undefined;
  moving: number | undefined;
  write: boolean;
  delay: number;
  onOpen: (n: number) => void;
  onMove: (n: number, sentenceId: string) => void;
  onInk?: (page: number, times: Map<number, [number, number]>) => void;
  // When each pin arrives, in seconds, during the reveal after a scan.
  arrive?: Map<number, number> | undefined;
}

function inkKind(m: Mark): InkMark["kind"] {
  if (m.kind === "symbol" && !m.words.includes("¶")) return "margin";
  return m.kind;
}

function sentenceChildren(text: string, marks: readonly Mark[]): ReactNode[] {
  const spans = marks
    .map((m) => ({ n: m.n, typed: m.kind === "comment", span: m.kind === "comment" ? exact(text, m.near) : findSpan(m.near, text) }))
    .filter((x): x is { n: number; typed: boolean; span: { start: number; end: number } } => x.span !== undefined)
    .sort((a, b) => a.span.start - b.span.start);
  const out: ReactNode[] = [];
  let at = 0;
  for (const { n, typed, span } of spans) {
    if (span.start < at) continue;
    out.push(text.slice(at, span.start));
    out.push(
      <span key={n} className={typed ? "t typed" : "t"} data-c={n}>
        {text.slice(span.start, span.end)}
      </span>,
    );
    at = span.end;
  }
  out.push(text.slice(at));
  return out;
}

function exact(text: string, near: string): { start: number; end: number } | undefined {
  const start = text.indexOf(near);
  return near === "" || start < 0 ? undefined : { start, end: start + near.length };
}

// The sentence under a point: the one hit, or else the one that starts on that line of the page.
function sentenceAt(page: HTMLElement, x: number, y: number): string | undefined {
  const hit = document.elementsFromPoint(x, y).find((el) => el.classList.contains("s") && page.contains(el));
  if (hit !== undefined) return hit.getAttribute("data-s") ?? undefined;
  let best: { id: string; left: number } | undefined;
  for (const el of page.querySelectorAll(".s")) {
    for (const r of el.getClientRects()) {
      if (y >= r.top && y <= r.bottom && (best === undefined || r.left < best.left)) best = { id: el.getAttribute("data-s") ?? "", left: r.left };
    }
  }
  return best?.id;
}

export function Page({ essay, page, width, open, moving, write, delay, onOpen, onMove, onInk, arrive }: Props): React.JSX.Element {
  const ref = useRef<HTMLElement>(null);
  const [ink, setInk] = useState("");
  const [pins, setPins] = useState<{ n: number; y: number }[]>([]);
  const [drag, setDrag] = useState<{ n: number; dy: number; startY: number } | undefined>();
  const u = width / 816;
  const { paragraphs, marks } = useMemo(() => {
    const own = essay.paragraphs.filter((p) => p.sentences[0]?.page === page);
    const ids = new Set(own.flatMap((p) => p.sentences.map((s) => s.id)));
    return { paragraphs: own, marks: essay.marks.filter((m) => ids.has(m.sentenceId)) };
  }, [essay, page]);
  const lit = essay.marks.find((m) => m.n === open)?.sentenceId;
  // The essay's title is the last heading line before the first paragraph; it sits centred.
  const firstBody = paragraphs.findIndex((p) => !p.heading);
  const titleAt = firstBody > 0 && paragraphs[firstBody - 1]?.sentences.length === 1 ? firstBody - 1 : -1;

  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const inkMarks: InkMark[] = marks.map((m) => ({ n: m.n, words: m.words, kind: inkKind(m), sentenceId: m.sentenceId, side: m.kind === "circle" || m.kind === "caret" ? "above" : "right" }));
    const drawn = drawMarks(el, inkMarks, { write, delay });
    setInk(drawn.svg);
    onInk?.(page, drawn.times);
    const where = anchors(el, inkMarks);
    // Pins on neighbouring lines would overlap: each sits at least a pin's height below the one before.
    const gap = 30 / (width / 816);
    let last = Number.NEGATIVE_INFINITY;
    const placed = marks
      .map((m) => ({ n: m.n, y: (where.get(m.n)?.[0]?.y ?? 0) + 16 }))
      .sort((a, b) => a.y - b.y || a.n - b.n)
      .map((p) => {
        last = Math.max(p.y, last + gap);
        return { n: p.n, y: last };
      });
    setPins(placed);
  }, [marks, width, write, delay, onInk, page]);

  const down = (n: number) => (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ n, dy: 0, startY: e.clientY });
  };
  const move = (e: PointerEvent<HTMLButtonElement>): void => {
    if (drag !== undefined) setDrag({ ...drag, dy: e.clientY - drag.startY });
  };
  const up = (n: number) => (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag;
    setDrag(undefined);
    if (d === undefined || ref.current === null) return;
    if (Math.abs(d.dy) < 6) {
      onOpen(n);
      return;
    }
    const target = sentenceAt(ref.current, e.clientX + 120 * u, e.clientY);
    if (target !== undefined) onMove(n, target);
  };

  return (
    <div className="page-wrap" style={{ width }}>
      <article
        ref={ref}
        className={`paper${moving !== undefined ? " choosing" : ""}`}
        style={{ "--u": `${String(u)}px` } as React.CSSProperties}
        data-page={page}
        onClick={(e) => {
          if (moving === undefined) return;
          const s = (e.target as HTMLElement).closest(".s");
          const id = s?.getAttribute("data-s");
          if (id !== undefined && id !== null) onMove(moving, id);
        }}
      >
        <span className="paper-run">Page {page}</span>
        {paragraphs.map((p, i) => (
          <p key={i} className={p.heading ? (i === titleAt ? "paper-head paper-title" : "paper-head") : undefined}>
            {p.sentences.map((s) => (
              <span key={s.id}>
                <span className={`s${s.id === lit ? " lit" : ""}`} data-s={s.id}>
                  {sentenceChildren(
                    s.text,
                    marks.filter((m) => m.sentenceId === s.id),
                  )}
                </span>{" "}
              </span>
            ))}
          </p>
        ))}
        <div className="ink-layer" dangerouslySetInnerHTML={{ __html: ink }} />
      </article>
      {pins.map(({ n, y }) => (
        <button
          key={n}
          type="button"
          className={`pin${n === open ? " open" : ""}${drag?.n === n ? " dragging" : ""}${arrive === undefined ? "" : " arriving"}`}
          style={{ top: y * u, transform: drag?.n === n ? `translateY(${String(drag.dy)}px)` : undefined, animationDelay: arrive === undefined ? undefined : `${((arrive.get(n) ?? 0) - 0.05).toFixed(2)}s` }}
          aria-label={`Comment ${String(n)}`}
          aria-pressed={n === open}
          onPointerDown={down(n)}
          onPointerMove={move}
          onPointerUp={up(n)}
          onPointerCancel={() => {
            setDrag(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(n);
            }
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
