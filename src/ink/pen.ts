// The teacher's pen: handwriting and correction marks as real pen strokes.
// Words are written with the Hershey "Script 1-stroke" font (single-line glyphs from hersheytext 2.0.0, MIT),
// jittered like a hand, smoothed, and outlined by perfect-freehand with pressure. Shapes (rings,
// underlines, carets, ticks, the pilcrow, brackets) are point lists drawn the same way.

import { getStroke } from "perfect-freehand";

import glyphData from "./hershey-script.json";

export type Point = [number, number];
export type Stroke = Point[];

const GLYPHS = glyphData as unknown as Record<string, [string, number] | undefined>;

// Seeded randomness (mulberry32), so every render draws the same hand.
export function rng(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Pen {
  size: number;
  thinning: number;
  smoothing: number;
  streamline: number;
}

export const BALLPOINT: Pen = { size: 2.2, thinning: 0.55, smoothing: 0.6, streamline: 0.35 };
export const FELT: Pen = { size: 4.6, thinning: 0.25, smoothing: 0.7, streamline: 0.4 };

function parseGlyph(d: string): Stroke[] {
  return d
    .split("M")
    .filter((part) => part.trim() !== "")
    .map((part) =>
      part
        .replace("L", " ")
        .trim()
        .split(/\s+/)
        .map((p): Point => {
          const [x, y] = p.split(",").map(Number);
          return [x ?? 0, y ?? 0];
        }),
    );
}

// Chaikin corner cutting: turns Hershey's polylines into a hand's curves.
function smooth(points: Stroke, iterations = 2): Stroke {
  let out = points;
  for (let k = 0; k < iterations; k++) {
    if (out.length < 3) return out;
    const first = out[0];
    const last = out[out.length - 1];
    if (first === undefined || last === undefined) return out;
    const next: Stroke = [first];
    for (let i = 0; i < out.length - 1; i++) {
      const p = out[i];
      const q = out[i + 1];
      if (p === undefined || q === undefined) continue;
      next.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
    }
    next.push(last);
    out = next;
  }
  return out;
}

// Write `text` in the teacher's hand. (x, y) is the baseline start; `size` is the cap height in px.
export function handwrite(text: string, { x = 0, y = 0, size = 20, seed = 7, slant = 0.08, jitter = 0.5 } = {}): { strokes: Stroke[]; width: number } {
  const r = rng(seed);
  const k = size / 21; // Hershey capitals run from about y=1 to the baseline at y=22
  const strokes: Stroke[] = [];
  let pen = 0;
  for (const ch of text) {
    if (ch === " ") {
      pen += 11;
      continue;
    }
    const glyph = GLYPHS[ch] ?? GLYPHS["?"];
    if (glyph === undefined) continue;
    const parts = parseGlyph(glyph[0]);
    const maxX = Math.max(...parts.flat().map((p) => p[0]));
    const dy = (r() - 0.5) * 2 * jitter;
    const sc = 1 + (r() - 0.5) * 0.08 * jitter;
    for (const part of parts) {
      const pts = part.map(([gx, gy]): Point => {
        const px = pen + gx * sc + (r() - 0.5) * 0.6 * jitter;
        const py = (gy - 22) * sc + dy + (r() - 0.5) * 0.6 * jitter;
        return [x + (px - py * slant) * k, y + py * k];
      });
      const last = strokes[strokes.length - 1];
      const end = last?.[last.length - 1];
      const start = pts[0];
      if (last !== undefined && end !== undefined && start !== undefined && Math.hypot(end[0] - start[0], end[1] - start[1]) < 4.5 * k) {
        last.push(...pts);
        continue;
      }
      strokes.push(pts);
    }
    pen += /[a-z]/.test(ch) ? maxX + 1.5 : Math.max(maxX + 3, glyph[1] * 2 - 2);
  }
  return { strokes: strokes.map((s) => smooth(s)), width: pen * k };
}

// A ring drawn round a box, the way a teacher circles words: once round and a little past the start.
export function ring(box: { x: number; y: number; w: number; h: number }, { seed = 3, pad = 6, overshoot = 0.18 } = {}): Stroke[] {
  const r = rng(seed);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = box.w / 2 + pad + r() * 3;
  const ry = box.h / 2 + pad * 0.7 + r() * 2;
  const tilt = (r() - 0.5) * 0.08;
  const start = Math.PI * (1.05 + r() * 0.15);
  const pts: Stroke = [];
  const n = 48;
  for (let i = 0; i <= n * (1 + overshoot); i++) {
    const t = start + (i / n) * Math.PI * 2;
    const wob = 1 + (r() - 0.5) * 0.04 + (i / n) * 0.05;
    const ex = Math.cos(t) * rx * wob;
    const ey = Math.sin(t) * ry * wob;
    pts.push([cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), cy + ex * Math.sin(tilt) + ey * Math.cos(tilt)]);
  }
  return [pts];
}

