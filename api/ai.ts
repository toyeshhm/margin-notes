// Groq first (the GROQ_API_KEY secret), then Workers AI through the Worker's AI binding: the models, JSON answers, and the one
// failure people meet on the free plan, the day's allowance running out.

import { log } from "../src/log";
import type { Env } from "../worker";

export const SCOUT = "@cf/meta/llama-4-scout-17b-16e-instruct";
export const LLAMA = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const BGE = "@cf/baai/bge-m3";

export class AllowanceUsed extends Error {}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function failure(error: unknown): Response {
  if (error instanceof AllowanceUsed) {
    return json({ error: "allowance", message: "Today's free reading allowance is used up. It resets at midnight UTC." }, 429);
  }
  if (error instanceof BadRequest) return json({ error: "bad-request", message: error.message }, 400);
  const message = error instanceof Error ? error.message : String(error);
  log("error", "api failure", { error: message });
  return json({ error: "failed", message: "The reading service didn't answer. Try again in a minute." }, 502);
}

export class BadRequest extends Error {}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS: Record<string, string> = {
  [SCOUT]: "meta-llama/llama-4-scout-17b-16e-instruct",
  [LLAMA]: "llama-3.3-70b-versatile",
};
// Groq's free tier allows about 30 requests a minute: calls start at least this far apart.
const GROQ_GAP_MS = 2100;
let groqTurn: Promise<void> = Promise.resolve();

// The Workers AI request body, reshaped for Groq's OpenAI-compatible endpoint.
export function toGroq(model: string, input: Record<string, unknown>): Record<string, unknown> {
  const { response_format: format, ...rest } = input;
  const body: Record<string, unknown> = { ...rest, model };
  const schema = (format as { json_schema?: unknown } | undefined)?.json_schema;
  if (schema !== undefined) body["response_format"] = { type: "json_schema", json_schema: { name: "answer", schema } };
  return body;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One Groq call, or undefined when it can't answer (no key, 429 after a wait, 4xx/5xx, network):
// the caller then uses Workers AI.
async function groq(env: Env, model: string, input: Record<string, unknown>): Promise<{ response: string } | undefined> {
  const groqModel = GROQ_MODELS[model];
  if (env.GROQ_API_KEY === undefined || groqModel === undefined) return undefined;
  const body = JSON.stringify(toGroq(groqModel, input));
  for (let attempt = 0; attempt < 2; attempt++) {
    const turn = groqTurn;
    groqTurn = turn.then(() => sleep(GROQ_GAP_MS));
    await turn;
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, "content-type": "application/json" },
        body,
      });
      if (res.ok) {
        const out = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
        const content = out.choices?.[0]?.message?.content;
        if (typeof content === "string") return { response: content };
        log("warn", "groq gave no text", { model: groqModel });
        return undefined;
      }
      log("warn", "groq refused", { status: res.status, model: groqModel });
      if (res.status !== 429 || attempt === 1) return undefined;
      await sleep(Math.min(Number(res.headers.get("retry-after") ?? "5"), 20) * 1000);
    } catch (error) {
      log("warn", "groq unreachable", { error: error instanceof Error ? error.message : String(error) });
      return undefined;
    }
  }
  return undefined;
}

export async function run(env: Env, model: string, input: Record<string, unknown>): Promise<unknown> {
  const fromGroq = await groq(env, model, input);
  if (fromGroq !== undefined) return fromGroq;
  try {
    return await env.AI.run(model, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // 4006: the account's daily free Neurons are used up.
    if (message.includes("4006") || /daily free allocation|neurons/i.test(message)) throw new AllowanceUsed(message);
    throw error;
  }
}

// Ask a chat model for JSON matching `schema`; returns the parsed object.
export async function askJSON(
  env: Env,
  model: string,
  messages: { role: string; content: unknown }[],
  schema: Record<string, unknown>,
  maxTokens: number,
): Promise<unknown> {
  const out = await run(env, model, {
    messages,
    response_format: { type: "json_schema", json_schema: schema },
    max_tokens: maxTokens,
    temperature: 0.1,
  });
  const response = (out as { response?: unknown }).response;
  if (typeof response === "string") return JSON.parse(response) as unknown;
  if (typeof response === "object" && response !== null) return response;
  throw new Error(`no JSON from ${model}`);
}

export async function embed(env: Env, texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let k = 0; k < texts.length; k += 50) {
    const out = (await run(env, BGE, { text: texts.slice(k, k + 50) })) as { data?: unknown };
    if (!Array.isArray(out.data)) throw new Error("no embeddings from bge-m3");
    vectors.push(...(out.data as number[][]));
  }
  return vectors;
}

// The request body as JSON, refusing anything over `maxBytes`. Content-Length is a fast check, but a
// chunked body has none, so bytes are also counted as they arrive and reading stops past the limit.
export async function readJSON(request: Request, maxBytes: number): Promise<unknown> {
  const tooLarge = new BadRequest("That file is too large.");
  if (Number(request.headers.get("content-length") ?? "0") > maxBytes) throw tooLarge;
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (request.body !== null) {
    const reader = request.body.getReader();
    for (let part = await reader.read(); !part.done; part = await reader.read()) {
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw tooLarge;
      }
      chunks.push(part.value);
    }
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new BadRequest("The request wasn't valid JSON.");
  }
}

export function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}
