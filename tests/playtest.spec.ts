import { expect, test } from "@playwright/test";

import { cards } from "../src/cards/content";

test("home loads with no console errors or failed requests", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("requestfailed", (r) => problems.push(r.url()));
  await page.goto("/");
  await expect(page.locator("main")).toBeAttached();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
  expect(problems).toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("sets data-motion to reduced", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  });
});

test("title card shows the title", async ({ page }) => {
  await page.goto("/cards/title.html");
  await expect(page.getByText(cards.title)).toBeVisible();
});

test("end card shows the url", async ({ page }) => {
  await page.goto("/cards/end.html");
  await expect(page.getByText(cards.url)).toBeVisible();
});

test("the Worker answers /api/* and the app answers every other path", async ({ request }) => {
  expect((await request.get("/api/no-such-route")).status()).toBe(404);
  const deepLink = await request.get("/some/client/route");
  expect(deepLink.status()).toBe(200);
  expect(await deepLink.text()).toContain('<div id="root">');
});
