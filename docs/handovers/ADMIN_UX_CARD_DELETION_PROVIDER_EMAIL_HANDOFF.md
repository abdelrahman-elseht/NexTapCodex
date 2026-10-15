# NexTap: admin interactions, permanent inventory deletion, provider logos, and mobile email

Prepared: **2026-10-14, Africa/Cairo**

Repository: `F:\projects\NexTabCodex-integration-preprod`

Implementation branch: proposed `feature/admin-ux-card-deletion-provider-links`

Release route: **feature branch → reviewed PR to `staging` → accepted Staging evidence → release PR to `main` → Production build**

This document is an implementation handoff. Application changes, deletions, database migrations, merges, and deployments were not performed while preparing it. Requirements 1–3 below are requested implementation scope. Requirement 4 is a discussion with a proposed email behavior; keep its decision status explicit.

## Goal

Make owner administration work in place: ordinary actions must update the relevant state without reloading the document, resetting forms, or losing the owner's position. Add genuine permanent removal of individual/selected cards and entire batches. Replace GitHub, Behance, and ArtStation placeholders with recognizable monochrome brand marks, and add Talabat and the user-identified Fast App as configurable delivery providers. Establish a sustainable mobile-first email-link policy using platform evidence and real-device validation.

Completion means the full requested admin surface has been audited and covered, deletion remains authorized and atomic, existing manufacturing and public-card behavior still works, all provider destinations survive save/preview/publish, and the accepted implementation passes the feature/Staging/release gates. Do not reduce this to a single card-table fix or representative icon screen.

## Requested behavior and decision status

| Track | User request | Implementation contract |
| --- | --- | --- |
| A | Admin actions should not refresh the whole page | No full document navigation for in-place mutations or list filtering/pagination; preserve working state and give local progress/success/error feedback. Intentional route changes use client navigation. |
| B | Completely delete some cards or batches | Hard-delete selected inventory rows and their dependent assignment history. Whole-batch deletion removes every child card and the batch in one transaction. Disabling stays a separate reversible action. |
| C | Proper monochrome GitHub, Behance, ArtStation icons; Talabat and Fast links/logos | Real, locally served brand assets in editor and public rendering, plus complete provider metadata, input validation, saved destinations, and publication behavior. |
| D | Discuss whether `mailto:` is sustainable for real mobile use | Explain OS/browser handler dependencies, investigate the reported Chrome behavior, and propose same-context email links plus a visible address/Copy email fallback. The recommendation has not yet been selected as an implementation decision by the user. |

Defaults for the builder: retain the established Arabic/English interface and visual system; permit deletion in all existing card statuses with an explicit impact confirmation; keep businesses/pages/publications intact; use owner-supplied HTTPS delivery destinations; treat app-launch behavior as unverified until measured. These defaults make the requested work concrete and must be visible in the PR.

## Verified starting point

These observations were made on 2026-10-14. Recheck them when implementation starts.

- Inspected local source: `4f5eb108ffdf295e6fe7370b0783067e48a69e68`, on `feat/card-serial-provider-icons`.
- Fresh remote read: `origin/staging` is `adb09bfcbb1d4129351c8dc1ea8c088503283d88`, containing the existing provider feature through PR #4. Start the new feature from the latest `origin/staging`; no prerequisite cherry-pick is currently required.
- Fresh remote read: `origin/main` is `9876535e540f72e603a24cd8150f43f551461cb0`. Main and Staging have different commit histories/SHAs but currently the **same tracked tree**, `1efdcdcc4e5a2d89d86a6581af9d8bc01f2489f7`; `git diff origin/main origin/staging` is empty. The provider feature is therefore present in both snapshots even though its original commit is not an ancestor of Main. Check content/tree identity as well as ancestry, and review the complete future release diff.
- `HOSTED_STAGING_VALIDATION_HANDOFF.md` already has user-owned changes. Preserve them. Historical handoffs include older branch/deployment observations; they are context, not live provider state.
- `.codegraph/` is absent. Use [the architecture map](../ARCHITECTURE.md) and targeted searches. If it exists in a later checkout, use CodeGraph before locating/reading code.
- Supabase MCP read-only inspection confirmed Staging project `flkakuysakgwfoemgbwn`, **22 migration entries**, RLS on the relevant public tables, and the foreign-key/policy behavior described below. This preparation did not query customer rows or contact the Production database.
- Environment mapping in `src/lib/config/environment.mjs`: Staging `flkakuysakgwfoemgbwn`; Production `jezpobjlfvihikplxrta`. Preserve `assertSupabaseEnvironment` and its prohibitions on development/E2E mutations against Production.
- Live GitHub protection read: both `staging` and `main` require strict `quality` checks, one approval, approval of the last push, stale-review dismissal, and conversation resolution; force pushes and branch deletions are prohibited. `main` enforces administrators and linear history. `staging` currently does not enforce administrators or linear history. Do not use that difference to bypass review.
- Hosted browser configuration currently supports desktop `1440×960` and mobile viewport `390×844`, using the repository's e2e runner and Playwright browser engine. These are browser viewport tests, not actual iOS/Android OS handoff tests.
- Deployment settings, current production migration parity, Auth setup, and live customer devices were not revalidated here. Older notes mentioning Vercel's `beta01` Production Branch must be checked against live settings before a release, rather than copied forward as a current fact.

## Source map for the implementation

Read [product context](../product/PRODUCT.md), [user/admin stories](../specs/USER_ADMIN_STORIES.md), [the documentation index](../README.md), and the current release/environment handoffs first. `@/*` resolves to `src/*`.

