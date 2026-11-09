import { expect, test } from "vitest";

import { BadRequest, dailyLimit, hostsFor, jsonIn, readJSON, toGroq } from "./ai";

function chunked(parts: string[]): Request {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of parts) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  });
  return new Request("https://example.test/api/scan", { method: "POST", body, duplex: "half" } as RequestInit);
}

test("a chunked body with no Content-Length is refused once it passes the limit", async () => {
  const request = chunked(['{"image":"', "x".repeat(600), "x".repeat(600), '"}']);
  expect(request.headers.get("content-length")).toBeNull();
  await expect(readJSON(request, 1000)).rejects.toThrow(new BadRequest("That file is too large. Use a smaller photo, or one cropped to the page."));
});

test("a body under the limit is parsed, and bad JSON is a bad request", async () => {
  await expect(readJSON(chunked(['{"a":', "1}"]), 1000)).resolves.toEqual({ a: 1 });
  await expect(readJSON(chunked(["{nope"]), 1000)).rejects.toThrow("The request wasn't valid JSON.");
});

test("a Workers AI request becomes a Groq one, with the schema wrapped and the model swapped", () => {
  const schema = { type: "object" };
  const body = toGroq("m", { messages: [], max_tokens: 5, response_format: { type: "json_schema", json_schema: schema } });
  expect(body).toEqual({ model: "m", messages: [], max_tokens: 5, response_format: { type: "json_schema", json_schema: { name: "answer", schema } } });
  expect(toGroq("m", { messages: [] })).toEqual({ model: "m", messages: [] });
  expect(toGroq("qwen/q", { messages: [] })["reasoning_effort"]).toBe("none");
  expect(toGroq("qwen/q", { messages: [], response_format: { type: "json_schema", json_schema: schema } })["reasoning_effort"]).toBeUndefined();
});

test("for NVIDIA the schema goes into the last message, and a reply inside a code fence is cut down to its JSON", () => {
  const schema = { type: "object" };
  const body = toGroq("m", { messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }], response_format: { type: "json_schema", json_schema: schema } }, true);
  expect(body["response_format"]).toBeUndefined();
  expect(JSON.stringify(body["messages"])).toContain('JSON Schema');
  expect(jsonIn('Here:\n```json\n{"a":1}\n```')).toBe('{"a":1}');
  expect(jsonIn("no json")).toBe("no json");
});

test("pictures go to NVIDIA first and plain text to Groq first", () => {
  const picture = { messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AA" } }] }] };
  expect(hostsFor(picture).map((h) => h.name)).toEqual(["nvidia", "groq"]);
  expect(hostsFor({ messages: [{ role: "user", content: "hi" }] }).map((h) => h.name)).toEqual(["groq", "nvidia"]);
  expect(hostsFor(picture, "groq").map((h) => h.name)).toEqual(["groq", "nvidia"]);
});

test("a per-minute 429 is told apart from a daily one, so only a spent day says the allowance is used up", () => {
  expect(dailyLimit("Rate limit reached for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000, Used 7900")).toBe(false);
  expect(dailyLimit("Rate limit reached for model `qwen/qwen3.8-27b` on tokens per day (TPD): Limit 500000")).toBe(true);
  expect(dailyLimit("Rate limit reached on requests per day (RPD): Limit 1000")).toBe(true);
  expect(dailyLimit("Too Many Requests")).toBe(false);
});
