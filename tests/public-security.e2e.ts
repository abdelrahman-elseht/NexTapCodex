import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("anonymous users are redirected from owner pages and card exports to login", async ({ app, screen, browser }) => {
  const paths = [
    "/admin",
    "/admin/cards",
    "/admin/businesses/new",
    "/admin/cards/export?batch=00000000-0000-0000-0000-000000000000",
  ];
  for (const path of paths) {
    await app.open(path);
    await expect(browser).toHaveURL(/\/login/);
    await expect(screen.getByRole("heading", "دخول فريق NexTap")).toBeVisible();
  }
});

test("invalid card tokens reach a branded unavailable state without exposing data", async ({ app, screen, browser }) => {
  await app.open("/c/not-a-valid-token");

  await expect(browser).toHaveURL(/\/card\/unavailable\?state=invalid/);
  await expect(screen.getByRole("link", "NexTap الرئيسية")).toHaveAttribute("href", "/");
  const content = await browser.evaluate(() => document.body.innerText);
  expect(content).not.toContain("undefined");
  expect(content).not.toContain("null");
});

test("unknown business slugs show a not-found page instead of a blank profile", async ({ app, screen, browser }) => {
  await app.open("/b/e2e-missing-business-slug");
  await expect(screen.getByRole("link", "العودة للرئيسية")).toBeVisible({ timeout: 20_000 });

  const result = await browser.evaluate(() => ({
    hasProfile: Boolean(document.querySelector(".public-page")),
  }));
  expect(result.hasProfile).toBe(false);
});

test("unknown routes show the branded not-found recovery", async ({ app, screen }) => {
  await app.open("/e2e-missing-route");

  await expect(screen.getByRole("heading", "هذه الصفحة غير موجودة")).toBeVisible();
  await expect(screen.getByRole("link", "العودة للرئيسية")).toHaveAttribute("href", "/");
  await expect(screen.getByRole("link", "استكشاف النموذج")).toHaveAttribute("href", "/demo");
});

test("access-denied page offers a sign-in recovery", async ({ app, screen }) => {
  await app.open("/403");

  await expect(screen.getByRole("heading", "هذه المساحة مخصصة لفريق NexTap")).toBeVisible();
  await expect(screen.getByRole("link", "تسجيل الدخول بحساب آخر")).toHaveAttribute("href", "/login");
});

test("public pages declare Arabic RTL and remain usable at the active viewport", async ({ app, browser }) => {
  await app.open("/demo");

  const layout = await browser.evaluate(() => ({
    language: document.documentElement.lang,
    direction: document.documentElement.dir,
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(layout.language).toBe("ar");
  expect(layout.direction).toBe("rtl");
  expect(layout.content).toBeLessThanOrEqual(layout.viewport);
});

test("public primary actions can receive keyboard focus", async ({ app, screen }) => {
  await app.open("/");
  const primaryAction = screen.getByRole("link", "شاهد صفحة تجريبية");
  await primaryAction.focus();
  await expect(primaryAction).toBeFocused();
});

test("payment cards keep recipient details private and guide the payer through the fallback", async ({ app, screen, browser }) => {
  await browser.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => undefined } });
  });
  await app.open("/demo");
  const action = screen.getByRole("button", "InstaPay", { exact: true });
  await action.scrollIntoView();
  await app.screenshot("payment-cards");
  await action.focus();
  await expect(action).toBeFocused();
  await action.press("Enter");
  const dialog = screen.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Recipient details copied");
  await expect(dialog).toContainText("complete the transfer in the app");
  await app.screenshot("payment-fallback");
  const privacy = await browser.evaluate(() => ({
    text: document.body.innerText,
    names: Array.from(document.querySelectorAll(".payment-tile"), item => item.getAttribute("aria-label") || ""),
    hrefs: Array.from(document.querySelectorAll(".payment-grid a"), item => item.getAttribute("href") || ""),
    copyButtons: document.querySelectorAll(".copy-payment").length,
  }));
  expect(privacy.text).not.toContain("@instapay");
  expect(privacy.text).not.toContain("Copy identifier");
  expect(privacy.names).toEqual(["InstaPay", "Vodafone Cash", "Bank instructions"]);
  expect(privacy.hrefs).toEqual([]);
  expect(privacy.copyButtons).toBe(0);
  await screen.getByRole("button", "Close", { exact: true }).press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(action).toBeFocused();
});

test("clipboard denial keeps payment instructions usable and local logo failures recover", async ({ app, screen, browser }) => {
  await browser.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Clipboard unavailable"); } } });
  });
  await browser.route("**/icons/payment/*.svg", route => route.abort());
  await app.open("/demo");
  await expect(browser.locator('.payment-grid img[src="/icons/payment/instapay.png"]')).toHaveCount(1);
  await screen.getByRole("button", "Vodafone Cash", { exact: true }).tap();
  const dialog = screen.getByRole("dialog");
  await expect(dialog).toContainText("Could not copy recipient details");
  await expect(dialog).toContainText("*9*7#");
  await screen.getByRole("button", "Close", { exact: true }).tap();
  await browser.route("**/icons/payment/*.png", route => route.abort());
  await browser.reload();
  await expect(browser.locator(".payment-grid .payment-logo-fallback")).toHaveCount(2);
});
