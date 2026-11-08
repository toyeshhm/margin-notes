// Moving a pin and the My essays drawer, on a saved sample so no reading model is called.
import { expect, test } from "@playwright/test";

test("a pin moved to another sentence stays there after a reload", async ({ page }) => {
  await page.goto("/samples");
  await page.locator(".tray-item", { hasText: "Later Bells" }).getByRole("button").click();
  await page.waitForURL(/\/e\//);
  const before = await page.locator(".row.open .on q").innerText();
  await page.getByRole("button", { name: "Move this pin" }).click();
  const target = page.locator(".paper .s").nth(6);
  const words = (await target.innerText()).trim();
  expect(words.startsWith(before.slice(0, 20))).toBe(false);
  await target.click();
  await expect(page.locator(".row.open .on q")).toContainText(words.slice(0, 20));
  await page.reload();
  await expect(page.locator(".row.open .on q")).toContainText(words.slice(0, 20));
});

test("a pin dragged with the mouse lands on the sentence it is dropped on", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the phone moves a pin by tapping, covered above");
  await page.goto("/samples");
  await page.locator(".tray-item", { hasText: "Later Bells" }).getByRole("button").click();
  await page.waitForURL(/\/e\//);
  const pin = page.getByRole("button", { name: "Comment 1", exact: true });
  // The drop lands at the start of a line, so aim at the first sentence of a paragraph.
  const target = page.locator(".paper p:not(.paper-head)").nth(1).locator(".s").first();
  const words = (await target.innerText()).trim();
  await target.scrollIntoViewIfNeeded();
  const from = await pin.boundingBox();
  // A sentence can wrap over lines: drop on the middle of its first line.
  const to = await target.evaluate((el) => {
    const r = el.getClientRects()[0];
    return r === undefined ? null : { y: r.top, height: r.height };
  });
  if (from === null || to === null) throw new Error("pin or sentence not on screen");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(".row.open .on q")).toContainText(words.slice(0, 20));
});

test("My essays lists a saved essay after a reload, and Delete removes it for good", async ({ page }) => {
  await page.goto("/samples");
  await page.locator(".tray-item", { hasText: "Later Bells" }).getByRole("button").click();
  await page.waitForURL(/\/e\//);
  await page.goto("/essays");
  await expect(page.locator(".folder")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".folder-title")).toContainText("Later Bells");
  await page.locator(".folder-delete").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete it" }).click();
  await expect(page.locator(".folder")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".folder")).toHaveCount(0);
});
