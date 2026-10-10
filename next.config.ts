import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { assertSupabaseEnvironment } from "./lib/environment.mjs";
assertSupabaseEnvironment(process.env);
const nextConfig: NextConfig = {
  distDir: process.env.NEXTAP_BUILD_DIR || ".next",
  poweredByHeader: false,
  images: {
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
    return [{ source: "/c/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] }];
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
    treeshake: { removeDebugLogging: true },
  },
});
