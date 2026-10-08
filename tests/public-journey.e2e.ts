import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("landing page links to the demo and contact channel without horizontal overflow", async ({ app, screen, browser }) => {
  await app.open("/");

  await expect(screen.getByRole("heading", "لمسة واحدة تفتح باب عملك.")).toBeVisible();
  await expect(screen.getByRole("link", "شاهد صفحة تجريبية")).toHaveAttribute("href", "/demo");
  await expect(screen.getByRole("link", "تواصل عبر واتساب")).toHaveAttribute("href", "https://wa.me/201000000000");
  await expect(screen.getByRole("img", "NexTap")).toHaveCount(2);

  const widths = await browser.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});

test("demo presents its business contact and returns to the landing page", async ({ app, screen, browser }) => {
  await app.open("/demo");

  await expect(screen.getByRole("heading", "قهوة ومزاج")).toBeVisible();
  await expect(screen.getByRole("link", "واتساب")).toHaveAttribute("href", "https://wa.me/201000000000");
  await screen.getByRole("link", "العودة للرئيسية").tap();
  await expect(browser).toHaveURL("/");
});

test("owner login form is available and anonymous admin access redirects to login", async ({ app, screen, browser }) => {
  await app.open("/login");

  await expect(screen.getByRole("heading", "دخول المالك")).toBeVisible();
  await expect(screen.getByLabel("البريد الإلكتروني")).toBeVisible();
  await expect(screen.getByLabel("كلمة المرور")).toBeVisible();

  await app.open("/admin");
  await expect(browser).toHaveURL(/\/login/);
  await expect(screen.getByRole("heading", "دخول المالك")).toBeVisible();
});
