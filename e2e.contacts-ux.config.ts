import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
process.loadEnvFile(".env.local");
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://flkakuysakgwfoemgbwn.supabase.co" || process.env.NEXTAP_ENV !== "staging") throw new Error("Contacts UX tests require the dedicated Staging project.");
const env = { NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, NEXTAP_ENV: "staging", NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3137" };
export default {
  tests: "tests/e2e/contacts-ux.e2e.ts", workers: 1, timeout: 180_000,
  targets: [390, 1440].map(width => ({ name: String(width), engine: web({ viewport: { width, height: 960 } }), app: { url: "http://127.0.0.1:3137", command: { executable: process.execPath, args: ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3137"], env, log: ".e2e/logs/contacts-ux.log" } } })),
} satisfies E2EConfig;
