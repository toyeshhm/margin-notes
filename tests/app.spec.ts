import { expect, test } from "@playwright/test";

import { keyFor } from "../src/lib/markingKey";
import { samples } from "../src/samples";

const MENU = [
  ["Scan an essay", "Scan an essay"],
  ["Try a sample", "Try a sample"],
  ["My essays", "My essays"],
  ["Marking key", "Marking key"],
] as const;

test("every menu item opens its screen from the desk and from the bar", async ({ page }) => {
  for (const [label, heading] of MENU) {
    await page.goto("/");
    await page.locator(".objects").getByRole("link", { name: label }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await page.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: label }).click();
    await expect(page.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }
  await expect(page.locator("footer")).toHaveText("Your essays stay in this browser. Photos are read, never stored.");
});

test("no screen scrolls sideways", async ({ page }) => {
  for (const path of ["/", "/scan", "/scan?tab=word", "/samples", "/essays", "/key", "/nowhere"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
  }
});

test("the marking key has a card for every mark on the photo samples", async ({ page }) => {
  await page.goto("/key");
  await expect(page.locator(".key-card").first()).toContainText("This sentence is hard to follow.");
  const meanings = await page.locator(".key-meaning").allTextContents();
  for (const s of samples.filter((x) => x.source === "photos")) {
    for (const c of s.comments) {
      const entry = keyFor(c.words);
      if (entry !== undefined) expect(meanings).toContain(entry.meaning);
    }
  }
  const laterBells = samples[0]?.comments ?? [];
  expect(laterBells.every((c) => keyFor(c.words) !== undefined)).toBe(true);
});

test("photos: nothing to read until a photo is chosen, and a non-photo is refused", async ({ page }) => {
  await page.goto("/scan");
  await expect(page.getByRole("button", { name: "Read the marks" })).toBeDisabled();
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByRole("alert")).toContainText("Those aren't photos");
  await page.locator('input[type="file"]').setInputFiles("public/samples/later-bells-page-1.jpg");
  await expect(page.getByRole("button", { name: "Read the marks" })).toBeEnabled();
  await expect(page.getByText("1 page ready.")).toBeVisible();
});

test("word file: the Google Docs hint shows and a non-Word file is refused", async ({ page }) => {
  await page.goto("/scan?tab=word");
  await expect(page.getByText("From Google Docs: File, Download, Microsoft Word")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "essay.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") });
  await expect(page.getByRole("alert")).toContainText("That isn't a Word file");
});

test("every sample offers its files, and they download", async ({ page, request }) => {
  await page.goto("/samples");
  await expect(page.locator(".tray-item")).toHaveCount(samples.length);
  for (const s of samples) {
    await expect(page.getByText(s.title, { exact: true })).toBeVisible();
    for (const f of s.files) expect((await request.get(`/samples/${f}`)).status(), f).toBe(200);
  }
});

test("a shared note opens read-only, and an unknown one says so", async ({ page, request }) => {
  const made = await request.post("/api/note", {
    headers: { "x-playtest": "1" },
    data: { title: "Playtest essay", round: 2, rows: [{ n: 1, mark: "awk", typed: false, quote: "Most students do not get enough sleep.", removed: false }, { n: 2, mark: "evidence?", typed: false, quote: "", removed: false }] },
  });
  expect(made.ok()).toBe(true);
  const { id } = (await made.json()) as { id: string };
  await page.goto(`/n/${id}`);
  await expect(page.getByRole("heading", { name: "Playtest essay" })).toBeVisible();
  await expect(page.getByText("Most students do not get enough sleep.")).toBeVisible();
  await expect(page.getByText("Not yet answered")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Menu" })).toHaveCount(0);
  await page.goto("/n/000000000000");
  await expect(page.getByRole("heading", { name: "No note here" })).toBeVisible();
});

test("an essay that isn't in this browser, and a wrong link, both lead back", async ({ page }) => {
  await page.goto("/e/notanessay1");
  await expect(page.getByRole("heading", { name: "This essay isn’t in this browser" })).toBeVisible();
  await page.goto("/nowhere");
  await expect(page.getByRole("heading", { name: "Nothing on this page" })).toBeVisible();
  await page.getByRole("link", { name: "Back to the desk" }).click();
  await expect(page.getByRole("heading", { name: "Margin Notes", level: 1 })).toBeVisible();
});

test("the API refuses bad input plainly", async ({ request }) => {
  const scan = await request.post("/api/scan", { data: { image: "https://example.com/a.jpg" } });
  expect(scan.status()).toBe(400);
  expect(((await scan.json()) as { message: string }).message).toBe("Send a JPEG, PNG or WebP photo.");
  const check = await request.post("/api/check", { data: { sentences: [], draft: "", comments: [] } });
  expect(check.status()).toBe(400);
  const note = await request.post("/api/note", { data: { title: "", rows: [] } });
  expect(note.status()).toBe(400);
});
