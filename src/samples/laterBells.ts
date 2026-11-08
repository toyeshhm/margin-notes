// Sample 1, "Later Bells": an argument essay written for this app, marked in red pen with eleven
// comments. The student, teacher and school are invented. Its two page photos are rendered from
// this file (scripts/photo.html); its two revisions answer nine, then all eleven, of the comments.

import type { SampleEssay } from "./types";

const heading = ["Maya Okafor", "Ms. Ruiz", "English 10", "14 October 2026", "Later Bells"];

const p1 = [
  "Every morning at 6:15 my alarm goes off, and I lie there doing math about how many minutes I can still sleep.",
  "Our first bell rings at 7:25, so most of us are on the bus before the sun is up.",
  "By the time first period starts, I have been awake for more than an hour, and I still feel like I am thinking through fog.",
];
const thesis = "Hartwell High should move its first bell to 9:00, because students would learn more and be healthier.";
const p2 = [
  "During puberty the body starts releasing melatonin later at night, so a fifteen-year-old who goes to bed at 10:00 often lies awake until 11:00 or later.",
  "This is not laziness or too much time on our phones; it is how the body works at that age.",
  "Scientists call it a sleep phase delay, and it lasts until our early twenties.",
];
const p3 = [
  "In first period, half of my biology class has their heads down before the warm-up is even finished.",
  "My friend Dani falls asleep in chemistry almost every morning, and she is one of the best students I know.",
  "Even Mr. Patel, who teaches first and sixth period, told our class that his first-period grades are always the lowest of his day.",
  "Nobody is choosing to be tired in those rooms.",
  "We are sitting in class, but a lot of us are not really there until third period.",
  "When the bell finally matches our bodies, those first two classes will count as much as the rest of the day.",
];
const p4b = [
  "Coaches worry that practices would end after dark, and parents worry about getting to work on time.",
  "Younger students could also end up waiting for buses in the dark if their schedules swap with ours.",
  "These are real problems, but other districts have solved them by changing bus routes and moving some practices indoors.",
];

const aap =
  "The American Academy of Pediatrics “recognizes insufficient sleep in adolescents as an important public health issue.”";

function essay(lines: string[][]): string {
  return [heading.slice(0, 4).join("\n"), heading[4] ?? "", ...lines.map((p) => p.join(" "))].join("\n\n");
}

const revision1 = essay([
  [...p1, "Most students at Hartwell do not get enough sleep.", thesis],
  ["The main reason is that teenagers’ bodies run on a later clock.", aap, ...p2, "That means we lose at least an hour of sleep every night.", "If school starts at 7:25 and the bus comes at 6:40, the math does not work.", "Most of us end up running on five or six hours a night.", "Doctors recommend eight to ten hours, and most of us get six."],
  ["Being this tired makes every class harder.", ...p3],
  ["It is hard to receive new information when your brain still thinks it is the middle of the night.", "A later start would give students the extra hour that the research says we are missing."],
  ["Some people say a later start would cause problems with sports and buses.", ...p4b],
  ["One district has already shown what happens when the bell moves.", "Seattle moved its high school start times to 8:45 in 2016.", "Afterward, students got 34 more minutes of sleep a night and their grades went up (Dunster et al. 2018).", "Rested students are also safer drivers and are less likely to feel depressed."],
  ["A later bell is a small change for the district.", "Students cannot change how their bodies work, but the district can change when the bell rings.", "It gives back the one thing every student in this building is short on, so Hartwell should ring its first bell at 9:00 and let students show up awake."],
]);

const revision2 = revision1
  .replace(
    aap,
    `${aap} Its doctors explain that this shift is part of puberty, which is why they recommend that high schools start at 8:30 or later.`,
  )
  .replace(
    "Doctors recommend eight to ten hours, and most of us get six.",
    "Doctors recommend eight to ten hours, because that is how long a teenage brain needs to store what it learned the day before.",
  );

export const laterBells: SampleEssay = {
  id: "later-bells",
  title: "Later Bells",
  what: "Argument essay, two page photos, 11 comments in red pen",
  source: "photos",
  heading,
  surname: "Okafor",
  pages: [
    [
      [
        ...p1,
        ["The fact that sleep is something we as students do not get enough of ", { t: "is a problem that is a big one", c: 1 }, "."],
        thesis,
      ],
      [
        ["The main reason is that ", { t: "teenagers’ bodies run on a later clock", c: 2 }, "."],
        ...p2,
        [{ t: "Which means less sleep.", c: 3 }],
        [{ t: "If school starts at 7:25 and the bus comes at 6:40, the math does not work, most of us end up running on five or six hours a night", c: 4 }, "."],
        [{ t: "Doctors recommend eight to ten hours.", c: 5 }],
      ],
      [["Being this tired makes ", { t: "stuff", c: 6 }, " in school harder."], ...p3],
    ],
    [
      [
        ["It is hard to ", { t: "recieve", c: 7 }, " new information when your brain still thinks it is the middle of the night."],
        "A later start would give students the extra hour that the research says we are missing.",
        [{ t: "Some people say a later start would cause problems with sports and buses.", c: 8 }],
        ...p4b,
      ],
      [
        [{ t: "Seattle moved its high school start times to 8:45 in 2016.", c: 9 }],
        ["Afterward, ", { t: "students got 34 more minutes of sleep a night and their grades went up", c: 10 }, "."],
        "Rested students are also safer drivers and are less likely to feel depressed.",
      ],
      [
        "A later bell is a small change for the district.",
        "Students cannot change how their bodies work, but the district can change when the bell rings.",
        ["It gives back the one thing every student in this building is short on, so Hartwell should ring its first bell at 9:00 and", { t: "", c: 11 }, " students show up awake."],
      ],
    ],
  ],
  comments: [
    { n: 1, words: "awk", kind: "circle", side: "above" },
    { n: 2, words: "evidence?", kind: "margin" },
    { n: 3, words: "frag", kind: "underline", side: "above" },
    { n: 4, words: "RO", kind: "bracket" },
    { n: 5, words: "so what?", kind: "margin" },
    { n: 6, words: "wc", kind: "circle", side: "above" },
    { n: 7, words: "sp", kind: "circle", side: "above" },
    { n: 8, words: "¶", kind: "symbol" },
    { n: 9, words: "trans", kind: "between" },
    { n: 10, words: "cite", kind: "underline" },
    { n: 11, words: "^ let", kind: "caret" },
  ],
  revisions: [revision1, revision2],
  files: ["later-bells-page-1.jpg", "later-bells-page-2.jpg"],
};
