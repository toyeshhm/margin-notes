// Turning what was read into an essay: pages of sentences, each mark pinned to its sentence and
// numbered in reading order, then plain words for every mark.

import { ApiError, explain, scanPage } from "./api";
import { keyFor } from "./markingKey";
import { cropMark, findInk, loadPhoto, pageJPEG } from "./photo";
import { newId } from "./store";
import { allSentences, findSentence, toParagraphs } from "./text";
import type { Essay, Mark, MarkKind, Paragraph, Plain } from "./types";

export interface ReadMark {
  words: string;
  kind: MarkKind;
  near: string;
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

// Pin each mark to a sentence (on its own page first) and number them in reading order.
export function pinMarks(paragraphs: readonly Paragraph[], read: readonly ReadMark[]): Mark[] {
  const sentences = allSentences(paragraphs);
  const order = new Map(sentences.map((s, i) => [s.id, i]));
  const pinned = read.flatMap((m, i) => {
    const own = sentences.filter((s) => s.page === m.page);
    const s = m.sentenceId !== undefined ? sentences.find((x) => x.id === m.sentenceId) : (findSentence(m.near, own) ?? findSentence(m.near, sentences));
    const fallback = own.find((x) => !paragraphs.find((p) => p.sentences.includes(x))?.heading) ?? own[0];
    const at = s ?? fallback;
    return at === undefined ? [] : [{ m, i, sentenceId: at.id }];
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
    if (!(error instanceof ApiError) || error.kind !== "allowance") throw error;
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
    const crops = ink.marks.map((box) => cropMark(photo, box, ink.text));
    const image = pageJPEG(photo);
    photos.push(image);
    const scan = await scanPage(image, crops);
    if (!scan.isEssay) throw new NotAnEssay(files.length > 1 ? `Photo ${String(i + 1)} doesn't show a typed essay page, so nothing was read from it.` : "That photo doesn't show a typed essay page, so nothing was read from it.");
    const paras = toParagraphs(scan.text, i + 1, next);
    next += allSentences(paras).length;
    paragraphs.push(...paras);
    read.push(...scan.marks.map((m) => ({ ...m, page: i + 1 })));
  }
  progress(files.length + 1, files.length);
  const marks = await addPlainWords(paragraphs, pinMarks(paragraphs, read));
  return {
    essay: { id: newId(), title: titleOf(paragraphs), source: "photos", paragraphs, marks, rounds: [], createdAt: new Date().toISOString() },
    photos,
  };
}
