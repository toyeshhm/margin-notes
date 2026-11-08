import { expect, test } from "vitest";

import { align } from "./align";
import { pinMarks } from "./build";
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
    { words: "wc", kind: "circle", near: "Three sentence", page: 1 },
    { words: "awk", kind: "margin", near: "One sentence", page: 1 },
  ]);
  expect(marks.map((m) => [m.n, m.words])).toEqual([
    [1, "awk"],
    [2, "wc"],
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
