import type { InkKind } from "../ink/marks";

// A marked part of a sentence: the words `t` that comment `c` sits on.
export interface Marked {
  t: string;
  c: number;
}

// A sentence is plain text, or parts where some words carry a comment.
export type SampleSentence = string | (string | Marked)[];

export interface SampleComment {
  n: number;
  words: string;
  kind: InkKind;
  side?: "left" | "right" | "above";
  // Pen colour on the photo, when not the teacher's red.
  color?: string;
}

export interface SampleEssay {
  id: string;
  title: string;
  what: string;
  source: "photos" | "docx";
  heading: string[];
  surname: string;
  // pages -> paragraphs -> sentences
  pages: SampleSentence[][][];
  comments: SampleComment[];
  revisions: string[];
  // Files a judge can download to try the scan themselves, under /samples/.
  files: string[];
}

export function sentenceText(s: SampleSentence): string {
  return typeof s === "string" ? s : s.map((p) => (typeof p === "string" ? p : p.t)).join("");
}
