import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";
import fs from "node:fs/promises";

test("card confirmation finishes in a production build", async ({ app, screen, browser }) => {
  test.skip(process.env.E2E_ALLOW_MUTATIONS !== "true" || !process.env.E2E_FIXTURE_PATH, "Requires a seeded isolated fixture");
  const fixture = JSON.parse(await fs.readFile(process.env.E2E_FIXTURE_PATH!, "utf8"));
  await app.open("/login?lang=en");
  await screen.getByLabel("Email address").fill(credentials.user("owner").username);
  await screen.getByLabel("Password").fill(credentials.user("owner").password);
  await screen.getByRole("button", "Sign in securely").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/, { timeout: 30_000 });
  await app.open(`/admin/cards?batch=${fixture.batchId}&page_search=${fixture.slug}`);
  await expect(browser.locator('.card-assignment-form select')).toHaveValue(fixture.pageId);
  await browser.locator('.card-assignment-form').getByRole("button", "تفعيل / نقل").tap();
  await screen.getByRole("button", "تأكيد التعيين").tap();
  await expect(browser).toHaveURL(/\/admin\/cards\?assigned=1/, { timeout: 10_000 });
  await expect(browser.locator('[role="status"].success')).toContainText("تم تحديث تعيين البطاقة.");
});

test("unassigned card displays only its printed serial", async ({ app, browser }) => {
  test.skip(process.env.E2E_ALLOW_MUTATIONS !== "true" || !process.env.E2E_FIXTURE_PATH, "Requires a seeded isolated fixture");
  const fixture = JSON.parse(await fs.readFile(process.env.E2E_FIXTURE_PATH!, "utf8"));
  test.skip(!fixture.unassignedToken || !/^NT-[0-9]{8}-[0-9]{6}$/.test(fixture.unassignedSerial), "Fixture has no unassigned card");
  await app.open(`/c/${fixture.unassignedToken}?via=qr`);
  await expect(browser).toHaveURL(new RegExp(`/card/unavailable\\?state=unassigned&serial=${fixture.unassignedSerial}`));
  await expect(browser.locator("[aria-label='Card serial']")).toContainText(fixture.unassignedSerial);
  const content = await browser.evaluate(() => document.body.innerText);
  expect(content).not.toContain(fixture.unassignedToken);
});
