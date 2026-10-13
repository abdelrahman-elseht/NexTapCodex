import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next 15 uses middleware.ts; proxy.ts is a Next 16 convention.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}
export const config = { matcher: ["/admin/:path*", "/login", "/auth/:path*", "/api/admin/:path*"] };
