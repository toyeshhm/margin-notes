// Turning what was read into an essay: pages of sentences, each mark pinned to its sentence and
// numbered in reading order, then plain words for every mark.

import { ApiError, explain, readContext, readPageText, readWholePage, readWriting } from "./api";
import { keyFor, snapMark } from "./markingKey";
import { type Box, cropMark, cropWriting, findInk, type InkMark, loadPhoto, pageJPEG, sheetOf, writingSheet } from "./photo";
import { newId } from "./store";
import { allSentences, matchScore, RUNNING_HEAD, toParagraphs, words } from "./text";
import type { Essay, Mark, MarkKind, Paragraph, Plain } from "./types";

export interface ReadMark {
  words: string;
  kind: MarkKind;
  near: string;
  // Every printed phrase the mark may sit on or beside, best first (`near` when empty).
  hints?: string[];
  // How far down the page's typed text the mark sits, 0 (top) to 1 (bottom), when known.
  y?: number;
  page: number;
  // Exact sentence, when the source says (a Word comment's anchor).
  sentenceId?: string;
}

export function titleOf(paragraphs: readonly Paragraph[]): string {
  const head = paragraphs.find((p) => !p.heading);
  const before = paragraphs.slice(0, head === undefined ? 0 : paragraphs.indexOf(head));
  const title = before.flatMap((p) => p.sentences).pop()?.text;
  if (title !== undefined && title.length <= 80) return title;
  const first = allSentences(paragraphs)[0]?.text ?? "Untitled essay";
  return first.split(/\s+/).slice(0, 6).join(" ").replace(/[.,;:]$/, "");
}

// Going back to an earlier sentence than the mark above costs this much, plus a little for each
// sentence back: marks come top to bottom, so a reading that jumps back needs strong evidence.
const BACK = 0.6;
const BACK_EACH = 0.05;
// A paragraph copied onto one line is wrapped at about this many characters, a typed line's length.
const LINE = 90;

// A word or two matches by chance: a hint counts for less the fewer words it has.
const confidence = (hint: string): number => Math.min(1, words(hint).length / 3);
// How far, in typed lines, a mark's place down the photo may fall outside its sentence's lines, and how
// much that place counts against what was read beside the mark.
const REACH = 0.3;
const GUIDE = 1;

// A page's typed lines: the photo's own lines when its text was copied line by line, otherwise each
// long line (a whole paragraph) wrapped at about LINE characters. `indented` marks a paragraph's first
// line (a heading line is short and isn't).
function layoutLines(text: string): { line: string; indented: boolean }[] {
  return text
    .split(/\n\s*\n/)
    .filter((b) => !RUNNING_HEAD.test(b.trim()))
    .flatMap((b) =>
      b
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l !== "")
        .flatMap((l) => {
          if (l.length <= LINE * 1.25) return [l];
          const out: string[] = [];
          let line = "";
          for (const w of l.split(/\s+/)) {
            if (line !== "" && line.length + 1 + w.length > LINE) {
              out.push(line);
              line = w;
            } else line = line === "" ? w : `${line} ${w}`;
          }
          return [...out, line];
        })
        .map((line, k) => ({ line, indented: k === 0 && line.length >= 60 })),
    );
}

export function typedLines(text: string): string[] {
  return layoutLines(text).map((l) => l.line);
}

// The page's lines run together: where each line starts, and where each sentence (in page order) starts and ends.
function runTogether(lines: readonly string[], sentences: readonly { text: string }[]): { flat: string; starts: number[]; ranges: [number, number][] } {
  const starts: number[] = [];
  let flat = "";
  for (const l of lines) {
    starts.push(flat.length);
    flat += `${l} `;
  }
  let cursor = 0;
  const ranges = sentences.map((s): [number, number] => {
    const found = flat.indexOf(s.text, cursor);
    const start = found === -1 ? cursor : found;
    cursor = start + s.text.length;
    return [start, cursor];
  });
  return { flat, starts, ranges };
}

