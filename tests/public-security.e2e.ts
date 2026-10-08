import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("anonymous requests to owner pages and card inventory exports end at login", async ({ app, browser }) => {
  await app.open("/");
  const destinations = await browser.evaluate(async () => {
    const paths = [
    "/admin",
    "/admin/cards",
    "/admin/businesses/new",
    "/admin/cards/export?batch=00000000-0000-0000-0000-000000000000",
    ];
    return Promise.all(paths.map(async path => (await fetch(path, { redirect: "follow" })).url));
  });
  expect(destinations.every(url => new URL(url).pathname === "/login")).toBe(true);
});

test("invalid card tokens reach a branded unavailable state without exposing data", async ({ app, screen, browser }) => {
  await app.open("/c/not-a-valid-token");

  await expect(browser).toHaveURL(/\/card\/unavailable\?state=invalid/);
  await expect(screen.getByRole("link", "NexTap")).toHaveAttribute("href", "/");
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

test("public primary actions can receive keyboard focus", async ({ app, browser }) => {
  await app.open("/");
  const focus = await browser.evaluate(() => {
    document.querySelector<HTMLAnchorElement>('a[href="/demo"]')?.focus();
    return {
    href: (document.activeElement as HTMLAnchorElement | null)?.getAttribute("href") ?? "",
    visible: Boolean(document.activeElement?.getClientRects().length),
    };
  });
  expect(focus.href).toBe("/demo");
  expect(focus.visible).toBe(true);
});
