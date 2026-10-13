# NexTap — Hosted Staging Deployment & Validation

Current status and continuation instructions:
[Staging validation and production release handoff](STAGING_VALIDATION_AND_PRODUCTION_RELEASE_HANDOFF.md).
The task below is historical; its domain spelling and original DNS restrictions
predate the owner's authorized corrections. Use the current handoff for
resource state and remaining work.

Work on a new branch:

`chore/hosted-staging-validation`

Base it on:

`chore/staging-schema-reconciliation`

Use `STAGING_SCHEMA_RECONCILIATION_HANDOFF.md` as the source of truth.

## Goal

Create the first safe Vercel Preview deployment of NexTap against the existing
Supabase Staging project, then run the complete hosted validation.

Do not deploy Production, modify Production DNS, or connect the Preview
deployment to Production Supabase.

## Phase Checklist

- [ ] Phase 1 — Vercel Preview setup
- [ ] Phase 2 — Staging Auth and domain configuration
- [ ] Phase 3 — Hosted E2E and Phase 6 verification
- [ ] Phase 4 — Handoff and merge recommendation

## Phase 1 — Vercel Preview Setup

1. Verify the worktree is clean and all intended changes are committed.
2. Inspect the existing Vercel `nextap` project through the available MCP.
3. Confirm the Vercel Production Branch is `main`.
4. Connect the repository if required, without creating a Production deployment.
5. Configure branch-specific Preview environment variables for
   `chore/hosted-staging-validation`.
6. Use the existing environment-variable names from the repository and
   `.env.example`; do not invent replacements.
7. Confirm every Supabase variable points only to Staging project:

   `flkakuysakgwfoemgbwn`

8. Configure Staging Sentry variables where already supported.
9. Never copy Production credentials into Preview.
10. Create a Preview deployment only. Never run `vercel --prod`.

Use the generated Vercel Preview URL first. Do not attach Production domains.

## Phase 2 — Auth and Staging Domain

1. Add the generated Preview URL to the allowed Supabase Staging Auth redirect
   URLs where required.
2. Verify login, logout, callback, session refresh, and password-reset redirects
   cannot escape to Production.
3. Ensure public signup remains disabled if that is the current NexTap policy.
4. Confirm the Owner account remains the only authorized Admin.
5. After the generated Preview URL works, inspect the existing configuration for:

   `staging.nextab.services`

6. If the staging domain is ready, assign it only to the Staging Preview branch.
7. Use Cloudflare MCP only to inspect or prepare the required DNS-only record.
8. Do not change nameservers, Production DNS, or `nextab.services` traffic without
   explicit approval.

## Phase 3 — Hosted Validation

Run the complete hosted tests against the generated Preview URL and, if
configured successfully, `staging.nextab.services`.

Verify:

1. Landing page loads without console or network errors.
2. Owner login and session refresh work.
3. Unauthorized users cannot access Admin routes or APIs.
4. Create and edit a Business.
5. Live Mobile Preview updates correctly.
6. Save Draft and reload it.
7. Unpublished content does not appear publicly.
8. Preview and Publish work.
9. The published Business page updates.
10. Old-slug aliases resolve correctly.
11. Card activation and deactivation work.
12. Card reassignment works without changing the permanent token.
13. `/c/:token` returns a zero-body `302` with:
    - `Cache-Control: no-store, max-age=0`
    - `Referrer-Policy: no-referrer`
14. Media loads correctly.
15. Arabic RTL and mobile responsiveness work.
16. Payment, Social, and Quick Action destinations remain functional.

Provide concrete evidence that hosted public Business requests use:

- `get_publication_pointer`
- `get_publication_snapshot`

instead of relying exclusively on the five-second compatibility fallback.

Use safe logs, Supabase inspection, Sentry operation tags, or temporary
non-sensitive diagnostics where necessary. Remove temporary diagnostics before
handoff.

Run:

- Typecheck
- Lint
- Unit tests
- Database contract tests
- Production build
- Hosted desktop and mobile E2E
- Console/network checks
- `git diff --check`

Do not mutate real customer data. Use a dedicated synthetic Staging fixture.

## Phase 4 — Handoff

Create:

`HOSTED_STAGING_VALIDATION_HANDOFF.md`

Include:

1. Deployed branch and commit.
2. Generated Preview URL.
3. Environment mapping without secret values.
4. Supabase Auth redirect configuration.
5. Staging-domain and Cloudflare status.
6. Actual E2E and test results.
7. Phase 6 hosted-path evidence.
8. Console, network, and Sentry findings.
9. Remaining blockers.
10. Exact recommendation for merging into `integration/preprod`.

## Safety Rules

- Preview/Staging only.
- No `vercel --prod`.
- No merge into `main`.
- No Production Supabase access.
- No Production domain activation.
- No destructive database changes.
- Never print or commit credentials.
- Ask for approval only for Production-impacting or destructive operations.

Stop after successful hosted validation. Do not activate Production.

## Execution status — 2026-10-13

The current implementation and release runbook is
[Staging validation and production release handoff](STAGING_VALIDATION_AND_PRODUCTION_RELEASE_HANDOFF.md).

A Ready deployment now exists with API target `preview`:
`dpl_CCGxHYZ9hGgeRZRz9cSfNPQo7W3r`, source commit `814b589`.
`staging.nextap.services` is bound to `chore/hosted-staging-validation`.
Apex/admin/staging DNS and certificates work. Hostinger remains authoritative;
no nameserver change is needed.

Hosted Auth and complete desktop/mobile journeys remain pending. The existing
E2E configuration runs locally, and inspected Vercel metadata contains no
Sentry DSNs. These gaps and prior local/CI evidence are recorded in the current
handoff. Production activation remains pending.
