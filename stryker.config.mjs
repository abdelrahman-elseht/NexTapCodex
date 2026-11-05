const config = {
  mutate: ["src/lib/business/public-publication.ts:47-60"],
  testFiles: ["tests/unit/public-publication.test.ts"],
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.config.ts",
    related: false,
  },
  coverageAnalysis: "all",
  reporters: ["clear-text", "json"],
  jsonReporter: {
    fileName: "reports/mutation/public-publication.json",
  },
  thresholds: {
    high: 95,
    low: 94,
    break: 94,
  },
  concurrency: 2,
  maxTestRunnerReuse: 1,
  timeoutMS: 10000,
  timeoutFactor: 2,
};

export default config;
