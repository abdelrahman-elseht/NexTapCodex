import { notFound } from "next/navigation";
import { sentryDiagnosticsEnabled } from "@/lib/observability/sentry";
import SentryDiagnostics from "./sentry-diagnostics";
import { requireOwner } from "@/lib/auth/owner";

export const dynamic = "force-dynamic";

export default async function SentryExamplePage() {
  if (!sentryDiagnosticsEnabled()) notFound();
  await requireOwner();
  return <SentryDiagnostics />;
}
