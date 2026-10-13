// Read-only production-build lab audit. Credentials and card tokens stay in memory.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright-core";
import { assertSupabaseEnvironment } from "../../src/lib/config/environment.mjs";

process.loadEnvFile(".env.local");
assertSupabaseEnvironment({ ...process.env, NEXTAP_ENV: "test", VERCEL_ENV: undefined });
const base = "http://127.0.0.1:3147";
const output = "artifacts/observability-baseline";
const fixture = JSON.parse(await fs.readFile(process.env.AUDIT_FIXTURE_PATH || ".env.audit-fixture.json", "utf8"));
if (!/^preprod-media-/.test(fixture.slug)) throw new Error("Use the existing synthetic preprod fixture.");
await fs.mkdir(output, { recursive: true });
const jar = new Map();
const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  cookies: { getAll: () => [...jar.values()], setAll: values => values.forEach(value => jar.set(value.name, value)) },
});
const { error: authError } = await client.auth.signInWithPassword({
  email: process.env.E2E_USER_OWNER_USERNAME, password: process.env.E2E_USER_OWNER_PASSWORD,
});
if (authError) throw new Error("Staging QA authentication failed.");
const { data: business, error: businessError } = await client.from("businesses").select("name").eq("id", fixture.businessId).single();
if (businessError || !business?.name) throw new Error("Expected synthetic business not found.");
const { data: fixturePage, error: fixturePageError } = await client.from("business_pages")
  .select("slug,business_id").eq("id", fixture.pageId).single();
