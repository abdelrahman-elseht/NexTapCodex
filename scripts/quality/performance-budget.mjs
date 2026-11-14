#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PERFORMANCE_BUDGETS = {
  htmlBytes: 15 * 1024,
  totalBytes: 1_500 * 1024,
  javascriptBytes: 180 * 1024,
  requestsBeforeLcp: 32,
  thirdPartyRequests: 0,
  routes: {
    "/": { requestsBeforeLcp: 18, totalBytes: 400 * 1024 },
    "/demo": { requestsBeforeLcp: 32, totalBytes: 340 * 1024 },
  },
};

export function checkPerformanceSample(sample, budgets = PERFORMANCE_BUDGETS) {
  const errors = [];
  const routeBudgets = { ...budgets, ...budgets.routes?.[sample.route] };
  for (const key of ["htmlBytes", "totalBytes", "javascriptBytes", "requestsBeforeLcp", "thirdPartyRequests"]) {
    if (!Number.isFinite(sample[key])) errors.push(`${sample.route}: missing numeric ${key}.`);
    else if (sample[key] > routeBudgets[key]) errors.push(`${sample.route}: ${key} ${sample[key]} exceeds ${routeBudgets[key]}.`);
  }
  if (sample.status < 200 || sample.status >= 400) errors.push(`${sample.route}: returned HTTP ${sample.status}.`);
  if (sample.overflow) errors.push(`${sample.route}: horizontal overflow at ${sample.viewportWidth}px.`);
  if (sample.lcpMs <= 0) errors.push(`${sample.route}: LCP was not observed.`);
  return { ok: errors.length === 0, errors };
}

export function summarizePerformanceReport(report, budgets = PERFORMANCE_BUDGETS) {
  const errors = [];
  if (report.schemaVersion !== 1 || !Array.isArray(report.samples) || report.samples.length === 0) {
    return { ok: false, errors: ["Performance report must use schemaVersion 1 and include samples."] };
  }
  const routes = new Set();
  for (const sample of report.samples) {
    routes.add(sample.route);
    errors.push(...checkPerformanceSample(sample, budgets).errors);
  }
  for (const required of report.requiredRoutes ?? []) {
    if (!routes.has(required)) errors.push(`Performance report is missing required route ${required}.`);
  }
  return { ok: errors.length === 0, errors };
}

function main() {
  const reportPath = process.argv[2];
  if (!reportPath) throw new Error("Usage: node scripts/quality/performance-budget.mjs <report.json>");
  const report = JSON.parse(fs.readFileSync(path.resolve(reportPath), "utf8"));
  const result = summarizePerformanceReport(report);
  for (const error of result.errors) process.stderr.write(`FAIL ${error}\n`);
  if (result.ok) process.stdout.write(`Performance budgets passed for ${report.samples.length} sample(s).\n`);
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
