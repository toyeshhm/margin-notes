// POST /api/check { sentences: [{ id, text }], draft, comments: [{ n, words, meaning, sentenceId }] } -> { verdicts }
// bge-m3 embeds the sentences of both drafts, they are lined up in order (src/lib/align.ts), and
// Llama 3.3 judges each comment against the new version of its sentence. It must quote the new
// draft, and code keeps a tick only when that quote is in the draft word for word.

import { align, cosine } from "../src/lib/align";
import { quoteCheck } from "../src/lib/guards";
import { toParagraphs } from "../src/lib/text";
import type { Verdict } from "../src/lib/types";
import type { Env } from "../worker";
import {
  askJSON,
  BadRequest,
  embed,
  failure,
  json,
  LLAMA,
  readJSON,
  str,
} from "./ai";

interface Comment {
  n: number;
  words: string;
  meaning: string;
  sentenceId: string;
}

const SYSTEM = `You check whether a student's revised essay answers one comment their teacher left on the first draft.
Judge only that comment. It is answered when the revision does what the comment asks; a change that does something else does not count.
You never write sentences for the student.`;

const SCHEMA = {
  type: "object",
  properties: {
    answered: { type: "boolean" },
    quote: { type: "string" },
    reason: { type: "string" },
  },
  required: ["answered", "quote", "reason"],
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export const POST = async (request: Request, env: Env): Promise<Response> => {
  try {
    const body = record(await readJSON(request, 400_000));
    const old = (
      Array.isArray(body["sentences"]) ? (body["sentences"] as unknown[]) : []
    )
      .slice(0, 400)
      .map((s) => {
        const o = record(s);
        return { id: str(o["id"], 40), text: str(o["text"], 2000) };
      });
    const draft = str(body["draft"], 100_000);
    const comments: Comment[] = (
      Array.isArray(body["comments"]) ? (body["comments"] as unknown[]) : []
    )
      .slice(0, 40)
      .map((c) => {
        const o = record(c);
        return {
          n: Number(o["n"]),
          words: str(o["words"], 300),
          meaning: str(o["meaning"], 400),
          sentenceId: str(o["sentenceId"], 40),
        };
      });
    const paragraphs = toParagraphs(draft, 1);
    const fresh = paragraphs.flatMap((p, pi) =>
      p.sentences.map((s, si) => ({
        text: s.text,
        startsParagraph: si === 0,
        para: pi,
      })),
    );
    if (fresh.length === 0)
      throw new BadRequest("Paste your revised essay first.");
    if (old.length === 0 || comments.length === 0)
      throw new BadRequest("This essay has no comments to check.");

    const pairs = (list: { text: string }[]): string[] =>
      list.slice(0, -1).map((s, i) => `${s.text} ${list[i + 1]?.text ?? ""}`);
    const texts = [
      ...old.map((s) => s.text),
      ...pairs(old),
      ...fresh.map((s) => s.text),
      ...pairs(fresh),
    ];
    const v = await embed(env, texts);
    const O = old.length;
    const N = fresh.length;
    const oldV = v.slice(0, O);
    const oldPairV = v.slice(O, O + O - 1);
    const newV = v.slice(2 * O - 1, 2 * O - 1 + N);
    const newPairV = v.slice(2 * O - 1 + N);
    const grid = (rows: number[][], cols: number[][]): number[][] =>
      rows.map((a) => cols.map((b) => cosine(a, b)));
    const matched = align(
      {
        one: grid(oldV, newV),
        split: grid(oldV, newPairV),
        merge: grid(oldPairV, newV),
      },
      O,
      N,
    );

    // Three at a time: asked all at once, the free hosts' per-minute limits refuse most of them.
    const judge = async (c: Comment): Promise<Verdict> => {
      const i = old.findIndex((s) => s.id === c.sentenceId);
      const after = i >= 0 ? (matched[i] ?? []) : [];
      const base = {
        n: c.n,
        after: after.map((j) => fresh[j]?.text ?? ""),
        quoteNotFound: false,
      };
      if (after.length === 0)
        return { ...base, ticked: true, removed: true, quote: "", reason: "" };
      const from = Math.max(0, Math.min(...after) - 2);
      const to = Math.min(N, Math.max(...after) + 3);
      const around = fresh
        .slice(from, to)
        .map((s) => `${s.startsParagraph ? "\n¶ " : ""}${s.text}`)
        .join(" ")
        .trim();
      const ask = [
        `Teacher's comment: "${c.words}"`,
        `What it asks for: ${c.meaning}`,
        `The marked sentence in the first draft: "${old[i]?.text ?? ""}"`,
        i > 0
          ? `The sentence before it in the first draft: "${old[i - 1]?.text ?? ""}"`
          : "",
        `The new version of the marked sentence: "${base.after.join(" ")}"`,
        `The revision around it (¶ starts a paragraph; never copy the ¶):\n${around}`,
        "",
        "answered: true only if the revision does what the comment asks.",
        "quote: if answered, the new sentence (or the words) from the revision that answer it, copied character for character. Otherwise an empty string.",
        "reason: if not answered, one sentence to the student saying what is still missing, without writing it for them. Otherwise an empty string.",
      ]
        .filter((line) => line !== "")
        .join("\n");
      const raw = record(
        await askJSON(
          env,
          LLAMA,
          [
            { role: "system", content: SYSTEM },
            { role: "user", content: ask },
          ],
          SCHEMA,
          300,
        ),
      );
      const verdict = {
        answered: raw["answered"] === true,
        quote: str(raw["quote"], 1000).replace(/^¶\s*/, "").trim(),
      };
      const ticked = quoteCheck(verdict, draft);
      const reason = str(raw["reason"], 500).trim();
      if (ticked)
        return {
          ...base,
          ticked,
          removed: false,
          quote: verdict.quote,
          reason: "",
        };
      if (verdict.answered)
        return {
          ...base,
          ticked: false,
          removed: false,
          quote: verdict.quote,
          reason: "The quote for this tick isn't in your draft word for word.",
          quoteNotFound: true,
        };
      return {
        ...base,
        ticked: false,
        removed: false,
        quote: "",
        reason: reason || "This comment isn't answered yet.",
      };
    };
    const verdicts: Verdict[] = [];
    for (let k = 0; k < comments.length; k += 3)
      verdicts.push(
        ...(await Promise.all(comments.slice(k, k + 3).map(judge))),
      );
    return json({ verdicts });
  } catch (error) {
    return failure(error);
  }
};
