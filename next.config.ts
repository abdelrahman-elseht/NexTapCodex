import type { NextConfig } from "next";
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
export default nextConfig;
