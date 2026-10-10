import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("phase 5 keeps section edits and order across incremental saves", async ({ app, screen, browser }) => {
  test.skip(
    !process.env.E2E_USER_OWNER_USERNAME || !process.env.E2E_USER_OWNER_PASSWORD || process.env.E2E_ALLOW_MUTATIONS !== "true",
    "Phase 5 owner save checks require the isolated Supabase project and mutation opt-in.",
  );

  await app.open("/login?lang=en");
  await screen.getByLabel("Email address").fill(credentials.user("owner").username);
  await screen.getByLabel("Password").fill(credentials.user("owner").password);
  await screen.getByRole("button", "Sign in securely").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);

  const suffix = Date.now().toString(36);
  await app.open("/admin/businesses/new");
  await browser.locator('input[name="name"]').fill(`Phase 5 QA ${suffix}`);
  await browser.locator('input[name="category"]').fill("QA");
  await browser.locator('input[name="slug"]').fill(`phase5-${suffix}`);
  await browser.locator("form.create-business-form button").tap();
  await expect(browser).toHaveURL(/\/admin\/businesses\/[0-9a-f-]+\?created=1/);

  const editorPath = await browser.evaluate(() => location.pathname);
  await screen.getByRole("button", /About/).tap();
  const aboutEnabled = await browser.evaluate(() => {
    const heading = [...document.querySelectorAll("h3")].find(node => /About/i.test(node.textContent || ""));
    return Boolean(heading?.closest(".editor-form-pane")?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked);
  });
  if (!aboutEnabled) await screen.getByRole("checkbox").check();
  const copy = `Incremental save ${suffix}`;
  await screen.getByLabel("About copy").fill(copy);
  await screen.getByRole("button", "Save draft").tap();
  await expect(screen.getByRole("status")).toContainText("Draft saved");

  const before = await browser.evaluate(() => Array.from(document.querySelectorAll(".visual-section-list > li"), row => row.querySelector(".navigator-item small")?.textContent?.trim() || ""));
  expect(before.length).toBeGreaterThan(1);
  await browser.locator(".visual-section-list > li").first().getByRole("button").nth(2).tap();
  await screen.getByRole("button", "Save draft").tap();
  await expect(screen.getByRole("status")).toContainText("Draft saved");

  await app.open(editorPath);
  await screen.getByRole("button", /About/).tap();
  await expect(screen.getByLabel("About copy")).toHaveValue(copy);
  const after = await browser.evaluate(() => Array.from(document.querySelectorAll(".visual-section-list > li"), row => row.querySelector(".navigator-item small")?.textContent?.trim() || ""));
  expect(after[0]).toBe(before[1]);
  expect(after[1]).toBe(before[0]);
  expect(after.slice(2)).toEqual(before.slice(2));
});
