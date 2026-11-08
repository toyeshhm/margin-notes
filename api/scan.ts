// POST /api/scan { image, crops: [{ image, inMargin }] } -> PageScan
// Llama 4 Scout reads one photo of a typed page. The browser finds each patch of the teacher's ink
// and sends a close-up of it with a box drawn round it; Scout reads the page's printed text from the
// whole photo and each mark from its close-up. Nothing is kept.

import { snapMark } from "../src/lib/markingKey";
import { MARK_KINDS, type MarkKind, type PageScan } from "../src/lib/types";
import type { Env } from "../worker";
import { askJSON, BadRequest, failure, json, readJSON, run, SCOUT, str } from "./ai";

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

const MARK_ASK = `This is part of a photo of a typed essay page that a teacher marked in pen. A blue box is drawn around one of the teacher's marks.
Answer as JSON.
words: only the teacher's handwritten letters or symbol inside the blue box, exactly as written. Never printed (typed) letters, even printed words the pen circled.
Teachers' shorthand is often one of: awk, frag, RO, wc, sp, trans, cite, so what?, evidence?, ?, ¶, vague, or a word written over a ^.
kind: "circle" if the pen ringed printed words, "underline" if it drew a line under printed words, "caret" for a ^ showing a missing word, "symbol" for a ¶ or a bracket, otherwise "margin".
marked: the printed words the teacher's pen ringed or underlined next to this mark, copied exactly, or "" if none.
below: the printed words directly under the handwriting, copied exactly, 3 to 10 words, or "" if none.
beside: the printed words on the same line as the handwriting, nearest to it, copied exactly, 3 to 10 words, or "" if none.`;

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

const MARK_SCHEMA = {
  type: "object",
  properties: {
    words: { type: "string" },
    kind: { type: "string", enum: INK_KINDS },
    marked: { type: "string" },
    below: { type: "string" },
    beside: { type: "string" },
  },
  required: ["words", "kind", "marked", "below", "beside"],
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

function ask(env: Env, url: string, text: string, schema: Record<string, unknown>, maxTokens: number): Promise<unknown> {
  return askJSON(
    env,
    SCOUT,
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: [{ type: "image_url", image_url: { url } }, { type: "text", text }] },
    ],
    schema,
    maxTokens,
  );
}

// One mark's close-up: the teacher's words, and the printed words it is about. A ring or underline
// says which words; otherwise a margin note goes with its line, and writing between lines with the words below it.
async function readMark(env: Env, crop: { image: string; inMargin: boolean }): Promise<PageScan["marks"][number]> {
  const o = record(await ask(env, crop.image, MARK_ASK, MARK_SCHEMA, 300));
  const marked = str(o["marked"], 300).trim();
  const below = str(o["below"], 300).trim();
  const beside = str(o["beside"], 300).trim();
  const long = (t: string): boolean => t.split(/\s+/).filter((w) => w !== "").length >= 3;
  const order = crop.inMargin ? [beside, below] : [below, beside];
  const near = (long(marked) ? marked : order.find((t) => t !== "")) ?? marked;
  const kind = kindOf(o["kind"]);
  return { words: snapMark(str(o["words"], 200), kind, `${marked} ${below} ${beside}`), kind, near };
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
    const page = image(body["image"]);
    const crops = (Array.isArray(body["crops"]) ? (body["crops"] as unknown[]) : []).slice(0, 30).map((c) => {
      const o = record(c);
      return { image: image(o["image"]), inMargin: o["inMargin"] === true };
    });
    const [text, ...marks] = await Promise.all([readText(env, page), ...(crops.length > 0 ? crops.map((c) => readMark(env, c)) : [])]);
    if (text === undefined) return json({ isEssay: false, text: "", marks: [] } satisfies PageScan);
    const found = crops.length > 0 ? marks : await readWholePage(env, page);
    return json({ isEssay: true, text, marks: found.filter((m) => m.words.trim() !== "" && m.near !== "") } satisfies PageScan);
  } catch (error) {
    return failure(error);
  }
};
