import { expect, test, vi } from "vitest";

import { log } from "./log";

test("log writes one JSON line", () => {
  const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  log("info", "hi", { k: 1 });
  expect(spy).toHaveBeenCalledTimes(1);
  expect(String(spy.mock.calls[0]?.[0])).toContain('"msg":"hi"');
  spy.mockRestore();
});
