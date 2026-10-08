import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("an owner can reorder sections, save them, and keep the order on reload", async ({ app, screen, browser }) => {
  test.skip(
    !process.env.E2E_USER_OWNER_USERNAME || !process.env.E2E_USER_OWNER_PASSWORD,
    "Set E2E_USER_OWNER_USERNAME and E2E_USER_OWNER_PASSWORD to exercise the protected owner workflow.",
  );

  await app.open("/login");
  await screen.getByLabel("Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ").fill(credentials.user("owner").username);
  await screen.getByLabel("ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±").fill(credentials.user("owner").password);
  await screen.getByRole("button", "Ø¯Ø®ÙˆÙ„ Ø¢Ù…Ù†").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);

  const editorPath = await browser.evaluate(() => document.querySelector<HTMLAnchorElement>('a[href^="/admin/businesses/"]')?.getAttribute("href") ?? "");
  expect(editorPath).toBeTruthy();
  await app.open(editorPath!);

  const before = await browser.evaluate(() => Array.from(document.querySelectorAll(".section-order-list > li"), row => row.querySelector("summary strong")?.textContent?.trim() || "")) as string[];
  expect(before.length).toBeGreaterThan(1);
  const firstSectionTitle = await browser.evaluate(() => document.querySelector(".section-order-list > li .editor-section strong")?.textContent?.split(" · ")[0] || "");
  await screen.getByRole("button", `Move ${firstSectionTitle} down`).tap();
  await screen.getByRole("button", "Save order").tap();
  await expect(screen.getByText("تم حفظ ترتيب الأقسام.")).toBeVisible();

  await app.open(editorPath!);
  const after = await browser.evaluate(() => Array.from(document.querySelectorAll(".section-order-list > li"), row => row.querySelector("summary strong")?.textContent?.trim() || "")) as string[];
  expect(after[0]).toBe(before[1]);
  expect(after[1]).toBe(before[0]);
  expect(after.slice(2)).toEqual(before.slice(2));
});
