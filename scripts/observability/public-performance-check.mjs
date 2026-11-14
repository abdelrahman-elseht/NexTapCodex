#!/usr/bin/env node
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright-core";
import { PERFORMANCE_BUDGETS, summarizePerformanceReport } from "../quality/performance-budget.mjs";

const host = "127.0.0.1";
const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(0, host, () => {
    const address = probe.address();
    probe.close((error) => error ? reject(error) : resolve(address.port));
  });
});
const baseUrl = `http://${host}:${port}`;
const routes = ["/", "/demo"];
const repetitions = 3;
const output = process.env.PERFORMANCE_REPORT || ".e2e/performance/public-performance.json";
const environment = {
  ...process.env,
  NEXTAP_ENV: "test",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_performance_placeholder",
  NEXT_PUBLIC_SITE_URL: baseUrl,
};
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", host, "--port", String(port)], {
  cwd: process.cwd(), env: environment, stdio: "ignore",
});
server.once("error", (error) => process.stderr.write(`Could not start local Next.js server: ${error.message}\n`));
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js production server exited with code ${server.exitCode}.`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error("Next.js production server did not become ready within 30 seconds.");
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const samples = [];
  for (const route of routes) {
    for (let run = 1; run <= repetitions; run += 1) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 200_000,
        uploadThroughput: 100_000,
        connectionType: "cellular3g",
      });
      await page.addInitScript(() => {
        window.__performanceGate = { lcpMs: 0 };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__performanceGate.lcpMs = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      });
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "load", timeout: 90_000 });
      await page.waitForTimeout(1_000);
      const measured = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        const lcpMs = window.__performanceGate.lcpMs;
        const beforeLcp = resources.filter((entry) => entry.startTime <= lcpMs);
        const scripts = resources.filter((entry) => entry.initiatorType === "script" || /\.js(?:\?|$)/.test(entry.name));
        return {
          htmlBytes: navigation.encodedBodySize,
          totalBytes: navigation.transferSize + resources.reduce((sum, entry) => sum + entry.transferSize, 0),
          javascriptBytes: scripts.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
          requestsBeforeLcp: beforeLcp.length + 1,
          thirdPartyRequests: resources.filter((entry) => new URL(entry.name).origin !== location.origin).length,
          lcpMs,
          ttfbMs: navigation.responseStart - navigation.requestStart,
          viewportWidth: innerWidth,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      samples.push({ route, run, ...measured, status: response?.status() ?? 0 });
      await context.close();
    }
  }

  const report = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    browser: "Playwright Chromium",
    profile: { viewport: "390x844", cpuSlowdown: 4, network: "Slow 3G (150 ms, 200 KB/s down, 100 KB/s up)", cache: "disabled" },
    budgets: PERFORMANCE_BUDGETS,
    requiredRoutes: routes,
    samples,
    medians: routes.map((route) => {
      const routeSamples = samples.filter((sample) => sample.route === route);
      return Object.fromEntries([
        ["route", route],
        ...["htmlBytes", "totalBytes", "javascriptBytes", "requestsBeforeLcp", "lcpMs", "ttfbMs"].map((key) => [key, median(routeSamples.map((sample) => sample[key]))]),
      ]);
    }),
  };
  const result = summarizePerformanceReport(report);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  for (const summary of report.medians) process.stdout.write(`${summary.route}: LCP ${Math.round(summary.lcpMs)}ms, TTFB ${Math.round(summary.ttfbMs)}ms, HTML ${summary.htmlBytes}B, JS ${summary.javascriptBytes}B, requests before LCP ${summary.requestsBeforeLcp}.\n`);
  for (const error of result.errors) process.stderr.write(`FAIL ${error}\n`);
  if (!result.ok) process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
