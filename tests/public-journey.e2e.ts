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

test("demo consolidates social links into official brand icons and a Google Reviews prompt", async ({ app, screen, browser }) => {
  await app.open("/demo");

  const instagram = screen.getByRole("link", "Instagram");
  const tiktok = screen.getByRole("link", "TikTok");
  await expect(instagram).toHaveAttribute("href", "https://instagram.com/");
  await expect(tiktok).toHaveAttribute("href", "https://tiktok.com/");
  await expect(screen.getByRole("link", "اكتب تقييمًا على Google Reviews")).toBeVisible();
  await expect(screen.getByText("★★★★★")).toBeVisible();

  const socialLinks = await browser.evaluate(() => Array.from(document.querySelectorAll(".social-icon-list a"), link => ({
    label: link.getAttribute("aria-label"),
    text: link.textContent?.trim(),
    hasIcon: Boolean(link.querySelector("img,svg")),
  })));
  expect(socialLinks).toEqual([
    { label: "Instagram", text: "", hasIcon: true },
    { label: "TikTok", text: "", hasIcon: true },
  ]);
});

test("demo keeps the business profile within a mobile viewport", async ({ app, browser }) => {
  await app.open("/demo");

  const dimensions = await browser.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    socialIcons: document.querySelectorAll(".social-icon-list a").length,
    ratings: document.querySelectorAll(".review-stars").length,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.socialIcons).toBe(2);
  expect(dimensions.ratings).toBe(1);
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
