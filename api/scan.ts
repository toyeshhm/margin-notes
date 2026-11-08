// POST /api/scan, four shapes: { image } -> { isEssay, text }; { sheet, inMargin: boolean[] } -> { marks } (what each mark is about);
// { writing, count } -> { words } (the handwriting of each tight close-up);
// { image, whole: true } -> { marks } (a page with no ink found in the browser).
// A vision model reads one photo of a typed page. The browser finds each patch of the teacher's ink
// and sends a close-up of it with a box drawn round it; Scout reads the page's printed text from the
// whole photo and each mark from its close-up. The photos are never kept; what was read is, by a hash of the request.

import { markingKey, snapMark } from "../src/lib/markingKey";
import { MARK_KINDS, type MarkKind, type PageScan, type SheetRead } from "../src/lib/types";
import type { Env } from "../worker";
import { askJSON, BadRequest, cached, failure, readJSON, run, SCOUT, str } from "./ai";

const SYSTEM = `You read phone photos of typed school essays that a teacher has marked by hand in pen.
You copy what is there and never add, fix or invent anything.`;

const NOT_AN_ESSAY = "NOT A TYPED PAGE";

const PAGE_ASK = `If this photo does not show a page of typed (printed) text, answer only: ${NOT_AN_ESSAY}
Otherwise copy every printed word on the page, exactly as printed, in reading order, keeping any misspelling as it is. Never correct anything.
Leave out all handwriting, and the running head (surname and page number) at the very top.
Put each heading line (name, teacher, class, date, title) on its own line, then a blank line.
Put each paragraph on a single line, with a blank line between paragraphs. Answer with the text only.`;

const MARKS_ASK = `This is a photo of a typed essay page that a teacher marked in pen. List every handwritten mark, top to bottom, each with
words (the handwriting exactly as written), kind ("circle", "underline", "caret", "symbol" or "margin") and near (the printed words it is about, copied exactly, 3 to 10 words).`;

const SHEET_ASK = (count: number): string => `This picture stacks ${String(count)} close-ups from a photo of a typed essay page that a teacher marked in pen.
Each close-up sits under a dark bar labelled MARK 1, MARK 2 and so on, and has a blue box drawn around one of the teacher's marks. Other marks outside the box are not yours: ignore them.
Answer as JSON with one entry per close-up, in order, each with n (the number on its bar) and:
kind: "circle" if the pen ringed printed words, "underline" if it drew a line under printed words, "caret" for a ^ showing a missing word, "symbol" for a ¶ or a bracket, otherwise "margin".
marked: the printed (typed, black) words the teacher's pen ringed or underlined next to this mark, copied exactly, or "" if none. Never the red handwriting itself.
below: the printed words directly under the handwriting, copied exactly, 3 to 10 words, or "" if none.
beside: the printed words on the same line as the handwriting, nearest to it, copied exactly, 3 to 10 words, or "" if none.`;

const VOCABULARY = markingKey.map((k) => k.mark).join(", ");

const WRITING_ASK = (count: number): string => `This picture stacks ${String(count)} close-ups of marks a teacher wrote in red pen on a student's essay.
Each close-up sits under a dark bar labelled MARK 1, MARK 2 and so on and shows one mark: its handwriting, sometimes ringed or underlined, sometimes with a few printed (typed, black) letters at the edge.
Answer as JSON with one entry per close-up, in order, each with n (the number on its bar) and words: only the red handwritten letters or symbol, exactly as written. Never printed letters, and never a ring, line or bracket on its own.
Teachers' shorthand is usually one of: ${VOCABULARY}, or a word written over a ^ (answer "^ " and the word). Read each close-up on its own: do not copy the answer of another close-up.`;

// Part of every cached read's key: change it whenever a prompt or the vision models change, so old reads aren't reused.
const SCAN_VERSION = 3;

const INK_KINDS = MARK_KINDS.filter((k) => k !== "comment");

const MARKS_SCHEMA = {
  type: "object",
  properties: {
    marks: {
      type: "array",
      items: {
        type: "object",
        properties: { words: { type: "string" }, kind: { type: "string", enum: INK_KINDS }, near: { type: "string" } },
        required: ["words", "kind", "near"],
      },
    },
  },
  required: ["marks"],
};

const SHEET_SCHEMA = {
  type: "object",
  properties: {
    marks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "number" },
          kind: { type: "string", enum: INK_KINDS },
          marked: { type: "string" },
          below: { type: "string" },
          beside: { type: "string" },
        },
        required: ["n", "kind", "marked", "below", "beside"],
      },
    },
  },
  required: ["marks"],
};

const WRITING_SCHEMA = {
  type: "object",
  properties: {
    marks: {
      type: "array",
      items: { type: "object", properties: { n: { type: "number" }, words: { type: "string" } }, required: ["n", "words"] },
    },
  },
  required: ["marks"],
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function kindOf(value: unknown): MarkKind {
  const kind = str(value, 20);
  return (INK_KINDS as readonly string[]).includes(kind) ? (kind as MarkKind) : "margin";
}

function image(value: unknown): string {
  const url = str(value, 8_000_000);
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(url)) throw new BadRequest("Send a JPEG, PNG or WebP photo.");
  return url;
}

