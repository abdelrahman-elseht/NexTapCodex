// Read-only staging investigation. Never write raw recipient URLs or browser traces.
import { chromium, webkit, devices } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { assertSupabaseEnvironment } from "../../src/lib/config/environment.mjs";
process.loadEnvFile(".env.local");
assertSupabaseEnvironment({ ...process.env, NEXTAP_ENV: "test", VERCEL_ENV: undefined });
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const { error: loginError } = await client.auth.signInWithPassword({ email: process.env.E2E_USER_OWNER_USERNAME, password: process.env.E2E_USER_OWNER_PASSWORD });
if (loginError) throw new Error("Staging sign-in failed");
const { data, error } = await client.from("page_sections").select("content").in("kind", ["payments", "quick_actions"]);
if (error) throw new Error("Staging read failed");
const destinations = [...new Set(data.flatMap(row => row.content.items || []).filter(item => item.provider === "instapay" && /^https:\/\/ipn\.eg\//.test(item.url || "")).map(item => item.url))];
await client.auth.signOut({ scope: "local" });
function shape(raw) {
  try { const url = new URL(raw); return { origin: url.origin, protocol: url.protocol, pathSegments: url.pathname.split("/").filter(Boolean).length, queryKeys: [...url.searchParams.keys()], hasFragment: !!url.hash }; }
  catch { return { invalid: true }; }
}
const report = { capturedAt: new Date().toISOString(), source: "existing staging destinations", nativeHandoffVerified: false, destinationCount: destinations.length, profiles: [] };
for (const [name, engine, device] of [["iPhone Safari / WebKit", webkit, "iPhone 13"], ["Android Chrome", chromium, "Pixel 7"]]) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const destination of destinations) {
      const context = await browser.newContext(devices[device]);
      const page = await context.newPage();
      const entry = { name, saved: shape(destination), responses: [], navigationCompleted: false };
      page.on("response", response => { if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) entry.responses.push({ status: response.status(), ...shape(response.url()) }); });
      try { await page.goto(destination, { waitUntil: "domcontentloaded", timeout: 30000 }); entry.navigationCompleted = true; }
      catch { entry.navigationError = "Navigation did not complete within the browser check; raw URL withheld."; }
      entry.final = shape(page.url());
      try {
        const ui = await page.evaluate(() => ({
          hasQr: !!document.querySelector('canvas, img[src*="qr" i], img[alt*="qr" i]'),
          links: Array.from(document.querySelectorAll("a[href]")).map(link => link.href),
        }));
        entry.hasQr = ui.hasQr;
        entry.linkShapes = ui.links.map(shape);
      } catch { entry.inspectionUnavailable = true; }
      report.profiles.push(entry);
      await context.close();
    }
  } finally { await browser.close(); }
}
await mkdir("artifacts/business-editor-reliability", { recursive: true });
await writeFile("artifacts/business-editor-reliability/instapay-redacted.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