| Area | Current entry points | Why they matter |
| --- | --- | --- |
| Cards list | `src/app/admin/cards/page.tsx` | Server-rendered lists, native GET filters, plain anchors for some navigation, native assignment forms, batch creation, cursor pagination, counts based on the visible rows. |
| Card assignment | `src/app/api/admin/cards/assignment/route.ts` | Origin/session/owner checks, `assign_card` RPC, native POST/303 response. Its comment documents a production RSC redirect stall that the current transport avoids. |
| Batch creation | `src/app/admin/businesses/actions.ts`, `createBatch` | Validates name/quantity, creates random tokens, uses the idempotent `create_card_batch` RPC, then redirects to batch details. |
| Batch details/exports | `src/app/admin/cards/batches/[id]/page.tsx`, sibling `manufacturing.zip/route.ts`, `src/app/admin/cards/export/route.ts` | Details and ZIP require `cards.length === batch.quantity`; details also reject zero cards. CSV does not currently verify that the batch exists. These assumptions must change with partial deletion. |
| Manufacturing library | `src/lib/cards/card-manufacturing.ts` | Stable QR/NFC URLs, serial filenames, manifests, NFC CSV, ZIP generation. |
| Card history/resolver | `src/app/admin/cards/_components/card-history.tsx`, `src/app/api/admin/cards/[id]/history/route.ts`, `src/app/c/[token]/route.ts` | History is fetched lazily; public resolution is live and returns no-store redirects. Deleted tokens already fit the existing invalid/unavailable state. |
| Business editor | `src/app/admin/businesses/_components/business-editor.tsx`, `src/app/api/admin/businesses/draft/route.ts` | Existing local draft/revision/upload state and JSON save/publish transport already avoid redirecting the editor tree. Preserve this behavior. |
| Other admin forms | `src/app/admin/businesses/new/page.tsx`, `src/app/admin/businesses/[id]/page.tsx`, business list, `actions.ts` | Business creation, page activation/deactivation, branch creation, list filters, and remaining reachable mutation forms belong in the no-reload audit. |
| Confirmation UI | `src/components/ui/confirm-submit-button.tsx`, `submit-button.tsx` | Current dialog submits a native form. A fetch-based confirmation needs pending state connected to its actual promise, plus predictable cancel/focus behavior. |
| Provider model | `src/lib/business/providers.ts`, `editor-items.ts`, editor picker and `item-editor.tsx`, draft sanitization in `actions.ts` | Provider IDs/labels/metadata, URL normalization, shared profile inheritance, nested actions, picker groups, and saved content must agree. |
| Public provider/email rendering | `src/components/business/public-snapshot.tsx`, `social-links.tsx` | Active renderer has brand maps and a common `ExternalLink`; the separate social renderer has its own older host map. Confirm reachability before updating or consolidating both. |
| Assets | `public/icons/social/`, `SOURCES.md` | The three requested professional icons are currently black rectangles containing text placeholders. |
| Database | `supabase/migrations/`, `supabase/tests/`, `scripts/database/test-database.mjs` | Existing schema, atomic RPCs, ACLs, identifier immutability, and disposable SQL contract runner. |
| Release/test identity | `.github/workflows/ci.yml`, `hosted-e2e.yml`, `scripts/ci/hosted-staging-preflight.mjs`, `hosted-browser.ts` | Quality checks, protected hosted runs, bypass-secret confinement, exact deployment identity, and sanitized summaries. |

Keep new route-specific UI beside the route in `_components/`. Put shared behavior behind focused modules in the documented `src/lib/<domain>/` folders. Use literal paths for bracketed Next.js directories and UTF-8-safe writes. A repository-wide move or redesign is unnecessary for this feature.

## Guardrails

1. **Isolated feature work.** Use a new feature branch from current Staging, preserving unrelated working-tree edits. If the current checkout is dirty, use an approved separate worktree/checkout. Never reset, clean, auto-stash, or commit the user's existing changes as part of this task.
2. **Protected release path.** Changes reach `staging` and `main` through reviewed PRs. No direct pushes, force pushes, admin overrides, or weakened branch protection. Prepare concrete code, tests, diffs, migration plans, and release evidence before any remaining merge/deployment approval.
3. **Environment identity before mutations.** Check branch, origin, deployment SHA, project ref, and fixture ownership. Production is `jezpobjlfvihikplxrta`; it is prohibited for development, seeds, deletion experiments, and acceptance-test mutations. Do not link a local shell to Production.
4. **Synthetic test data only.** Use a unique run namespace and record exact created IDs. Cleanup/deletion tests can remove only that run's fixtures. A query matching a generic name, all unassigned cards, or every batch is not acceptable cleanup scope.
5. **Authorization at both boundaries.** Every mutation verifies session claims and the `owner_users` allowlist; database access/RPCs also enforce owner authorization. Authentication alone is insufficient. Protect cookie-authenticated routes against cross-origin requests, validate IDs/body sizes, and keep responses private/no-store.
6. **No client privilege escalation.** Never place service-role keys, database passwords, bypass secrets, tokens, or owner passwords in browser code, chat, screenshots, logs, or public artifacts. Reuse protected environment credentials and opaque e2e credential handling.
7. **Reviewed database changes.** Keep migrations in source control and apply each once in order. Inspect current schema/ACLs first. Iterate on a disposable/local database; hosted DDL goes through a reviewed migration (`apply_migration` where MCP is the permitted deployment path), not ad hoc `execute_sql` changes. Do not rewrite previously applied migrations.
8. **Precise destructive scope.** Confirm exact card IDs or one batch ID and display the impact before deletion. Deleting a batch includes all its cards; deleting selected cards never expands to every row matching the current search/filter. Server validation must reject stale confirmation scope.
9. **Preserve business content and identifiers.** Removal affects physical inventory and dependent history, not the associated business/page/publication/media. Surviving tokens, serials, batch membership, QR/NFC payloads, and business destinations remain stable.
10. **Honest evidence.** A no-reload assertion must test document identity, not just an unchanged URL. A mobile viewport does not prove native app launch. A skipped deletion/owner test does not prove acceptance. Record failures, retries, skips, and blockers.

## Track A — Admin actions without full document refresh

### Scope and expected interactions

Audit every reachable action under `/admin`, map its transport and result, and include the audit in the implementation report. Do not assume every server-action redirect is a browser document reload: distinguish client route transitions, RSC data requests, and actual top-level document navigation with browser evidence.

| Action family | Required outcome |
| --- | --- |
| Batch creation | Inline validation/progress and exactly one batch per request key. On success, update the list and show a details/download action in place; use client navigation if a deliberate create-to-details transition is retained. |
| Card assign/reassign/activate/disable | Update the confirmed card row, dependent status/counts and fetched history without losing inventory filters, cursor, scroll, or unrelated row selections. |
| Card/batch deletion | Keep the dialog pending until commit; remove confirmed items and reconcile counts/filter options in place. Deleting the detail page's own batch may navigate back to Cards using the client router. |
| Business creation | Validate without losing fields. On successful creation, client-navigate to the editor; do not force a document reload. Prevent duplicate business creation on repeated submit/retry. |
| Business draft/publish/archive settings | Preserve existing revision and upload protections, selected section, edits made during an in-flight save, and unpublished-versus-published semantics. |
| Page active state and branch creation | Update the relevant controls/branch list and publication eligibility while preserving any unsaved business editor data on the same screen. |
| Sections/items, ordering, media, copy controls | Local changes stay local until the intended save/publish action; failed saves/uploads preserve draft data. Reachable legacy persistence forms also follow the interaction contract. |
| List search/filter/clear/pagination | Update URL-backed state through client navigation with predictable back/forward behavior; keep unaffected draft/selection state and correct result counts. |
| Exports, previews, intentional navigation, logout | Downloads must not replace the dashboard document; intentional route changes, public previews, external links and session exit use their appropriate navigation. No promise that the user can never leave a page. |

