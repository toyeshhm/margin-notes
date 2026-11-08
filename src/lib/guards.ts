// The two checks that keep the models honest, in code: plain words stay an instruction and never
// a rewritten sentence, and a tick stands only when its quote is in the student's draft word for word.

import { normalize, words as wordsOf } from "./text";

const MAX_TODO_WORDS = 25;

// True when `todo` is an instruction, not the student's sentence rewritten.
export function isInstruction(todo: string, sentence: string): boolean {
  const said = wordsOf(todo);
  if (said.length === 0 || said.length > MAX_TODO_WORDS) return false;
  const essay = wordsOf(sentence);
  const grams = new Set<string>();
  for (let i = 0; i + 5 <= essay.length; i++) grams.add(essay.slice(i, i + 5).join(" "));
  for (let i = 0; i + 5 <= said.length; i++) if (grams.has(said.slice(i, i + 5).join(" "))) return false;
  return !/["“”][^"“”]*\s[^"“”]*\s[^"“”]*\s[^"“”]*["“”]/.test(todo);
}

export function quoteCheck(verdict: { answered: boolean; quote: string }, revision: string): boolean {
  if (verdict.quote.trim() === "") return false;
  const quote = normalize(verdict.quote);
  const ticked = verdict.answered && normalize(revision).includes(quote);
  return ticked;
}
