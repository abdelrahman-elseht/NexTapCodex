const config = {
  mutate: ["src/lib/admin/card-inventory.ts:17-35"],
  testFiles: ["tests/unit/card-inventory.test.ts"],
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.config.ts",
    related: false,
  },
  coverageAnalysis: "all",
  reporters: ["clear-text", "json"],
  jsonReporter: {
    fileName: "reports/mutation/card-inventory.json",
  },
  thresholds: {
    high: 100,
    low: 99,
    break: 100,
  },
  concurrency: 2,
  maxTestRunnerReuse: 1,
  timeoutMS: 10000,
  timeoutFactor: 2,
};

export default config;
