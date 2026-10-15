import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertSupabaseEnvironment } from "../../src/lib/config/environment.mjs";
import { verifyDeployment } from "./verify-hosted-deployment.mjs";

if (process.argv.includes("--verify-deployment-only")) {
  await verifyDeployment();
  process.exit(0);
}

assertSupabaseEnvironment({ ...process.env, NEXTAP_ENV: "staging", VERCEL_ENV: "preview" });
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://flkakuysakgwfoemgbwn.supabase.co") {
  throw new Error("Hosted acceptance requires the dedicated Staging Supabase project.");
}
if (process.env.E2E_BASE_URL !== "https://staging.nextap.services") {
  throw new Error("Hosted CI must target the stable Staging origin.");
}
for (const name of ["VERCEL_AUTOMATION_BYPASS_SECRET", "E2E_USER_OWNER_USERNAME", "E2E_USER_OWNER_PASSWORD", "E2E_USER_NON_OWNER_USERNAME", "E2E_USER_NON_OWNER_PASSWORD"]) {
  if (!process.env[name]?.trim()) throw new Error(`Missing protected Staging secret: ${name}`);
}
await verifyDeployment({ wait: true });
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.auth.signInWithPassword({
  email: process.env.E2E_USER_OWNER_USERNAME, password: process.env.E2E_USER_OWNER_PASSWORD,
});
if (error || !data.user) throw new Error("Protected Staging owner credentials could not authenticate.");
try {
  const owner = await client.from("owner_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (owner.error || !owner.data) throw new Error("The Staging Auth user is not on the owner allowlist.");

  // This is a no-write schema probe. A deployed app can authenticate while a
  // required RPC migration is still absent; PostgREST reports that as PGRST202.
  // Null input must reach the function and return its own validation code.
  const adminPageProbe = await client.rpc("create_admin_page", {
    request_key: null,
    details: null,
    seeds: null,
  });
  if (!adminPageProbe.error || adminPageProbe.error.code !== "22023") {
    throw new Error(`Staging schema probe failed for create_admin_page (${adminPageProbe.error?.code || "no error"}).`);
  }
} finally {
  await client.auth.signOut({ scope: "local" });
}

if (process.env.E2E_ALLOW_MUTATIONS !== "true") {
  if (!process.env.E2E_FIXTURE_JSON) throw new Error("Set the Staging environment variable E2E_FIXTURE_JSON.");
  const fixture = JSON.parse(process.env.E2E_FIXTURE_JSON);
  const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  if (!/^preprod-media-[a-z0-9-]+$/.test(fixture.slug) ||
      !["businessId", "pageId", "batchId"].every(key => uuid.test(fixture[key]))) {
    throw new Error("Hosted CI requires a namespaced synthetic fixture with valid IDs.");
  }
  const destination = process.env.E2E_FIXTURE_PATH;
  if (destination !== "artifacts/hosted-staging/fixture.json") throw new Error("Unexpected hosted fixture path.");
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, JSON.stringify({ businessId: fixture.businessId, pageId: fixture.pageId, batchId: fixture.batchId, slug: fixture.slug }));
}
const response = await fetch(process.env.E2E_BASE_URL, {
  headers: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET },
  redirect: "manual",
});
if (response.status !== 200) {
  throw new Error(`Staging protection preflight returned HTTP ${response.status}; verify the bypass secret.`);
}
console.log("Staging origin, isolated Supabase, protected credentials and synthetic fixture preflight passed.");
