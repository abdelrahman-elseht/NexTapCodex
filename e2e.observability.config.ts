import type { E2EConfig } from "e2e";
import base from "./e2e.config";

// Connect to the separately started production build. No mutation suites are selected.
export default {
  ...base,
  tests: ["tests/e2e/public-journey.e2e.ts", "tests/e2e/public-security.e2e.ts", "tests/e2e/observability-baseline.e2e.ts"],
  retries: 0,
  targets: base.targets.map(target => ({
    ...target,
    app: { url: "http://127.0.0.1:3147" },
  })),
} satisfies E2EConfig;
