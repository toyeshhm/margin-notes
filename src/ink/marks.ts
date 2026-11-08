// The teacher's marks drawn on a typed page, at the words they belong to. A page is an element
// 816 page-px wide (US Letter at 96 dpi), scaled by its --u custom property; the words a mark sits on
// are wrapped in `.t[data-c="<n>"]`, and every sentence is `.s[data-s="<id>"]`.

import { arrow, bracket, caret, handwrite, inkSVG, type Pen, pilcrow, ring, type Stroke, underline, BALLPOINT } from "./pen";

export type InkKind = "margin" | "circle" | "underline" | "caret" | "symbol" | "comment" | "bracket" | "between";

export interface InkMark {
  n: number;
  words: string;
  kind: InkKind;
  // Where the written words go: the right margin (default), the left margin, or above the words.
  side?: "left" | "right" | "above";
  sentenceId: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAGE_W = 816;
const MARGIN = 96;

// Where each mark's words are on the page, in unscaled page px.
export function anchors(page: HTMLElement, marks: readonly InkMark[]): Map<number, Rect[]> {
  const u = parseFloat(page.style.getPropertyValue("--u")) || 1;
  const box = page.getBoundingClientRect();
  const scale = box.width / (PAGE_W * u);
  const out = new Map<number, Rect[]>();
  for (const m of marks) {
    const el = page.querySelector(`.t[data-c="${String(m.n)}"]`) ?? page.querySelector(`.s[data-s="${m.sentenceId}"]`);
    if (el === null) continue;
    const rects = [...el.getClientRects()]
      .filter((r) => r.width > 0 || el.textContent === "")
      .map((r) => ({ x: (r.left - box.left) / scale / u, y: (r.top - box.top) / scale / u, w: r.width / scale / u, h: r.height / scale / u }));
    if (rects.length === 0) {
      const r = el.getBoundingClientRect();
      rects.push({ x: (r.left - box.left) / scale / u, y: (r.top - box.top) / scale / u, w: 0, h: 32 });
    }
    out.set(m.n, rects);
  }
  return out;
}

export interface DrawOptions {
  pen?: Pen;
  color?: string;
  write?: boolean;
  delay?: number;
  speed?: number;
  markSize?: number;
  seed?: number;
  // Seconds between one mark finishing and the next starting, when writing.
  pause?: number;
}

// Draw every mark. Returns the SVG markup (page-px viewBox) and, per mark, when its writing starts and ends.
export function drawMarks(page: HTMLElement, marks: readonly InkMark[], options: DrawOptions = {}): { svg: string; times: Map<number, [number, number]> } {
  const { pen = BALLPOINT, color = "var(--color-pen)", write = false, delay = 0.2, speed = 520, markSize = 21, seed = 1, pause = 0.08 } = options;
  const where = anchors(page, marks);
  const height = Math.max(1056, page.scrollHeight / (parseFloat(page.style.getPropertyValue("--u")) || 1));
  const groups: string[] = [];
  const times = new Map<number, [number, number]>();
  let t = delay;
  const textRight = PAGE_W - MARGIN;
  for (const m of marks) {
    const rects = where.get(m.n);
    const first = rects?.[0];
    const last = rects?.[rects.length - 1];
    if (rects === undefined || first === undefined || last === undefined || m.kind === "comment") continue;
    const s = seed * 100 + m.n;
    const strokes: Stroke[] = [];
    const add = (more: Stroke[]): void => {
      strokes.push(...more);
    };
    const base = (r: Rect): number => r.y + r.h * 0.8;
    const fit = (word: string, size: number, room: number): number => {
      const w = handwrite(word, { size, seed: s }).width;
      return w > room ? (size * room) / w : size;
    };
    const note = (word: string, x: number, y: number, size: number): void => {
      add(handwrite(word, { x, y, size, seed: s }).strokes);
    };
    const inMargin = (word: string, rect: Rect, side: "left" | "right"): void => {
      const size = Math.max(markSize * 0.82, fit(word, markSize * 0.95, MARGIN - 8));
      const w = handwrite(word, { size, seed: s }).width;
      note(word, side === "left" ? Math.max(4, MARGIN - 8 - w) : Math.min(textRight + 6, PAGE_W - w - 4), base(rect) + 1, size);
    };
    const above = (word: string, rect: Rect): void => {
      const size = markSize * 0.8;
      const w = handwrite(word, { size, seed: s }).width;
      note(word, Math.min(Math.max(4, rect.x + rect.w / 2 - w / 2), PAGE_W - w - 8), rect.y - 2, size);
    };
    const side = m.side ?? "right";
    switch (m.kind) {
      case "circle":
        for (const r of rects) add(ring({ x: r.x, y: r.y + r.h * 0.12, w: r.w, h: r.h * 0.78 }, { seed: s + Math.round(r.y), pad: 5 }));
        if (side === "above") above(m.words, first);
        else inMargin(m.words, first, side);
        break;
      case "margin":
      case "underline":
        for (const r of rects) add(underline(r.x, r.x + r.w, r.y + r.h + 1, { seed: s + Math.round(r.y) }));
        if (side === "above") above(m.words, first);
        else inMargin(m.words, last, side);
        break;
      case "bracket": {
        const bottom = last.y + last.h;
        add(bracket(MARGIN - 10, first.y + 2, bottom - 2, { seed: s }));
        const size = markSize * 0.95;
        const w = handwrite(m.words, { size, seed: s }).width;
        note(m.words, MARGIN - 22 - w, (first.y + bottom) / 2 + size * 0.45, size);
        break;
      }
      case "symbol":
        if (m.words.includes("¶")) add(pilcrow(first.x - 15, first.y - 6, markSize * 1.1, { seed: s }));
        else inMargin(m.words, first, side === "above" ? "right" : side);
        break;
      case "between": {
        // The note in the left margin, level with the line it is about, and an arrow to its first word.
        const size = fit(m.words, markSize * 0.9, 74);
        const w = handwrite(m.words, { size, seed: s }).width;
        note(m.words, 4, base(first) + 1, size);
        add(arrow([w + 8, base(first) - size * 0.35], [first.x - 4, base(first) - size * 0.3], { seed: s, head: 7, bow: 0.05 }));
        break;
      }
      case "caret": {
        add(caret(first.x + 1, base(first) + 1, 11, { seed: s }));
        const word = m.words.replace("^", "").trim();
        if (word !== "") {
          const size = markSize * 0.8;
          const w = handwrite(word, { size, seed: s }).width;
          note(word, first.x - w / 2, first.y - 2, size);
        }
        break;
      }
    }
    const g = inkSVG(strokes, { pen, color, write, delay: t, speed });
    groups.push(`<g class="mark" data-n="${String(m.n)}">${g.svg}</g>`);
    times.set(m.n, [t, g.end]);
    if (write) t = g.end + pause;
  }
  return { svg: `<svg class="ink" viewBox="0 0 ${String(PAGE_W)} ${height.toFixed(0)}" aria-hidden="true">${groups.join("")}</svg>`, times };
}
