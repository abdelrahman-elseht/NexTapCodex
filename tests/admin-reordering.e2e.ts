import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("an owner can reorder sections, save them, and keep the order on reload", async ({ app, screen, browser }) => {
  test.skip(
    !process.env.E2E_USER_OWNER_USERNAME || !process.env.E2E_USER_OWNER_PASSWORD || process.env.E2E_ALLOW_MUTATIONS !== "true",
    "Owner mutation tests require credentials and E2E_ALLOW_MUTATIONS=true for a dedicated isolated Supabase test project.",
  );

  await app.open("/login");
  await screen.getByLabel("البريد الإلكتروني").fill(credentials.user("owner").username);
  await screen.getByLabel("كلمة المرور").fill(credentials.user("owner").password);
  await screen.getByRole("button", "دخول آمن").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);

  // Keep this mutation independent from customer records and other test suites.
  const suffix = Date.now().toString(36);
  await app.open("/admin/businesses/new");
  await screen.getByLabel("اسم النشاط").fill(`Reorder QA ${suffix}`);
  await screen.getByLabel("التصنيف").fill("QA");
  await screen.getByLabel("رابط الصفحة").fill(`reorder-qa-${suffix}`);
  await screen.getByRole("button", "إنشاء النشاط والصفحة").tap();
  await expect(browser).toHaveURL(/\/admin\/businesses\/[0-9a-f-]+\?created=1/);
  await expect(browser.locator(".visual-section-list")).toBeVisible();
  const editorPath = await browser.evaluate(() => location.pathname);
  const readOrder = () => browser.evaluate(() => Array.from(document.querySelectorAll(".visual-section-list > li"), row => row.querySelector(".navigator-item strong")?.textContent?.trim() || ""));
  const before = await readOrder();
  expect(before.length).toBeGreaterThan(1);
  await browser.locator(".visual-section-list > li").first().getByRole("button").nth(2).tap();
  await screen.getByRole("button", "Save draft").tap();
  await expect(browser.locator(".editor-save-status")).toHaveText("Draft saved");
  await app.open(editorPath);
  await expect(browser.locator(".visual-section-list")).toBeVisible();
  const after = await readOrder();
  expect(after[0]).toBe(before[1]);
  expect(after[1]).toBe(before[0]);
  expect(after.slice(2)).toEqual(before.slice(2));
});
