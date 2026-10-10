import { notFound } from "next/navigation";
import { sentryDiagnosticsEnabled } from "@/lib/sentry";
import SentryDiagnostics from "./sentry-diagnostics";

export const dynamic = "force-dynamic";

export default function SentryExamplePage() {
  if (!sentryDiagnosticsEnabled()) notFound();
  return <SentryDiagnostics />;
}
