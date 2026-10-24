# Security and architecture remediation implementation record

Baseline: staging, `f33c1a85d4ecd49d7d46db05106e86362baa66f3`, 2026-10-24.

## Preserved concurrent work

Modified before implementation: `.gitignore`, `HOSTED_STAGING_VALIDATION_HANDOFF.md`, `docs/README.md`. Untracked before implementation: `CONTRIBUTORS.md`, `WALLET_PAYMENT_SOL_6_1_CONTINUATION_PROMPT.md`, `docs/refrence/`, `docs/specs/LANDLINE_AND_MULTILINE_ABOUT_AGENT_PROMPT.md`, `docs/specs/NEXTAP_SECURITY_PERFORMANCE_IMPROVEMENTS_SPEC.md`, `docs/specs/SECURITY_ARCHITECTURE_REMEDIATION_AGENT_PROMPT.md`, `docs/specs/SECURITY_ARCHITECTURE_REMEDIATION_PLAN.md`, `scripts/performance/`. These files are not implementation-owned.

## Baseline verification

- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed, 14 existing warnings (unused declarations, image elements, anonymous k6 export).
- `npm.cmd test -- --run`: 35 files, 233 tests passed.
- `npm.cmd run test:db`: all 27 migrations and eight SQL suites passed using disposable PGlite, including anonymous publication RPCs.
- `npm.cmd audit --json`: seven findings (three critical, three high, one moderate), including Next 15.5.27, Zod 4.1.5, Vitest 3.2.4 and transitive worker/mocker dependencies.
- Baseline commit: `f33c1a85d4ecd49d7d46db05106e86362baa66f3`; branch `staging`.
- Staging catalog read through Supabase MCP, project `flkakuysakgwfoemgbwn`; Production untouched. Staging has two owner records. `business-media` is public, 5 MiB object limit, JPEG/PNG/WebP allowlist, unconditional anonymous SELECT.
- Staging has 27 recorded migrations with historical timestamp differences; the local relationship guard `20261024010000_legacy_relationship_guards.sql` is absent from hosted history. This blocks claiming schema parity.

## Caller inventory

- `private.is_owner()`: owner RLS for businesses, pages, sections, publications, batches, cards, history, media, audit and aliases; storage writes; privileged draft, publication and inventory functions. Application authorization reads `owner_users` in `src/lib/auth/owner.ts`, `src/lib/admin/mutation.ts`, login, draft and contact-preview handlers.
- `save_page_draft`: application no longer calls this RPC directly; SQL `save_contact_draft` composes the private provider-profile overload. Both eight- and nine-argument public/private legacy signatures remain granted to authenticated users. SQL contracts exercise legacy compatibility.
- `save_contact_draft`: `src/app/admin/businesses/actions.ts` persists complete revision-checked drafts and optional publication.
- `publish_page`: legacy business action and SQL composition. Public wrapper delegates to private publication transaction.
- Cards: assignment handler calls `assign_card_once` for JSON/idempotent requests and `assign_card` for form requests; deletion handler calls preview/commit; operations handler calls batch and page creation; manufacturing exports call `card_batch_snapshot`. Private receipts and scope fingerprints protect retries/deletion.
- Managed media: upload handler calls `storeManagedImage`; store returns public business-media URLs. `resolveContactPhoto` prepares derivatives on save/preview. `contact-download` fetches frozen public derivative paths. `isOptimizableImage` permits configured public WebP objects and local rasters. Snapshot and editor image fields retain absolute public storage URLs.

## Decisions and assumptions

The user's final tenancy instruction supersedes the earlier sole-owner answer: multiple trusted internal administrators intentionally manage all businesses. No business isolation and no sole-owner constraint. Explicit global roles/capabilities and controlled owner admission are implemented in the new migration. Existing owners are grandfathered as administrators. See the accompanying ADR.

