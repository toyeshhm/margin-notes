import { expect, test } from "vitest";

import { align, answerRegion } from "./align";
import { pinMarks, placeMarks } from "./build";
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
    { text: "One sentence about alarms and mornings.", at: 0.1 },
    { text: "Two sentence about the bus and the bell.", at: 0.35 },
    { text: "Three sentence about sleep and melatonin.", at: 0.6 },
    { text: "Four sentence about grades and sports.", at: 0.85 },
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
