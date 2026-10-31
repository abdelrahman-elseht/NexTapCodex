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
  const diagnosticsEnabled = process.env.NEXTAP_REQUEST_DIAGNOSTICS === "true"
    && process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:56321"
    && process.env.NEXTAP_ENV !== "production"
    && process.env.VERCEL_ENV !== "production";
  const requestId = diagnosticsEnabled ? request.headers.get("x-nextap-request-id") || crypto.randomUUID() : null;
  const log = (checkpoint: string, fields: Record<string, string | number | boolean | null> = {}) => {
    if (requestId) console.info("[phase1-draft-diagnostic] " + JSON.stringify({ scope: "route", requestId, checkpoint, ...fields }));
  };
  const reply = (body: string | object, status: number, headers?: HeadersInit) => {
    log("response", { status });
    const result = response(body, status, headers);
    if (requestId) result.headers.set("x-nextap-request-id", requestId);
    return result;
  };
  log("request");
  let bounded: Request;
  try {
    const body = await readBoundedBody(request, MAX_BODY_BYTES);
    bounded = boundedRequest(request, body);
  } catch (error) {
    if (error instanceof BodyLimitError) return reply("Request rejected", 413);
    if (error instanceof MissingBodyError) return reply("Request rejected", 400);
    return reply("Request rejected", 400);
  }
  const url = new URL(request.url);
  const expectedOrigin = expectedRequestOrigin(request);
  const requestOrigin = request.headers.get("origin");
  const requestHost = request.headers.get("host");
  let hostOrigin: string | null = null;
  try {
    hostOrigin = requestHost ? new URL(`${url.protocol}//${requestHost}`).origin : url.origin;
  } catch {
    hostOrigin = null;
  }
  const hosted = process.env.NEXTAP_ENV === "staging"
    || process.env.NEXTAP_ENV === "production"
    || process.env.VERCEL_ENV === "preview"
    || process.env.VERCEL_ENV === "production";
  const originAllowed = requestOrigin === (hosted ? expectedOrigin : hostOrigin);
  const diagnosticOrigin = (value: string | null) => {
    if (!value) return "missing";
    try {
      const parsed = new URL(value);
      return ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ? parsed.origin : "non-local";
    } catch {
      return "invalid";
    }
  };
  log("origin-check", {
    allowed: originAllowed,
    requestOrigin: diagnosticOrigin(requestOrigin),
    expectedOrigin: diagnosticOrigin(expectedOrigin),
    requestUrlOrigin: diagnosticOrigin(url.origin),
    hostOrigin: diagnosticOrigin(hostOrigin),
    requestMatchesExpected: requestOrigin === expectedOrigin,
    expectedMatchesRequestUrl: expectedOrigin === url.origin,
    requestMatchesHost: requestOrigin === hostOrigin,
  });
  if (!originAllowed) return reply("Forbidden", 403);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  const authErrorCode = typeof error?.code === "string" && /^[A-Za-z0-9_-]+$/.test(error.code) ? error.code : error ? "unknown" : null;
  const claimsPresent = typeof subject === "string";
  log("claims-check", { claimsPresent, authErrorCode });
  if (error || !claimsPresent) return reply("Unauthorized", 401);
  const { data: owner, error: ownerError } = await supabase.from("owner_users").select("user_id").eq("user_id", subject).maybeSingle();
  const ownerErrorCode = typeof ownerError?.code === "string" && /^[A-Za-z0-9_-]+$/.test(ownerError.code) ? ownerError.code : ownerError ? "unknown" : null;
  const ownerFound = Boolean(owner);
  log("owner-check", { ownerFound, ownerQueryError: Boolean(ownerError), ownerErrorCode });
  if (ownerError || !ownerFound) return reply("Forbidden", 403);
  const budget = consumeRateLimit("admin-draft", subject, { max: 30, windowMs: 60_000, maxKeys: 256 });
  log("rate-limit", { allowed: budget.allowed });
  if (!budget.allowed) return reply("Request limit exceeded", 429, { "Retry-After": String(budget.retryAfter) });
  const contentType = request.headers.get("content-type") || "";
  const contentTypeAllowed = /^multipart\/form-data\b|^application\/x-www-form-urlencoded\b/i.test(contentType);
  log("content-type-check", { allowed: contentTypeAllowed });
  if (!contentTypeAllowed) return reply("Request rejected", 415);
  let form: FormData;
  try {
    form = await bounded.formData();
  } catch {
    return reply("Request rejected", 400);
  }
  const mode = form.get("mode");
  const draft = form.get("draft");
  const draftValid = typeof draft === "string" && new TextEncoder().encode(draft).byteLength <= 256 * 1024;
  const modeAllowed = mode === "save" || mode === "publish";
  log("form-check", { draftValid, modeAllowed });
  if (!draftValid) return reply({ ok: false, error: "Invalid draft." }, 413);
  if (!modeAllowed) return reply({ ok: false, error: "Invalid save mode." }, 400);
  // Existing actions retain validation, owner checks, atomic persistence and cache invalidation.
  log("action-start", { publish: mode === "publish" });
  const result = await (mode === "publish" ? publishDraftState(form) : saveDraftState(form));
  log("action-result", { ok: result.ok });
  return reply(result, result.ok ? 200 : 400);
}
