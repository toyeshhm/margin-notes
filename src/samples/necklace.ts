// Sample 2, "What the Necklace Cost": a literary analysis of Guy de Maupassant's "The Necklace"
// (1884, public domain), written for this app, with seven typed comments in a Word file
// (scripts/make-docx.ts builds it). The student and teacher are invented.

import type { SampleEssay } from "./types";

const heading = ["Jonah Reyes", "Mr. Hale", "English 10", "3 November 2026", "What the Necklace Cost"];

const body = {
  intro: [
    "Mathilde Loisel spends ten years paying for a necklace that was never worth what she thought.",
    "In “The Necklace,” Guy de Maupassant tells the story of a woman who wanted more.",
    "Maupassant shows that pride costs more than poverty, and that Mathilde loses her youth because she would rather work for a decade than admit a mistake.",
  ],
  p2: [
    "From the first page, Mathilde believes she was born for a richer life.",
    "Maupassant describes her as one of those girls born “as if by a slip of fate” into a family of clerks.",
    "She has a husband who loves her and a home that is comfortable, but she only sees what is missing.",
    "When the invitation to the ball arrives, she cries because she has nothing to wear.",
  ],
  p3: [
    "She borrows a diamond necklace from her friend Madame Forestier and goes to the ball.",
    "Everyone admires her and she dances until four in the morning.",
    "On the way home she discovers that the necklace is gone.",
  ],
  p4: [
    "The real turning point is what Mathilde chooses next, she could tell her friend the truth but she decides to buy a replacement and say nothing.",
    "The Loisels borrow thirty-six thousand francs, give up their maid and move to an attic.",
    "Mathilde does the washing and carries water up the stairs for ten years.",
    "By the end she looks old and very sad.",
  ],
  p5: [
    "In the last lines, Madame Forestier tells her the diamonds were paste, worth five hundred francs at most.",
    "Mathilde gave up ten years for a fake.",
    "The story shows that pride costs more than poverty.",
  ],
};

const plain = (lines: string[][]): string => [heading.slice(0, 4).join("\n"), heading[4] ?? "", ...lines.map((p) => p.join(" "))].join("\n\n");

const revision = plain([
  [
    "Mathilde Loisel spends ten years paying for a necklace that was never worth what she thought.",
    "In “The Necklace,” Guy de Maupassant tells the story of a clerk’s wife who wants the jewels, gowns and admirers of the rich.",
    "Maupassant shows that Mathilde loses her youth because her pride will not let her admit a mistake.",
  ],
  [
    "From the first page, Mathilde believes she was born for a richer life.",
    "Maupassant describes her as one of those girls born “as if by a slip of fate” into a family of clerks (Maupassant 1).",
    "She has a husband who loves her and a home that is comfortable, but she only sees what is missing.",
    "When the invitation to the ball arrives, she cries because she has nothing to wear.",
  ],
  [
    "The night of the ball matters because it is the only time Mathilde is treated the way she believes she deserves.",
    "That is why losing the necklace feels to her like losing that whole self, not just a piece of jewelry.",
  ],
  [
    "The real turning point is what Mathilde chooses next.",
    "She could tell her friend the truth, but she decides to buy a replacement and say nothing.",
    "The Loisels borrow thirty-six thousand francs, give up their maid and move to an attic.",
    "Mathilde does the washing and carries water up the stairs for ten years.",
    "By the end her hands are red and rough, and she looks like any worn-out woman in the neighborhood.",
  ],
  [
    "In the last lines, Madame Forestier tells her the diamonds were paste, worth five hundred francs at most.",
    "Mathilde gave up ten years for a fake.",
    "The ending makes readers ask what they would hide to protect their own image, and what that silence would cost them.",
  ],
]);

export const necklace: SampleEssay = {
  id: "the-necklace",
  title: "What the Necklace Cost",
  what: "Literary analysis, a Word file with 7 typed comments",
  source: "docx",
  heading,
  surname: "Reyes",
  pages: [
    [
      [
        body.intro[0] ?? "",
        ["In “The Necklace,” Guy de Maupassant tells the story of ", { t: "a woman who wanted more", c: 1 }, "."],
        [{ t: "Maupassant shows that pride costs more than poverty, and that Mathilde loses her youth", c: 2 }, " because she would rather work for a decade than admit a mistake."],
      ],
      [
        body.p2[0] ?? "",
        ["Maupassant describes her as one of those girls born ", { t: "“as if by a slip of fate”", c: 3 }, " into a family of clerks."],
        body.p2[2] ?? "",
        body.p2[3] ?? "",
      ],
      [[{ t: "She borrows a diamond necklace from her friend Madame Forestier and goes to the ball.", c: 4 }], body.p3[1] ?? "", body.p3[2] ?? ""],
      [
        [{ t: "The real turning point is what Mathilde chooses next, she could tell her friend the truth", c: 5 }, " but she decides to buy a replacement and say nothing."],
        body.p4[1] ?? "",
        body.p4[2] ?? "",
        ["By the end she looks old and ", { t: "very sad", c: 6 }, "."],
      ],
      [body.p5[0] ?? "", body.p5[1] ?? "", [{ t: "The story shows that pride costs more than poverty.", c: 7 }]],
    ],
  ],
  comments: [
    { n: 1, words: "Too general. What exactly does she want?", kind: "comment" },
    { n: 2, words: "Two claims in one thesis. Which one is your argument?", kind: "comment" },
    { n: 3, words: "Cite the page for this quote.", kind: "comment" },
    { n: 4, words: "This paragraph is plot summary. Analyze: why does the ball matter?", kind: "comment" },
    { n: 5, words: "Run-on sentence.", kind: "comment" },
    { n: 6, words: "wc: show it instead of saying it.", kind: "comment" },
    { n: 7, words: "This repeats your thesis word for word. So what?", kind: "comment" },
  ],
  revisions: [revision],
  files: ["what-the-necklace-cost.docx"],
};
