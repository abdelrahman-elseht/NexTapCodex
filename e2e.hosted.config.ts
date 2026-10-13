import type { E2EConfig } from "e2e";
import { hostedBrowser } from "./scripts/ci/hosted-browser";
import { assertSupabaseEnvironment } from "./src/lib/config/environment.mjs";

try { process.loadEnvFile(".env.local"); } catch { /* CI injects the values. */ }

const baseUrl = process.env.E2E_BASE_URL ?? "https://staging.nextap.services";
const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== "https:" || parsedBaseUrl.port || parsedBaseUrl.username || parsedBaseUrl.password ||
    parsedBaseUrl.pathname !== "/" || parsedBaseUrl.search || parsedBaseUrl.hash ||
    parsedBaseUrl.hostname !== "staging.nextap.services") {
  throw new Error("Hosted E2E requires the stable Staging origin.");
}

assertSupabaseEnvironment({
  ...process.env,
  NEXTAP_ENV: "staging",
  VERCEL_ENV: "preview",
});

const target = (name: string, width: number, height: number) => ({
  name,
  engine: hostedBrowser(parsedBaseUrl.origin, { width, height }),
  app: {
    url: baseUrl,
    environment: "staging" as const,
    identity: "nextap-staging",
  },
});

export default {
  tests: "tests/e2e/**/*.e2e.ts",
  trace: "off",
  video: "off",
  workers: 1,
  targets: [target("desktop", 1440, 960), target("mobile", 390, 844)],
  credentials: {
    owner: {
      username: process.env.E2E_USER_OWNER_USERNAME ?? "",
      password: () => process.env.E2E_USER_OWNER_PASSWORD ?? "",
    },
  },
} satisfies E2EConfig;
