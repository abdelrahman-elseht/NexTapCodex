import { describe, expect, it } from "vitest";
import { checkPerformanceSample, summarizePerformanceReport } from "../../scripts/quality/performance-budget.mjs";

const passingSample = {
  route: "/",
  status: 200,
  htmlBytes: 7_000,
  totalBytes: 400_000,
  javascriptBytes: 110_000,
  requestsBeforeLcp: 12,
  thirdPartyRequests: 0,
  lcpMs: 3_000,
  ttfbMs: 500,
  viewportWidth: 390,
  overflow: false,
};

describe("public performance budgets", () => {
  it("accepts a valid sample within the page-weight, request, and layout budgets", () => {
    expect(checkPerformanceSample(passingSample)).toEqual({ ok: true, errors: [] });
  });

  it("reports every exceeded budget and a broken or overflowing route", () => {
    const result = checkPerformanceSample({
      ...passingSample,
      status: 500,
      htmlBytes: 20_000,
      totalBytes: 2_000_000,
      javascriptBytes: 200_000,
      requestsBeforeLcp: 20,
      thirdPartyRequests: 1,
      overflow: true,
    });
    expect(result.errors).toHaveLength(7);
  });

  it("uses route-specific budgets for distinct public surfaces", () => {
    expect(checkPerformanceSample({ ...passingSample, route: "/demo", totalBytes: 300_000, requestsBeforeLcp: 27 }).ok).toBe(true);
    expect(checkPerformanceSample({ ...passingSample, requestsBeforeLcp: 19 }).errors).toContain("/: requestsBeforeLcp 19 exceeds 18.");
  });

  it("requires complete samples for each route under the report contract", () => {
    expect(summarizePerformanceReport({
      schemaVersion: 1,
      requiredRoutes: ["/", "/demo"],
      samples: [passingSample],
    })).toMatchObject({ ok: false, errors: ["Performance report is missing required route /demo."] });
  });
});
