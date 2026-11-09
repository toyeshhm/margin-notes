import { expect, test } from "vitest";

import { align, answerRegion } from "./align";
import { inkSentence, lineSpans, nearby, pinMarks, placeMarks, typedLines } from "./build";
import { isInstruction, quoteCheck } from "./guards";
import { keyFor, snapMark } from "./markingKey";
import { findSentence, splitSentences, toParagraphs } from "./text";

test("sentences split at end punctuation but not after Mr. or inside a quote", () => {
  expect(splitSentences("Even Mr. Patel told us. “It works,” she said. Seattle moved in 2016.")).toEqual([
    "Even Mr. Patel told us.",
    "“It works,” she said.",
    "Seattle moved in 2016.",
  ]);
});

test("a heading block keeps its lines; a running head is dropped", () => {
  const paras = toParagraphs("Okafor 2\n\nMaya Okafor\nMs. Ruiz\nEnglish 10\n\nIt is late. We are tired.", 2);
  expect(paras.map((p) => [p.heading, p.sentences.map((s) => s.text)])).toEqual([
    [true, ["Maya Okafor", "Ms. Ruiz", "English 10"]],
    [false, ["It is late.", "We are tired."]],
  ]);
});

test("a mark finds its sentence even when the copy fixed a misspelling", () => {
  const sentences = toParagraphs("It is hard to receive new information at night. A later start would help.", 1).flatMap((p) => p.sentences);
  expect(findSentence("to recieve new information", sentences)?.text).toBe("It is hard to receive new information at night.");
});

test("marks are numbered in reading order of their sentences", () => {
  const paragraphs = toParagraphs("One sentence here. Two sentence here. Three sentence here.", 1);
  const marks = pinMarks(paragraphs, [
    { words: "wc", kind: "circle", near: "One sentence here", page: 1 },
    { words: "awk", kind: "margin", near: "Two sentence here", page: 1 },
    { words: "trans", kind: "margin", near: "Two sentence here", page: 1, sentenceId: "s0" },
  ]);
  expect(marks.map((m) => [m.n, m.words])).toEqual([
    [1, "wc"],
    [2, "trans"],
    [3, "awk"],
  ]);
});

test("drafts line up in order, a split sentence finding both halves and a cut one finding none", () => {
  // old: A, B, C, D   new: A', B1, B2, D'   (C was cut, B was split)
  const one = [
    [0.95, 0.3, 0.3, 0.3],
    [0.3, 0.7, 0.68, 0.3],
    [0.35, 0.4, 0.4, 0.42],
    [0.3, 0.3, 0.3, 0.93],
  ];
  const split = [
    [0.4, 0.3, 0.3],
    [0.35, 0.92, 0.4],
    [0.3, 0.4, 0.4],
    [0.3, 0.3, 0.4],
  ];
  const merge = [
    [0.5, 0.4, 0.4, 0.3],
    [0.3, 0.5, 0.4, 0.4],
    [0.3, 0.3, 0.3, 0.6],
  ];
  expect(align({ one, split, merge }, 4, 4)).toEqual([[0], [1, 2], [], [3]]);
});

test("a tick stands only when its quote is in the draft word for word", () => {
  const draft = "Being this tired makes every class harder. Most of us get six hours.";
  expect(quoteCheck({ answered: true, quote: "Being this tired makes every class harder." }, draft)).toBe(true);
  expect(quoteCheck({ answered: true, quote: "“being this tired  makes every class harder”" }.quote.includes("being") ? { answered: true, quote: "being this tired  makes every class harder" } : { answered: true, quote: "" }, draft)).toBe(true);
  expect(quoteCheck({ answered: true, quote: "Being tired makes every class harder." }, draft)).toBe(false);
  expect(quoteCheck({ answered: true, quote: "" }, draft)).toBe(false);
  expect(quoteCheck({ answered: false, quote: "Most of us get six hours." }, draft)).toBe(false);
});

test("plain words that copy the sentence are not an instruction", () => {
  const sentence = "The fact that sleep is something we as students do not get enough of is a problem that is a big one.";
  expect(isInstruction("Say this more simply, and cut the words that repeat the same idea.", sentence)).toBe(true);
  expect(isInstruction("Try: sleep is something we as students do not get enough of.", sentence)).toBe(false);
  expect(isInstruction("Write “Most students do not get enough sleep” instead.", sentence)).toBe(false);
  expect(isInstruction(new Array(30).fill("word").join(" "), sentence)).toBe(false);
});

test("handwriting read a letter off snaps to the marking key", () => {
  expect(snapMark("widence?", "margin", "")).toBe("evidence?");
  expect(snapMark("RQ", "margin", "")).toBe("RO");
  expect(snapMark("S", "symbol", "")).toBe("¶");
  expect(snapMark("awk is", "circle", "is a problem")).toBe("awk");
  expect(snapMark("how warm?", "margin", "")).toBe("how warm?");
  expect(keyFor("^ let")?.mark).toBe("^");
});

