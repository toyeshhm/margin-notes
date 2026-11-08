// The Comments tab: the typed pages with each mark pinned to its sentence, and the index card.
// Straight after a scan, the photos turn to dust and settle into the typed pages, the teacher's ink
// is written back on, and each comment arrives as a pin and a card item.

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { IndexCard } from "../components/IndexCard";
import { Page } from "../components/Page";
import { allSentences } from "../lib/text";
import { updateEssay } from "../lib/store";
import type { Essay } from "../lib/types";
import { prefersReducedMotion } from "../motion";

const SETTLE = 2.4;

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const observer = new ResizeObserver(() => {
      setWidth(Math.floor(el.clientWidth));
    });
    observer.observe(el);
    setWidth(Math.floor(el.clientWidth));
    return () => {
      observer.disconnect();
    };
  }, []);
  return [ref, width];
}

export function pagesOf(essay: Essay): number[] {
  return [...new Set(allSentences(essay.paragraphs).map((s) => s.page))];
}

export function CommentsTab({ essay, photos }: { essay: Essay; photos: string[] | undefined }): React.JSX.Element {
  const [reveal] = useState(() => photos !== undefined && photos.length > 0 && !prefersReducedMotion());
  const [open, setOpen] = useState<number | undefined>(reveal ? undefined : essay.marks[0]?.n);
  const [moving, setMoving] = useState<number | undefined>();
  const [ends, setEnds] = useState<Map<number, Map<number, [number, number]>>>(new Map());
  const [shown, setShown] = useState(reveal ? 0 : essay.marks.length);
  const [column, width] = useWidth<HTMLDivElement>();
  const stage = useRef<HTMLDivElement>(null);
  const pages = pagesOf(essay);

  // Each page starts writing when the page before it has finished.
  const delayFor = (page: number): number => {
    let t = SETTLE;
    for (const p of pages) {
      if (p === page) break;
      const times = [...(ends.get(p)?.values() ?? [])];
      t = Math.max(t, ...times.map(([, end]) => end + 0.1));
    }
    return t;
  };
  const onInk = useCallback((page: number, times: Map<number, [number, number]>) => {
    setEnds((prev) => (JSON.stringify([...(prev.get(page) ?? new Map<number, [number, number]>())]) === JSON.stringify([...times]) ? prev : new Map(prev).set(page, times)));
  }, []);
  const arrive = new Map<number, number>();
  if (reveal) for (const times of ends.values()) for (const [n, [, end]] of times) arrive.set(n, end + 0.3);

  // Once every page has reported when its ink is written, count the comments up as they arrive.
  const schedule = reveal && arrive.size >= essay.marks.length ? JSON.stringify([...arrive.values()].sort((a, b) => a - b)) : "";
  const first = essay.marks[0]?.n;
  useEffect(() => {
    if (schedule === "") return;
    const times = JSON.parse(schedule) as number[];
    const timers = times.map((at, i) =>
      window.setTimeout(() => {
        setShown(i + 1);
      }, at * 1000),
    );
    timers.push(
      window.setTimeout(() => {
        setOpen(first);
      }, ((times[times.length - 1] ?? 0) + 0.6) * 1000),
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [schedule, first]);

  useGSAP(
    () => {
      if (!reveal) return;
      gsap.fromTo(".reveal-photo", { filter: "grayscale(0) blur(0px)", y: 0, opacity: 1 }, { filter: "grayscale(1) blur(6px)", y: 26, opacity: 0, delay: 0.8, duration: 1.6, ease: "power2.in" });
      gsap.fromTo(".pages .paper", { filter: "blur(4px)", opacity: 0 }, { filter: "blur(0px)", opacity: 1, delay: 0.8, duration: 1.4, ease: "expo.out" });
    },
    { scope: stage, dependencies: [reveal] },
  );

  const move = (n: number, sentenceId: string): void => {
    const text = allSentences(essay.paragraphs).find((s) => s.id === sentenceId)?.text ?? "";
    updateEssay(essay.id, (e) => ({ ...e, marks: e.marks.map((m) => (m.n === n ? { ...m, sentenceId, near: text, kind: m.kind === "comment" ? "comment" : "margin" } : m)) }));
    setMoving(undefined);
    setOpen(n);
  };

  return (
    <div className="essay-body" ref={stage}>
      <div className="pages" ref={column}>
        {moving !== undefined && (
          <p className="choose" role="status">
            Tap the sentence comment {moving} belongs to.{" "}
            <button type="button" className="link" onClick={() => {
              setMoving(undefined);
            }}>
              Cancel
            </button>
          </p>
        )}
        {width > 0 &&
          pages.map((page, i) => (
            <div key={page} className="page-slot">
              <Page
                essay={essay}
                page={page}
                width={Math.min(width - 44, 640)}
                open={open}
                moving={moving}
                write={reveal}
                delay={delayFor(page)}
                arrive={reveal ? arrive : undefined}
                onOpen={setOpen}
                onMove={move}
                onInk={onInk}
              />
              {reveal && photos?.[i] !== undefined && <img className="reveal-photo" src={photos[i]} alt="" />}
            </div>
          ))}
      </div>
      <IndexCard
        essay={essay}
        open={open}
        onOpen={(n) => {
          setOpen(n === open ? undefined : n);
        }}
        onMove={setMoving}
        arrive={reveal ? arrive : undefined}
        header={
          <>
            <h2 className="count">
              {shown} {shown === 1 ? "comment" : "comments"}
            </h2>
            <p className="card-meta">{essay.rounds.length === 0 ? "Not checked yet" : `Checked ${String(essay.rounds.length)} ${essay.rounds.length === 1 ? "time" : "times"}`}</p>
          </>
        }
      />
    </div>
  );
}
