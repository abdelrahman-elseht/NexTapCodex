import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";
import fs from "node:fs/promises";

async function fixture() {
  const value = JSON.parse(await fs.readFile(process.env.AUDIT_FIXTURE_PATH || ".env.audit-fixture.json", "utf8"));
  if (!/^preprod-media-/.test(value.slug)) throw new Error("An existing synthetic preprod fixture is required.");
  return value;
}

test("baseline published synthetic business keeps its media and actions usable", async ({ app, screen, browser }) => {
  const data = await fixture();
  await app.clearState();
  await app.open(`/b/${data.slug}`);
  await expect(screen.getByRole("heading", "Preprod QA illustrative media")).toBeVisible();
  await expect(screen.getByRole("link", "Website", { exact: true })).toHaveAttribute("href", "https://example.com");
  await expect(browser.locator(".hero-photo")).toHaveAttribute("fetchpriority", "high");
  await expect(browser.locator(".gallery-photo")).toHaveCount(100);
  await expect.poll(() => browser.evaluate(() => {
    const image = document.querySelector<HTMLImageElement>(".hero-photo");
    return Boolean(image?.complete && image.naturalWidth > 0);
  })).toBe(true);
  const layout = await browser.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  expect(layout).toEqual({ lang: "ar", dir: "rtl", overflow: false });
});

test("baseline owner dashboard and editor update the live preview without saving", async ({ app, screen, browser }) => {
  const data = await fixture();
  await app.clearState();
  let mutationRequests = 0;
  await browser.route("**/api/admin/**", route => {
    if (route.request.method !== "GET") {
      mutationRequests++;
      return route.abort();
    }
    return route.continue();
  });
  await app.open("/login?lang=en");
  await screen.getByLabel("Email address").fill(credentials.user("owner").username);
  await screen.getByLabel("Password").fill(credentials.user("owner").password);
  await screen.getByRole("button", "Sign in securely").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);
  await expect(screen.getByRole("heading", "لوحة التحكم", { exact: true })).toBeVisible();
  await app.open(`/admin/businesses/${data.businessId}`);
  const name = screen.getByLabel("Business name", { exact: true });
  await expect(name).toBeVisible();
  const initialName = await name.inputValue();
  expect(initialName).toBeTruthy();
  await name.fill("Observability QA local preview");
  await expect(screen.getByRole("status")).toContainText("Unpublished changes");
  if (await browser.evaluate(() => innerWidth < 800)) await screen.getByRole("button", "Preview", { exact: true }).tap();
  await expect(browser.locator(".editor-phone-screen")).toContainText("Observability QA local preview");
  await expect(screen.getByRole("button", "Save draft", { exact: true })).toBeEnabled();
  // The dirty editor intentionally guards navigation; keep this assertion on the
  // editor surface and verify that no mutation was sent.
  expect(mutationRequests).toBe(0);
});