Phase 1 uses Next 15.5.28, Zod 4.6.7, matching Next ESLint config, and Vitest 4.1.12. Vitest 3.2.7 still contains vulnerable mocker/worker dependencies; the major test-runner upgrade is necessary to clear those advisories. Vite remains 7.3.7 to avoid an unrelated major toolchain change. Zod override deduplicates vulnerable E2E/MCP toolchain copies. npm 10.9.8 crashed resolving optional Vitest peers; npm 11.6.2 resolved isolated manifest copies, then npm 10 regenerated platform entries successfully.

## Implementation status (2026-10-24)

- Phase 0: baseline, caller inventory, tenancy ADR and read-only staging catalog inspection recorded. Hosted migration history differs from local history; the hosted schema does not include local `20261024010000_legacy_relationship_guards.sql`, so schema parity is not established.
- Phase 1: patched Next, Zod and Vitest; explicit SVG optimization denial; CI audit and manifest/lock checks. A normal clean `npm ci` completed with zero vulnerabilities. Typecheck, lint, 243 unit tests and a production build passed.
- Phase 2: global role/admission migration, capability checks in business actions, and SQL role matrix cover editor, publisher, inventory, auditor and external users, direct table/RPC paths, and two-business global access. Disposable PostgreSQL migrations and real PostgreSQL concurrency/rollback checks pass. Hosted PostgREST/auth verification and role-provisioning runbook checks remain.
- Phase 3: private bucket migration, publication reference tracking, current-publication read policy, historical deletion protection, bounded media route, and bounded contact/photo reads are implemented. SQL and unit tests pass. Public/media route-rendering smoke passes; write-enabled media lifecycle E2E and staged rollback sequencing remain.
- Phase 4: draft validation/normalization and the publication snapshot type moved to `src/lib/business/`; draft save/publish server actions are split into `draft-actions.ts`, with compatibility wrappers retained. Provider/contact schemas already lived in domain modules. Further editor responsibility decomposition remains incomplete.
- Phase 5: incomplete. Read-only staging `EXPLAIN` plans and `pg_stat_user_tables` showed approximately 360 businesses, 359 pages, 547 cards, and 97 batches. The substring searches on business name, page slug, serial, and token currently use sequential scans at that size; the batch cursor query uses `card_batches_admin_cursor_idx`, and filtered card lookup uses `cards_batch_idx`. `pg_trgm` is not installed. No search indexes were added because the measured small relations do not justify their extra write and storage cost; retain the substring contract and revisit trigram indexes when staging cardinality or query latency warrants them. A deployment-wide shared rate limiter remains unimplemented. The local limiter is process-bound, and no shared limiter service or validated deployment configuration is available in this checkout.
- Phase 6: incomplete. Clean install, typecheck, lint, 243 unit tests, all 29 migrations/SQL contracts, real PostgreSQL concurrency/rollback, and production build pass. Public desktop/mobile smoke passed 14/14. The additional public-security run passed 16 checks and skipped the credentialed non-owner test; its two wallet-copy checks failed because the deployment served the disabled experimental-dialing state even with the test flag set. This is outside changed modules and has not been reproduced on the baseline commit. The push of `c2ae2c2` to `origin/staging` passed CI's `quality` job; Hosted Staging E2E run `40059647127` was pending at handoff. Full auth, card, contact and media E2E and hosted-shaped schema comparison remain. No hosted migration was applied; production was not touched.

## Migration sequencing and rollback

Deploy the application media proxy before making `business-media` private. The proxy accepts both the current public-object URL shape (persisted in immutable snapshots) and the new private bucket read policy; public URL strings and card/QR/NFC formats remain unchanged. Then apply the authorization migration before the media migration, since storage policies depend on capabilities. Keep both migrations forward-only in the release runbook; the disposable SQL suite verifies their clean application and media contracts.

If media rollout must be rolled back, keep the bucket private and roll back only to an application build that understands `/api/media`. Restoring a public bucket while unpublished drafts are present would expose them. Returning to an older application that fetches public Storage URLs requires first moving draft assets to a separate private bucket and reviewing publication references; do not use `UPDATE storage.buckets SET public=true` as a quick rollback. The authorization migration should not be reversed by deleting role/admission data: restore a reviewed prior function/policy set only after the staging owner confirms that no newly admitted role depends on it. No rollback SQL has been executed against hosted staging.
