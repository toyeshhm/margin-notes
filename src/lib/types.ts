// The shapes the browser keeps and the Worker answers with.

export interface Sentence {
  id: string;
  text: string;
  page: number;
}

export interface Paragraph {
  sentences: Sentence[];
  heading: boolean;
}

// How the teacher marked it. A typed comment comes from a Word file.
export type MarkKind = "margin" | "circle" | "underline" | "caret" | "symbol" | "comment";
export const MARK_KINDS: readonly MarkKind[] = ["margin", "circle", "underline", "caret", "symbol", "comment"];

export interface Mark {
  n: number;
  // The teacher's words or symbol, exactly as written.
  words: string;
  kind: MarkKind;
  // The typed words the mark sits on or beside.
  near: string;
  sentenceId: string;
  plain?: Plain;
}

export interface Plain {
  meaning: string;
  todo: string;
}

export interface Verdict {
  n: number;
  ticked: boolean;
  quote: string;
  reason: string;
  removed: boolean;
  quoteNotFound: boolean;
  // The new sentence or sentences lined up with the marked one.
  after: string[];
}

export interface Round {
  n: number;
  at: string;
  draft: string;
  verdicts: Verdict[];
}

export interface Essay {
  id: string;
  title: string;
  source: "photos" | "docx";
  sampleId?: string;
  paragraphs: Paragraph[];
  marks: Mark[];
  rounds: Round[];
  createdAt: string;
}

// What /api/scan answers for one page photo.
export interface PageScan {
  isEssay: boolean;
  text: string;
  marks: { words: string; kind: MarkKind; near: string }[];
}
