// Page photos in the browser: shrink a photo for sending, find the teacher's coloured ink on it,
// and cut a close-up around each mark with a box drawn round it, so the vision model reads one
// mark at a time at full detail. Typed text is black or grey, so ink is any strongly coloured pixel.

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface MarkCrop {
  canvas: HTMLCanvasElement;
  // The mark sits outside the typed text block, in a margin.
  inMargin: boolean;
}

export async function loadPhoto(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (ctx === null) throw new Error("This browser can't read images.");
  return [c, ctx];
}

// The whole page as a JPEG data URL, at most `max` px on its long side.
export function pageJPEG(photo: ImageBitmap, max = 1600): string {
  const s = Math.min(1, max / Math.max(photo.width, photo.height));
  const [c, ctx] = canvas(photo.width * s, photo.height * s);
  ctx.drawImage(photo, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.86);
}

function saturation(r: number, g: number, b: number): [number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return [max === 0 ? 0 : (max - min) / max, max / 255];
}

interface Cells {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  n: number;
}

const overlaps = (a: Cells, b: Cells): boolean => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

// Connected patches of a mask, joining cells up to rx across and ry down apart.
function components(mask: Uint8Array, w: number, h: number, rx: number, ry: number): Cells[] {
  const seen = new Uint8Array(w * h);
  const out: Cells[] = [];
  for (let start = 0; start < w * h; start++) {
    if (mask[start] !== 1 || seen[start] === 1) continue;
    seen[start] = 1;
    const stack = [start];
    const c = { x0: w, y0: h, x1: 0, y1: 0, n: 0 };
    while (stack.length > 0) {
      const i = stack.pop() ?? 0;
      const x = i % w;
      const y = Math.floor(i / w);
      c.n++;
      c.x0 = Math.min(c.x0, x);
      c.x1 = Math.max(c.x1, x);
      c.y0 = Math.min(c.y0, y);
      c.y1 = Math.max(c.y1, y);
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (mask[j] === 1 && seen[j] !== 1) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    out.push(c);
  }
  return out;
}

// Boxes round each patch of coloured ink, in photo px, top to bottom. Works on a copy scaled so
// the page is about 325 cells wide; strokes closer than a few cells join into one mark.
export function findInk(photo: ImageBitmap): { marks: Box[]; text: Box | undefined } {
  const k = Math.max(1, photo.width / 325);
  const w = Math.round(photo.width / k);
  const h = Math.round(photo.height / k);
  const [, ctx] = canvas(w, h);
  ctx.drawImage(photo, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const ink = new Uint8Array(w * h);
  const stroke = new Uint8Array(w * h);
  const paper = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    const [s, v] = saturation(r, g, b);
    if (s > 0.45 && v > 0.25) ink[i] = 1;
    if (s > 0.28 && v > 0.3) stroke[i] = 1;
    else if (v > 0.62 && s < 0.25) paper[i] = 1;
  }
  // Typed text is dark pixels with paper close by on both sides; the block is where most of them lie.
  const dark = new Uint32Array(w);
  const darkRows = new Uint32Array(h);
  for (let y = 0; y < h; y++) {
    for (let x = 3; x < w - 3; x++) {
      const i = y * w + x;
      const r = data[i * 4] ?? 0;
      const g = data[i * 4 + 1] ?? 0;
      const b = data[i * 4 + 2] ?? 0;
      const [s, v] = saturation(r, g, b);
      if (v < 0.5 && s < 0.3 && paper[i - 3] === 1 && paper[i + 3] === 1) {
        dark[x] = (dark[x] ?? 0) + 1;
        darkRows[y] = (darkRows[y] ?? 0) + 1;
      }
    }
  }
  const colLimit = Math.max(...dark) * 0.15;
  const rowLimit = Math.max(...darkRows) * 0.15;
  const cols = [...dark.keys()].filter((x) => (dark[x] ?? 0) > colLimit);
  const rows = [...darkRows.keys()].filter((y) => (darkRows[y] ?? 0) > rowLimit);
  const text =
    cols.length > 0 && rows.length > 0
      ? { x0: (cols[0] ?? 0) * k, x1: ((cols[cols.length - 1] ?? 0) + 1) * k, y0: (rows[0] ?? 0) * k, y1: ((rows[rows.length - 1] ?? 0) + 1) * k }
      : undefined;
  // Written marks are dense ink; pale strokes on their own (an underline, a ring) belong to the
  // written mark on the same line, so the close-up shows which words it is about.
  const written = components(ink, w, h, 5, 2).filter((c) => c.n >= 12 && c.y1 - c.y0 >= 2);
  const strokes = components(stroke, w, h, 2, 1).filter((c) => c.n >= 6 && !written.some((m) => overlaps(m, c)));
  const line = h * 0.025;
  for (const st of strokes) {
    const sameLine = written.filter((m) => st.y0 < m.y1 + line && st.y1 > m.y0 - line);
    const gap = (m: Cells): number => Math.max(0, m.x0 - st.x1, st.x0 - m.x1);
    const near = sameLine.sort((p, q) => gap(p) - gap(q))[0];
    if (near !== undefined) Object.assign(near, { x0: Math.min(near.x0, st.x0), y0: Math.min(near.y0, st.y0), x1: Math.max(near.x1, st.x1), y1: Math.max(near.y1, st.y1) });
  }
  const marks: Box[] = written.map((c) => ({ x0: c.x0 * k, y0: c.y0 * k, x1: (c.x1 + 1) * k, y1: (c.y1 + 1) * k }));
  marks.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  return { marks: marks.slice(0, 30), text };
}

// A close-up of one mark with a blue box round it: the lines just above and below, and across
// the page when the mark is in a margin (its underline may be at the other end of the line).
export function cropMark(photo: ImageBitmap, box: Box, text: Box | undefined, width = 1400): MarkCrop {
  const W = photo.width;
  const H = photo.height;
  const inMargin = text !== undefined && (box.x1 < text.x0 + W * 0.01 || box.x0 > text.x1 - W * 0.01);
  const line = H * 0.03;
  const top = Math.max(0, box.y0 - line);
  const bottom = Math.min(H, box.y1 + line);
  const left = inMargin ? 0 : Math.max(0, box.x0 - W * 0.3);
  const right = inMargin ? W : Math.min(W, box.x1 + W * 0.3);
  const s = width / (right - left);
  const [c, ctx] = canvas(width, (bottom - top) * s);
  ctx.drawImage(photo, left, top, right - left, bottom - top, 0, 0, c.width, c.height);
  ctx.strokeStyle = "rgb(30, 90, 255)";
  ctx.lineWidth = 3;
  const pad = 8 * s;
  ctx.strokeRect((box.x0 - left) * s - pad, (box.y0 - top) * s - pad, (box.x1 - box.x0) * s + pad * 2, (box.y1 - box.y0) * s + pad * 2);
  return { canvas: c, inMargin };
}

// Close-ups stacked into one picture, each under a dark bar numbered "MARK n", so one request reads
// several marks (a vision request is charged per picture, not per mark).
export function sheetOf(crops: readonly MarkCrop[], first: number): string {
  const bar = 44;
  const width = Math.max(...crops.map((c) => c.canvas.width));
  const [c, ctx] = canvas(width, crops.reduce((h, k) => h + k.canvas.height + bar, 0));
  ctx.fillStyle = "rgb(20, 20, 20)";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "white";
  ctx.font = "bold 32px sans-serif";
  let y = 0;
  for (const [i, k] of crops.entries()) {
    ctx.fillText(`MARK ${String(first + i)}`, 12, y + 34);
    ctx.drawImage(k.canvas, 0, y + bar);
    y += bar + k.canvas.height;
  }
  return c.toDataURL("image/jpeg", 0.88);
}
