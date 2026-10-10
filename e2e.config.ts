import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { assertSupabaseEnvironment } from "./src/lib/config/environment.mjs";

try { process.loadEnvFile(".env.local"); } catch { /* Environment may be injected by CI. */ }
assertSupabaseEnvironment({ ...process.env, NEXTAP_ENV: "test", VERCEL_ENV: undefined });

const node = process.execPath;
const productionServer = process.env.E2E_SERVER_MODE === "production";
const sentryDiagnostics = process.env.SENTRY_TEST_ERRORS_ENABLED === "1";
const env = {
  NEXTAP_BUILD_DIR: productionServer ? ".next" : ".next-e2e",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_e2e_placeholder",
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3137",
  NEXTAP_ENV: sentryDiagnostics ? "staging" : "test",
  SENTRY_DSN: process.env.SENTRY_DSN ?? "",
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "",
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT ?? (sentryDiagnostics ? "staging" : "test"),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? (sentryDiagnostics ? "staging" : "test"),
  SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? "nextap@e2e",
  NEXT_PUBLIC_SENTRY_RELEASE: process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? "nextap@e2e",
  SENTRY_TEST_ERRORS_ENABLED: sentryDiagnostics ? "1" : "0",
};
const app = {
  url: "http://127.0.0.1:3137",
  command: {
    executable: node,
    args: ["node_modules/next/dist/bin/next", productionServer ? "start" : "dev", "--hostname", "127.0.0.1", "--port", "3137"],
    cwd: process.cwd(),
    env,
    startupTimeout: 120_000,
    log: ".e2e/logs/app.log",
  },
};

export default {
  tests: "tests/e2e/**/*.e2e.ts",
  workers: 1,
  targets: [
    { name: "desktop", engine: web({ viewport: { width: 1440, height: 960 } }), app },
    { name: "mobile", engine: web({ viewport: { width: 390, height: 844 } }), app },
  ],
  credentials: {
    owner: {
      username: process.env.E2E_USER_OWNER_USERNAME ?? "",
      password: () => process.env.E2E_USER_OWNER_PASSWORD ?? "",
    },
  },
} satisfies E2EConfig;
