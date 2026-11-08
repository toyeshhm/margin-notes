// Free hosted models, tried in order, then Workers AI through the Worker's AI binding: pictures go to NVIDIA NIM first
// (NVIDIA_API_KEY) and then Groq (GROQ_API_KEY); plain text goes to Groq, then NIM. Also the JSON answers, and the one
// failures people meet on the free plan: every model busy for a minute, or every day's allowance spent.

import { log } from "../src/log";
import type { Env } from "../worker";

export const SCOUT = "@cf/meta/llama-4-scout-17b-16e-instruct";
export const LLAMA = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const BGE = "@cf/baai/bge-m3";

export class AllowanceUsed extends Error {}
// Some model refused for a reason that passes within a minute (a per-minute limit, a timeout, an outage).
export class Busy extends Error {}

// A 429 whose text says it is the day's limit, not the minute's.
export function dailyLimit(text: string): boolean {
  return /per day|daily|\b(RPD|TPD)\b/i.test(text);
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function failure(error: unknown): Response {
  if (error instanceof AllowanceUsed) {
    return json({ error: "allowance", message: "Today's free reading allowance is used up. It resets at midnight UTC." }, 429);
  }
  if (error instanceof Busy) {
    return json({ error: "busy", message: "The reading models are busy right now. Try again in a minute." }, 503);
  }
  if (error instanceof BadRequest) return json({ error: "bad-request", message: error.message }, 400);
  const message = error instanceof Error ? error.message : String(error);
  log("error", "api failure", { error: message });
  return json({ error: "failed", message: "The reading service didn't answer. Try again in a minute." }, 502);
}

export class BadRequest extends Error {}

export interface Host {
  name: string;
  url: string;
  key: (env: Env) => string | undefined;
  // The hosted model standing in for each Workers AI model, best first. Several, because a free key may not reach them all.
  models: Record<string, string[]>;
  // Hosts that don't take a JSON schema get it in the prompt instead.
  schemaInPrompt: boolean;
}

const GROQ: Host = {
  name: "groq",
  url: "https://api.groq.com/openai/v1/chat/completions",
  key: (env) => env.GROQ_API_KEY,
  models: { [SCOUT]: ["qwen/qwen3.8-27b"], [LLAMA]: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"] },
  schemaInPrompt: false,
};

const NIM: Host = {
  name: "nvidia",
  url: "https://integrate.api.nvidia.com/v1/chat/completions",
  key: (env) => env.NVIDIA_API_KEY,
  models: {
    [SCOUT]: ["meta/llama-3.2-90b-vision-instruct", "nvidia/nemotron-3.5-super-vl-120b-a12b", "google/gemma-4-31b-it"],
    [LLAMA]: ["meta/llama-3.2-90b-vision-instruct", "openai/gpt-oss-20b"],
  },
  schemaInPrompt: true,
};

// A stalled call gives up after this long and the next host is tried. No state is shared between requests:
// a timer made in one request never fires in another's, so a shared queue hangs.
const CALL_TIMEOUT_MS = 40000;
// A rate-limited call is retried this many times, within this much time, before the next host is tried.
const TRIES = 4;
const BUDGET_MS = 110000;

// The Workers AI request body, reshaped for an OpenAI-compatible endpoint. NVIDIA gets the schema in the prompt.
export function toGroq(model: string, input: Record<string, unknown>, schemaInPrompt = false): Record<string, unknown> {
  const { response_format: format, ...rest } = input;
  const body: Record<string, unknown> = { ...rest, model };
  if (model.startsWith("openai/gpt-oss")) body["reasoning_effort"] = "low";
  const schema = (format as { json_schema?: unknown } | undefined)?.json_schema;
  if (schema === undefined) return body;
  if (!schemaInPrompt) {
    body["response_format"] = { type: "json_schema", json_schema: { name: "answer", schema } };
    return body;
  }
  const rule = `Answer with only one JSON object that matches this JSON Schema, and nothing else:\n${JSON.stringify(schema)}`;
  const messages = (rest["messages"] as { role: string; content: unknown }[]).map((m) => ({ ...m }));
  const last = messages[messages.length - 1];
  if (last !== undefined) {
    last.content = Array.isArray(last.content) ? [...(last.content as unknown[]), { type: "text", text: rule }] : `${String(last.content)}\n\n${rule}`;
  }
  body["messages"] = messages;
  return body;
}

// The JSON object in a model's reply, which may sit inside a code fence or after a sentence.
export function jsonIn(text: string): string {
  const open = text.indexOf("{");
  const close = text.lastIndexOf("}");
  return open >= 0 && close > open ? text.slice(open, close + 1) : text;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One call to one hosted model, or why it can't answer: "day" when it says its daily limit is spent, "busy" for
// anything else (429 after a wait, 4xx/5xx, network). The caller then tries the next.
async function chat(host: Host, key: string, model: string, input: Record<string, unknown>, tries: number): Promise<{ response: string } | "day" | "busy"> {
  const body = JSON.stringify(toGroq(model, input, host.schemaInPrompt));
  const started = Date.now();
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const stop = new AbortController();
      const timer = setTimeout(() => { stop.abort(); }, CALL_TIMEOUT_MS);
      const stalled = new Promise<never>((_, reject) => {
        stop.signal.addEventListener("abort", () => { reject(new Error(`${host.name} timed out`)); });
      });
      const res = await Promise.race([
        fetch(host.url, {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body,
          signal: stop.signal,
        }),
        stalled,
      ]);
      if (res.ok) {
        const out = (await Promise.race([res.json(), stalled])) as { choices?: { message?: { content?: unknown } }[] };
        clearTimeout(timer);
        const content = out.choices?.[0]?.message?.content;
        if (typeof content === "string") return { response: host.schemaInPrompt && input["response_format"] !== undefined ? jsonIn(content) : content };
        log("warn", "model gave no text", { host: host.name, model });
        return "busy";
      }
      const said = res.status === 429 ? await Promise.race([res.text(), stalled]).catch(() => "") : "";
      clearTimeout(timer);
      log("warn", "model refused", { host: host.name, status: res.status, model, daily: dailyLimit(said) });
      if (dailyLimit(said)) return "day";
      const wait = Math.min(Number(res.headers.get("retry-after") ?? "6") + 1, 40);
      if ((res.status !== 429 && res.status !== 503) || attempt === tries - 1 || Date.now() - started + wait * 1000 > BUDGET_MS) return "busy";
      await sleep(wait * 1000);
    } catch (error) {
      log("warn", "model unreachable", { host: host.name, error: error instanceof Error ? error.message : String(error) });
      return "busy";
    }
  }
  return "busy";
}

function hasPicture(input: Record<string, unknown>): boolean {
  return JSON.stringify(input["messages"] ?? []).includes('"image_url"');
}

// The hosted models to try for this request, in order. `first` puts one host ahead: Groq's Qwen reads
// handwriting and the words beside a mark better, NVIDIA's Llama copies a whole page of type more faithfully.
export function hostsFor(input: Record<string, unknown>, first?: "groq"): Host[] {
  return hasPicture(input) && first === undefined ? [NIM, GROQ] : [GROQ, NIM];
}

// The first hosted answer, or "day" when every hosted model said its daily limit is spent (or none has a key).
async function hosted(env: Env, model: string, input: Record<string, unknown>, first?: "groq"): Promise<{ response: string } | "day" | "busy"> {
  const options = hostsFor(input, first).flatMap((host) => {
    const key = host.key(env);
    return key === undefined ? [] : (host.models[model] ?? []).map((hostModel) => ({ host, key, hostModel }));
  });
  let allDay = true;
  for (const [k, { host, key, hostModel }] of options.entries()) {
    // Only the last option is waited on when rate-limited; the others are skipped past at once.
    const answer = await chat(host, key, hostModel, input, k === options.length - 1 ? TRIES : 1);
    if (typeof answer === "object") return answer;
    if (answer === "busy") allDay = false;
  }
  return allDay ? "day" : "busy";
}

export async function run(env: Env, model: string, input: Record<string, unknown>, first?: "groq"): Promise<unknown> {
  const fromHost = await hosted(env, model, input, first);
  if (typeof fromHost === "object") return fromHost;
  try {
    return await env.AI.run(model, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // 4006: the account's daily free Neurons are used up. That is the day's end only if every host said the same.
    if (message.includes("4006") || /daily free allocation|neurons/i.test(message)) throw fromHost === "day" ? new AllowanceUsed(message) : new Busy(message);
    throw error;
  }
}

// A model answer kept by a hash of what was asked, in `table`, so asking the same thing twice costs one call.
export async function cached(env: Env, table: "scan_cache" | "check_cache", key: unknown, read: () => Promise<unknown>): Promise<Response> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(key)));
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  await env.DB.prepare(`create table if not exists ${table} (hash text primary key, result text not null, created_at text not null)`).run();
  const hit = await env.DB.prepare(`select result from ${table} where hash = ?`).bind(hash).first<{ result: string }>();
  if (hit !== null) return new Response(hit.result, { headers: { "content-type": "application/json" } });
  const result = JSON.stringify(await read());
  await env.DB.prepare(`insert or ignore into ${table} (hash, result, created_at) values (?, ?, ?)`).bind(hash, result, new Date().toISOString()).run();
  return new Response(result, { headers: { "content-type": "application/json" } });
}

