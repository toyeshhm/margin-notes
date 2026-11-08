// POST /api/explain { marks: [{ n, words, sentence }] } -> { plains: [{ n, meaning, todo }] }
// Plain words for each teacher comment. The first line is the marking key's meaning when the key
// has the mark; Llama 3.3 writes what to do about this sentence. It never writes the sentence:
// code drops any answer that runs past 25 words or copies five words in a row from the essay.

import { keyFor } from "../src/lib/markingKey";
import { isInstruction } from "../src/lib/guards";
import type { Plain } from "../src/lib/types";
import type { Env } from "../worker";
import { askJSON, BadRequest, failure, json, LLAMA, readJSON, str } from "./ai";

const SYSTEM = `You explain a teacher's comment on a student's essay in plain words a fifteen-year-old understands.
You say what the comment asks the student to do. You never write, rewrite or finish any sentence of the essay,
never suggest replacement words or a corrected spelling, and never quote the essay.`;

const SCHEMA = {
  type: "object",
  properties: { meaning: { type: "string" }, todo: { type: "string" } },
  required: ["meaning", "todo"],
};

async function explainOne(env: Env, words: string, sentence: string): Promise<Plain> {
  const key = keyFor(words);
  const ask = [
    `The teacher wrote: "${words}"`,
    key ? `In the marking key this mark means: "${key.meaning}" Usually it asks: "${key.todo}"` : "This mark is not in the marking key.",
    `It is on this sentence of the essay: "${sentence}"`,
    "",
    key
      ? `meaning: copy exactly "${key.meaning}"`
      : "meaning: what the comment means, in one short plain sentence of at most 12 words.",
    `todo: one instruction of at most 20 words saying what to change about this sentence. Name the problem, not the fix: no new wording, no corrected spelling, no quotes from the essay.`,
  ].join("\n");
  const raw = (await askJSON(env, LLAMA, [{ role: "system", content: SYSTEM }, { role: "user", content: ask }], SCHEMA, 160)) as Record<string, unknown>;
  const meaning = key ? key.meaning : str(raw["meaning"], 200).trim() || "Your teacher left a note on this sentence.";
  const todo = str(raw["todo"], 400).trim();
  const fallback = key ? key.todo : "Reread the comment and change this sentence so it answers it.";
  return { meaning, todo: isInstruction(todo, sentence) ? todo : fallback };
}

export const POST = async (request: Request, env: Env): Promise<Response> => {
  try {
    const body = (await readJSON(request, 200_000)) as Record<string, unknown>;
    const marks = Array.isArray(body["marks"]) ? (body["marks"] as unknown[]).slice(0, 40) : [];
    if (marks.length === 0) throw new BadRequest("No comments to explain.");
    const plains = await Promise.all(
      marks.map(async (m) => {
        const o = (typeof m === "object" && m !== null ? m : {}) as Record<string, unknown>;
        const plain = await explainOne(env, str(o["words"], 300), str(o["sentence"], 1500));
        return { n: Number(o["n"]), ...plain };
      }),
    );
    return json({ plains });
  } catch (error) {
    return failure(error);
  }
};
