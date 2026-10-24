import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { assertSupabaseEnvironment } from "./src/lib/config/environment.mjs";
import { resolveWalletUssdEnabled } from "./src/lib/config/wallet-ussd.mjs";
assertSupabaseEnvironment(process.env);
const nextConfig: NextConfig = {
  distDir: process.env.NEXTAP_BUILD_DIR || ".next",
  poweredByHeader: false,
  env: { NEXT_PUBLIC_WALLET_USSD_ENABLED: resolveWalletUssdEnabled(process.env) },
  images: {
    dangerouslyAllowSVG: false,
    // Fixed logo sizes can select small variants instead of a 640px fill image.
    imageSizes: [32, 48, 64, 84, 96, 128, 168, 256, 384],
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL ? [{
      protocol: "https",
      hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
      port: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).port,
      pathname: "/storage/v1/object/public/business-media/**",
      search: "",
    }] : [],
  },
  async headers() {
    const scriptPolicy = process.env.NODE_ENV === "development" ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
    const securityHeaders = [
      { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src ${scriptPolicy}; connect-src 'self' https://*.supabase.co https://*.sentry.io; font-src 'self' data:; upgrade-insecure-requests` },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }, ...securityHeaders] },
      { source: "/api/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }, ...securityHeaders] },
      { source: "/c/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }, ...securityHeaders] },
    ];
  }
};
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "abdelrahman-0n",
  project: process.env.SENTRY_PROJECT || "nextap",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sentryUrl: process.env.SENTRY_URL,
  telemetry: false,
  silent: true,
  // Upload source maps only when a server-side auth token is present, then remove
  // them from the deploy artifacts so private source is never publicly served.
  sourcemaps: {
    disable: process.env.SENTRY_AUTH_TOKEN ? false : true,
    deleteSourcemapsAfterUpload: true,
  },
  release: {
    name: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
  },
  webpack: {
    // Client tracing adds browser instrumentation to every route. Error capture,
    // request error hooks, and server-side telemetry remain enabled.
    // Error boundaries and operation wrappers capture app errors explicitly;
    // avoid injecting the full browser SDK into every App Router route.
    autoInstrumentAppDirectory: false,
    disableSentryConfig: true,
    treeshake: { removeDebugLogging: true, removeTracing: true },
  },
});
