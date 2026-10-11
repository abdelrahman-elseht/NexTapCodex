import { chromium, webkit, devices } from "playwright-core";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import assert from "node:assert/strict";
import { assertSupabaseEnvironment } from "../../src/lib/config/environment.mjs";
process.loadEnvFile(".env.local");
assertSupabaseEnvironment({ ...process.env, NEXTAP_ENV: "test", VERCEL_ENV: undefined });
const root = "artifacts/business-editor-reliability";
await mkdir(root, { recursive: true });
const fixture = JSON.parse(await readFile(`${root}/fixture.json`, "utf8"));
const origin = process.env.RELIABILITY_BASE_URL || "http://127.0.0.1:3138";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error("Evidence requires a local server and an isolated fixture");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [], failures = [];
page.on("pageerror", () => errors.push("Browser JavaScript error"));
page.on("response", response => { if (response.url().startsWith(origin) && response.status() >= 400) failures.push({ status: response.status(), path: new URL(response.url()).pathname }); });
const report = { profiles: [], errors, failures };
let traceStarted = false;
try {
  await page.goto(`${origin}/login?lang=en`);
  await page.getByLabel("Email address").fill(process.env.E2E_USER_OWNER_USERNAME);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_USER_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(`${origin}/admin`, { timeout: 30000 });
  await page.goto(origin + fixture.editorPath);
  await page.getByRole("region", { name: "Live business editor" }).waitFor();
  // Record only the synthetic fixture. Authentication happens before tracing.
  await context.tracing.start({ screenshots: true, snapshots: true });
  traceStarted = true;
  await page.locator(".navigator-item").filter({ hasText: "Opening hours" }).click();
  const hours = page.locator(".editor-form-pane > .live-items-editor > .live-item-row");
  assert.equal(await hours.nth(0).getByLabel("Hours", { exact: true }).inputValue(), "09:00–17:00");
  await hours.nth(1).getByLabel("Hours", { exact: true }).fill("14:00–22:00");
  assert.equal(await hours.nth(0).getByLabel("Hours", { exact: true }).inputValue(), "09:00–17:00");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("status").filter({ hasText: /^Draft saved$/ }).waitFor();
  await page.reload();
  await page.locator(".navigator-item").filter({ hasText: "Opening hours" }).click();
  assert.equal(await hours.nth(0).getByLabel("Hours", { exact: true }).inputValue(), "09:00–17:00");
  assert.equal(await hours.nth(1).getByLabel("Hours", { exact: true }).inputValue(), "14:00–22:00");
  const privatePreview = await page.getByRole("link", { name: "\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0645\u0633\u0648\u062f\u0629", exact: true }).getAttribute("href");
  await page.goto(origin + privatePreview);
  await page.getByText("14:00\u201322:00", { exact: true }).waitFor();
  await page.goto(origin + fixture.editorPath);
  await page.locator(".navigator-item").filter({ hasText: "Opening hours" }).click();
  await page.locator(".visual-editor").screenshot({ path: `${root}/editor-desktop.png` });
  await page.locator(".editor-phone-screen").screenshot({ path: `${root}/simulator.png` });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("status").filter({ hasText: /^Published$/ }).waitFor();
  await page.goto(`${origin}/b/${fixture.slug}`);
  await page.getByText("14:00–22:00", { exact: true }).waitFor();
  await page.screenshot({ path: `${root}/public-desktop.png`, fullPage: true });
  await page.goto(origin + fixture.editorPath);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".navigator-item").filter({ hasText: "Opening hours" }).click();
  await page.locator(".editor-form-pane").screenshot({ path: `${root}/editor-mobile.png` });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.locator(".editor-phone-shell").screenshot({ path: `${root}/simulator-mobile.png` });
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  await page.locator(".navigator-item").filter({ hasText: "Hero" }).click();
  await page.getByLabel("Language").selectOption("ar");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("status").filter({ hasText: /^Published$/ }).waitFor();
  await page.goto(`${origin}/b/${fixture.slug}`);
  await page.locator('main[dir="rtl"]').waitFor();
  await page.screenshot({ path: `${root}/public-mobile-rtl.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await context.tracing.stop({ path: `${root}/editor-workflow.zip` });
  traceStarted = false;
  report.editorWorkflow = "passed: edit, save, reload, preview, publish and mobile RTL";
} finally {
  if (traceStarted) await context.tracing.stop({ path: `${root}/editor-workflow.zip` });
  await browser.close();
  // Playwright network traces include session headers. Strip them before delivery.
  const tracePath = `${root}/editor-workflow.zip`;
  const entries = unzipSync(await readFile(tracePath));
  const redact = value => {
    if (Array.isArray(value)) return value.map(redact);
    if (!value || typeof value !== "object") return value;
    if (typeof value.name === "string" && /^(cookie|set-cookie|authorization|apikey)$/i.test(value.name)) return { ...value, value: "<REDACTED>" };
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, /^(cookies|cookie|authorization|access_token|refresh_token)$/i.test(key) ? "<REDACTED>" : redact(entry)]));
  };
  for (const [name, bytes] of Object.entries(entries)) {
    if (!/\.(network|trace)$/.test(name)) continue;
    entries[name] = strToU8(strFromU8(bytes).split("\n").map(line => {
      if (!line.trim()) return line;
      return JSON.stringify(redact(JSON.parse(line)));
    }).join("\n"));
  }
  await writeFile(tracePath, zipSync(entries));
}
for (const [name, engine, device] of [["iPhone WebKit", webkit, "iPhone 13"], ["Android Chromium", chromium, "Pixel 7"]]) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext(devices[device]);
    const page = await context.newPage();
    await page.goto(`${origin}/b/${fixture.slug}`);
    const link = page.locator(".payment-grid a");
    const href = await link.getAttribute("href");
    assert.equal(href, "https://payments.example.test/verified-owner-link?token=synthetic-fixture");
    assert.equal(await link.getAttribute("target"), null);
    await page.locator(".payment-link-help summary").click();
    assert.equal(await page.locator(".payment-link-help").getAttribute("open"), "");
    await page.route("https://payments.example.test/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Provider fixture</h1>" }));
    await link.click();
    await page.waitForURL(href);
    report.profiles.push({ name, directLink: true, queryPreserved: true, fallbackAccessible: true, nativeHandoffVerified: false });
  } finally { await browser.close(); }
}
assert.deepEqual(errors, []);
assert.deepEqual(failures, []);
await writeFile(`${root}/browser-evidence.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
