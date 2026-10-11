import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import base from "./e2e.config";

export default {
  ...base,
  tests: "tests/e2e/editor-reliability.e2e.ts",
  targets: [{
    name: "ios-webkit",
    engine: web({ browser: "webkit", viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" }),
    app: base.targets[0].app,
  }],
} satisfies E2EConfig;