// For each sentence (in page order), the first and last typed line it is on.
export function lineSpans(lines: readonly string[], sentences: readonly { text: string }[]): { first: number; last: number }[] {
  const { starts, ranges } = runTogether(lines, sentences);
  const lineAt = (i: number): number => {
    let k = 0;
    while (k + 1 < starts.length && (starts[k + 1] ?? 0) <= i) k++;
    return k;
  };
  return ranges.map(([a, b]) => ({ first: lineAt(a), last: lineAt(Math.max(a, b - 1)) }));
}

// A paragraph's first line starts about this share of the text's width in.
const INDENT_SHARE = 0.075;

// The sentence (its index) a mark's ink points at, from where the ink lies over the page's typed lines,
// and the typed words under the ink when it lies on them: the words under the rings and underlines drawn
// with it (the most ink wins); else, for handwriting among the lines, the word under it; else, for a note
// in a margin, the sentence with most of its words on the note's line. `text` is the box round the typed
// text on the photo.
export function inkSentence(pageText: string, sentences: readonly { text: string }[], text: Box, mark: InkMark): { sentence: number; words?: string; pen?: true } | undefined {
  const layout = layoutLines(pageText);
  const lines = layout.map((l) => l.line);
  if (lines.length === 0 || sentences.length === 0 || text.y1 <= text.y0 || text.x1 <= text.x0) return undefined;
  const { flat, starts, ranges } = runTogether(lines, sentences);
  const n = lines.length;
  const width = text.x1 - text.x0;
  // Type is about half a line high, so line k's middle is (k + 1/4) lines down the text's box.
  const lineOf = (y: number): number => Math.min(n - 1, Math.max(0, Math.round(((y - text.y0) / (text.y1 - text.y0)) * (n - 0.5) - 0.25)));
  const full = Math.max(...lines.map((l) => l.length));
  const sentenceAt = (offset: number): number => {
    const i = ranges.findIndex(([, z]) => offset < z);
    return i === -1 ? ranges.length - 1 : i;
  };
  // Where in the run-together text the type at (x, y) is.
  const offsetAt = (x: number, y: number): number => {
    const l = lineOf(y);
    const left = text.x0 + (layout[l]?.indented === true ? INDENT_SHARE * width : 0);
    const c = Math.round(((x - left) / width) * full);
    return (starts[l] ?? 0) + Math.min((lines[l]?.length ?? 1) - 1, Math.max(0, c));
  };
  // The whole words from offset a to z.
  const wordsFrom = (a: number, z: number): string => {
    let from = a;
    let to = z;
    while (from > 0 && flat[from - 1] !== " ") from--;
    while (to < flat.length && flat[to] !== " ") to++;
    return flat.slice(from, to).trim();
  };
  // A ring or underline is wider than it is tall; a bracket or a tall stroke in a margin is not.
  const votes = new Map<number, { ink: number; from: number; to: number }>();
  for (const b of mark.strokes.filter((x) => x.x1 - x.x0 > x.y1 - x.y0)) {
    const y = (b.y0 + b.y1) / 2;
    const a = offsetAt(b.x0, y);
    const z = offsetAt(b.x1, y);
    const at = sentenceAt(Math.round((a + z) / 2));
    const vote = votes.get(at) ?? { ink: 0, from: a, to: z };
    votes.set(at, { ink: vote.ink + b.x1 - b.x0, from: Math.min(vote.from, a), to: Math.max(vote.to, z) });
  }
  const top = [...votes.entries()].sort((p, q) => q[1].ink - p[1].ink)[0];
  if (top !== undefined) {
    const [at, { from, to }] = top;
    const [a, z] = ranges[at] ?? [from, to];
    return { sentence: at, words: wordsFrom(Math.max(a, from), Math.min(z - 1, to)), pen: true };
  }
  const { core } = mark;
  const x = (core.x0 + core.x1) / 2;
  if (x > text.x0 && x < text.x1) {
    const at = offsetAt(x, core.y1);
    return { sentence: sentenceAt(at), words: wordsFrom(at, at) };
  }
  const l = lineOf((core.y0 + core.y1) / 2);
  const lo = starts[l] ?? 0;
  const hi = lo + (lines[l]?.length ?? 0);
  let best = 0;
  let most = Number.NEGATIVE_INFINITY;
  ranges.forEach(([a, z], i) => {
    const on = Math.min(z, hi) - Math.max(a, lo);
    if (on > most) {
      most = on;
      best = i;
    }
  });
  return { sentence: best };
}

