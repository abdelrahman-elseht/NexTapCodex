import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import fs from "node:fs/promises";

test("public media has responsive variants, eager hero/logo, lazy gallery and stable geometry", async ({ app, browser }) => {
  const fixture = JSON.parse(await fs.readFile(process.env.E2E_FIXTURE_PATH || ".e2e/optimization-phase123/fixture.json", "utf8"));
  await app.open(`/b/${fixture.slug}`);
  await expect(browser.locator('.hero-photo')).toHaveAttribute("loading", "eager");
  await expect(browser.locator('.hero-photo')).toHaveAttribute("fetchpriority", "high");
  await expect(browser.locator('.business-logo img')).toHaveAttribute("loading", "eager");
  await browser.evaluate(() => { document.querySelector('.gallery-section')!.scrollIntoView(); return null; });
  await expect(browser.locator('.gallery-photo')).toHaveCount(100);
  await expect(browser.locator('.gallery-photo img').first()).toHaveAttribute("loading", "lazy");
  await expect(browser.locator('.map-preview img')).toHaveAttribute("loading", "lazy");
  await expect(browser.locator('.payments-section img.section-background-photo')).toHaveAttribute("loading", "lazy");
  // Offscreen sections use content-visibility:auto; measure after bringing them into view.
  await browser.evaluate(() => { document.querySelector('.gallery-photo')!.scrollIntoView(); return null; });
  await expect(browser.locator('.gallery-photo').first()).toBeVisible();
  const geometry = await browser.evaluate(() => {
    const hero = document.querySelector<HTMLImageElement>('.hero-photo')!;
    const logo = document.querySelector<HTMLImageElement>('.business-logo img')!;
    const thumb = document.querySelector('.gallery-photo')!.getBoundingClientRect();
    return { heroSrc: hero.currentSrc, logoSrc: logo.currentSrc, thumbWidth: thumb.width, thumbHeight: thumb.height, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(geometry.heroSrc).toContain('/_next/image?');
  expect(Number(new URL(geometry.logoSrc).searchParams.get("w"))).toBeLessThanOrEqual(256);
  expect(geometry.thumbWidth / geometry.thumbHeight).toBeCloseTo(4 / 3, 1);
  expect(geometry.overflow).toBe(false);
  await app.screenshot("public-responsive-gallery");
});

test("broken optimized images preserve actions and recover after reload", async ({ app, browser, screen }) => {
  const fixture = JSON.parse(await fs.readFile(process.env.E2E_FIXTURE_PATH || ".e2e/optimization-phase123/fixture.json", "utf8"));
  await browser.route("**/_next/image?**", route => route.abort());
  await app.open(`/b/${fixture.slug}`);
  await expect(browser.locator('.business-logo .image-unavailable')).toBeVisible();
  await expect(screen.getByRole("link", "Website", { exact: true })).toBeVisible();
  await browser.unroute("**/_next/image?**");
  await app.open(`/b/${fixture.slug}`);
  await expect(browser.locator('.business-logo img')).toBeVisible();
  await expect(browser.locator('.business-logo .image-unavailable')).toHaveCount(0);
});
