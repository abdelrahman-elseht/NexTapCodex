import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";

const node = process.execPath;
const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_e2e_placeholder",
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3127",
};
const app = {
  url: "http://127.0.0.1:3127",
  command: {
    executable: node,
    args: ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3127"],
    cwd: process.cwd(),
    env,
    startupTimeout: 120_000,
    log: ".e2e/logs/app.log",
  },
};

export default {
  tests: "tests/**/*.e2e.ts",
  workers: 1,
  targets: [
    { name: "desktop", engine: web({ viewport: { width: 1440, height: 960 } }), app },
    { name: "mobile", engine: web({ viewport: { width: 390, height: 844 } }), app },
  ],
} satisfies E2EConfig;