// The body sentences on the typed lines within about a line of a mark `y` (a share of the typed text's
// height) down the page, at most six, in page order.
export function nearby(paras: readonly Paragraph[], text: string, y: number | undefined): string[] {
  if (y === undefined) return [];
  const lines = typedLines(text);
  const own = paras.flatMap((p) => p.sentences.map((s) => ({ text: s.text, heading: p.heading })));
  const at = y * Math.max(1, lines.length - 0.5) - 0.25;
  return lineSpans(lines, own)
    .flatMap((span, i) => {
      const s = own[i];
      return s !== undefined && !s.heading && span.last >= at - 1.25 && span.first <= at + 1.25 ? [s.text] : [];
    })
    .slice(0, 6);
}

// For marks in page order, the sentence of each: the choice that best matches what was read beside
// the mark and where the mark sits down the page, with the marks running down the page in step with
// the sentences. One misread mark can't pull its neighbours off, and a mark nothing was read for
// follows the one above. `from` and `to` bound each sentence's lines, and `ys` each mark's place, as shares
// of the height of the page's typed text; `reach` is about a third of a line in the same share.
export function placeMarks(sentences: readonly { text: string; from: number; to: number }[], hints: readonly (readonly string[])[], ys: readonly (number | undefined)[] = [], reach = 0.03): number[] {
  const n = sentences.length;
  if (n === 0) return hints.map(() => 0);
  const fit = hints.map((h, i) =>
    sentences.map((s) => {
      const read = Math.max(0, ...h.map((t, k) => (matchScore(t, s.text) * confidence(t)) ** 2 * (k === 0 ? 1 : 0.9)));
      const y = ys[i];
      const off = y === undefined ? 0 : Math.max(0, s.from - y, y - s.to);
      return read + (y === undefined ? 0 : GUIDE * Math.exp(-((off / reach) ** 2)));
    }),
  );
  let value: number[] = (fit[0] ?? []).map((v) => v);
  const from: number[][] = [];
  for (let i = 1; i < hints.length; i++) {
    const row: number[] = [];
    const next = sentences.map((_, j) => {
      let best = Number.NEGATIVE_INFINITY;
      let at = 0;
      for (let k = 0; k < n; k++) {
        const cost = k > j ? BACK + BACK_EACH * (k - j) : 0.001 * (j - k);
        const v = (value[k] ?? 0) - cost;
        if (v > best) {
          best = v;
          at = k;
        }
      }
      row.push(at);
      return best + (fit[i]?.[j] ?? 0);
    });
    from.push(row);
    value = next;
  }
  let j = value.indexOf(Math.max(...value));
  const out = new Array<number>(hints.length).fill(0);
  for (let i = hints.length - 1; i >= 0; i--) {
    out[i] = j;
    j = from[i - 1]?.[j] ?? j;
  }
  return out;
}

