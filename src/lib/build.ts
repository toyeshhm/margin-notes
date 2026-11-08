// Turning what was read into an essay: pages of sentences, each mark pinned to its sentence and
// numbered in reading order, then plain words for every mark.

import { ApiError, explain, readContext, readPageText, readWholePage, readWriting } from "./api";
import { keyFor, snapMark } from "./markingKey";
import { cropMark, cropWriting, findInk, loadPhoto, pageJPEG, sheetOf, writingSheet } from "./photo";
import { newId } from "./store";
import { allSentences, matchScore, toParagraphs, words } from "./text";
import type { Essay, Mark, MarkKind, Paragraph, Plain, Sentence } from "./types";

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

// A word or two matches by chance: a hint counts for less the fewer words it has.
const confidence = (hint: string): number => Math.min(1, words(hint).length / 3);
// How far, as a share of the page's text, a mark's place down the photo may differ from its sentence's.
const REACH = 0.07;
const GUIDE = 0.5;

// For marks in page order, the sentence of each: the choice that best matches what was read beside
// the mark and where the mark sits down the page, with the marks running down the page in step with
// the sentences. One misread mark can't pull its neighbours off, and a mark nothing was read for
// follows the one above. `at` is the share of the page's text above the middle of each sentence.
export function placeMarks(sentences: readonly { text: string; at: number }[], hints: readonly (readonly string[])[], ys: readonly (number | undefined)[] = []): number[] {
  const n = sentences.length;
  if (n === 0) return hints.map(() => 0);
  const fit = hints.map((h, i) =>
    sentences.map((s) => {
      const read = Math.max(0, ...h.map((t, k) => (matchScore(t, s.text) * confidence(t)) ** 2 * (k === 0 ? 1 : 0.9)));
      const y = ys[i];
      return read + (y === undefined ? 0 : GUIDE * Math.exp(-(((s.at - y) / REACH) ** 2)));
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

// Pin each mark to a sentence (on its own page) and number them in reading order.
export function pinMarks(paragraphs: readonly Paragraph[], read: readonly ReadMark[]): Mark[] {
  const sentences = allSentences(paragraphs);
  const order = new Map(sentences.map((s, i) => [s.id, i]));
  const isHeading = (s: Sentence): boolean => paragraphs.find((p) => p.sentences.includes(s))?.heading === true;
  // The sentences a mark may sit on, each with the share of the page's text above its middle (a
  // heading line counts as one full line).
  const body = (page: number): { id: string; text: string; at: number }[] => {
    const own = sentences.filter((s) => s.page === page);
    const size = (s: Sentence): number => (isHeading(s) ? 90 : s.text.length);
    const total = own.reduce((t, s) => t + size(s), 0);
    let before = 0;
    const placed = own.map((s) => {
      const at = total === 0 ? 0 : (before + size(s) / 2) / total;
      before += size(s);
      return { id: s.id, text: s.text, at, heading: isHeading(s) };
    });
    const text = placed.filter((s) => !s.heading);
    return (text.length > 0 ? text : placed).map(({ id, text: t, at }) => ({ id, text: t, at }));
  };
  const chosen = new Map<number, string>();
  for (const page of new Set(read.map((m) => m.page))) {
    const here = read.map((m, i) => ({ m, i })).filter(({ m }) => m.page === page && m.sentenceId === undefined);
    const own = body(page);
    placeMarks(
      own,
      here.map(({ m }) => (m.hints !== undefined && m.hints.length > 0 ? m.hints : [m.near])),
      here.map(({ m }) => m.y),
    ).forEach((at, k) => {
      const id = own[at]?.id;
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
    plains = await explain(marks.map((m) => ({ n: m.n, words: m.words, sentence: text.get(m.sentenceId) ?? m.near })));
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
  let next = 0;
  for (const [i, file] of files.entries()) {
    progress(i + 1, files.length);
    const photo = await loadPhoto(file);
    const ink = findInk(photo);
    const crops = ink.marks.map(({ box }) => cropMark(photo, box, ink.text));
    const writing = ink.marks.map(({ core }) => cropWriting(photo, core));
    const image = pageJPEG(photo);
    photos.push(image);
    const scan = await readPageText(image);
    if (!scan.isEssay) throw new NotAnEssay(files.length > 1 ? `Photo ${String(i + 1)} doesn't show a typed essay page, so nothing was read from it.` : "That photo doesn't show a typed essay page, so nothing was read from it.");
    const paras = toParagraphs(scan.text, i + 1, next);
    next += allSentences(paras).length;
    paragraphs.push(...paras);
    const found: ReadMark[] = [];
    const words: string[] = [];
    for (let k = 0; k < writing.length; k += WRITING_SHEET) {
      const group = writing.slice(k, k + WRITING_SHEET);
      words.push(...(await readWriting(writingSheet(group, 1), group.length)));
    }
    for (let k = 0; k < crops.length; k += SHEET) {
      const group = crops.slice(k, k + SHEET);
      const reads = await readContext(sheetOf(group, 1), group.map((c) => c.inMargin));
      for (const [g, r] of reads.entries()) {
        const text = words[k + g] ?? "";
        if (text === "" || r.near === "") continue;
        const box = ink.marks[k + g]?.core;
        const y = box !== undefined && ink.text !== undefined && ink.text.y1 > ink.text.y0 ? Math.min(1, Math.max(0, ((box.y0 + box.y1) / 2 - ink.text.y0) / (ink.text.y1 - ink.text.y0))) : undefined;
        found.push({ words: snapMark(text, r.kind, r.hints.join(" ")), kind: r.kind, near: r.near, hints: r.hints, ...(y === undefined ? {} : { y }), page: i + 1 });
      }
    }
    if (crops.length === 0) found.push(...(await readWholePage(image)).map((m) => ({ ...m, page: i + 1 })));
    read.push(...found);
  }
  progress(files.length + 1, files.length);
  const marks = await addPlainWords(paragraphs, pinMarks(paragraphs, read));
  return {
    essay: { id: newId(), title: titleOf(paragraphs), source: "photos", paragraphs, marks, rounds: [], createdAt: new Date().toISOString() },
    photos,
  };
}
