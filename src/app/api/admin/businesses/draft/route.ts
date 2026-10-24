import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publishDraftState, saveDraftState } from "@/app/admin/businesses/actions";
import { BodyLimitError, boundedRequest, MissingBodyError, readBoundedBody } from "@/lib/security/bounded-body";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { expectedRequestOrigin } from "@/lib/security/public-origin";

const MAX_BODY_BYTES = 512 * 1024;
const response = (body: string | object, status: number, headers?: HeadersInit) =>
  typeof body === "string"
    ? new Response(body, { status, headers: { "Cache-Control": "private, no-store", ...headers } })
    : NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", ...headers } });

/** JSON transport keeps route revalidation out of the live editor's React tree. */
export async function POST(request: Request) {
  let bounded: Request;
  try {
    const body = await readBoundedBody(request, MAX_BODY_BYTES);
    bounded = boundedRequest(request, body);
  } catch (error) {
    if (error instanceof BodyLimitError) return response("Request rejected", 413);
    if (error instanceof MissingBodyError) return response("Request rejected", 400);
    return response("Request rejected", 400);
  }
  const url = new URL(request.url);
  const expectedOrigin = expectedRequestOrigin(request);
  const localOrigin = url.origin;
  if (request.headers.get("origin") !== (process.env.NEXTAP_ENV === "staging" || process.env.NEXTAP_ENV === "production" || process.env.VERCEL_ENV ? expectedOrigin : localOrigin)) return response("Forbidden", 403);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  if (error || typeof subject !== "string") return response("Unauthorized", 401);
  const { data: owner, error: ownerError } = await supabase.from("owner_users").select("user_id").eq("user_id", subject).maybeSingle();
  if (ownerError || !owner) return response("Forbidden", 403);
  const budget = consumeRateLimit("admin-draft", subject, { max: 30, windowMs: 60_000, maxKeys: 256 });
  if (!budget.allowed) return response("Request limit exceeded", 429, { "Retry-After": String(budget.retryAfter) });
  const contentType = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data\b|^application\/x-www-form-urlencoded\b/i.test(contentType)) return response("Request rejected", 415);
  let form: FormData;
  try {
    form = await bounded.formData();
  } catch {
    return response("Request rejected", 400);
  }
  const mode = form.get("mode");
  const draft = form.get("draft");
  if (typeof draft !== "string" || new TextEncoder().encode(draft).byteLength > 256 * 1024) return response({ ok: false, error: "Invalid draft." }, 413);
  if (mode !== "save" && mode !== "publish") return response({ ok: false, error: "Invalid save mode." }, 400);
  // Existing actions retain validation, owner checks, atomic persistence and cache invalidation.
  const result = await (mode === "publish" ? publishDraftState(form) : saveDraftState(form));
  return response(result, result.ok ? 200 : 400);
}