export function underline(x1: number, x2: number, y: number, { seed = 5, rise = -2, waver = 1.2 } = {}): Stroke[] {
  const r = rng(seed);
  const pts: Stroke = [];
  const n = Math.max(6, Math.round((x2 - x1) / 18));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x1 + (x2 - x1) * t, y + rise * t + Math.sin(t * Math.PI * 2 + r()) * waver * 0.5 + (r() - 0.5) * waver]);
  }
  return [smooth(pts, 1)];
}

export function caret(x: number, y: number, size = 12, { seed = 9 } = {}): Stroke[] {
  const r = rng(seed);
  return [smooth([[x - size * 0.55, y + size * 0.9], [x + (r() - 0.5) * 2, y], [x + size * 0.5, y + size * 0.95]], 1)];
}

export function tick(x: number, y: number, size = 24, { seed = 11 } = {}): Stroke[] {
  const r = rng(seed);
  return [
    smooth(
      [
        [x, y + size * 0.45],
        [x + size * 0.18, y + size * 0.62],
        [x + size * 0.34, y + size * 0.95],
        [x + size * 0.55, y + size * 0.55],
        [x + size * 0.8, y + size * 0.18 + r() * 2],
        [x + size, y - size * 0.05],
      ],
      2,
    ),
  ];
}

// The pilcrow as a teacher draws it: a backward bowl, then two stems joined at the top.
export function pilcrow(x: number, y: number, size = 24, { seed = 17 } = {}): Stroke[] {
  const r = rng(seed);
  const w = size * 0.62;
  const s1 = x + w * 0.58;
  const s2 = x + w * 0.95;
  const bowl: Stroke = [];
  for (let i = 0; i <= 16; i++) {
    const t = -Math.PI / 2 - (i / 16) * Math.PI;
    bowl.push([s1 + Math.cos(t) * w * 0.5, y + size * 0.24 + Math.sin(t) * size * 0.24]);
  }
  bowl.push([s1, y + size * 0.48], [s1 - w * 0.15, y + size * 0.36], [s1 - w * 0.2, y + size * 0.16]);
  return [
    smooth(bowl, 1),
    [
      [s1, y],
      [s2 + r() * 0.5, y - 0.5],
    ],
    [
      [s1, y],
      [s1 + (r() - 0.5), y + size * 1.02],
    ],
    [
      [s2, y],
      [s2 + (r() - 0.5), y + size * 1.04],
    ],
  ];
}

export function bracket(x: number, y1: number, y2: number, { seed = 19, arm = 9 } = {}): Stroke[] {
  const r = rng(seed);
  return [
    smooth(
      [
        [x + arm, y1],
        [x, y1 + 3],
        [x + (r() - 0.5) * 2, (y1 + y2) / 2],
        [x, y2 - 3],
        [x + arm, y2],
      ],
      2,
    ),
  ];
}

export function arrow([x1, y1]: Point, [x2, y2]: Point, { seed = 23, head = 8, bow = 0.12 } = {}): Stroke[] {
  const r = rng(seed);
  const mx = (x1 + x2) / 2 - (y2 - y1) * bow;
  const my = (y1 + y2) / 2 + (x2 - x1) * bow;
  const line: Stroke = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    line.push([(1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t * t * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t * t * y2]);
  }
  const near = line[10] ?? [x1, y1];
  const a = Math.atan2(y2 - near[1], x2 - near[0]);
  const h1: Point = [x2 - Math.cos(a - 0.5) * head, y2 - Math.sin(a - 0.5) * head];
  const h2: Point = [x2 - Math.cos(a + 0.5) * head, y2 - Math.sin(a + 0.5) * head];
  return [line, [h1, [x2 + (r() - 0.5), y2], h2]];
}

