import { createClient } from "@/lib/supabase/server";
import { compileContact, contactConfigSchema } from "@/lib/business/contact";
import { contactError, contactResponse } from "@/lib/business/contact-download";
import { resolveContactPhoto } from "@/lib/media/resolve-contact-photo";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const expectedOrigin = `${requestUrl.protocol}//${request.headers.get("host") || requestUrl.host}`;
  if (request.headers.get("origin") !== expectedOrigin) return contactError(404);
  try {
    const client = await createClient();
    const { data: claims, error } = await client.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (error || !userId) return contactError(404);
    const { data: owner } = await client.from("owner_users").select("user_id").eq("user_id", userId).maybeSingle();
    if (!owner) return contactError(404);
    if (Number(request.headers.get("content-length")) > 256 * 1024) return contactError(404);
    const reader = request.body?.getReader();
    if (!reader) return contactError(404);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 256 * 1024) { await reader.cancel(); return contactError(404); }
      chunks.push(chunk.value);
    }
    const bounded = new Request(request.url, { method: "POST", headers: request.headers, body: Buffer.concat(chunks) });
    const form = await bounded.formData();
    const draft = JSON.parse(String(form.get("draft") || "{}"));
    const { data: page } = await client.from("business_pages").select("id,branch_name").eq("id", draft.pageId).eq("business_id", draft.businessId).maybeSingle();
    if (!page) return contactError(404);
    const config = contactConfigSchema.parse(draft.contact);
    const contact = compileContact(config, { business: { name: draft.name }, page: { branchName: page.branch_name }, sections: draft.sections });
    if (!contact) return contactError(404);
    contact.photoPath = await resolveContactPhoto(client, draft.businessId, config, draft.sections || []);
    return await contactResponse(contact);
  } catch { return new Response("Check the contact fields and try again.", { status: 400, headers: { "Cache-Control": "private, no-store" } }); }
}
