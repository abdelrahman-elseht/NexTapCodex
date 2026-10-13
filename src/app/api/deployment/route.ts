import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Staging acceptance needs the identity of the deployment actually serving the
// stable alias. Return an explicit metadata allowlist, never environment dumps.
export function GET() {
  if (process.env.VERCEL_ENV !== "preview" || process.env.NEXT_PUBLIC_SITE_URL !== "https://staging.nextap.services") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA,
    branch: process.env.VERCEL_GIT_COMMIT_REF,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    deploymentUrl: process.env.VERCEL_URL,
    target: process.env.VERCEL_ENV,
    supabaseProject: process.env.NEXT_PUBLIC_SUPABASE_URL === "https://flkakuysakgwfoemgbwn.supabase.co" ? "flkakuysakgwfoemgbwn" : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
