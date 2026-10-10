import * as Sentry from "@sentry/nextjs";

/** Capture a server-side operation failure with a stable operation tag only. */
export function captureOperationError(error: unknown, operation: string) {
  Sentry.withScope(scope => {
    scope.setTag("operation", operation);
    Sentry.captureException(error instanceof Error ? error : new Error("NexTap operation failed"));
  });
}
