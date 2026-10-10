const SENSITIVE_KEY = /(?:authorization|bearer|cookie|csrf|email|pass(?:word)?|payment|card|secret|session|supabase|token|phone|api[-_]?key)/i;
const CARD_PATH = /(^|\/)c\/[A-Za-z0-9_-]{32,64}(?=\/|\?|#|$)/g;
const QUERY_SECRET = /([?&](?:access_token|card_token|code|key|password|secret|token|email|phone)=)[^&#\s]*/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~-]+/gi;

export function sentryEnvironment() {
  const configured = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.SENTRY_ENVIRONMENT;
  if (configured === "production" || process.env.VERCEL_ENV === "production" || process.env.NEXTAP_ENV === "production") return "production";
  if (configured === "test" || process.env.NEXTAP_ENV === "test") return "test";
  return "staging";
}

function normalizeRelease(value: string) {
  const clean = value.replace(/[^A-Za-z0-9._@-]/g, "-").replace(/-+/g, "-").slice(0, 120);
  return clean || "local";
}

export function sentryRelease() {
  const configured = process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.SENTRY_RELEASE;
  if (configured) return normalizeRelease(configured);
  const commit = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  return `nextap@${normalizeRelease(commit || "local").slice(0, 40)}`;
}

export function sentryEnabled(dsn: string | undefined) {
  return Boolean(dsn) && process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "0" && process.env.SENTRY_ENABLED !== "0";
}

export function sentryDiagnosticsEnabled() {
  return process.env.SENTRY_TEST_ERRORS_ENABLED === "1" && sentryEnvironment() !== "production";
}

export function scrubText(value: string) {
  return value.replace(CARD_PATH, "$1c/[card-token]").replace(QUERY_SECRET, "$1[redacted]").replace(BEARER, "Bearer [redacted]").slice(0, 2000);
}

export function sanitizeUrl(value: string) {
  const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
  try {
    const url = new URL(value, "https://nextap.invalid");
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(CARD_PATH, "$1c/[card-token]");
    return absolute ? `${url.origin}${url.pathname}` : url.pathname;
  } catch {
    return scrubText(value);
  }
}

function sanitizeValue(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") {
    if (/^(?:https?:\/\/|\/)/i.test(value)) return sanitizeUrl(value);
    return scrubText(value);
  }
  if (depth >= 3 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 40).map(item => sanitizeValue(item, key, depth + 1));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 40).map(([entryKey, entryValue]) => [entryKey, sanitizeValue(entryValue, entryKey, depth + 1)]));
}

export function sanitizeSentryEvent(event: any) {
  if (event.request) {
    if (typeof event.request.url === "string") event.request.url = sanitizeUrl(event.request.url);
    if (event.request.headers) {
      const contentType = event.request.headers["content-type"] || event.request.headers["Content-Type"];
      event.request.headers = contentType ? { "content-type": scrubText(String(contentType)) } : {};
    }
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
  }
  delete event.user;
  if (event.message) event.message = scrubText(String(event.message));
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((value: any) => ({
      ...value,
      value: typeof value.value === "string" ? scrubText(value.value) : value.value,
    }));
  }
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map((breadcrumb: any) => sanitizeSentryBreadcrumb(breadcrumb)).filter(Boolean);
  if (event.extra) event.extra = sanitizeValue(event.extra);
  if (event.contexts) event.contexts = sanitizeValue(event.contexts);
  if (event.tags) event.tags = sanitizeValue(event.tags);
  return event;
}

export function sanitizeSentryBreadcrumb(breadcrumb: any) {
  if (breadcrumb.category === "console") return null;
  if (breadcrumb.message) breadcrumb.message = scrubText(String(breadcrumb.message));
  if (breadcrumb.data) breadcrumb.data = sanitizeValue(breadcrumb.data);
  return breadcrumb;
}

export function sanitizeSentrySpan(span: any) {
  if (span.description) span.description = scrubText(String(span.description));
  if (span.data) span.data = sanitizeValue(span.data);
  return span;
}