// Pin each mark to a sentence (on its own page) and number them in reading order. `pageText` is each
// page's text as copied from the photo, line by line.
export function pinMarks(paragraphs: readonly Paragraph[], read: readonly ReadMark[], pageText: ReadonlyMap<number, string> = new Map()): Mark[] {
  const sentences = allSentences(paragraphs);
  const order = new Map(sentences.map((s, i) => [s.id, i]));
  // The sentences a mark may sit on, each with the band of the page's typed text its lines take up.
  const body = (page: number): { sentences: { id: string; text: string; from: number; to: number }[]; reach: number } => {
    const paras = paragraphs.filter((q) => q.sentences[0]?.page === page);
    const lines = typedLines(pageText.get(page) ?? paras.map((p) => p.sentences.map((x) => x.text).join(p.heading ? "\n" : " ")).join("\n"));
    const own = paras.flatMap((p) => p.sentences.map((x) => ({ ...x, heading: p.heading })));
    const spans = lineSpans(lines, own);
    // From the top of the first line's type to the bottom of the last's, with type about half a line high.
    const height = Math.max(1, lines.length - 0.5);
    const placed = own.map((x, i) => ({ id: x.id, text: x.text, heading: x.heading, from: ((spans[i]?.first ?? 0) - 0.25) / height, to: ((spans[i]?.last ?? 0) + 0.75) / height }));
    const text = placed.filter((x) => !x.heading);
    return { sentences: (text.length > 0 ? text : placed).map(({ id, text: t, from, to }) => ({ id, text: t, from, to })), reach: REACH / height };
  };
  const chosen = new Map<number, string>();
  for (const page of new Set(read.map((m) => m.page))) {
    const here = read.map((m, i) => ({ m, i })).filter(({ m }) => m.page === page && m.sentenceId === undefined);
    const own = body(page);
    placeMarks(
      own.sentences,
      here.map(({ m }) => (m.hints !== undefined && m.hints.length > 0 ? m.hints : [m.near])),
      here.map(({ m }) => m.y),
      own.reach,
    ).forEach((at, k) => {
      const id = own.sentences[at]?.id;
      const item = here[k];
      if (id !== undefined && item !== undefined) chosen.set(item.i, id);
    });
  }
  const pinned = read.flatMap((m, i) => {
    const sentenceId = m.sentenceId ?? chosen.get(i);
    return sentenceId === undefined || !order.has(sentenceId) ? [] : [{ m, i, sentenceId }];
  });
  pinned.sort((a, b) => (order.get(a.sentenceId) ?? 0) - (order.get(b.sentenceId) ?? 0) || a.i - b.i);
  return pinned.map(({ m, sentenceId }, k) => ({ n: k + 1, words: m.words, kind: m.kind, near: m.near, sentenceId }));
}

// Plain words from /api/explain. When the day's free model allowance is used up, a mark the
// marking key knows still gets the key's own words; the rest show the teacher's words alone.
export async function addPlainWords(paragraphs: readonly Paragraph[], marks: Mark[]): Promise<Mark[]> {
  const text = new Map(allSentences(paragraphs).map((s) => [s.id, s.text]));
  let plains: Map<number, Plain>;
  try {
    plains = await explain(
      marks.map((m) => {
        const sentence = text.get(m.sentenceId) ?? m.near;
        // A caret's word is the one before the gap, not the words the comment is about.
        return { n: m.n, words: m.words, sentence, ...(m.kind !== "caret" && m.near !== "" && m.near !== sentence && sentence.includes(m.near) ? { marked: m.near } : {}) };
      }),
    );
  } catch (error) {
    if (!(error instanceof ApiError) || error.kind === "bad-request") throw error;
    plains = new Map(marks.flatMap((m) => {
      const key = keyFor(m.words);
      return key === undefined ? [] : [[m.n, { meaning: key.meaning, todo: key.todo }] as const];
    }));
  }
  return marks.map((m) => {
    const plain = plains.get(m.n);
    return plain === undefined ? m : { ...m, plain };
  });
}

// Close-ups per request: with context (each a wide strip), and of the writing alone (small).
const SHEET = 4;
const WRITING_SHEET = 8;

export class NotAnEssay extends Error {}