// A stroke's filled outline as SVG path data.
export function outline(points: Stroke, pen: Pen): string {
  const o = getStroke(points, { ...pen, simulatePressure: true });
  const first = o[0];
  if (first === undefined) return "";
  const parts: string[] = ["M", first[0].toFixed(1), first[1].toFixed(1), "Q"];
  o.forEach(([x0, y0], i) => {
    const [x1, y1] = o[(i + 1) % o.length] ?? first;
    parts.push(x0.toFixed(1), y0.toFixed(1), ((x0 + x1) / 2).toFixed(1), ((y0 + y1) / 2).toFixed(1));
  });
  return `${parts.join(" ")} Z`;
}

function length(points: Stroke): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const q = points[i - 1];
    if (p !== undefined && q !== undefined) total += Math.hypot(p[0] - q[0], p[1] - q[1]);
  }
  return total;
}

let uid = 0;
// Strokes as an SVG <g> string. With `write`, each stroke is revealed along its centreline in order,
// starting at `delay` seconds at `speed` px per second. Returns the markup and when the last stroke ends.
export function inkSVG(strokes: Stroke[], { pen = BALLPOINT, color = "var(--color-pen)", write = false, delay = 0, speed = 420, gap = 0.04 } = {}): { svg: string; end: number } {
  let t = delay;
  const parts: string[] = [];
  for (const s of strokes) {
    if (s.length < 2) continue;
    const d = outline(s, pen);
    if (!write) {
      parts.push(`<path d="${d}" fill="${color}"/>`);
      continue;
    }
    const id = `pen-${String(++uid)}`;
    const dur = Math.max(0.05, length(s) / speed);
    const centre = `M${s.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L")}`;
    parts.push(
      `<mask id="${id}" maskUnits="userSpaceOnUse"><path d="${centre}" fill="none" stroke="#fff" stroke-width="${(pen.size * 3).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" class="pen-line" style="animation-duration:${dur.toFixed(3)}s;animation-delay:${t.toFixed(3)}s"/></mask>` +
        `<path d="${d}" fill="${color}" mask="url(#${id})"/>`,
    );
    t += dur + gap;
  }
  return { svg: `<g>${parts.join("")}</g>`, end: t };
}

// One word or phrase in the teacher's hand as a standalone SVG string sized to the writing.
// The Hershey script has no pilcrow, so a ¶ is drawn with the pilcrow strokes.
export function handSVG(text: string, { size = 22, pen = BALLPOINT, color = "var(--color-pen)", write = false, delay = 0, speed = 420, seed = 7, pad = 6 } = {}): { svg: string; end: number; width: number; height: number } {
  const strokes: Stroke[] = [];
  let width = 0;
  // A caret is drawn as the mark, not the Hershey "^" glyph (which reads as an arrow).
  const caretFirst = text.trimStart().startsWith("^");
  if (caretFirst) {
    strokes.push(...caret(pad + size * 0.4, pad + size * 0.55, size * 0.75, { seed }));
    width += size * 0.95;
  }
  for (const [i, part] of text.replace(/^\s*\^\s*/, "").split("¶").entries()) {
    if (i > 0) {
      strokes.push(...pilcrow(pad + width, pad + size * 0.1, size * 1.1, { seed }));
      width += size * 0.9;
    }
    if (part.trim() === "") continue;
    const h = handwrite(part.trim(), { x: pad + width, y: size + pad, size, seed: seed + i });
    strokes.push(...h.strokes);
    width += h.width + size * 0.3;
  }
  const g = inkSVG(strokes, { pen, color, write, delay, speed });
  const W = Math.ceil(width + pad * 2 + size * 0.4);
  const H = Math.ceil(size * 1.75 + pad * 2);
  const label = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return { svg: `<svg class="hand" width="${String(W)}" height="${String(H)}" viewBox="0 0 ${String(W)} ${String(H)}" role="img" aria-label="${label}">${g.svg}</svg>`, end: g.end, width: W, height: H };
}
