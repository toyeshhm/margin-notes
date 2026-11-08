// Text helpers shared by the browser and the Worker: sentence splitting, normalising for
// word-for-word checks, and finding the sentence a mark sits beside.

import type { Paragraph, Sentence } from "./types";

// Lower case, curly quotes and dashes made plain, punctuation spacing and runs of space folded,
// so "students got 34 more minutes" matches across copy and paste from any editor.
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+([.,;:!?)])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function words(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w !== "");
}

// A sentence ends at . ! or ? (and any closing quote or bracket) followed by space and a capital,
// a quote, a bracket or a digit. Abbreviations common in essays don't end one.
const ABBREV = /(?:\b(?:Mr|Mrs|Ms|Dr|St|vs|etc|al|e\.g|i\.e|Jr|Sr|No|p|pp)\.)$/i;

export function splitSentences(paragraph: string): string[] {
  const text = paragraph.replace(/\s+/g, " ").trim();
  if (text === "") return [];
  const out: string[] = [];
  const re = /[.!?]+["”’')\]]*\s+(?=["“‘(\[]?[A-Z0-9])/g;
  let start = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const end = m.index + m[0].trimEnd().length;
    const candidate = text.slice(start, end);
    if (ABBREV.test(candidate)) continue;
    out.push(candidate.trim());
    start = m.index + m[0].length;
  }
  const rest = text.slice(start).trim();
  if (rest !== "") out.push(rest);
  return out;
}

// Plain text (paragraphs split by blank lines) into paragraphs of sentences with ids.
// A paragraph of short lines with no closing punctuation (an essay's heading block) keeps each line.
export function toParagraphs(text: string, page: number, startId = 0): Paragraph[] {
  let next = startId;
  const blocks = text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    // A running head ("Okafor 2") is not part of the essay.
    .filter((b) => b !== "" && !/^[A-Z][\w'-]* \d{1,2}$/.test(b));
  let body = false;
  return blocks.map((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    // Heading lines (name, teacher, class, date, title) are short with no closing punctuation,
    // and come before the first real paragraph of the essay.
    const short = lines.every((l) => l.length < 80 && !/[.!?]["”]?$/.test(l));
    const heading = !body && short && (lines.length > 1 || startId === 0);
    if (!heading) body = true;
    const parts = heading ? lines : splitSentences(lines.join(" "));
    const sentences: Sentence[] = parts.map((t) => ({ id: `s${String(next++)}`, text: t, page }));
    return { sentences, heading };
  });
}

export function allSentences(paragraphs: readonly Paragraph[]): Sentence[] {
  return paragraphs.flatMap((p) => p.sentences);
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const here = row[j] ?? 0;
      row[j] = Math.min(here + 1, (row[j - 1] ?? 0) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = here;
    }
  }
  return row[b.length] ?? 0;
}

// Two read words are the same word: equal, or a letter or two apart in a longer word
// (a model reading "recieve" may copy it as "receive").
export function alike(a: string, b: string): boolean {
  if (a === b) return true;
  const n = Math.min(a.length, b.length);
  return n >= 5 && distance(a, b) <= (n >= 8 ? 2 : 1);
}

// How much of the typed words `near` a sentence holds, in order, from 0 to 1 (1 when it holds them whole).
export function matchScore(near: string, sentence: string): number {
  const target = words(near);
  if (target.length === 0) return 0;
  if (normalize(sentence).includes(normalize(near))) return 1;
  const have = words(sentence);
  let i = 0;
  let hits = 0;
  for (const w of target) {
    const at = have.findIndex((h, k) => k >= i && alike(h, w));
    if (at >= 0) {
      hits++;
      i = at + 1;
    }
  }
  return hits / target.length;
}

// The sentence a mark belongs to: the one holding the most of the typed words beside the mark,
// in order; ties go to the earlier sentence, since a mark beside a line break belongs to its start.
export function findSentence(near: string, sentences: readonly Sentence[]): Sentence | undefined {
  let best: Sentence | undefined;
  let bestScore = 0;
  for (const s of sentences) {
    const score = matchScore(near, s.text);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return bestScore >= 0.5 ? best : undefined;
}

// The exact span of `near` inside a sentence's text, for underlining the words a mark sits on.
export function findSpan(near: string, sentence: string): { start: number; end: number } | undefined {
  const target = words(near);
  if (target.length === 0) return undefined;
  const tokens = [...sentence.matchAll(/[A-Za-z0-9'’-]+/g)];
  const norm = tokens.map((t) => words(t[0])[0] ?? "");
  let bestLen = 0;
  let best: { start: number; end: number } | undefined;
  for (let i = 0; i < norm.length; i++) {
    let k = 0;
    while (i + k < norm.length && k < target.length && alike(norm[i + k] ?? "", target[k] ?? "")) k++;
    if (k > bestLen) {
      bestLen = k;
      const first = tokens[i];
      const last = tokens[i + k - 1];
      if (first?.index !== undefined && last?.index !== undefined) {
        best = { start: first.index, end: last.index + last[0].length };
      }
    }
  }
  return bestLen >= Math.min(2, target.length) ? best : undefined;
}
