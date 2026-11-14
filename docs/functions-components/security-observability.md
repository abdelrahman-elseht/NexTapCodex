# Security and Observability Functions

| Export | Source | Reuse contract | Primary verification |
| --- | --- | --- | --- |
| `readBoundedBody`, `boundedRequest`, body-limit errors | `src/lib/security/bounded-body.ts` | Enforces request-body size limits before parsing/handling | Security-limit and route tests |
| `consumeRateLimit` | `src/lib/security/rate-limit.ts` | In-process limiting for supported handlers; not distributed across instances | `security-limits.test.ts`, route tests |
| `sanitizeSentryEvent`, `sanitizeSentryBreadcrumb`, `sanitizeSentrySpan` | `src/lib/observability/sentry.ts` | Removes sensitive values from telemetry payloads | `sentry-sanitization.test.ts`, observability E2E |
| `captureOperationError` | `src/lib/observability/operations.ts` | Captures bounded operation failure context | Route error-path checks and observability E2E |
| `captureClientException` | `src/lib/observability/client.ts` | Client-side exception reporting through configured instrumentation | Instrumentation and error-boundary flows |

Review trust boundaries, data exposure, and runtime scope before reuse. In-process rate limiting does not provide a Cloudflare-wide quota or revocation guarantee.
