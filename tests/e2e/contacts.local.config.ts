import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Never load .env.local: this checkout may contain hosted settings.
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:56321") throw new Error("Contacts E2E requires the isolated Supabase URL http://127.0.0.1:56321.");
if (process.env.E2E_SERVER_MODE !== "production") throw new Error("Contacts E2E requires E2E_SERVER_MODE=production and a fresh locally configured production build.");
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export default {
  tests: "contacts.e2e.ts", workers: 1,
  targets: [390, 1440].map(width => ({name: String(width), engine: web({viewport:{width,height:960}}), app:{url:"http://127.0.0.1:3137",command:{executable:process.execPath,args:["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3137"],cwd:repoRoot,env:{NEXTAP_ENV:"test",NEXT_PUBLIC_SITE_URL:"http://127.0.0.1:3137",NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL || "",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",E2E_SERVER_MODE:"production"},log:".e2e/logs/contacts.log"}}})),
  credentials:{owner:{username:process.env.E2E_USER_OWNER_USERNAME||"",password:()=>process.env.E2E_USER_OWNER_PASSWORD||""}},
} satisfies E2EConfig;
