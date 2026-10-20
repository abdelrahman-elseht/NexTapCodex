import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("owners can browse businesses, open an editor, and return through preview", async ({ app, screen, browser }) => {
  test.skip(!process.env.E2E_USER_OWNER_USERNAME || !process.env.E2E_USER_OWNER_PASSWORD, "Requires the configured owner account.");

  await app.open("/login");
  await screen.getByLabel("البريد الإلكتروني").fill(credentials.user("owner").username);
  await screen.getByLabel("كلمة المرور").fill(credentials.user("owner").password);
  await screen.getByRole("button", "دخول آمن").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);

  await app.open("/admin/businesses");
  await expect(browser.locator("table tbody tr")).toHaveCount(25);
  const businessLink = browser.locator('a[href^="/admin/businesses/"]:not([href$="/new"])').first();
  await businessLink.tap();
  await expect(browser).toHaveURL(/\/admin\/businesses\/[0-9a-f-]+$/);
  await expect(screen.getByRole("heading", { name: /إدارة/ })).toBeVisible();
  await expect(screen.getByRole("link", "معاينة المسودة")).toBeVisible();
  await expect(screen.getByRole("link", "فتح الصفحة العامة ↗")).toBeVisible();

  await screen.getByRole("link", "معاينة المسودة").tap();
  await expect(browser).toHaveURL(/\/admin\/businesses\/[0-9a-f-]+\/preview\?page=/);
  await expect(screen.getByText(/معاينة خاصة بالمالك/)).toBeVisible();
  await screen.getByRole("link", "العودة للمحرر").tap();
  await expect(browser).toHaveURL(/\/admin\/businesses\/[0-9a-f-]+$/);

  await app.open("/admin/businesses?status=active");
  await expect(browser.locator("table tbody tr")).toHaveCount(25);
  await expect(browser.locator("nav.pagination a").last()).toHaveAttribute("href", /direction=next/);
});
