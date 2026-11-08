// Sample 3, "Yeast, Sugar and Time": a one-page lab report written for this app, marked with six
// comments in red and green pen. The student and teacher are invented.

import type { SampleEssay } from "./types";

const heading = ["Priya Shah", "Ms. Tran", "Biology 9", "29 October 2026", "Yeast, Sugar and Time"];

const question = "We wanted to know whether the amount of sugar changes how fast yeast makes carbon dioxide.";
const method = [
  "We mixed one packet of yeast with 100 mL of warm water in each of four bottles.",
  "Each bottle got 0, 5, 10 or 20 grams of sugar, and we stretched a balloon over its neck.",
  "Every five minutes for thirty minutes we measured around each balloon with a string and a ruler.",
];
const results2 = "The bottle with no sugar did not change at all.";
const conclusion2 = "This happens because yeast breaks down sugar for energy and gives off carbon dioxide as it does.";

const lines = (paras: string[][]): string => [heading.slice(0, 4).join("\n"), heading[4] ?? "", ...paras.map((p) => p.join(" "))].join("\n\n");

const revision = lines([
  [question, "Our hypothesis was that more sugar would make the balloon grow faster, up to a point."],
  [...method, "We kept the water at 40 °C by standing the bottles in a tub of warm water."],
  [
    "After thirty minutes the balloon on the 20 gram bottle measured 31 cm around, compared with 24 cm for 10 grams and 17 cm for 5 grams.",
    results2,
  ],
  [
    "More sugar made the balloons grow faster, which supports our hypothesis.",
    conclusion2,
    "The 20 gram balloon grew only 7 cm more than the 10 gram one, so adding more sugar helped less each time.",
    "Next time we would repeat each bottle three times, because one bottle of each is not enough to be sure.",
  ],
]);

export const yeast: SampleEssay = {
  id: "yeast-sugar-time",
  title: "Yeast, Sugar and Time",
  what: "Lab report, one page photo, 6 comments in red and green pen",
  source: "photos",
  heading,
  surname: "Shah",
  pages: [
    [
      [question, [{ t: "Our hypothesis is that more sugar would make the balloon grow faster.", c: 1 }]],
      [...method, [{ t: "We kept the water warm the whole time.", c: 2 }]],
      [["After thirty minutes the balloon on the 20 gram bottle was ", { t: "a lot bigger", c: 3 }, " than the others."], results2],
      [
        [{ t: "More sugar made the balloons grow faster, which proves our hypothesis.", c: 4 }],
        conclusion2,
        ["The ", { t: "temprature", c: 5 }, " also matters because yeast is alive."],
        [{ t: "We only did each bottle once.", c: 6 }],
      ],
    ],
  ],
  comments: [
    { n: 1, words: "tense", kind: "underline" },
    { n: 2, words: "how warm?", kind: "margin", color: "#1f7a3a" },
    { n: 3, words: "vague", kind: "circle", side: "above" },
    { n: 4, words: "proves?", kind: "margin" },
    { n: 5, words: "sp", kind: "circle", side: "above" },
    { n: 6, words: "so what?", kind: "margin", color: "#1f7a3a" },
  ],
  revisions: [revision],
  files: ["yeast-sugar-time-page-1.jpg"],
};