### Implementation approach

- Prefer the repository's existing JSON mutation pattern for the card-table transport: fetch the existing/new route, run the atomic RPC, and return a structured result instead of a 303 for hydrated UI submissions. Preserve origin/session/owner checks. A negotiated JSON response and native fallback can coexist, but do not fetch a 303 and treat the resulting HTML as JSON.
- Reuse domain mutation logic across transports. A suitable result shape includes `ok`, a stable error code/message, authoritative changed entities/counts, and any deliberate `nextHref`. Classify unauthenticated, forbidden, invalid, conflict, missing, and server-failure outcomes; never emit success merely because `fetch` completed.
- Give controls real idle/pending/success/error states. Lock conflicting mutations on the same card/batch, prevent repeat confirmation while pending, and keep unrelated work usable. Destructive removals wait for server commit; reversible optimistic changes require rollback/reconciliation on rejection.
- Preserve the batch request key through retries and generate a new one only for a new logical creation. Extend equivalent duplicate-submit/retry protection to other creation actions as needed.
- Update only the affected state, then reconcile with an authoritative read without clearing local work. Avoid a broad `router.refresh()` that overwrites drafts, refetches the entire screen unnecessarily, resets selections, or causes a visual flash. `router.refresh()` itself is an RSC refresh, not inherently a document reload; if used, prove the actual preservation behavior.
- Use `Link`, the client router, or the framework's client-capable form navigation for internal routes/search/pagination. Preserve shareable filters, browser history, cursor correctness, and RTL scrolling. Avoid `location.reload`, `location.assign`, forced page replacement, or success redirects for in-place mutations.
- Preserve server cache/publication invalidation. Removing a browser reload does not replace `revalidatePath`/publication-pointer handling or live public-card resolution.
- Keep confirmation dialog semantics accessible: initial focus on cancel for destructive actions, Escape/cancel before submission, focus restoration after completion, errors announced, and a visible result. A dialog cannot imply a committed deletion while the request is still pending.
- The existing business editor is a regression reference. Do not restore the old redirect-based save flow or remount its local state when a sibling page-state/branch form changes.
- Retest the assignment change under **`next build` + `next start`**. The current native endpoint was introduced for a production RSC stall; a passing development-server check is insufficient.

### Acceptance criteria A

- **A1:** An action audit covers all reachable admin controls/forms, including cards, batches, businesses, page state, branches, filters/pagination, media, section/item editing, save and publish.
- **A2:** Every ordinary in-place action completes with the same top-level document instance and no new document navigation request. Expected fetch/RSC requests are allowed.
- **A3:** Filters, current cursor, useful scroll position, expanded history, unrelated row selections, selected section, and unsaved inputs survive both success and failure unless the action intentionally changes that state.
- **A4:** Failed validation, RPC errors, network failures, expired authentication, and a lost response do not display false success or discard the user's work. Retry reconciles ambiguous outcomes rather than blindly duplicating them.
- **A5:** Repeated creation/confirmation clicks produce one logical operation; local pending indicators settle correctly and conflicting operations cannot race in the same UI.
- **A6:** Status/counts/history/eligible-page state agree with committed data. A row that no longer matches an active filter disappears correctly; deletion of the last row on a cursor page provides a usable preceding/first-page fallback.
- **A7:** Existing draft isolation, edit-during-save handling, upload locking, publication visibility and public resolver contracts pass unchanged in meaning.
- **A8:** Desktop/mobile viewport and production-server assignment/disable/reassign journeys pass. Update tests that currently require `?assigned=1`/`?created=1` redirects to assert the new behavior, rather than deleting those journeys.

## Track B — Permanent card and batch deletion

### User-facing contract

Provide a clear permanent-delete action on a card row, an explicit selection-based action for several cards, and a whole-batch delete action in its summary/details. Selection is by stable UUID, with the count always visible. If selections can survive pagination, keep their explicit IDs and show that they span pages; clearing filters must never silently enlarge the scope. Use one card mutation service/RPC contract for single and selected-card operations.

Deletion is available for **unassigned, active, disabled, and replaced** cards. Confirmation shows serial/batch identity, the exact current number of cards, operational-status/assigned-card impact, and the fact that already printed QR/NFC links will stop resolving to the business. Require typing the batch code for whole-batch deletion and an explicit permanent-delete acknowledgement for cards; provide cancel as the safe initial focus. Active/assigned cards need a clear additional impact acknowledgement, not a hidden status restriction that removes requested capability.

“Completely delete” means operational card rows disappear, assignment-history rows for those cards disappear, new exports omit them, and their public token resolves to the existing invalid/unavailable experience. It does not delete associated business content. Keep only a minimal administrative deletion audit (actor, time, entity ID/type, counts/request ID), without raw card tokens or a restoreable inventory payload. State this retention clearly in the implementation report; this is operational inventory removal, not a claim to erase backups or previously downloaded printer files.

### Database dependencies that must be handled

Read-only Staging metadata confirms:

- `cards.batch_id → card_batches.id` uses **ON DELETE RESTRICT**.
- `card_assignment_history.card_id → cards.id` uses **ON DELETE RESTRICT**.
- Card history has an owner read policy but no owner delete policy. A normal browser/client delete cannot simply remove it with the existing permission model.
- Cards/batches currently have broad owner mutation policies. Direct Data API deletes can bypass a new confirmation/audit/count protocol unless delete privileges/policies are narrowed as part of the design.
- `create_card_batch` computes the next daily serial from **`max(serial)` in surviving cards**. Removing the highest serial or all cards can permit reuse of manufactured serials.
- Batch detail/ZIP readers use the original `quantity` equality; removing one card would make a surviving batch appear missing or block its ZIP. The detail route also assumes a nonempty batch.

Implement an atomic database operation, not a client loop deleting history/cards/batches in separate requests. Retaining the RESTRICT relationships and deleting dependencies explicitly is a suitable approach. Do not disable foreign keys or introduce an unrestricted cascade API to make errors disappear.

### Required transaction and security design

