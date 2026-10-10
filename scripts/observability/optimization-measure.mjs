// Deterministic isolated fixtures and repeatable production-mode lab evidence.
import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright-core";
process.loadEnvFile(".env.local");
const output = ".e2e/optimization-phase123";
await fs.mkdir(output, { recursive: true });
const cookieJar = new Map();
const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  cookies: { getAll: () => [...cookieJar.values()], setAll: values => values.forEach(value => cookieJar.set(value.name, value)) },
});
const { error: authError } = await client.auth.signInWithPassword({ email: process.env.E2E_USER_OWNER_USERNAME, password: process.env.E2E_USER_OWNER_PASSWORD });
if (authError) throw new Error("Isolated fixture owner login failed");
const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };
let fixture;
try { fixture = JSON.parse(await fs.readFile(`${output}/fixture.json`, "utf8")); } catch {
  const business = check(await client.from("businesses").insert({ name: "Optimization QA — illustrative fixture", category: "QA" }).select("id").single());
  const page = check(await client.from("business_pages").insert({ business_id: business.id, slug: "optimization-qa-phase123", template: "professional" }).select("id").single());
  const photo = "/payment-nfc.webp";
  const sections = [
    { kind: "hero", content: { language: "en", coverUrl: photo, logoUrl: photo, tagline: "Illustrative media and editor benchmark", location: "Cairo" } },
    { kind: "quick_actions", content: { columns: 4, items: [{ label: "Website", provider: "website", url: "https://example.com" }] } },
    { kind: "about", content: { description: "Deterministic test content. No customer information." } },
    { kind: "payments", content: { backgroundUrl: photo, items: [{ label: "Payment guidance", provider: "bank", value: "Ask the business" }] } },
    { kind: "contact", content: { address: "Illustrative Cairo location", mapsUrl: "https://maps.google.com/?q=Cairo", mapImageUrl: photo } },
    { kind: "gallery", content: { items: Array.from({ length: 100 }, (_, i) => ({ label: `Illustrative gallery ${i + 1}`, url: photo, enabled: true })) } },
  ];
  check(await client.from("page_sections").insert(sections.map((s, position) => ({ ...s, page_id: page.id, section_key: s.kind, title: s.kind, enabled: true, position }))));
  check(await client.rpc("publish_page", { target_page_id: page.id }));
  fixture = { businessId: business.id, pageId: page.id, slug: "optimization-qa-phase123" };
  await fs.writeFile(`${output}/fixture.json`, JSON.stringify(fixture));
}
if (process.argv[2] === "seed") { console.log("Isolated deterministic fixture ready"); process.exit(0); }
const pass = process.argv[2] || "before";
const base = process.env.OPTIMIZATION_BASE_URL || "http://127.0.0.1:3140";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];
for (const mobile of [false, true]) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 }, deviceScaleFactor: mobile ? 2 : 1 });
  await context.addCookies([...cookieJar.values()].filter(c => c.value).map(c => ({ name: c.name, value: c.value, domain: "127.0.0.1", path: "/", httpOnly: false, sameSite: "Lax" })));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  if (mobile) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 100000 });
  }
  await page.addInitScript(() => {
    window.lab = { lcp: 0, cls: 0, longTasks: [], interactions: [] };
    new PerformanceObserver(list => list.getEntries().forEach(e => window.lab.lcp = e.startTime)).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver(list => list.getEntries().forEach(e => { if (!e.hadRecentInput) window.lab.cls += e.value; })).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver(list => list.getEntries().forEach(e => window.lab.longTasks.push(e.duration))).observe({ type: "longtask", buffered: true });
    new PerformanceObserver(list => list.getEntries().forEach(e => { if (e.interactionId) window.lab.interactions.push(e.duration); })).observe({ type: "event", buffered: true, durationThreshold: 16 });
  });
  for (const [surface, path] of [["landing", "/"], ["demo", "/demo"], ["published", `/b/${fixture.slug}`], ["cards", "/admin/cards"], ["editor", `/admin/businesses/${fixture.businessId}`]]) {
    for (const cache of ["cold", "warm"]) for (let run = 0; run < 3; run++) {
      if (cache === "cold") await cdp.send("Network.clearBrowserCache");
      await page.goto(base + path, { waitUntil: "networkidle" });
      if (surface === "editor") {
        await page.getByLabel("Business name", { exact: true }).fill("Optimization QA — typing benchmark");
        await page.getByLabel("Business name", { exact: true }).pressSequentially(" typing responsiveness", { delay: 10 });
      }
      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        return { ...window.lab, ttfb: nav.responseStart - nav.requestStart, bytes: nav.transferSize + resources.reduce((sum, r) => sum + r.transferSize, 0), requests: resources.length + 1, dom: document.querySelectorAll("*").length, fonts: resources.filter(r => /\/fonts\//.test(r.name)).map(r => ({ name: r.name.split("/").pop(), bytes: r.transferSize })), images: resources.filter(r => /webp|_next\/image/.test(r.name)).map(r => ({ name: r.name.replace(location.origin, ""), bytes: r.transferSize })), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      rows.push({ surface, device: mobile ? "mobile" : "desktop", cache, run, ...metrics });
    }
    await page.screenshot({ path: `${output}/${pass}-${mobile ? "mobile" : "desktop"}-${surface}.png`, fullPage: true });
  }
  await context.close();
}
await browser.close();
await fs.writeFile(`${output}/${pass}-metrics.json`, JSON.stringify(rows, null, 2));
console.log(`Saved ${rows.length} production lab samples for ${pass}`);
