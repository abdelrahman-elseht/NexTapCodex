# NexTap - Launch Architecture Readiness

Audit date: 2026-10-12  
Branch: `fix/launch-architecture-readiness`  
Baseline: `1d97341` (`Improve business payment provider handling`)  
Source of truth: [`ARCHITECTURE_CAPACITY_HANDOFF.md`](ARCHITECTURE_CAPACITY_HANDOFF.md)

## Current decision

The branch is ready for a reviewed Staging migration and deployment exercise. It is not ready for Production activation. No hosted database, Production project, DNS record, customer data, or deployment was changed by this work.

The local source and disposable PostgreSQL contracts cover the Phase 6 publication path, redirect freshness, owner authorization, and the new privilege hardening. Staging still needs migration-history reconciliation before any forward migration is applied. Staging currently lacks the Phase 6 RPCs and has two unnecessary public execute grants identified by the security advisor.

## Phase checklist

| Phase | Status | Evidence or remaining gate |
| --- | --- | --- |
| Phase 1 - Security grants and Auth hardening | Partial | Local ACL migration and SQL contract pass. Staging grant revocation, Auth settings, MFA, password policy, signup policy, and CAPTCHA/Turnstile still require hosted verification. |
| Phase 2 - Publication-cache schema parity | Partial | Local Phase 6 migrations and publication security contracts pass. Staging has no `get_publication_pointer` or `get_publication_snapshot`; reconcile history, apply forward migrations, and run hosted checks. |
| Phase 3 - Analytics decision and privacy | Complete for MVP decision | No visitor writes exist. Keep Postgres free of per-visitor writes. Use only a privacy-conscious browser analytics product after the hosting choice is confirmed. |
| Phase 4 - Rate limits, monitoring, and verification | Partial | Redirect and response-cache behavior are covered. No application rate limiter, WAF rule, hosted quota alert, or deployed traffic measurement was verified. These remain launch gates. |

## Phase 1 - Security

Completed in this branch:

1. Added [`20261012201228_launch_architecture_security.sql`](../../supabase/migrations/20261012201228_launch_architecture_security.sql). It revokes `anon` and inherited `public` execution on `public.assign_card(uuid,uuid,text,text)` while preserving `authenticated` execution for the owner workflow.
2. The same migration conditionally revokes `public`, `anon`, and `authenticated` execution from `public.rls_auto_enable()` when that hosted event-trigger handler exists. Fresh local schemas without the handler remain valid.
3. Added [`launch-architecture-security.sql`](../../supabase/tests/launch-architecture-security.sql), which asserts anonymous `assign_card` denial, authenticated owner-path availability, and `rls_auto_enable` denial when present.
4. Existing SQL contracts continue to cover non-owner mutation denial, anonymous publication reads, draft isolation, and RLS.

Hosted Staging gates:

- Reconcile the remote migration history and definitions against this checkout before applying anything. The hosted migration names/timestamps do not match the local files and stop before Phase 6.
- Apply the reviewed Phase 6, preproduction contract repair, and security migrations to Staging only, in the reconciled order.
- Re-run the Supabase security advisor. The intended residual `create_card_batch` warning must be reviewed separately because the owner-checked authenticated workflow still needs its wrapper.
- In the Supabase Auth dashboard, verify environment-specific Site URL and redirect allowlists, disabled public signup, strong password requirements, MFA policy, and available CAPTCHA/Turnstile controls. Source text says administrator accounts are invitation-only; that is not proof that hosted signup is disabled.
- Do not enable leaked-password protection on a Free plan unless the current plan supports it. Record the plan and the chosen control in the hosted handoff.

## Phase 2 - Cache schema parity

The checked-in Phase 6 migration defines the public invoker wrappers `get_publication_pointer(text)` and `get_publication_snapshot(uuid)` over private, security-definer readers with an empty search path. The compatibility fallback remains in the application for older Staging projects.

After the hosted migration is reconciled and applied, verify all of the following in Staging:

