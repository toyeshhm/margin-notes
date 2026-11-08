import { expect, test, type Page } from "@playwright/test";

import type { Essay } from "../src/lib/types";

// A small essay kept in the browser, so the essay screen opens without a scan.
const ESSAY: Essay = {
  id: "art-check",
  title: "Later Bells",
  source: "photos",
  paragraphs: [
    { heading: true, sentences: [{ id: "h1", text: "Later Bells", page: 1 }] },
    {
      heading: false,
      sentences: [
        { id: "s1", text: "Every morning at 6:15 my alarm goes off, and I lie there doing math about how many minutes I can still sleep.", page: 1 },
        { id: "s2", text: "Our first bell rings at 7:25, so most of us are on the bus before the sun is up.", page: 1 },
      ],
    },
  ],
  marks: [
    { n: 1, words: "awk", kind: "margin", near: "doing math about how many minutes", sentenceId: "s1", plain: { meaning: "This sentence is hard to follow.", todo: "Read it aloud and say it more simply." } },
    { n: 2, words: "evidence?", kind: "margin", near: "most of us are on the bus", sentenceId: "s2", plain: { meaning: "Show how you know this.", todo: "Add a fact or a source." } },
  ],
  rounds: [],
  createdAt: "2026-11-08T00:00:00.000Z",
};

async function picture(page: Page, canvas: string): Promise<string> {
  return page.locator(canvas).evaluate((c: HTMLCanvasElement) => c.toDataURL("image/png"));
}

async function width(page: Page): Promise<number> {
  return page.evaluate(() => window.innerWidth);
}

test("the home clouds turn with the mouse, and the page stills slide", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".m-pencil")).toHaveAttribute("data-ready", "1");
  await expect(page.locator(".m-relief")).toHaveAttribute("data-ready", "1");
  const w = await width(page);
  await page.mouse.move(4, 120);
  await page.waitForTimeout(2000);
  const left = [await picture(page, ".m-pencil canvas"), await picture(page, ".m-relief canvas")];
  await page.mouse.move(w - 4, 120);
  await page.waitForTimeout(2000);
  const right = [await picture(page, ".m-pencil canvas"), await picture(page, ".m-relief canvas")];
  expect(right[0]).not.toBe(left[0]);
  expect(right[1]).not.toBe(left[1]);
  // Held still, the cloud stays where the hand left it.
  await page.waitForTimeout(600);
  expect(await picture(page, ".m-pencil canvas")).toBe(right[0]);
  if (test.info().project.name === "desktop") {
    const shift = await page.locator(".m-page img").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    expect(shift).toBeLessThan(-10);
  }
});

test("an essay's title band turns with the mouse, and a marked sentence lifts its ink", async ({ page }) => {
  await page.addInitScript((essay) => {
    localStorage.setItem("margin-notes:essays", JSON.stringify([essay]));
  }, ESSAY);
  await page.goto(`/e/${ESSAY.id}`);
  await expect(page.locator(".band .orbit")).toHaveAttribute("data-ready", "1");
  const w = await width(page);
  await page.mouse.move(4, 100);
  await page.waitForTimeout(2000);
  const left = await picture(page, ".band canvas");
  await page.mouse.move(w - 4, 100);
  await page.waitForTimeout(2000);
  expect(await picture(page, ".band canvas")).not.toBe(left);

  await page.locator('.paper .t[data-c="2"]').hover();
  await expect(page.locator('.ink-layer g.mark[data-n="2"]')).toHaveClass(/lift/);
  await expect(page.locator('.ink-layer g.mark[data-n="1"]')).not.toHaveClass(/lift/);
  await page.getByRole("button", { name: "Comment 1", exact: true }).hover();
  await expect(page.locator('.ink-layer g.mark[data-n="1"]')).toHaveClass(/lift/);
});

test("a marking key card writes its mark again when the mouse comes over it", async ({ page }) => {
  await page.goto("/key");
  const card = page.locator(".key-card").first();
  await card.locator("svg.hand").evaluate((svg) => {
    svg.setAttribute("data-first", "1");
  });
  await page.mouse.move(0, 0);
  await card.hover();
  await expect(card.locator("svg.hand")).not.toHaveAttribute("data-first", "1");
  await expect(card.locator(".pen-line").first()).toHaveCSS("animation-name", "pen-write");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("the art shows its stills and doesn't follow the mouse", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".orbit canvas")).toHaveCount(0);
    await expect(page.locator(".m-pencil img")).toBeVisible();
    await page.mouse.move(4, 120);
    await page.waitForTimeout(800);
    await page.mouse.move((await width(page)) - 4, 120);
    await page.waitForTimeout(800);
    if (test.info().project.name === "desktop") {
      await expect(page.locator(".m-page img")).toHaveCSS("transform", "none");
    }
  });
});
