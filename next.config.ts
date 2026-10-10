import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  distDir: process.env.NEXTAP_BUILD_DIR || ".next",
  poweredByHeader: false,
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/c/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] }];
  }
};
export default nextConfig;
