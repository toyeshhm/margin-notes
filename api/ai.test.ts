import { expect, test } from "vitest";

import { BadRequest, readJSON } from "./ai";

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
  await expect(readJSON(request, 1000)).rejects.toThrow(new BadRequest("That file is too large."));
});

test("a body under the limit is parsed, and bad JSON is a bad request", async () => {
  await expect(readJSON(chunked(['{"a":', "1}"]), 1000)).resolves.toEqual({ a: 1 });
  await expect(readJSON(chunked(["{nope"]), 1000)).rejects.toThrow("The request wasn't valid JSON.");
});
