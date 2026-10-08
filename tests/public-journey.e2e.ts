import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("landing page links to the demo and uses a sample fallback when no contact number is configured", async ({ app, screen, browser }) => {
  await app.open("/");

  await expect(screen.getByRole("heading", "لمسة واحدة تفتح باب عملك.")).toBeVisible();
  await expect(screen.getByRole("link", "شاهد صفحة تجريبية")).toHaveAttribute("href", "/demo");
  await expect(screen.getByRole("link", "افتح الصفحة التجريبية").first()).toHaveAttribute("href", "/demo");
  await expect(screen.getByRole("link", "تواصل عبر واتساب")).toHaveCount(0);
  await expect(screen.getByRole("img", "NexTap")).toHaveCount(3);

  const widths = await browser.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});

test("demo presents its map action and returns to the landing page", async ({ app, screen, browser }) => {
  await app.open("/demo");

  await expect(screen.getByRole("heading", "قهوة ومزاج")).toBeVisible();
  await expect(screen.getByRole("link", "الموقع").first()).toHaveAttribute("href", "https://maps.google.com/?q=Cairo");
  await expect(screen.getByRole("link", "اكتب تقييمًا على Google Reviews")).toBeVisible();
  const returnLink = screen.getByRole("link", "العودة إلى NexTap");
  await screen.scrollUntilVisible(returnLink, { direction: "down" });
  await returnLink.tap();
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

test("team login supports Arabic and English", async ({ app, screen, browser }) => {
  await app.open("/login");

  await expect(screen.getByRole("heading", "دخول فريق NexTap")).toBeVisible();
  await expect(screen.getByLabel("البريد الإلكتروني")).toBeVisible();
  await expect(screen.getByLabel("كلمة المرور")).toBeVisible();
  await screen.getByRole("link", "English").tap();
  await expect(browser).toHaveURL(/\/login\?lang=en/);
  await expect(screen.getByRole("heading", "Team sign in")).toBeVisible();
  await expect(screen.getByLabel("Email address")).toBeVisible();

});
