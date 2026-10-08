import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/c/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] }];
  }
};
export default nextConfig;