# NexTap Launch Architecture Handoff

Audit date: 2026-10-12  
Branch: `fix/launch-architecture-readiness`  
Baseline: `1d97341`  
Staging project: `flkakuysakgwfoemgbwn` (`NexTabCodex`, `eu-west-1`, `ACTIVE_HEALTHY`)

## Readiness verdict

The branch is ready for a reviewed Staging migration and deployment exercise. It is not ready for Production activation. No hosted database, Production project, DNS record, deployment, or customer data was modified.

The repository now contains a forward security migration and local contract coverage. Staging still needs migration-history reconciliation and the hosted Phase 6 rollout. Rate limiting/WAF, quota alerts, and hosted Auth policy checks are release gates rather than completed implementation claims.

## What changed

- `supabase/migrations/20261012201228_launch_architecture_security.sql` revokes `anon` and inherited `public` execution from `public.assign_card(uuid,uuid,text,text)`, preserving `authenticated` execution for the owner workflow.
- The same migration conditionally revokes `public`, `anon`, and `authenticated` execution from the hosted `public.rls_auto_enable()` handler when it exists. Fresh local schemas without that event-trigger function are supported.
- `supabase/tests/launch-architecture-security.sql` asserts both ACL outcomes and protects the owner path from accidental revocation.
- `scripts/database/test-database.mjs` runs the new contract with the existing disposable migration suite.
- `docs/handovers/Launch_arch_readiness.md` records the phase status, acceptance matrix, and staging release order.

## Hosted Staging evidence

Read-only Supabase MCP inspection recorded:

- Project health: `ACTIVE_HEALTHY`, PostgreSQL 17.11, `eu-west-1`.
- Hosted migration history currently ends at `draft_save_constraint_resolution` and does not contain the local Phase 6 publication-cache migration or the preproduction contract repair. Names and timestamps differ from the checked-in migration files.
- `public.get_publication_pointer(text)` and `public.get_publication_snapshot(uuid)` are absent from the hosted project.
- `public.assign_card(uuid,uuid,text,text)` currently has `EXECUTE` for `anon` and `authenticated`; its private helper is security-definer and authenticated-only.
- `public.rls_auto_enable()` exists as a security-definer event-trigger handler for `ensure_rls` and currently has `EXECUTE` for both `anon` and `authenticated`.
- Security advisor baseline: anonymous `rls_auto_enable`, authenticated `rls_auto_enable`, authenticated `create_card_batch`, and disabled leaked-password protection.
- Performance advisor baseline: six unused-index informational findings. They were not removed; the staging dataset is too small to justify that change.

The remote migration history mismatch is material. Do not run `supabase db push` or apply a guessed migration order. First inventory the remote definitions and prepare an explicit forward-only reconciliation.

## Architecture and privacy decisions

### Public reads and cache

`GET /c/:token` validates token syntax before calling one `resolve_card` RPC. Valid active cards return a zero-body `302` with `Cache-Control: no-store, max-age=0` and no referrer. `via` is limited to `qr` or `nfc` before forwarding to the public business route.

`GET /b/:slug` uses the Phase 6 pointer/snapshot path when the RPCs exist. The compatibility fallback calls `get_published_page` with a five-second cache when they do not. The immutable snapshot cache is keyed by publication ID and remains safe only after the pointer and snapshot functions are deployed together.

### Analytics

There is no visitor analytics table, RPC, or synchronous route write. Keep it that way for MVP. Use a browser page-view product only after the hosting plan is confirmed, and send only normalized, allowlisted source/provider dimensions. Browser page views do not count a bare server-side redirect as an exact scan.

### Capacity and alerts

The architecture audit identifies media/Storage egress as the likely first Free-tier pressure point for media-heavy traffic. Alert on Supabase cached/uncached egress, Storage usage/egress, database size, Auth/connection errors, and Vercel invocations/transfer. Revisit limits after a real Preview/Staging deployment; current quota figures are planning envelopes, not throughput guarantees.

### Rate limiting

The source has no distributed rate limiter. Before public traffic, configure WAF/edge limits for `/c/*`, login, and admin mutation endpoints. An in-process limiter would not provide consistent protection across Vercel instances and is not accepted as the launch control by itself.

## Verification

The following local command passed on this branch:

```text
npm.cmd run test:db
PASS: 19 migrations, SQL contracts, anonymous publication RPC execution
```

The run applies all 19 checked-in migrations to disposable PGlite, then passes:

- `phase123-contracts.sql`
- `phase5-incremental-saves.sql`
- `phase6-publication-cache.sql`
- `preprod-publication-security.sql`
- `launch-architecture-security.sql`

The new ACL contract proves that anonymous `assign_card` execution is denied, authenticated execution remains available, and `rls_auto_enable` is denied if the function exists.

The existing integration handoff records the broader local result: typecheck, lint, unit tests, production build, and 54/54 production-build E2E journeys passed before this branch. Those checks should be rerun after the hosted migration rollout because Staging currently exercises the compatibility cache path.

## Staging runbook

1. Snapshot Staging and inspect every remote migration definition, function signature/body, constraint, event trigger, and ACL against the checked-in source.
2. Prepare and review the migration-history reconciliation. Keep the existing compatibility fallback until hosted Phase 6 verification passes.
3. Apply the Phase 6 publication-cache migration, the preproduction contract repair, and this branch's security migration to Staging only, using the reconciled order and a recorded change ID.
4. Verify with catalog queries that the two Phase 6 public functions exist, `anon` can execute only the intended public readers, `anon` cannot execute `assign_card` or `rls_auto_enable`, and `authenticated` can still execute `assign_card`.
5. Run the SQL security contracts and Supabase advisors again.
6. Run hosted Preview/Staging journeys for Draft -> Publish, public update, old-slug alias, card reassignment, activation/deactivation, `/c/:token` no-store redirects, media, and Auth/session refresh.
7. Configure and record Auth URLs/redirects, signup policy, password/MFA controls, CAPTCHA/Turnstile availability, WAF/rate limits, quota alerts, and the selected analytics product.

Do not run this sequence against Production. Do not claim the Phase 6 fast path or advisor remediation complete until the hosted evidence is attached to a later handoff.

## Remaining launch gates

- Reconciled and reviewed Staging migration history.
- Hosted Phase 6 RPC deployment and browser verification.
- Post-migration security-advisor run with the intended findings resolved or explicitly accepted.
- Auth dashboard policy verification, including disabled signup and environment-specific redirects.
- WAF/rate-limit rules for public redirects, login, and admin mutations.
- Usage/error alerts and a rollback or recovery plan.
- Separate approval for Production deployment and DNS activation.
