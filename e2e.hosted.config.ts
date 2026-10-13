import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { assertSupabaseEnvironment } from "./src/lib/config/environment.mjs";

try { process.loadEnvFile(".env.local"); } catch { /* CI injects the values. */ }

const baseUrl = process.env.E2E_BASE_URL ?? "https://staging.nextap.services";
const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== "https:") {
  throw new Error("Hosted E2E requires an HTTPS E2E_BASE_URL.");
}

assertSupabaseEnvironment({
  ...process.env,
  NEXTAP_ENV: "staging",
  VERCEL_ENV: "preview",
});

const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const protectionHeaders = protectionBypass
  // The e2e web engine currently types site headers as strings. Keep this
  // value in protected CI secrets and restrict hosted trace artifacts.
  ? { "x-vercel-protection-bypass": protectionBypass }
  : undefined;

const target = (name: string, width: number, height: number) => ({
  name,
  engine: web({
    viewport: { width, height },
    headers: protectionHeaders,
  }),
  app: {
    url: baseUrl,
    environment: "staging" as const,
    identity: "nextap-staging",
  },
});

export default {
  tests: "tests/e2e/**/*.e2e.ts",
  workers: 1,
  targets: [target("desktop", 1440, 960), target("mobile", 390, 844)],
  credentials: {
    owner: {
      username: process.env.E2E_USER_OWNER_USERNAME ?? "",
      password: () => process.env.E2E_USER_OWNER_PASSWORD ?? "",
    },
  },
} satisfies E2EConfig;
