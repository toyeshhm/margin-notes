import { expect, test } from "vitest";

import { changedWords } from "./diff";

test("only the replaced word is marked as changed", () => {
  expect(changedWords("Being this tired makes stuff in school harder.", "Being this tired makes every class harder.")).toEqual([
    { text: "Being this tired makes", changed: false },
    { text: "every class", changed: true },
    { text: "harder.", changed: false },
  ]);
});
