import { NextResponse } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireOwner } from "@/lib/auth/owner";
import { optimizeImage } from "@/lib/media/optimize";
import { storeManagedImage } from "@/lib/media/store";
import { MAX_TRANSPORT_BYTES } from "@/lib/media/limits";
export const runtime = "nodejs";
const response = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  // Reject cross-site form posts; byte uploads and JSON actions remain owner checked.
  const origin = request.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).host !== (request.headers.get("host") || new URL(request.url).host)) return response({ error: "Upload must originate from this site." }, 403); }
    catch { return response({ error: "Upload must originate from this site." }, 403); }
  }
  let owner: Awaited<ReturnType<typeof requireOwner>>;
  try { owner = await requireOwner(); } catch (error) {
    return response({ error: isRedirectError(error) ? "Sign in with an authorized owner account to upload." : "Authorization unavailable. Retry." }, isRedirectError(error) ? 401 : 503);
  }
  // Bound even chunked requests before allocating a multipart buffer.
  const ceiling = MAX_TRANSPORT_BYTES + 32 * 1024;
  if (Number(request.headers.get("content-length")) > ceiling) return response({ error: "Prepare the image below 3 MiB before uploading." }, 413);
  try {
    const reader = request.body?.getReader(); if (!reader) return response({ error: "Choose an image to upload." }, 400);
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > ceiling) { await reader.cancel(); return response({ error: "Prepare the image below 3 MiB before uploading." }, 413); }
      chunks.push(chunk.value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const businessId = String(form.get("businessId") || ""); const role = String(form.get("role") || ""); const file = form.get("file");
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(businessId) || !["photo", "logo"].includes(role) || !(file instanceof File)) return response({ error: "Choose a business and a still image." }, 400);
    // All allowlisted owners manage the shared inventory; the authenticated query also enforces RLS.
    const { data: business, error } = await owner.supabase.from("businesses").select("id").eq("id", businessId).maybeSingle();
    if (error) return response({ error: "Could not check this business. Retry." }, 503);
    if (!business) return response({ error: "Business not found or not accessible." }, 403);
    if (file.size > MAX_TRANSPORT_BYTES) return response({ error: "Prepare the image below 3 MiB before uploading." }, 413);
    let image;
    try { image = await optimizeImage(Buffer.from(await file.arrayBuffer()), role === "logo" ? "logo" : "photo"); } catch (error) { return response({ error: error instanceof Error ? error.message : "Invalid image." }, 422); }
    return response(await storeManagedImage(owner.supabase, owner.userId, businessId, image, String(form.get("alt") || "")));
  } catch { return response({ error: "Image upload failed. Retry or choose another image." }, 500); }
}