1. Validate and deduplicate explicit IDs or the target batch; enforce bounded request size. Batch deletion queries every child in that batch, including children outside the visible page and any legacy batch larger than today's 1,000-card creation limit.
2. Authenticate the actor and verify the owner allowlist inside the operation. UI confirmation is an intent safeguard, not an authorization boundary.
3. Produce a deletion preview bound to actor, operation, exact targets/current membership, current card status/assignment/version, and expiry. Return a server-verifiable confirmation token or equivalent version fingerprint. Recheck it inside the committing transaction. Changed membership/status/assignment produces a conflict and a fresh preview; a stale confirmation cannot delete a newly active or newly included card unnoticed.
4. Lock batches and affected cards in a consistent order. Coordinate with assignment/status operations and identifier issuance; verify concurrent assignment-versus-delete and delete-versus-delete behavior with real transactions. No orphaned history, half-removed batches, or conflicting success responses.
5. Remove affected assignment history, then cards, then the batch for a batch operation. Keep a surviving batch when only some/all individual cards were selected. Write the minimal audit and operation result in the same transaction; any failure rolls back all these changes.
6. Return authoritative deleted counts, affected batch summaries and operation identity. Use an idempotency/result record or another explicit committed-outcome mechanism so a lost response/retry can be reconciled; a missing target is not proof that this request deleted it. Repeated confirmation must not recreate inventory or add duplicate audit entries.
7. Prevent direct unguarded Data API deletion of cards/batches/history. Preserve the required SELECT/INSERT/UPDATE and existing assignment/creation contracts. Prefer invoker security where permissions allow it; if privileged history cleanup is required, use a narrowly scoped private SECURITY DEFINER implementation with owner checks, schema-qualified relations, empty `search_path`, and a controlled public wrapper. Revoke default PUBLIC/anon execution and grant only the intended authenticated entry point. Review advisors and negative authorization tests.
8. Keep a persistent daily serial high-water counter, initialized from existing issuance before deletion is enabled, with transaction/advisory locking and atomic allocation. Preserve `NT-YYYYMMDD-NNNNNN`, daily capacity handling, and batch idempotency. Counters and the existing batch-code sequence never move backwards because inventory was deleted. Retrying an already deleted batch-creation request must not resurrect it: retain a minimal operation receipt independent of the batch row.
9. Continue generating fresh cryptographically random tokens server-side; expose no old-token restoration/reassignment flow. If permanent non-reuse must be enforced even for an authorized caller supplying `card_tokens` directly, add a private nonresolving token-fingerprint issuance guard and test it. Retaining such an issuance digest must be documented; it cannot act as a public resolver or a restoreable card record.

New migrations should be additive and compatible with the existing app where possible. Use `supabase migration new <name>` after inspecting CLI help for hand-authored migrations, and verify local history. Document any ACL/reader changes that require coordinated application deployment. Do not guess a timestamp or change old files.

### Quantity and manufacturing contract

Use **original issued quantity** and **current remaining inventory count** as different values. Recommended default: preserve `card_batches.quantity` as its original creation quantity, derive remaining/deleted counts authoritatively, and label them clearly in the UI. Do not keep presenting a partially deleted batch as if all original cards still exist.

- A partially deleted batch remains viewable. Details and ZIP use surviving cards, with accurate current counts and serials; change the strict original-quantity equality assumption.
- New CSV/ZIP exports contain surviving rows only. Preserve each remaining card's serial, token, QR/NFC URLs, ordering, filenames, and valid manifest/index content. Generate a consistent read snapshot so a concurrent deletion does not mix membership across export files.
- A batch with zero remaining cards, removed through individual/selected deletion, remains a valid empty batch until explicitly deleted. Show an empty state, no QR preview, and disabled download controls. Direct export requests for an existing empty batch return a defined empty-inventory response (recommended `409`), not a missing-batch error or misleading successful archive.
- A deleted/nonexistent batch returns `404` for authenticated details/CSV/ZIP reads. Fix the current CSV route's header-only success for a missing batch.
- Export requests started after deletion commits cannot include removed cards. Already generated/in-flight downloads and previously downloaded printer files cannot be recalled; the confirmation copy should state that printed/encoded cards and old files need to be discarded or replaced.
- A deleted token returns the existing `/card/unavailable?state=invalid` contract for both `?via=qr` and `?via=nfc`; it must not disclose the deleted serial, business, or historical assignment. Surviving active/unassigned/inactive card behavior remains correct.
- Check any new schema's RLS/grants/indexes and regenerate types if the project uses generated database types. Do not expose operation receipts, serial counters, or token fingerprints to anonymous clients.

### Acceptance criteria B

- **B1:** Single-card, explicit selected-card, and whole-batch permanent deletion are reachable and cancelable; all existing card statuses are supported with accurate impact confirmation.
- **B2:** Anonymous and authenticated non-owner clients cannot preview/execute deletion; missing/cross-origin/invalid/unconfirmed/stale requests cannot mutate data. Direct Data API/RPC access also obeys the intended permissions.
- **B3:** Successful deletion removes exactly the confirmed card rows and their history. Whole-batch deletion removes every child plus the batch atomically, including hidden pagination rows. Unselected cards and associated business/page/publication/media data remain intact.
- **B4:** Foreign-key/history/audit failure leaves all original operational rows intact. A concurrent assignment or changed preview returns a defined conflict or a coherent serialized outcome.
- **B5:** UI removes committed rows in place and updates counts, history state, batch options and cursor behavior; a failed delete keeps the dialog/context and cards available for recovery.
- **B6:** Partial/empty batches and exports follow the quantity/remaining-count contract. Deleted batch details/CSV/ZIP return `404`; new exports contain no deleted cards and decode to the correct remaining QR/NFC destinations.
- **B7:** Both old QR/NFC links for a deleted card become unavailable, while all surviving card paths retain their prior destinations/status semantics.
- **B8:** Deleting the largest serial/all cards followed by same-day batch creation cannot reuse issued serials; concurrent creation is unique; batch-code sequence and immutable identifiers remain valid. Creation retry after batch deletion cannot resurrect a deleted operation.
- **B9:** Lost-response retries reconcile committed outcomes without duplicate side effects/audits; replayed/expired confirmation cannot widen scope or remove new records.
- **B10:** Minimal audit/operation/issuance retention and backup/export limitations are documented. No raw card tokens are added to telemetry, deletion receipts, public responses, or published test evidence.

## Track C — Monochrome provider assets and delivery links

### Brand identity and sources

