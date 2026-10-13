import { captureClientException } from "@/lib/observability/client";

// Catch uncaught browser errors before the SDK is needed. The full SDK loads
// only after an error; explicit React error boundaries use the same loader.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  window.addEventListener("error", event => {
    if (event.error || event.message) {
      void captureClientException(event.error || new Error(event.message), { tags: { surface: "browser.error" } });
    }
  });
  window.addEventListener("unhandledrejection", event => {
    void captureClientException(event.reason, { tags: { surface: "browser.unhandledrejection" } });
  });
}
