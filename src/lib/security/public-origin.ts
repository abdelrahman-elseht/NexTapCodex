const ORIGIN = /^https?:\/\/[^/]+$/i;

function normalize(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return ORIGIN.test(url.origin) ? url.origin : null;
  } catch {
    return null;
  }
}

/** Resolve a configured public origin; request headers are a test/development-only override. */
export function configuredPublicOrigin() {
  if (process.env.NEXTAP_ENV === "staging" || process.env.VERCEL_ENV === "preview") return "https://staging.nextap.services";
  if (process.env.NEXTAP_ENV === "production" || process.env.VERCEL_ENV === "production") return "https://nextap.services";
  const explicit = normalize(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit;
  return "http://127.0.0.1:3000";
}

export function allowDynamicPublicOrigin() {
  const hosted = process.env.NEXTAP_ENV === "staging" || process.env.NEXTAP_ENV === "production" || process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production";
  return !hosted && (process.env.NEXTAP_ALLOW_DYNAMIC_PUBLIC_ORIGIN === "1" || process.env.NODE_ENV === "test" || process.env.NEXTAP_ENV === "development");
}

export function normalizePublicOrigin(value: string | undefined) {
  return normalize(value);
}

export function expectedRequestOrigin(request: Request) {
  const hosted = process.env.NEXTAP_ENV === "staging" || process.env.NEXTAP_ENV === "production" || process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production";
  return hosted ? configuredPublicOrigin() : new URL(request.url).origin;
}