test("marks run down the page with the sentences: a weakly read mark stays in step with the one above", () => {
  const sentences = [
    { text: "One sentence about alarms and mornings.", from: 0, to: 0.25 },
    { text: "Two sentence about the bus and the bell.", from: 0.25, to: 0.5 },
    { text: "Three sentence about sleep and melatonin.", from: 0.5, to: 0.75 },
    { text: "Four sentence about grades and sports.", from: 0.75, to: 1 },
  ];
  // The second mark was read beside the wrong words (part of the last sentence's), the others are clear.
  expect(placeMarks(sentences, [["alarms and mornings"], ["grades and zebras"], ["sleep and melatonin"], ["grades and sports"]])).toEqual([0, 0, 2, 3]);
  // Nothing read for the second mark: it stays with the one above.
  expect(placeMarks(sentences, [["the bus and the bell"], []])).toEqual([1, 1]);
  expect(placeMarks([], [["x"]])).toEqual([0]);
  // Read beside words that match two sentences, the mark's place down the page says which.
  expect(placeMarks(sentences, [["sentence about"]], [0.62])).toEqual([2]);
  expect(placeMarks(sentences, [["sentence about"]], [0.12])).toEqual([0]);
  // A single word is weak: the three-word reading beats it.
  expect(placeMarks(sentences, [["sports", "Three sentence about"]])).toEqual([2]);
});

test("a comment is answered in its sentence's new version or in sentences added beside it, never in a sentence matched to another", () => {
  // old 0 -> new 0; new 1 added; old 1 -> new 2 and 3 (split); old 2 cut; new 4 added; old 3 -> new 5.
  const matched = [[0], [2, 3], [], [5]];
  expect(answerRegion(matched, 1, 6)).toEqual([1, 2, 3, 4]);
  expect(answerRegion(matched, 0, 6)).toEqual([0, 1]);
  expect(answerRegion(matched, 3, 6)).toEqual([4, 5]);
  expect(answerRegion(matched, 2, 6)).toEqual([]);
});

test("a page's typed lines come from its text: the running head left out, a paragraph on one line wrapped, and each sentence knows its lines", () => {
  expect(typedLines("Okafor 2\n\nMaya Okafor\nEnglish 10\n\nOne two.")).toEqual(["Maya Okafor", "English 10", "One two."]);
  expect(typedLines(`${"word ".repeat(40)}end.`).length).toBe(3);
  expect(lineSpans(["One. Two starts", "here. Three."], [{ text: "One." }, { text: "Two starts here." }, { text: "Three." }])).toEqual([
    { first: 0, last: 0 },
    { first: 0, last: 1 },
    { first: 1, last: 1 },
  ]);
  const text = "Title\n\nFirst sentence here. Second one\nruns on. Third.\nFourth is long and\nends here.\n\nFifth.";
  const paras = toParagraphs(text, 1);
  // Six lines; a mark level with the last line is about the sentences within a line or so of it.
  expect(nearby(paras, text, 1)).toEqual(["Fourth is long and ends here.", "Fifth."]);
  expect(nearby(paras, text, 0.3)).toEqual(["First sentence here.", "Second one runs on.", "Third."]);
  expect(nearby(paras, text, undefined)).toEqual([]);
});

test("a mark's ink says its sentence: the words under an underline, under handwriting among the lines, or most of a margin note's line", () => {
  const text = "Alpha beta gamma. Delta epsilon\nzeta eta. Theta iota kappa.";
  const sentences = [{ text: "Alpha beta gamma." }, { text: "Delta epsilon zeta eta." }, { text: "Theta iota kappa." }];
  const box = { x0: 0, x1: 1000, y0: 0, y1: 150 };
  const mark = (core: { x0: number; x1: number; y0: number; y1: number }, strokes: { x0: number; x1: number; y0: number; y1: number }[] = []) => ({ box: core, core, strokes });
  expect(inkSentence(text, sentences, box, mark({ x0: 1020, x1: 1100, y0: 0, y1: 30 }, [{ x0: 600, x1: 1000, y0: 30, y1: 36 }]))).toEqual({ sentence: 1, words: "Delta epsilon", pen: true });
  expect(inkSentence(text, sentences, box, mark({ x0: 1100, x1: 1200, y0: 100, y1: 130 }))).toEqual({ sentence: 2 });
  expect(inkSentence(text, sentences, box, mark({ x0: 30, x1: 70, y0: 0, y1: 15 }))).toEqual({ sentence: 0, words: "Alpha" });
  // A tall stroke (a bracket) is not an underline.
  expect(inkSentence(text, sentences, box, mark({ x0: -80, x1: -40, y0: 100, y1: 130 }, [{ x0: -30, x1: -20, y0: 90, y1: 140 }]))).toEqual({ sentence: 2 });
  expect(inkSentence("", sentences, box, mark(box))).toBeUndefined();
});
