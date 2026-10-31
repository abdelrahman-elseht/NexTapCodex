import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const diagnosticRequest = request.method === "POST" && request.nextUrl.pathname === "/api/admin/businesses/draft";
  const diagnosticsEnabled = diagnosticRequest
    && process.env.NEXTAP_REQUEST_DIAGNOSTICS === "true"
    && process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:56321"
    && process.env.NEXTAP_ENV !== "production"
    && process.env.VERCEL_ENV !== "production";
  const requestId = diagnosticsEnabled ? crypto.randomUUID() : null;
  const log = (checkpoint: string, fields: Record<string, string | number | boolean | null> = {}) => {
    if (requestId) console.info("[phase1-draft-diagnostic] " + JSON.stringify({ scope: "middleware", requestId, checkpoint, ...fields }));
  };
  const nextResponse = () => {
    const headers = new Headers(request.headers);
    if (requestId) headers.set("x-nextap-request-id", requestId);
    const next = NextResponse.next({ request: { headers } });
    if (requestId) next.headers.set("x-nextap-request-id", requestId);
    return next;
  };
  let response = nextResponse();
  let refreshedCookieCount = 0;
  log("request", { cookieHeaderPresent: request.headers.has("cookie") });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        refreshedCookieCount += cookiesToSet.length;
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = nextResponse();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers || {}).forEach(([key, value]) => response.headers.set(key, value));
      }
    } }
  );
  const { data, error } = await supabase.auth.getClaims();
  const authErrorCode = typeof error?.code === "string" && /^[A-Za-z0-9_-]+$/.test(error.code) ? error.code : error ? "unknown" : null;
  log("session-check", {
    claimsPresent: typeof data?.claims?.sub === "string",
    authErrorCode,
    refreshedCookieCount,
    cookiesForwardedToRoute: refreshedCookieCount > 0,
  });
  if (requestId) response.headers.set("x-nextap-request-id", requestId);
  return response;
}