// Ask a chat model for JSON matching `schema`; returns the parsed object.
export async function askJSON(
  env: Env,
  model: string,
  messages: { role: string; content: unknown }[],
  schema: Record<string, unknown>,
  maxTokens: number,
  first?: "groq",
): Promise<unknown> {
  const out = await run(
    env,
    model,
    { messages, response_format: { type: "json_schema", json_schema: schema }, max_tokens: maxTokens, temperature: 0.1 },
    first,
  );
  const response = (out as { response?: unknown }).response;
  if (typeof response === "string") return JSON.parse(response) as unknown;
  if (typeof response === "object" && response !== null) return response;
  throw new Error(`no JSON from ${model}`);
}

const NIM_EMBEDDINGS_URL = "https://integrate.api.nvidia.com/v1/embeddings";
// NVIDIA's own embedding models (bge-m3 is no longer hosted there); they want an input type.
const NIM_EMBEDDERS: { model: string; extra: Record<string, unknown> }[] = [
  { model: "nvidia/llama-3.2-nv-embedqa-1b-v1", extra: { input_type: "passage", truncate: "END" } },
  { model: "nvidia/nemotron-3.5-embed-1b", extra: { input_type: "passage", truncate: "END" } },
  { model: "nvidia/nemotron-3-embed-1b", extra: { input_type: "passage", truncate: "END" } },
];