if (fixturePageError || fixturePage?.slug !== fixture.slug || fixturePage.business_id !== fixture.businessId) {
  throw new Error("Synthetic page does not match the recorded fixture.");
}
const { data: cards, error: cardError } = await client.from("cards").select("token,status,page_id").eq("batch_id", fixture.batchId);
if (cardError || cards?.length !== 1) throw new Error("Expected one dedicated synthetic card.");
const card = cards[0];
if (card.page_id !== fixture.pageId || card.status !== "active") throw new Error("Synthetic card must already be active on the fixture; this audit will not assign it.");
const cookies = () => [...jar.values()].filter(cookie => cookie.value).map(cookie => ({
  name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", sameSite: "Lax",
}));
function safeUrl(value) {
  try {
    const url = new URL(value, base);
    url.pathname = url.pathname.replace(/\/c\/[^/]+/g, "/c/[redacted]")
      .replace(/(\/admin\/businesses\/)[0-9a-f-]{36}/g, "$1[id]");
    const query = new URLSearchParams();
    for (const key of ["w", "q", "via"]) if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key));
    if (url.pathname === "/_next/image") query.set("url", "[image]");
    return `${url.origin === base ? "" : url.origin}${url.pathname}${query.size ? `?${query}` : ""}`;
  } catch { return "[invalid URL]"; }
}
const routes = [
  ["landing", "/", false], ["published", `/b/${fixture.slug}`, false], ["login", "/login", false],
  ["dashboard", "/admin", true], ["editor", `/admin/businesses/${fixture.businessId}`, true],
];
const mode = process.argv[2] || "lab";
let browser;
let profile;
try {
  if (mode === "lab") {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const rows = [];
    const redirects = [];
    for (let run = 1; run <= 3; run++) {
      const start = performance.now();
      const response = await fetch(`${base}/c/${card.token}?via=nfc`, { redirect: "manual" });
      const location = response.headers.get("location");
      if (response.status !== 302 || location !== `/b/${fixture.slug}?via=nfc`) throw new Error("Synthetic card redirect failed.");
      redirects.push({ run, route: "/c/[token]?via=nfc", status: response.status, location, durationMs: performance.now() - start,
        cacheControl: response.headers.get("cache-control"), referrerPolicy: response.headers.get("referrer-policy") });
    }
    for (const device of ["mobile", "desktop"]) {
      for (const [surface, route, authenticated] of routes) {
        const context = await browser.newContext({
          viewport: device === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 960 },
          deviceScaleFactor: device === "mobile" ? 2 : 1, isMobile: device === "mobile", hasTouch: device === "mobile",
        });
        if (authenticated) await context.addCookies(cookies());
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        if (device === "mobile") {
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
          await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 100000 });
        }
        await page.addInitScript(() => {
          window.__audit = { lcpMs: 0, cls: 0, longTasks: [], interactions: [] };
          new PerformanceObserver(list => list.getEntries().forEach(entry => { window.__audit.lcpMs = entry.startTime; }))
            .observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver(list => list.getEntries().forEach(entry => { if (!entry.hadRecentInput) window.__audit.cls += entry.value; }))
            .observe({ type: "layout-shift", buffered: true });
          new PerformanceObserver(list => list.getEntries().forEach(entry => window.__audit.longTasks.push(entry.duration)))
            .observe({ type: "longtask", buffered: true });
          new PerformanceObserver(list => list.getEntries().forEach(entry => { if (entry.interactionId) window.__audit.interactions.push(entry.duration); }))
            .observe({ type: "event", buffered: true, durationThreshold: 16 });
        });
        let problems = [];
        page.on("pageerror", error => problems.push({ type: "pageerror", message: error.message.slice(0, 300) }));
        page.on("console", message => { if (message.type() === "error") problems.push({ type: "console", message: message.text().slice(0, 300) }); });
        page.on("requestfailed", request => problems.push({ type: "requestfailed", url: safeUrl(request.url()), error: request.failure()?.errorText }));
        page.on("response", response => { if (response.status() >= 400) problems.push({ type: "http", url: safeUrl(response.url()), status: response.status() }); });
        for (const cache of ["cold", "warm"]) {
          problems = [];
          if (cache === "cold") await cdp.send("Network.clearBrowserCache");
          const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
          if (response?.status() !== 200 || new URL(page.url()).pathname !== route) throw new Error(`Wrong response for ${surface}.`);
          if (surface === "editor") await page.getByLabel("Business name", { exact: true }).waitFor();
          const metrics = await page.evaluate(() => {
            const nav = performance.getEntriesByType("navigation")[0];
            const resources = performance.getEntriesByType("resource");
            return { ...window.__audit, ttfbMs: nav.responseStart - nav.requestStart,
              transferBytes: nav.transferSize + resources.reduce((sum, item) => sum + item.transferSize, 0),
              requests: resources.length + 1, domElements: document.querySelectorAll("*").length,
              lang: document.documentElement.lang, dir: document.documentElement.dir, viewport: innerWidth,
              contentWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > innerWidth,
              brokenImages: [...document.images].filter(image => image.complete && image.naturalWidth === 0).length,
              resources: resources.map(item => ({ url: item.name, initiatorType: item.initiatorType, transferBytes: item.transferSize,
                encodedBytes: item.encodedBodySize, durationMs: item.duration })) };
          });
          metrics.resources = metrics.resources.map(item => ({ ...item, url: safeUrl(item.url) }));
          rows.push({ surface, route: safeUrl(route), device, cache, status: response.status(),
            cacheControl: response.headers()["cache-control"], ...metrics, problems: [...problems] });
        }
        if (surface === "editor") {
          let mutations = 0;
          await page.route("**/api/admin/**", route => {
            if (route.request().method() !== "GET") { mutations++; return route.abort(); }
            return route.continue();
          });
          await page.getByLabel("Business name", { exact: true }).fill("Observability QA local preview");
          if (device === "mobile") await page.getByRole("button", { name: "Preview", exact: true }).click();
          await page.locator(".editor-phone-screen").getByRole("heading", { name: "Observability QA local preview", exact: true }).waitFor();
          const interactions = await page.evaluate(() => ({ durationsMs: window.__audit.interactions,
            previewVisible: document.querySelector(".editor-preview-pane").getBoundingClientRect().width > 0,
            previewBusy: document.querySelector(".editor-preview-pane").getAttribute("aria-busy") }));
          rows.push({ surface: "editor-interaction", device, mutations, ...interactions });
        }
        await page.screenshot({ path: `${output}/${device}-${surface}.png`, fullPage: true });
        await context.close();
        console.log(`Lab captured ${device} ${surface}`);
      }
    }
    await fs.writeFile(`${output}/lab.json`, JSON.stringify({ date: new Date().toISOString(), base, fixtureSlug: fixture.slug,
      mobileThrottling: { cpu: 4, latencyMs: 150, downloadBytesPerSecond: 200000, uploadBytesPerSecond: 100000 }, redirects, rows }, null, 2));
  } else if (mode === "lighthouse") {
    const modulePath = process.env.AUDIT_LIGHTHOUSE_MODULE || "artifacts/observability-tools/node_modules/lighthouse/core/index.js";
    const { default: lighthouse } = await import(pathToFileURL(path.resolve(modulePath)).href);
    profile = await fs.mkdtemp(path.join(os.tmpdir(), "nextap-observability-"));
    browser = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true, args: ["--remote-debugging-port=9157"] });
    const summaries = [];
    for (const device of ["mobile", "desktop"]) {
      for (const [surface, route, authenticated] of routes) {
        if (authenticated) await browser.addCookies(cookies());
        else await browser.clearCookies();
        const repetitions = ["landing", "published"].includes(surface) ? 3 : 1;
        for (let run = 1; run <= repetitions; run++) {
          const result = await lighthouse(`${base}${route}`, {
            port: 9157, output: ["json", "html"], logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
            formFactor: device, disableStorageReset: authenticated,
            ...(device === "desktop" ? { screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
              throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 } } : {}),
          });
          const lhr = result.lhr;
          if (lhr.runtimeError) throw new Error(`Lighthouse failed for ${surface}: ${lhr.runtimeError.code}`);
          if (new URL(lhr.finalDisplayedUrl).pathname !== route) throw new Error(`Lighthouse measured a redirect instead of ${surface}.`);
          const stem = `${output}/lighthouse-${device}-${surface}-${run}`;
          await fs.writeFile(`${stem}.json`, result.report[0]);
          await fs.writeFile(`${stem}.html`, result.report[1]);
          summaries.push({ surface, route: safeUrl(route), device, run, lighthouseVersion: lhr.lighthouseVersion,
            fetchTime: lhr.fetchTime, configSettings: lhr.configSettings,
            scores: Object.fromEntries(Object.entries(lhr.categories).map(([key, value]) => [key, value.score === null ? null : Math.round(value.score * 100)])),
            lcpMs: lhr.audits["largest-contentful-paint"].numericValue, cls: lhr.audits["cumulative-layout-shift"].numericValue,
            tbtMs: lhr.audits["total-blocking-time"].numericValue, ttfbMs: lhr.audits["server-response-time"]?.numericValue,
            bytes: lhr.audits["total-byte-weight"].numericValue,
            findings: Object.values(lhr.audits).filter(audit => audit.score !== null && audit.score < 1 && audit.scoreDisplayMode !== "informative")
              .map(audit => ({ id: audit.id, title: audit.title, score: audit.score, displayValue: audit.displayValue })),
            warnings: lhr.runWarnings });
          await fs.writeFile(`${output}/lighthouse-summary.json`, JSON.stringify(summaries, null, 2));
          console.log(`${device} ${surface} ${run}: ${JSON.stringify(summaries.at(-1).scores)}`);
        }
      }
    }
  } else throw new Error("Use lab or lighthouse mode.");
} finally {
  await browser?.close();
  if (profile && path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith("nextap-observability-")) {
    await fs.rm(profile, { recursive: true, force: true });
  }
  await client.auth.signOut({ scope: "local" });
}