function ask(env: Env, url: string, text: string, schema: Record<string, unknown>, maxTokens: number, first?: "groq"): Promise<unknown> {
  return askJSON(
    env,
    SCOUT,
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: [{ type: "image_url", image_url: { url } }, { type: "text", text }] },
    ],
    schema,
    maxTokens,
    first,
  );
}

// The printed words each mark is about, for each close-up on a sheet. A ring or underline says which
// words; otherwise a margin note goes with its line, and writing between lines with the words below it.
// `hints` are every printed phrase the model gave, best first, for finding the sentence.
async function readSheet(env: Env, sheet: string, inMargin: boolean[]): Promise<SheetRead[]> {
  const o = record(await ask(env, sheet, SHEET_ASK(inMargin.length), SHEET_SCHEMA, 250 * inMargin.length + 100, "groq"));
  const items = Array.isArray(o["marks"]) ? (o["marks"] as unknown[]).map(record) : [];
  return inMargin.map((margin, k) => {
    const x = items.find((m) => Number(m["n"]) === k + 1) ?? items[k] ?? {};
    const marked = str(x["marked"], 300).trim();
    const below = str(x["below"], 300).trim();
    const beside = str(x["beside"], 300).trim();
    const long = (t: string): boolean => t.split(/\s+/).filter((w) => w !== "").length >= 3;
    const order = margin ? [beside, below] : [below, beside];
    const near = (long(marked) ? marked : order.find((t) => t !== "")) ?? marked;
    return { kind: kindOf(x["kind"]), near, hints: [marked, ...order].filter((t) => t !== "") };
  });
}

// The teacher's handwriting for each tight close-up on a sheet.
async function readWriting(env: Env, sheet: string, count: number): Promise<string[]> {
  const o = record(await ask(env, sheet, WRITING_ASK(count), WRITING_SCHEMA, 40 * count + 100, "groq"));
  const items = Array.isArray(o["marks"]) ? (o["marks"] as unknown[]).map(record) : [];
  return Array.from({ length: count }, (_, k) => {
    const x = items.find((m) => Number(m["n"]) === k + 1) ?? items[k];
    return str(x?.["words"], 200).trim();
  });
}

// The page's printed text, as plain text (more reliable than JSON for long copies). A reply that
// runs on into repeated blank lines is a failed copy; it is asked once more before giving up.
async function readText(env: Env, page: string): Promise<string | undefined> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = record(await run(env, SCOUT, { messages: [{ role: "system", content: SYSTEM }, { role: "user", content: [{ type: "image_url", image_url: { url: page } }, { type: "text", text: PAGE_ASK }] }], max_tokens: 2500, temperature: 0.1 }));
    const text = str(out["response"], 20000).replace(/\n{3,}/g, "\n\n").trim();
    if (text.includes(NOT_AN_ESSAY) || (text.length < 40 && attempt === 1)) return undefined;
    if (text.length >= 40 && text.split("\n").length < 400) return text;
  }
  throw new Error("the page text could not be read");
}

// With no ink found in the browser (pencil, or a pen colour too faint), Scout looks for marks on the whole page.
async function readWholePage(env: Env, page: string): Promise<PageScan["marks"]> {
  const o = record(await ask(env, page, MARKS_ASK, MARKS_SCHEMA, 1500));
  return (Array.isArray(o["marks"]) ? (o["marks"] as unknown[]) : []).map((m) => {
    const x = record(m);
    const kind = kindOf(x["kind"]);
    const near = str(x["near"], 300).trim();
    return { words: snapMark(str(x["words"], 200), kind, near), kind, near };
  });
}

export const POST = async (request: Request, env: Env): Promise<Response> => {
  try {
    const body = record(await readJSON(request, 12_000_000));
    if (body["sheet"] !== undefined) {
      const inMargin = (Array.isArray(body["inMargin"]) ? (body["inMargin"] as unknown[]) : []).slice(0, 8).map((m) => m === true);
      if (inMargin.length === 0) throw new BadRequest("No marks to read.");
      const sheet = image(body["sheet"]);
      return await cached(env, "scan_cache", { v: SCAN_VERSION, body }, async () => ({ marks: await readSheet(env, sheet, inMargin) }));
    }
    if (body["writing"] !== undefined) {
      const count = Math.min(12, Math.max(1, Math.round(Number(body["count"]) || 1)));
      const writing = image(body["writing"]);
      return await cached(env, "scan_cache", { v: SCAN_VERSION, body }, async () => ({ words: await readWriting(env, writing, count) }));
    }
    const page = image(body["image"]);
    if (body["whole"] === true) {
      return await cached(env, "scan_cache", { v: SCAN_VERSION, body }, async () => ({ marks: (await readWholePage(env, page)).filter((m) => m.words.trim() !== "" && m.near !== "") }));
    }
    return await cached(env, "scan_cache", { v: SCAN_VERSION, body }, async () => {
      const text = await readText(env, page);
      return text === undefined ? { isEssay: false, text: "" } : { isEssay: true, text };
    });
  } catch (error) {
    return failure(error);
  }
};