// All the texts embedded by one NVIDIA model (vectors from two models can't be compared), or undefined.
async function nimEmbed(key: string, texts: string[]): Promise<number[][] | undefined> {
  for (const { model, extra } of NIM_EMBEDDERS) {
    const vectors: number[][] = [];
    for (let k = 0; k < texts.length; k += 50) {
      try {
        const res = await fetch(NIM_EMBEDDINGS_URL, {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({ model, input: texts.slice(k, k + 50), encoding_format: "float", ...extra }),
          signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
        });
        if (!res.ok) {
          log("warn", "embedding refused", { model, status: res.status });
          break;
        }
        const out = (await res.json()) as { data?: { embedding?: number[] }[] };
        const got = (out.data ?? []).map((d) => d.embedding);
        if (got.length !== Math.min(50, texts.length - k) || got.some((e) => e === undefined)) break;
        vectors.push(...(got as number[][]));
      } catch (error) {
        log("warn", "embedding unreachable", { model, error: error instanceof Error ? error.message : String(error) });
        break;
      }
    }
    if (vectors.length === texts.length) return vectors;
  }
  return undefined;
}

export async function embed(env: Env, texts: string[]): Promise<number[][]> {
  if (env.NVIDIA_API_KEY !== undefined) {
    const hostedVectors = await nimEmbed(env.NVIDIA_API_KEY, texts);
    if (hostedVectors !== undefined) return hostedVectors;
  }
  const vectors: number[][] = [];
  try {
    for (let k = 0; k < texts.length; k += 50) {
      const out = (await run(env, BGE, { text: texts.slice(k, k + 50) })) as { data?: unknown };
      if (!Array.isArray(out.data)) throw new Error("no embeddings from bge-m3");
      vectors.push(...(out.data as number[][]));
    }
  } catch (error) {
    // NVIDIA's refusal above has no daily limit in it, so with its key the wait is a minute, not a day.
    if (error instanceof AllowanceUsed && env.NVIDIA_API_KEY !== undefined) throw new Busy(error.message);
    throw error;
  }
  return vectors;
}

// The request body as JSON, refusing anything over `maxBytes`. Content-Length is a fast check, but a
// chunked body has none, so bytes are also counted as they arrive and reading stops past the limit.
export async function readJSON(request: Request, maxBytes: number): Promise<unknown> {
  const tooLarge = new BadRequest("That file is too large. Use a smaller photo, or one cropped to the page.");
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
