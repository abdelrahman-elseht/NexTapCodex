// Read-only owner audit. Never deletes; every historical publication is retained.
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await supabase.auth.signInWithPassword({ email: process.env.E2E_USER_OWNER_USERNAME, password: process.env.E2E_USER_OWNER_PASSWORD });
if (error) throw new Error("An authorized owner login is required for auditing");
async function all(table, columns) {
  const rows = [];
  for (let start = 0;; start += 500) {
    const { data, error } = await supabase.from(table).select(columns).order("id").range(start, start + 499);
    if (error) throw new Error(`Audit incomplete: cannot read ${table}. No candidates are safe.`);
    rows.push(...data); if (data.length < 500) return rows;
  }
}
const [assets, drafts, publications] = await Promise.all([all("media_assets", "id,storage_path,created_at,size_bytes"), all("page_sections", "id,content"), all("page_publications", "id,snapshot")]);
const referenced = new Set();
function visit(value) {
  if (typeof value === "string") {
    const marker = "/storage/v1/object/public/business-media/";
    if (value.includes(marker)) { try { referenced.add(decodeURIComponent(value.split(marker)[1].split("?")[0])); } catch { throw new Error("Audit incomplete: malformed media reference."); } }
  } else if (value && typeof value === "object") Object.values(value).forEach(visit);
}
drafts.forEach(row => visit(row.content)); publications.forEach(row => visit(row.snapshot));
const grace = Date.now() - 7 * 86400000;
const candidates = assets.filter(asset => !referenced.has(asset.storage_path) && Date.parse(asset.created_at) < grace);
console.log(JSON.stringify({ readOnly: true, graceDays: 7, scannedAssets: assets.length, scannedDrafts: drafts.length, scannedPublications: publications.length, candidates }, null, 2));
// Storage-only objects (e.g. failed cleanup) need a separately paged bucket listing.
// This report intentionally makes no deletion recommendation for unregistered paths.
