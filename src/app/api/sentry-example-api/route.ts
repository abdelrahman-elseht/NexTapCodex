import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { sentryDiagnosticsEnabled } from "@/lib/observability/sentry";
import { requireOwner } from "@/lib/auth/owner";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!sentryDiagnosticsEnabled()) return new Response("Not found", { status: 404 });
  try {
    const owner = await requireOwner();
    const budget = consumeRateLimit("sentry-diagnostics", owner.userId, { max: 3, windowMs: 60_000, maxKeys: 256 });
    if (!budget.allowed) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const eventId = Sentry.withScope(scope => {
    scope.setTag("verification", "server");
    scope.setTag("surface", "sentry-diagnostics");
    return Sentry.captureException(new Error("NexTap controlled server verification error"));
  });
  await Sentry.flush(2000);
  return NextResponse.json({ ok: true, eventId }, { headers: { "Cache-Control": "no-store" } });
}
