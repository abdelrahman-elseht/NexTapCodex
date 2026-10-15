import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";
import fs from "node:fs/promises";
import { markDocument, expectSameDocument } from "./_helpers/document";

test("rejected and interrupted admin mutations retain work and retry identity", async ({ app, screen, browser }) => {
  test.skip(!process.env.E2E_FIXTURE_PATH, "Requires namespaced owner fixture");
  const fixture = JSON.parse(await fs.readFile(process.env.E2E_FIXTURE_PATH!, "utf8"));
  await app.open("/login?lang=en");
  await screen.getByLabel("Email address").fill(credentials.user("owner").username);
  await screen.getByLabel("Password").fill(credentials.user("owner").password);
  await screen.getByRole("button", "Sign in securely").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);
  await app.open(`/admin/cards?batch=${fixture.batchId}`);
  await browser.locator('input[name="name"]').fill("Keep manufacturing draft");
  await browser.locator('tr[data-card-id] input[type="checkbox"]').check();
  const before = await markDocument(browser);
  // Controlled transport failures only: no fake success or committed database state.
  await browser.evaluate(() => {
    const original = window.fetch.bind(window), keys: string[] = [];
    Object.assign(window, { __retryKeys: keys, __failureStatus: 422 });
    window.fetch = async (input, init) => {
      if (String(input) !== "/api/admin/operations") return original(input, init);
      keys.push(String((init?.body as FormData).get("request_key")));
      const status = Number(Reflect.get(window, "__failureStatus"));
      if (status === 0) throw new TypeError("Controlled network interruption");
      return Response.json({ ok: false, error: `Controlled rejection ${status}` }, { status });
    }; return true;
  });
  for (const status of [422, 500, 401, 0]) {
    await browser.evaluate(status => { Reflect.set(window, "__failureStatus", status); return true; }, status);
    await screen.getByRole("button", "إنشاء دفعة", { exact: true }).tap();
    await expect(browser.locator('.batch-create-form [role="alert"]')).toBeVisible();
    await expect(browser.locator('.batch-create-form .mutation-result')).toHaveCount(0);
    await expect(browser.locator('input[name="name"]')).toHaveValue("Keep manufacturing draft");
    await expect(browser.locator('tr[data-card-id] input[type="checkbox"]')).toBeChecked();
    await expectSameDocument(browser, before);
  }
  expect(await browser.evaluate(() => new Set(Reflect.get(window, "__retryKeys")).size)).toBe(1);
  await browser.locator('input[name="name"]').fill("Changed intent");
  await screen.getByRole("button", "إنشاء دفعة", { exact: true }).tap();
  await expect(browser.locator('.batch-create-form [role="alert"]')).toBeVisible();
  expect(await browser.evaluate(() => new Set(Reflect.get(window, "__retryKeys")).size)).toBe(2);
});

test("lost creation response retries one committed batch without a document reload", async ({ app, screen, browser }) => {
  test.skip(process.env.E2E_ALLOW_MUTATIONS !== "true", "Requires authorized synthetic mutations");
  await app.open("/login?lang=en");
  await screen.getByLabel("Email address").fill(credentials.user("owner").username);
  await screen.getByLabel("Password").fill(credentials.user("owner").password);
  await screen.getByRole("button", "Sign in securely").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);
  await app.open("/admin/cards");
  await browser.locator('input[name="name"]').fill(`Lost response fixture ${Date.now().toString(36)}`);
  await browser.locator('input[name="quantity"]').fill("1");
  const before = await markDocument(browser);
  await browser.evaluate(() => {
    const original = window.fetch.bind(window); let lose = true;
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      if (String(input) === "/api/admin/operations" && response.ok && lose) {
        lose = false;
        const result = await response.clone().json();
        Reflect.set(window, "__committedBatchHref", result.nextHref);
        throw new TypeError("Controlled response loss after commit");
      }
      return response;
    }; return true;
  });
  await screen.getByRole("button", "إنشاء دفعة", { exact: true }).tap();
  await expect(browser.locator('.batch-create-form [role="alert"]')).toBeVisible();
  await expectSameDocument(browser, before);
  const committedHref = await browser.evaluate(() => String(Reflect.get(window, "__committedBatchHref")));
  expect(committedHref).toMatch(/^\/admin\/cards\/batches\/[0-9a-f-]+\?created=1$/);
  await screen.getByRole("button", "إنشاء دفعة", { exact: true }).tap();
  await expect(browser).toHaveURL(committedHref);
  await expect(browser.locator("h1")).toBeVisible();
  await expectSameDocument(browser, before);
});
