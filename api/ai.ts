// Workers AI through the Worker's AI binding: the three models, JSON answers, and the one
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

export async function run(env: Env, model: string, input: Record<string, unknown>): Promise<unknown> {
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

export async function readJSON(request: Request, maxBytes: number): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > maxBytes) throw new BadRequest("That file is too large.");
  try {
    return await request.json();
  } catch {
    throw new BadRequest("The request wasn't valid JSON.");
  }
}

export function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}
