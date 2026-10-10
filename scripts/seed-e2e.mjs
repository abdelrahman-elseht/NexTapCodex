// Creates only uniquely named test data on the approved non-production project.
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertSupabaseEnvironment } from "../lib/environment.mjs";
try { process.loadEnvFile(".env.local"); } catch { /* CI injects variables. */ }
assertSupabaseEnvironment({ ...process.env, NEXTAP_ENV: "test", VERCEL_ENV: undefined });
if (process.env.E2E_ALLOW_MUTATIONS !== "true") throw new Error("E2E_ALLOW_MUTATIONS=true is required to seed test data.");
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };
check(await client.auth.signInWithPassword({ email: process.env.E2E_USER_OWNER_USERNAME, password: process.env.E2E_USER_OWNER_PASSWORD }));
try {
  const slug = `preprod-media-${Date.now().toString(36)}`;
  const business = check(await client.from("businesses").insert({ name: "Preprod QA illustrative media", category: "QA" }).select("id").single());
  const page = check(await client.from("business_pages").insert({ business_id: business.id, slug, template: "professional" }).select("id").single());
  const photo = "/payment-nfc.webp";
  const sections = [
    { kind: "hero", content: { language: "en", coverUrl: photo, logoUrl: photo, tagline: "Illustrative preprod fixture" } },
    { kind: "quick_actions", content: { columns: 4, items: [{ label: "Website", provider: "website", url: "https://example.com" }] } },
    { kind: "about", content: { description: "Test content. No customer information." } },
    { kind: "payments", content: { backgroundUrl: photo, items: [{ label: "Payment guidance", provider: "bank", value: "Ask the business" }] } },
    { kind: "contact", content: { address: "Illustrative Cairo location", mapsUrl: "https://maps.google.com/?q=Cairo", mapImageUrl: photo } },
    { kind: "gallery", content: { items: Array.from({ length: 100 }, (_, i) => ({ label: `Illustrative gallery ${i + 1}`, url: photo, enabled: true })) } },
  ];
  check(await client.from("page_sections").insert(sections.map((s, position) => ({ ...s, page_id: page.id, section_key: s.kind, title: s.kind, enabled: true, position }))));
  check(await client.rpc("publish_page", { target_page_id: page.id }));
  const batch = check(await client.rpc("create_card_batch", {
    batch_name: `Preprod fixture ${slug}`, card_quantity: 1,
    request_key: randomUUID(), card_tokens: [randomBytes(24).toString("base64url")],
  }));
  const output = process.env.E2E_FIXTURE_PATH || "artifacts/preprod-fixture.json";
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ businessId: business.id, pageId: page.id, batchId: batch.id, slug }));
  console.log(`Created non-production fixture: ${output}`);
} finally {
  await client.auth.signOut({ scope: "local" });
}
