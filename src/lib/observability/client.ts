"use client";

let configuration: Promise<typeof import("../../../sentry.client.config")> | undefined;

export async function captureClientException(error: unknown, context?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return undefined;
  try {
    configuration ||= import("../../../sentry.client.config");
    const sentryConfig = await configuration;
    const eventId = sentryConfig.captureException(error, context);
    await sentryConfig.flush(2000);
    return eventId;
  } catch {
    // A monitoring transport/chunk failure must not break app error recovery.
    configuration = undefined;
    return undefined;
  }
}
