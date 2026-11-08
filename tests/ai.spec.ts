// Playtests for the flows that call the reading models. Run them against a deployment:
//   PLAYTEST_URL=<live link> make check
// A scan is kept by a hash of the photos, so a repeat run costs no reading.
import { expect, type Page, test } from "@playwright/test";

import { isInstruction } from "../src/lib/guards";
import { normalize } from "../src/lib/text";
import { laterBells } from "../src/samples/laterBells";
import { sentenceText } from "../src/samples/types";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

// The sentence each comment of the first sample sits on, from the sample's own source.
const answers = new Map(
  laterBells.pages.flatMap((page) =>
    page.flatMap((para) => para.flatMap((s) => (typeof s === "string" ? [] : s.flatMap((p) => (typeof p === "string" ? [] : [[p.c, sentenceText(s)] as const]))))),
  ),
);

async function openSample(page: Page, title: string): Promise<void> {
  await page.goto("/samples");
  await page.locator(".tray-item", { hasText: title }).getByRole("button").click();
  await page.waitForURL(/\/e\//);
}

test("the first sample's two photos give eleven comments, each pinned to its sentence", async ({ page }) => {
  await page.goto("/scan");
  await page.locator('input[type="file"]').setInputFiles(["public/samples/later-bells-page-1.jpg", "public/samples/later-bells-page-2.jpg"]);
  await page.getByRole("button", { name: "Read the marks" }).click();
  await expect(page.getByText("Reading page 1 of 2")).toBeVisible();
  await page.waitForURL(/\/e\//, { timeout: 200_000 });
  await expect(page.locator(".card .count")).toHaveText("11 comments", { timeout: 30_000 });
  await expect(page.locator(".pin")).toHaveCount(11);
  // Reading handwriting from a phone photo is not exact: most pins land on the right sentence, a few one sentence off
  // (each can be dragged, feature 4).
  let right = 0;
  for (let n = 1; n <= 11; n++) {
    await page.locator(".row-main").nth(n - 1).click();
    const sentence = await page.locator(".row.open .on q").last().textContent();
    if ((sentence ?? "").slice(0, 14) === (answers.get(n) ?? "x").slice(0, 14)) right++;
  }
  expect(right).toBeGreaterThanOrEqual(7);
  await expect(page.locator(".row").first()).toContainText("This sentence is hard to follow.");
});

test("a photo with no essay on it says so instead of inventing marks", async ({ page }) => {
  await page.goto("/scan");
  await page.locator('input[type="file"]').setInputFiles("public/assets/home-pencil.webp");
  await page.getByRole("button", { name: "Read the marks" }).click();
  await expect(page.getByRole("alert")).toContainText("doesn't show a typed essay page", { timeout: 120_000 });
});

test("plain words for 'rewrite this' are an instruction, not a rewritten sentence", async ({ request }) => {
  const sentence = "The fact that sleep is something we as students do not get enough of is a problem that is a big one.";
  const r = await request.post("/api/explain", { data: { marks: [{ n: 1, words: "rewrite this", sentence }] } });
  expect(r.ok()).toBe(true);
  const { plains } = (await r.json()) as { plains: { meaning: string; todo: string }[] };
  expect(isInstruction(plains[0]?.todo ?? "", sentence)).toBe(true);
});

test("checking the sample's revisions: quoted ticks, a reasoned miss, then most answered in round 2", async ({ page }) => {
  await openSample(page, "Later Bells");
  await page.getByRole("link", { name: "Check my revision" }).click();
  await page.getByRole("button", { name: "Paste the sample’s revision" }).click();
  await page.getByRole("button", { name: "Check it" }).click();
  await expect(page.locator(".card .count")).toHaveText("Round 1", { timeout: 120_000 });
  const draft = normalize(laterBells.revisions[0] ?? "");
  for (const q of await page.locator(".row.ticked .quote").allTextContents()) {
    if (q !== "Removed in your revision") expect(draft).toContain(normalize(q.replace(/^“|”$/g, "")));
  }
  // The sample's first revision leaves some comments unanswered; the models vary on which, so any miss will do.
  await expect(page.locator(".row.missed").first()).toBeVisible();
  await expect(page.locator(".row.missed").first().locator(".reason")).not.toBeEmpty();
  await page.locator(".row.ticked .row-main").first().click();
  await page.getByRole("button", { name: "Before and after" }).click();
  await expect(page.getByRole("dialog")).toContainText("Before");
  await page.getByRole("button", { name: "Close" }).click();
  // The free hosts allow about a check a minute; a student takes longer than that to revise.
  await page.waitForTimeout(65_000);
  await page.getByRole("button", { name: "Paste the sample’s revision" }).click();
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.locator(".card .count")).toHaveText("Round 2", { timeout: 120_000 });
  // The reading models are stricter than the sample's author (they want evidence cited, for one): most, not all, are ticked.
  const done = Number(/^(\d+) of 11 answered$/.exec((await page.locator(".answered").textContent()) ?? "")?.[1]);
  expect(done).toBeGreaterThanOrEqual(6);
  await page.getByRole("button", { name: "Round 1" }).click();
  await expect(page.locator(".card .count")).toHaveText("Round 1");
  // The note for the teacher, from the latest round: Copy link gives a read-only page.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  // Notes made by tests are flagged, so they can be told apart from students' notes.
  await page.setExtraHTTPHeaders({ "x-playtest": "1" });
  await page.getByRole("link", { name: "Note for your teacher" }).click();
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByText("Link copied.")).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  await page.goto(url);
  await expect(page.locator(".note-sheet li")).toHaveCount(11);
  // My essays lists the essay with both rounds, and a round opens its results.
  await page.goto("/essays");
  await expect(page.locator(".folder-rounds li")).toHaveCount(2);
  await page.locator(".folder-rounds a").first().click();
  await expect(page.locator(".card .count")).toHaveText("Round 1");
});

test("the Word sample shows each typed comment on the words it was left on", async ({ page }) => {
  await page.goto("/scan?tab=word");
  await page.locator('input[type="file"]').setInputFiles("public/samples/what-the-necklace-cost.docx");
  await page.waitForURL(/\/e\//, { timeout: 120_000 });
  await expect(page.locator(".paper .t.typed")).toHaveCount(7);
  await expect(page.locator('.paper .t[data-c="6"]')).toHaveText("very sad");
});