1. Both public RPCs exist and anonymous calls work.
2. Anonymous callers cannot read draft tables or superseded, disabled, or archived snapshots.
3. Draft -> Publish updates the pointer and public page. The immutable snapshot is keyed by publication ID.
4. Card reassignment, activation, and deactivation remain immediately correct through `/c/:token`.
5. `/c/:token` remains a `302` with `Cache-Control: no-store, max-age=0` and `Referrer-Policy: no-referrer`.
6. A hosted browser journey confirms the Phase 6 path rather than only the five-second compatibility fallback.

Do not claim Phase 2 complete from local PGlite tests alone. The current Staging project has no Phase 6 RPCs.

## Phase 3 - Analytics

The source contains no page-view, scan-hit, QR/NFC source, or action-click table, RPC, or route write. `via=qr|nfc` is allowlisted and forwarded to `/b/:slug`; it is not persisted. Administrative audit and assignment-history rows are not visitor analytics.

MVP decision:

- Keep synchronous visitor writes out of Supabase.
- Do not add raw page-view, scan, or click tables.
- If Vercel is the selected host, enable its basic browser Web Analytics only after a Preview deployment confirms availability. A server-side `302` is not a browser page view.
- If another host is selected, use its privacy-conscious browser analytics equivalent. Do not claim exact card-scan counts from page-view data.
- Any optional custom event may contain only an allowlisted provider/category and normalized `source=qr|nfc|direct`. Never send card tokens, payment identifiers, destination URLs, names, arbitrary query strings, or personal data.
- PostHog or another custom-event provider remains a later product decision and is not installed by this branch.

## Phase 4 - Operations

Verified locally:

- Public card redirects are uncached and token-free in response headers.
- Admin routes and mutation responses are private/no-store and owner-gated.
- Sentry URL sanitization removes token-like query values and other sensitive URL data.
- The disposable database test suite passes all migration and RLS contracts.

Still required before launch:

- Add and verify edge/WAF rate limits for `/c/*`, login, and admin mutation endpoints. The current source has no distributed rate limiter, so an in-process limiter alone is not sufficient for a multi-instance deployment.
- Configure alerts for Supabase cached/uncached egress, Storage usage/egress, database size, Auth and connection errors, and Vercel invocations/transfer.
- Capture deployed p50/p95 latency, error rate, cache behavior, and quota dashboards in Preview/Staging. Do not generate abusive traffic.
- Run typecheck, lint, unit tests, production build, SQL contracts, and the affected hosted E2E journeys after the reconciled migration is applied.

## Acceptance matrix

| Acceptance criterion | Result |
| --- | --- |
| Anonymous callers cannot execute sensitive admin functions | Local ACL contract passes for `assign_card`; hosted verification pending for the migration and `rls_auto_enable`. |
| Owner card operations still work | Authenticated grant is preserved and existing card route/unit/E2E coverage remains in place; hosted rerun pending. |
| Phase 6 publication RPCs exist and are used on Staging | Not yet; staging inventory shows both RPCs absent. |
| Publishing updates the public page | Local publication contracts pass; hosted Phase 6 browser check pending. |
| Card reassignment remains immediately correct | Existing no-store redirect contract and owner journey cover this locally; hosted rerun pending. |
| No per-visitor PostgreSQL writes are introduced | Pass; source inventory contains none. |
| Security advisors and tests are rerun with documented results | Baseline advisor results are recorded in the launch handoff; post-migration advisor rerun is pending. |
| Environment limits and upgrade triggers are documented | Pass in [`LAUNCH_ARCHITECTURE_HANDOFF.md`](LAUNCH_ARCHITECTURE_HANDOFF.md). |

## Required release order

1. Snapshot Staging and inventory remote migration bodies, constraints, functions, and ACLs.
2. Prepare a reviewed forward-only history reconciliation. Do not mark migrations applied by name alone and do not run an unreviewed `supabase db push`.
3. Apply the reconciled Phase 6, contract-repair, and security migrations to Staging only.
4. Run the SQL security tests, advisors, and hosted Preview/Staging browser journeys.
5. Configure Auth, WAF/rate limits, quota alerts, and analytics according to the verified host and plan.
6. Obtain separate approval before any Production deployment, DNS activation, or customer-data operation.

Do not merge this branch into `main` or deploy Production as part of this handover.
