import { createPublicClient } from "@/lib/supabase/public";
import { serializeVCard } from "./vcard";
import type { ContactProjection } from "./contact";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const contactHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer",
};
export function contactError(status: number, head = false) {
  return new Response(head ? null : status === 404 ? "Not found" : "Service unavailable", { status, headers: { ...contactHeaders, "Content-Type": "text/plain; charset=utf-8" } });
}
/** Only immutable precomputed objects from this application's bucket, with a byte/time budget. */
export async function readContactPhoto(path?: string): Promise<Uint8Array | undefined> {
  if (!path || !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}(?:\.crop-\d{1,4}-\d{1,4}-\d{4})?\.contact\.jpg$/i.test(path)) return;
  try {
    const origin = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const response = await fetch(`${origin}/storage/v1/object/public/business-media/${path}`, { cache: "no-store", signal: AbortSignal.timeout(3000), redirect: "error" });
    if (!response.ok || Number(response.headers.get("content-length")) > 200 * 1024) return;
    const reader = response.body?.getReader(); if (!reader) return;
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 200 * 1024) { await reader.cancel(); return; } chunks.push(chunk.value); }
    const bytes = Buffer.concat(chunks);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return;
    return bytes;
  } catch { return; }
}
export async function contactResponse(contact: ContactProjection, head = false, attachment = false) {
  const body = serializeVCard(contact, head ? undefined : await readContactPhoto(contact.photoPath));
  return new Response(head ? null : body, { headers: { ...contactHeaders, "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="business-contact.vcf"` } });
}
/** No publication cache or rollout fallback: each request checks current eligibility. */
export async function downloadContact(identity: { slug: string } | { token: string }, head = false, attachment = false) {
  try {
    const client = createPublicClient();
    const token = "token" in identity;
    if (token ? !/^[A-Za-z0-9_-]{32,64}$/.test(identity.token) : !/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(identity.slug)) return contactError(404, head);
    const budget = consumeRateLimit("contact-download", token ? identity.token : identity.slug, { max: 60, windowMs: 60_000, maxKeys: 2048 });
    if (!budget.allowed) return contactError(429, head);
    const { data, error } = token
      ? await client.rpc("get_card_contact", { card_token: identity.token })
      : await client.rpc("get_published_page", { page_slug: identity.slug });
    if (error) return contactError(503, head);
    const contact = token ? data : data?.contact;
    if (contact?.version !== 1 || contact.enabled !== true) return contactError(404, head);
    return await contactResponse(contact, head, attachment);
  } catch { return contactError(503, head); }
}