// Read every photo (one request per page), then explain the marks. `progress` gets the page being read.
export async function scanPhotos(files: readonly File[], progress: (page: number, total: number) => void): Promise<{ essay: Essay; photos: string[] }> {
  const paragraphs: Paragraph[] = [];
  const read: ReadMark[] = [];
  const photos: string[] = [];
  const pageText = new Map<number, string>();
  let next = 0;
  for (const [i, file] of files.entries()) {
    progress(i + 1, files.length);
    const photo = await loadPhoto(file);
    const ink = findInk(photo);
    const crops = ink.marks.map(({ box }) => cropMark(photo, box, ink.text));
    const writing = ink.marks.map(({ core }) => cropWriting(photo, core));
    const image = pageJPEG(photo);
    photos.push(image);
    // The typed words are read with the pen ink taken out; the marks are read from their own close-ups.
    const scan = await readPageText(ink.marks.length > 0 ? pageJPEG(photo, 1600, true) : image);
    if (!scan.isEssay) throw new NotAnEssay(files.length > 1 ? `Photo ${String(i + 1)} doesn't show a typed essay page, so nothing was read from it.` : "That photo doesn't show a typed essay page, so nothing was read from it.");
    pageText.set(i + 1, scan.text);
    const paras = toParagraphs(scan.text, i + 1, next);
    next += allSentences(paras).length;
    paragraphs.push(...paras);
    // How far down the typed text each mark sits, and the sentences on the lines beside it, for the model to choose from.
    const ys = ink.marks.map(({ core }) => (ink.text !== undefined && ink.text.y1 > ink.text.y0 ? Math.min(1, Math.max(0, ((core.y0 + core.y1) / 2 - ink.text.y0) / (ink.text.y1 - ink.text.y0))) : undefined));
    const choices = ys.map((y) => nearby(paras, scan.text, y));
    // The sentence each mark's ink lies over, which counts first when pinning it.
    const pageSentences = allSentences(paras);
    const inked = ink.marks.map((m) => {
      const at = ink.text === undefined ? undefined : inkSentence(scan.text, pageSentences, ink.text, m);
      const sentence = pageSentences[at?.sentence ?? -1]?.text;
      return sentence === undefined ? undefined : { sentence, words: at?.words, pen: at?.pen };
    });
    const found: ReadMark[] = [];
    const words: string[] = [];
    for (let k = 0; k < writing.length; k += WRITING_SHEET) {
      const group = writing.slice(k, k + WRITING_SHEET);
      words.push(...(await readWriting(writingSheet(group, 1), group.length)));
    }
    for (let k = 0; k < crops.length; k += SHEET) {
      const group = crops.slice(k, k + SHEET);
      const reads = await readContext(sheetOf(group, 1), choices.slice(k, k + SHEET));
      for (const [g, r] of reads.entries()) {
        const text = words[k + g] ?? "";
        const over = inked[k + g];
        if (text === "" || (r.near === "" && over === undefined)) continue;
        const y = ys[k + g];
        // The words it is about: those under a ring or underline; else as read, when they are in the sentence
        // the ink is over and take in the word under the handwriting; else that word, or the whole sentence for
        // a note in a margin.
        const under = over?.words ?? "";
        const asRead = over === undefined || (r.near !== "" && over.sentence.includes(r.near) && r.near.includes(under));
        const near = over?.pen === true && under !== "" ? under : asRead ? r.near : under !== "" ? under : over.sentence;
        // What the handwriting is read against is the typed sentence under it, never the model's echo of the handwriting.
        const printed = over?.sentence ?? r.hints.filter((h) => h.trim() !== text.trim()).join(" ");
        const snapped = snapMark(text, r.kind, printed);
        // An ordinary word written among the typed lines, with no ring or line drawn, is a word to put in there.
        const insert = over?.pen !== true && over?.words !== undefined && keyFor(snapped) === undefined && /^[a-z]+$/i.test(snapped);
        found.push({ words: insert ? `^ ${snapped}` : snapped, kind: insert ? "caret" : r.kind, near, hints: over === undefined ? r.hints : [over.sentence, ...r.hints], ...(y === undefined ? {} : { y }), page: i + 1 });
      }
    }
    if (crops.length === 0) found.push(...(await readWholePage(image)).map((m) => ({ ...m, page: i + 1 })));
    read.push(...found);
  }
  progress(files.length + 1, files.length);
  const marks = await addPlainWords(paragraphs, pinMarks(paragraphs, read, pageText));
  return {
    essay: { id: newId(), title: titleOf(paragraphs), source: "photos", paragraphs, marks, rounds: [], createdAt: new Date().toISOString() },
    photos,
  };
}
