import * as Sentry from "@sentry/nextjs";
import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  sanitizeSentrySpan,
  sentryEnabled,
  sentryEnvironment,
  sentryRelease,
} from "./src/lib/observability/sentry";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: sentryEnabled(dsn),
  // Lightweight startup listeners own these events, including before lazy init.
  integrations: defaults => defaults.filter(integration => integration.name !== "GlobalHandlers"),
  environment: sentryEnvironment(),
  release: sentryRelease(),
  tracesSampleRate: 0.05,
  maxBreadcrumbs: 20,
  dataCollection: {
    userInfo: false,
    cookies: false,
    urlQueryParams: false,
    httpHeaders: { request: { allow: ["content-type"] }, response: { allow: ["content-type"] } },
    httpBodies: [],
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
    frameContextLines: 0,
  },
  tracePropagationTargets: [/^\/(?:api|b|c)(?:\/|$)/],
  beforeSend: sanitizeSentryEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  beforeSendSpan: sanitizeSentrySpan,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

export function captureException(error: unknown, context?: Record<string, unknown>) {
  return Sentry.captureException(error, context);
}

export const flush = Sentry.flush;
