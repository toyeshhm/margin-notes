// The marking key: what common teacher marks mean. The Marking key page shows these cards,
// and /api/explain starts every plain-words line from the matching entry.

export interface KeyEntry {
  mark: string;
  meaning: string;
  todo: string;
  // Other ways teachers write the same mark, compared after lowering case and trimming punctuation.
  also: readonly string[];
}

export const markingKey: readonly KeyEntry[] = [
  { mark: "awk", meaning: "This sentence is hard to follow.", todo: "Say it more simply, or split it in two.", also: ["awkward", "awk."] },
  { mark: "frag", meaning: "This is not a complete sentence.", todo: "Join it to the sentence before, or add what it is missing.", also: ["fragment", "frag.", "sentence fragment"] },
  { mark: "RO", meaning: "Two sentences run together.", todo: "Split them with a period, or join them with and, but or because.", also: ["run-on", "run on", "r/o", "ro", "cs", "comma splice"] },
  { mark: "¶", meaning: "Start a new paragraph here.", todo: "Begin a new paragraph where the new idea starts.", also: ["para", "new para", "new paragraph", "np", "p"] },
  { mark: "^", meaning: "Something is missing here.", todo: "Add the word or words written above the mark.", also: ["caret", "insert"] },
  { mark: "sp", meaning: "This word is misspelled.", todo: "Look it up and correct the spelling.", also: ["spelling", "sp?", "sp."] },
  { mark: "?", meaning: "Your teacher is not sure what you mean.", todo: "Make the point clearer in your own words.", also: ["??", "unclear", "what?", "huh?", "meaning?"] },
  { mark: "so what?", meaning: "This point needs a reason it matters.", todo: "Add a sentence that ties it to your argument.", also: ["so what", "why does this matter?", "significance?"] },
  { mark: "evidence?", meaning: "This claim needs support.", todo: "Add a source, a fact or an example, then explain it.", also: ["evidence", "support?", "proof?", "examples?", "example?", "support"] },
  { mark: "wc", meaning: "Word choice: this word is not quite right.", todo: "Pick a more exact or more formal word.", also: ["ww", "word choice", "wrong word", "diction", "wc?"] },
  { mark: "trans", meaning: "This needs a transition.", todo: "Add words that link this idea to the one before.", also: ["transition", "trans?", "tr", "flow?"] },
  { mark: "cite", meaning: "Say where this comes from.", todo: "Name the source in the sentence or in parentheses.", also: ["citation", "cite?", "source?", "citation needed", "source"] },
  { mark: "vague", meaning: "This is too general.", todo: "Name the exact thing, person or number you mean.", also: ["be specific", "specific?", "vague?", "how?"] },
  { mark: "tense", meaning: "The verb tense changes here.", todo: "Keep to one tense, usually the present for writing about a text.", also: ["t", "vt", "verb tense", "shift"] },
  { mark: "agr", meaning: "These words don't agree.", todo: "Make the verb match its subject, or the pronoun match its noun.", also: ["agreement", "s/v", "sv", "s-v agr"] },
  { mark: "rep", meaning: "This word or idea repeats.", todo: "Cut the repeat or use a different word.", also: ["repetitive", "redundant", "repetition"] },
];

function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"'.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// The entry for a mark as the teacher wrote it, if the key has one. "^ let" (a caret with a word) is a caret.
export function keyFor(words: string): KeyEntry | undefined {
  const w = fold(words);
  if (w.startsWith("^")) return markingKey.find((k) => k.mark === "^");
  return markingKey.find((k) => fold(k.mark) === w || k.also.some((a) => fold(a) === w));
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

// Handwriting read by a model is sometimes a letter off ("widence?", "RQ"). When a reading is
// within a letter or two of exactly one mark in the key, it is that mark. A pilcrow read as a
// letter is a pilcrow. Printed words the model swept into the reading are dropped.
export function snapMark(read: string, kind: string, printed: string): string {
  const exact = (w: string): string | undefined => {
    const hit = keyFor(w);
    return hit === undefined ? undefined : w.trim();
  };
  const near = (w: string): string | undefined => {
    const f = fold(w);
    if (f.length < 2) return undefined;
    const limit = f.length <= 3 ? 1 : 2;
    const hits = markingKey.filter((k) => [k.mark, ...k.also].some((a) => fold(a).length >= 2 && distance(f, fold(a)) <= limit));
    return hits.length === 1 ? hits[0]?.mark : undefined;
  };
  const words = read.trim();
  if (kind === "symbol" && /^[SPpq9¶]$/.test(words)) return "¶";
  const whole = exact(words) ?? near(words);
  if (whole !== undefined) return whole;
  const tokens = words.split(/\s+/);
  const typed = new Set(fold(printed).split(" "));
  for (const t of tokens) {
    const rest = tokens.filter((x) => x !== t);
    if (rest.length > 0 && rest.every((x) => typed.has(fold(x)))) {
      const one = exact(t) ?? near(t);
      if (one !== undefined) return one;
    }
  }
  return words;
}