| Provider ID/label | Identity reference | Required asset/destination behavior |
| --- | --- | --- |
| `github` / GitHub | [GitHub brand/logo guidance](https://brand.github.com/foundations/logo) | Recognizable permitted GitHub mark in monochrome, replacing the text rectangle; correct profile/project URL. |
| `behance` / Behance | [Behance](https://www.behance.net/) | Official/verified Behance brand geometry, replacing the text rectangle; owner-supplied profile/project URL. |
| `artstation` / ArtStation | [ArtStation](https://www.artstation.com/) | Official/verified ArtStation brand geometry, replacing the text rectangle; owner-supplied portfolio URL. |
| `talabat` / Talabat | [Talabat Egypt](https://www.talabat.com/egypt) | Recognizable monochrome Talabat mark; owner's restaurant/store/share HTTPS destination. |
| `fast` / Fast App | [User-supplied Android listing](https://play.google.com/store/apps/details?id=com.ZED.zid_app), [user-supplied iOS listing](https://apps.apple.com/us/app/fast-app/id1671447192) | Correct mark for these exact listings; owner's verified merchant/share HTTPS destination where available. |

Fast identity is no longer an unnamed-provider question. The Android listing identifies **Fast App**, package **`com.ZED.zid_app`**, in Food & Drink, with developer **Miracle Development**. Apple's lookup for the supplied app identifies **Fast App**, track **1671447192**, bundle **`com.example.zidApp`**, seller **mohamed elshora**. The iOS description describes restaurant order/menu management. These are store observations, not proof that both listings expose the same consumer ordering flow or a usable merchant deep link. Confirm the audience/destination before labeling a link “Order from this restaurant.” Do not substitute FastOrder, Fast Food, or another brand because its asset is easier to find.

The store links identify the app; they are not a merchant URL or proof of an app-link/deep-link contract. A configured delivery action needs an explicit owner-supplied destination. If Fast offers only store destinations, present a small destination screen with explicit Android/iPhone store choices and an accurate “Get Fast App” label, or use an official cross-platform landing page once verified. Keep this optional configuration separate from a merchant “Order” action; never choose one mobile store as a silent fallback for every device.

### Implementation checklist

1. Replace the three existing placeholder SVGs with correct brand geometry. Add local monochrome Talabat/Fast assets in the existing icon organization or a documented provider directory. Use vetted SVGs where available; a clean transparent raster derived from an official mark is acceptable when no trustworthy vector is available. Do not invent an AI logo, text rectangle, generic delivery glyph, or distorted tracing as the brand.
2. Update `SOURCES.md` with the exact source URL, retrieval date, source version/license or brand-use terms, and monochrome changes. The repository cites Simple Icons, but CC0 for icon geometry does not remove trademark restrictions. Verify the chosen version actually contains the requested brand and allows the intended identification use.
3. Integrate `talabat` and `fast` into `ProviderId`, metadata, labels, normalization, destination policy, profile inheritance/overrides, and server draft validation. Start with `valueKind: url`, `external_url`, and **no claimed verified deep link**. Reject unsafe schemes, embedded credentials, control characters, and malformed URLs. A provider hostname used for identity detection must match exactly or by a real subdomain boundary, never substring matching.
4. Add delivery choices to relevant editor picker groups: quick actions, useful links, and nested service/order actions where supported. Preserve professional-provider choices in social groups. Delivery belongs with ordering; do not require the owner to disguise it as a payment or social network.
5. Update every icon registry used by the picker, row editor, draft/live preview, published page, and reachable legacy renderer. Consolidate duplicated registries if useful behind one small domain interface; do not introduce a broad icon framework for five assets.
6. Save the actual full destination supplied by the owner without inventing vendor URL patterns, custom app schemes, Android intent URIs, or unverified App Store redirects. HTTPS links may hand off to an installed app when the provider owns that association; fallback behavior remains the provider/OS's responsibility.
7. Prefer a direct same-context HTTPS navigation for delivery app/share links to allow a normal OS handoff and return path; validate installed/uninstalled behavior on physical devices. Avoid asynchronous popups. Preserve the accepted same-context payment behavior and the reviewed policy for ordinary social URLs.
8. Ensure profile inheritance and per-item overrides work for both new providers, including nested actions. Blank/disabled/unsafe items must not render broken links; labels can be customized without changing provider identity.
9. Keep the existing quiet visual treatment: one-color artwork, transparent background where appropriate, consistent optical size/baseline/padding, crisp rendering at current 24–35px placements, readable contrast, clear accessible labels, and mobile touch targets of at least 44×44 CSS pixels. Match Arabic RTL/English LTR layouts.
10. Verify existing saved snapshots and generic `order`/custom URLs continue to render. Do not rewrite existing published JSON or merchant URLs just to assign a new brand automatically. Adding JSON-backed provider IDs does not inherently require a database schema migration; inspect actual validators before deciding.

### Acceptance criteria C

- **C1:** GitHub, Behance, and ArtStation use recognizable monochrome marks with no text placeholders in any reachable admin/preview/public location.
- **C2:** Talabat and the specified Fast App are selectable, editable, saveable, and publishable in the intended ordering/link/action contexts; their monochrome assets load locally without 404s or third-party CDN dependence.
- **C3:** Exact configured destinations survive draft reload, preview, publish, shared-profile updates and explicit overrides. Brand identity never depends on a custom label.
- **C4:** Invalid/unsafe URLs are rejected consistently on client/server; disabled/empty items render no broken action; malicious lookalike domains do not receive a trusted-provider logo through host inference.
- **C5:** Existing social, payment, generic ordering and custom URLs retain accepted behavior. Asset provenance and legal/brand-use references are recorded for all changed files.
- **C6:** Screenshots at desktop/mobile sizes and Arabic/English layouts show correct geometry, spacing, contrast and accessible touch/focus behavior. SVG external resources/scripts and inappropriate embedded assets are absent.
- **C7:** For Talabat/Fast, record real-device destination results with the app installed and uninstalled. Clearly distinguish merchant ordering from app installation/restaurant management; unresolved provider-side deep linking is reported without falsely advertising a working order flow.

## Track D — Mobile-first email discussion and proposed policy

### Answer to the product question

**`mailto:` is sustainable as the standard way to request an email composer on iOS, Android and desktop, provided the experience includes a usable fallback. It cannot guarantee that a visitor has a configured mail handler or that any message is sent.** Apple's default email-app settings and Android's email-intent documentation support the platform model; desktop Chrome can delegate to an OS application or an allowed webmail protocol handler.

An iPhone successfully opening its mail app proves that configuration works. Chrome showing a blank tab does not alone prove the scheme is unsuitable. The actual device/OS, installed/default email app, account setup, protocol-handler settings and rendered link attributes matter.

Current source generates `mailto:${address}` in `actionHref`, but its common `ExternalLink` adds **`target="_blank"`**, including email actions. An external protocol can be handed to software after a new browsing context is created, leaving a blank tab behind. This is a concrete code risk and plausible contributor, **not a confirmed diagnosis of the user's particular Chrome incident**.

### Recommended implementation, if selected

- Keep a direct semantic `mailto:` anchor, using the current browsing context (`target` absent or `_self` with no conflicting inherited base target). Review the same scheme policy for `tel:`. Preserve the intended policies for HTTPS/social/payment/delivery links.
- Provide a visible, selectable address and **Copy email** / **نسخ البريد الإلكتروني** control, accessible from every rendered email placement. Copy the plain address; clipboard rejection shows a usable manual-copy fallback. Keep address direction readable in RTL layouts.
- Do not replace this with a Gmail-only URL, user-agent sniffing, a custom Android intent, hidden automatic fallback, or a timer that guesses composer success. Visitors should retain their choice of mail app.
- Say “Email address copied” only after the clipboard write succeeds. Do not claim “mail app opened,” “email sent,” or delivery based on click, visibility changes or timers.
- Validate/encode the recipient correctly, including common plus addresses and characters with URI meaning. Reject CR/LF/control/header injection. If subject/body support is added later, encode it per RFC 6068; do not rely on attachments, HTML bodies, arbitrary headers, or long messages across clients.
- Preserve email anchors before hydration and without JavaScript. Clipboard enhancement may use JavaScript; reading/selecting the address must stay available.
- Cover quick actions, social/email tiles, generic links, nested service actions, contact-driven actions where reachable, and preview/public parity. Do not fix one visible email button while others still request `_blank`.

A form that accepts a message without any mail app would be a separate delivery/backend feature. It is outside the present email discussion and should not be added silently.

### Discussion acceptance and optional implementation acceptance

- **D1 (required discussion):** Present the standard/platform evidence and handler dependencies, document the current `_blank` risk, and distinguish verified markup from the user's un-reproduced device symptom.
- **D2 (required discussion):** Record a clear product recommendation and the remaining device evidence needed. Keep “recommended” and “accepted/implemented” as different statuses.
- **D3 (if recommendation is selected):** All email actions have the validated intended `mailto:` href and same-context target policy; they remain usable before hydration. No application-created popup/redirect/timed-fallback flow is used.
- **D4 (if selected):** Copy/manual fallback works with clipboard allowed, denied, or unavailable; messages and address direction are correct in Arabic/English, and copying does not also activate the email link.
- **D5 (if selected):** Physical iPhone Safari/Chrome and Android Chrome tests show a correct recipient with a configured default mail app, cancel/return usability, and a usable fallback with no configured handler/account. Desktop Chrome OS/webmail/no-handler behavior is also recorded.
- **D6 (if selected):** Automated assertions and physical-device results are separately labeled; no test sends mail or uses the operator's personal account as a fixture.

See [the primary-source mobile email research](../research/MOBILE_EMAIL_LINK_BEHAVIOR.md) for citations, detailed limitations, and the full device matrix.

## Skills and MCP/tool responsibilities

Discover the tools available in the implementation session and read the current skill files; tool availability or authentication can change. Never claim that a deferred/unavailable MCP was used. Use the working documented CLI/local fallback where appropriate.

| Skill/tool | Role in this work | Evidence/output |
| --- | --- | --- |
| `diagnosing-bugs` | Reproduce full reload/state loss, the former production assignment stall, and any Chrome email symptom before calling them diagnosed | Trigger, hypothesis, captured behavior, minimal regression. |
| `impeccable` | Preserve the incumbent interface while defining local feedback, deletion confirmation, provider geometry, accessibility and mobile/RTL behavior | Batched desktop/mobile review, one corrective pass, relevant detector checks after UI work. Product context is at `docs/product/PRODUCT.md`; a root-only discovery miss is not evidence that product truth is absent. |
| `supabase` and `supabase-postgres-best-practices` | Inspect constraints/RLS/ACLs, design atomic deletion/counters/idempotency, test concurrency and plan migrations | Reviewed migration, SQL contracts, least-privilege checks, advisor disposition. Load these before authoring SQL. |
| Supabase MCP `list_tables`, `list_migrations`, `execute_sql` | Read Staging schema/metadata, inspect function definitions/grants and verify namespaced fixture results | Sanitized schema/verification summary, explicit project ref. `execute_sql` is read-only here or confined to authorized disposable/fixture work, never arbitrary Production DDL. |
| Supabase MCP `apply_migration`, `get_advisors`, `generate_typescript_types` | Apply reviewed migrations to the explicitly authorized environment, review advisors/types if relevant | Migration version/checksum, environment identity, post-apply verification. Production changes occur only through the authorized protected release path. |
| `e2e`, `@e2e-dev/web` | Maintain/add real repository journeys using exact locators/assertions and existing desktop/mobile targets | Runner report with counts, selected/executed/skipped distinction and traces for local failures. |
| `chrome-devtools-axi` | Inspect live navigation, tabs, document requests, console/network, scroll/state retention and final screenshots | Before/after observations tied to the route/build; use CLI help for current commands. |
| Playwright MCP | Additional semantic flow inspection, controlled network/clipboard failures and targeted UI reproduction | DOM/attribute assertions, reproducible failure cases; use the existing e2e runner as the durable suite. |
| Playwright browser engine / `playwright-core` | Document-identity probes, tab/pop-up tracking, production-server browser tests, deterministic state checks | Tests prove behavior rather than mirroring implementation or merely counting API calls. Confirm APIs against installed versions. |
| `research` | Resolve official brand sources and email/app-link facts against primary sources | Dated source register; no speculative deep-link contracts. |
| `gh-axi`, `pr`, and `code-review` | Inspect branch protection/checks, create focused PR descriptions and review standards/spec before promotion | Reviewed feature PR, accepted Staging report, release diff and check status. Read skill instructions when performing those actions; no override of review gates. |
| Vercel/Sentry MCP or documented CLI fallback | Read deployment identity/env scope and relevant runtime errors; monitor accepted Staging/release behavior | SHA/deployment ID/project/branch/environment evidence and sanitized error findings. No secret-bearing raw artifacts. |

Start browser work by discovering the current Chrome CLI (`npx.cmd --yes chrome-devtools-axi --help`) and follow per-command help. For GitHub use `npx.cmd --yes gh-axi --help` / per-command help. If MCP access fails, report the actual failure and use an authorized fallback; do not silently turn off deployment protection or environment checks.

## Validation plan

### Deterministic unit/API/database coverage

Add meaningful tests for changed contracts rather than tests for every cosmetic edit:

- Assignment and new mutation transports: JSON success/error behavior, safe native fallback if retained, missing/cross-origin rejection, expired session, authenticated non-owner, malformed IDs, stale confirmation and server failure.
- Deletion SQL: owner/non-owner/anon, single/selected/multi-status cards, historical assignments, whole batches, partial/empty batches, rollback injection, direct Data API permissions, idempotent retry/receipts, and unrelated business data preservation.
- Identifier allocation: deleted highest serial/all rows, same-day retry, concurrent batches, daily capacity, batch-code monotonicity, creation retry after deletion, and any token-issuance guard.
- Use a real disposable PostgreSQL/Supabase session with concurrent connections to establish locking/race behavior. The existing PGlite runner is useful for migrations/RLS/contracts but alone does not establish distributed concurrency or full Auth/Storage parity.
- Extend `scripts/database/test-database.mjs` to include the new SQL test file. It currently uses an explicit file list: adding a file under `supabase/tests/` alone does not execute it.
- Manufacturing: partial and empty membership, nonexistent batch, coherent export snapshot, no removed rows, stable survivor URLs/files and QR decoding. Reuse `card-manufacturing.test.ts`, `card-route.test.ts` and existing DB resolver contracts where appropriate.
- Providers: Talabat/Fast metadata and input rules, saved profiles/overrides/nested actions, exact and lookalike host identity, no unsafe destinations, and snapshot compatibility.
- If selected, email: RFC-aware href construction, target policy in every renderer, injection rejection, selectable plain recipient and actual clipboard success/failure. Do not assert native-app launch from desktop automation.

### Browser journeys and no-reload proof

Add focused files such as `tests/e2e/admin-no-reload.e2e.ts`, `card-deletion.e2e.ts`, `provider-links.e2e.ts` and, if selected, `email-actions.e2e.ts`. Names are proposed; keep the established test glob and imports (`test` from `@e2e-dev/web`, `expect`/`credentials` from `e2e`).

After initial navigation/login/hydration, set a random sentinel on the page's `window` and record `performance.timeOrigin`. Perform a real mutation, assert its visible and persisted outcome, then verify the sentinel/time origin still exist unchanged. Supplement with navigation/document-request observation. Set the probe again only at an intentional route boundary; do not restore it from storage, which would conceal a reload. An unchanged URL or successful status toast alone is insufficient.

Seed a second unsaved value/row selection, active filter/cursor, scroll position and expanded history/selected editor section before the action. Assert preserved work and authoritative changed rows afterward, then independently reopen/read to confirm persistence. Use semantic locators and stable IDs; avoid table-column positions that will shift when selection/deletion controls are added. Do not add arbitrary sleeps to resolve races.

Exercise server rejection, network interruption, response loss after a commit, double clicks, expired session, stale preview, dialog cancellation/Escape, concurrent owner updates and clipboard denial. Controlled failures should assert recovery and no false success. Keep credentials opaque and use no live customer cards.

Rerun relevant existing journeys: `owner-cards`, `owner-card-journey`, `card-state`, `card-manufacturing`, `non-owner-access`, `business-editor-actions`, `editor-reliability`, `phase5-incremental-saves`, `admin-reordering`, `media-upload`, `public-journey`, `public-security`, and `quick-actions-layout`. Include auth-refresh when transport/session behavior changes.

### Physical mobile checks

| Surface | Configurations | Required observations |
| --- | --- | --- |
| Admin | Desktop and a narrow real phone, Arabic and English as available | No reload/jump/draft loss; usable filters and destructive dialog; keyboard/touch/focus feedback. |
| Talabat/Fast | Real iPhone and Android, provider app installed and uninstalled | Correct merchant/share/store destination and logo; actual app/web fallback, cancel/back return; accurate consumer-versus-restaurant-management label. |
| Email, if selected | iPhone Safari and Chrome, configured Apple Mail then a supported alternative | Correct recipient/default app, no application-requested blank tab, compose cancel/return, copy fallback. |
| Email, if selected | Android Chrome with configured Gmail, another mail app, and no usable handler/account on a test profile | Actual chooser/default behavior, recipient, cancel/return; address remains obtainable when handoff fails. |
| Email, if selected | Desktop Chrome with OS handler, allowed webmail handler, and no handler | Record real behavior and original blank-tab reproduction/fix where possible. |
| Public actions | Representative iOS/Android in-app browser | Record restrictions/prompts and confirm manual fallback/return path. |

Record device/OS/browser/app version, default-handler state, tested source/deployment SHA and observed result. Open and cancel email drafts; do not send email. If devices/provider merchant links are unavailable, finish every independent implementation/test step and report the exact remaining acceptance gate rather than claiming completion.

### Commands and gates

From the new feature checkout, after reviewing environment identity:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:db
npm.cmd run build
```

For targeted browser runs, first confirm the installed runner's help and the files that exist. Example for proposed new files once added:

```powershell
npx.cmd e2e list tests/e2e/admin-no-reload.e2e.ts tests/e2e/card-deletion.e2e.ts tests/e2e/provider-links.e2e.ts
npx.cmd e2e run tests/e2e/admin-no-reload.e2e.ts tests/e2e/card-deletion.e2e.ts tests/e2e/provider-links.e2e.ts --output artifacts/admin-feature
```

Run these against isolated/local or explicitly approved Staging fixtures with owner/non-owner credentials and mutation opt-in. For the production-server regression, build with the correct **test/Staging** environment and set `E2E_SERVER_MODE=production` before the relevant e2e run; this means `next start`, not the Production database. Restore process settings afterward. A stale `.next` build is not acceptable evidence; use a fresh production build after the final runtime edits.

Hosted acceptance uses the protected **Hosted Staging E2E** workflow. Its mutation switch is deliberately opt-in (`workflow_dispatch` with `allow_mutations=true`); push runs use read-only behavior and can skip mutation journeys. Require the feature's destructive/owner journeys to actually execute in the accepted mutation run. Use before/after deployment verification and retain the allowlisted summary only. Do not invoke the protected flow as an arbitrary pull-request job with shared Staging secrets.

## Implementation and promotion sequence

1. **Establish baseline.** Read required repo context; inspect current branch/worktrees and preserve existing edits. Fetch current refs, verify the existing provider feature remains in Staging, and create `feature/admin-ux-card-deletion-provider-links` from latest Staging in a clean approved checkout. Record base SHA and application/test/environment versions.
2. **Audit behavior.** Reproduce full-reload/state-loss cases and classify every reachable admin action. Capture the current assignment behavior under a production server, export/partial-batch assumptions, and provider/email render paths. Confirm Fast merchant/customer destination facts without guessing.
3. **Implement contracts and migration.** Design the atomic deletion preview/commit, ACLs, receipts, serial allocation and remaining-count/export behavior. Add migration/database/security/API tests and prove them locally before enabling the destructive UI.
4. **Complete admin interactions.** Implement all reachable no-reload transports/client controls, preserve business-editor draft state, add delete dialogs/selection and reconcile authoritative data. Retain real pending/error/retry behavior and creation idempotency.
5. **Complete providers.** Replace the three marks, add Talabat/Fast assets/metadata/pickers/destinations and provenance, and cover save/preview/publish/inheritance/override paths. If the email recommendation is selected for implementation, apply its common policy/fallback and tests now. Otherwise preserve Track D as the discussion outcome and report it separately.
6. **Validate and review.** Run quality/database/build checks, focused and relevant existing journeys, production-server regressions, one batched desktop/mobile UI inspection and one correction pass. Obtain real-device evidence for applicable public handoffs. Prepare a standards/spec review and feature PR with concrete behavior, migration impact, tests and remaining limitations.
7. **Merge to Staging through review.** Keep required `quality` green and resolve reviews/conversations. Apply the exact checked-in migration to Staging through its serialized authorized path; coordinate schema/app changes so old readers and ACLs cannot create a broken intermediate state. Verify Staging deployment SHA/project/origin and migration version.
8. **Accept on hosted Staging.** Execute the protected mutation run against fresh namespaced fixtures, with the new deletion/no-reload/provider journeys selected and executed. Record desktop/mobile counts, failure/retry/skip reasons, real-device results, screenshots and runtime/advisor findings. Old acceptance numbers cannot substitute for this feature's evidence.
9. **Prepare release PR `staging → main`.** Review every difference included since the previous release, including any other changes subsequently added to Staging. Record accepted Staging source/tree, migration list/checksums, deployed build and exact release candidate. If the merge strategy creates a new SHA, confirm that its application tree matches what was accepted and run required checks on that SHA; revalidate any changed application/configuration content.
10. **Production preparation and release.** Verify live Vercel Production Branch is `main`, Production env/project mapping, Auth/owner setup, migration parity, required release review and recovery evidence. Apply the accepted migration once via the authorized protected Production path, then build/deploy the accepted source using **Production** settings. Never promote a Staging-built deployment by moving production aliases onto it.
11. **Controlled release smoke.** Verify public card resolution, surviving manufacturing URLs, admin authorization, provider rendering and email policy if selected. Use approved non-customer disposable inventory for any deletion smoke or keep deletion acceptance on Staging; never run the mutation suite against real Production inventory. Read relevant runtime/Sentry errors and record release identity.
12. **Close with evidence.** Supply the implementation report, feature/release PR links, source/base/accepted/release SHAs, migration/deployment identity, complete acceptance matrix, test counts, remaining explicit gates and rollback information. Do not mark the goal complete with required tests skipped or a known unresolved data/UI regression.

Existing review/environment gates may need an operator's final approval. Prepare the complete reviewable result first and identify the concrete gate/source if action is blocked; do not repeatedly request permission for already-authorized local/read-only work. This handoff alone does not authorize executing customer-data deletion, merging protected branches, or deploying now.

## Rollback and recovery

- Record the last known-good Production deployment and a usable backup/recovery point before releasing destructive inventory capability. Test recovery on an isolated database, not by restoring over live data as an experiment.
- An application rollback does **not** restore hard-deleted cards/history or recall downloaded manufacturing files. Accidental data deletion requires explicit recovery from a suitable backup, preserving actor/audit evidence and reconciling any subsequent writes.
- Preserve serial counters, batch-code sequence state and operation receipts across recovery; restoring a lower issuance counter can reuse manufactured identifiers. Do not automatically republish recovered/deleted physical tokens without an explicit recovery decision.
- Old code currently rejects partial/empty batches. A simple deployment rollback after partial deletions may therefore break batch details/ZIP. Release a compatible reader first where practical, retain a compatible rollback target, or provide a tested forward-fix recovery plan. Do not describe an arbitrary pre-feature rollback as safe.
- Avoid rollback migrations that drop issuance/audit state, recreate deleted inventory, reset shared schemas or loosen ACLs. Prefer disabling the destructive UI/entry point and applying a reviewed forward fix while maintaining existing reads/assignments.
- Separate migration failure, UI transport regression, provider-link failure and accidental deletion responses. State which operations are stopped, which tested deployment/compatibility path is used and what evidence closes the incident.

## Required deliverables

- Complete admin action/transport inventory and implemented behavior, including failure/retry/document-identity evidence.
- Focused new feature branch and feature PR to Staging, with appropriate source layout and no unrelated edits.
- Reviewed migration plus authorization, rollback, concurrency, issuance/idempotency, partial/empty export and public-token tests.
- Correct local brand assets for the five requested providers, source/license/brand-use register, and Fast merchant/customer destination findings.
- Updated browser journeys and sanitized desktop/mobile/real-device evidence tied to the tested build.
- Explicit email discussion decision and, only if selected, verified common target policy/copy fallback.
- Hosted Staging acceptance report and reviewed release PR to Main with migration/deployment/recovery evidence.
- Final acceptance table for A1–A8, B1–B10, C1–C7 and D1–D6, with D3–D6 marked conditional until the recommendation is selected. Each row records pass/fail/pending/not-applicable, evidence and any precise blocker.



## References and evidence boundary

- [Architecture](../ARCHITECTURE.md), [product](../product/PRODUCT.md), [stories](../specs/USER_ADMIN_STORIES.md), [business-editor reliability](BUSINESS_EDITOR_RELIABILITY_HANDOFF.md).
- [Environment separation and CI/CD](ENVIRONMENT_SEPARATION_AND_CICD_HANDOFF.md) and [current release handoff](../../HOSTED_STAGING_VALIDATION_HANDOFF.md); reconcile dated observations with live state before acting.
- [Mobile email primary-source research](../research/MOBILE_EMAIL_LINK_BEHAVIOR.md), including RFC 6068, Apple default apps, Android common intents, Chrome protocol handlers, WHATWG navigation and the Clipboard API.
- [Next.js `useRouter` documentation](https://nextjs.org/docs/app/api-reference/functions/use-router): `router.refresh()` merges an RSC payload and preserves unaffected client/browser state; it is not inherently a document reload. Actual draft/state preservation still needs application tests.
- [Supabase database functions](https://supabase.com/docs/guides/database/functions) and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), consulted through Supabase MCP on 2026-10-14.
- [GitHub brand/logo guidance](https://brand.github.com/foundations/logo), [Talabat Egypt](https://www.talabat.com/egypt), the supplied [Google Play Fast listing](https://play.google.com/store/apps/details?id=com.ZED.zid_app) and [Apple Fast listing](https://apps.apple.com/us/app/fast-app/id1671447192). Apple identity was additionally read through its [lookup endpoint](https://itunes.apple.com/lookup?id=1671447192&country=us). Exact final asset terms and merchant handoff behavior remain implementation evidence to collect.

Preparation performed source/branch inspection, live GitHub protection reads, read-only Staging schema/migration/policy/FK inspection and primary-source research. It did not run feature tests, modify the application/schema/data, send email, merge, deploy or verify physical devices. The acceptance criteria above are future gates, not passing results from this document-writing task.
