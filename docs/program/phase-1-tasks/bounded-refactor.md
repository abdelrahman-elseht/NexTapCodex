# Task 1.5: Migration-Relevant Behavior-Preserving Refactor

## Contract

Refactor one or two high-risk slices selected from the accepted map after the codebook, maintenance checks and mutation baseline are understood. Clarify responsibility boundaries while preserving public, owner, database and privacy behavior.

## Read first

- Accepted `docs/ARCHITECTURE.md`, `docs/CODEBOOK.md`, maintenance baseline and Stryker report.
- Exact source/tests for the selected slice. Likely candidates include `src/app/admin/cards/page.tsx`, `src/lib/business/providers.ts`, `src/lib/cards/card-manufacturing.ts`, or `src/components/business/public-snapshot.tsx`; select only with evidence.
- `docs/product/PRODUCT.md`, relevant migrations/SQL tests and affected browser journeys.

## Work

1. State the before responsibility, after responsibility and invariant/behavior contract in a short refactor note.
2. Choose one boundary where extraction improves cohesion or testability without adding a speculative abstraction. Keep the diff narrowly scoped.
3. Preserve inputs, outputs, ordering, authorization, fallback, cache/revocation, error and accessibility behavior as applicable.
4. Add or adjust only focused tests that prove the contract and failure/recovery behavior.
5. Run lint, typecheck, focused unit/SQL checks, browser journeys if the route/user behavior is affected, focused mutation ratchet and a fresh production build.
6. Update architecture only when actual ownership changed; document exceptions only with a reason and owner.

## Selected slice

- Before: `src/app/admin/cards/page.tsx` owned query validation, batch/card/page Supabase reads, cursor shaping, eligible-page calculation and React presentation after calling `requireOwner()`.
- After: the route retains `requireOwner()`, route-level messages and JSX; `src/lib/admin/card-inventory.ts` owns normalized inventory filters, authenticated-client queries, cursor ordering, selected-batch recovery, missing assigned-page lookup, eligibility and navigation links.
- Preserved contract: keep the same owner check, PostgREST filters, result ordering, page eligibility (`is_active`, `published_snapshot_id`, active business), visible current batch, query strings and next/previous cursor URLs. No writes or schema changes move into the loader.
- Regression evidence: `tests/unit/card-inventory.test.ts`, existing pagination/inventory/assignment tests, `tests/e2e/owner-cards.e2e.ts`, `owner-card-journey.e2e.ts` and `admin-no-reload.e2e.ts`. G4 accepted the publication pointer/fallback baseline before this slice was selected. Run affected browser journeys, a scoped card-inventory parser mutation ratchet and a fresh build before G5 closes.

## Verification record (2026-11-05)

- `npm test`: 44 files and 284 tests passed, including the card-inventory parser contract tests.
- `npm run test:mutation:card-inventory`: 31/31 mutants killed, 100% score, no survivors, timeouts, no-coverage mutants or errors. The focused ratchet is `thresholds.break=100` in `stryker.card-inventory.config.mjs` and is run by CI.
- `npm run build`: passed with local-only Supabase URL validation values; `/admin/cards` is present in the production route manifest.
- Historical browser regression assertions (the earlier direct desktop/mobile reports are not retained and these counts are not independently verified here): `owner-cards.e2e.ts` passed on desktop and mobile (2/2); `admin-no-reload.e2e.ts` passed on desktop (3/3), using a uniquely named isolated local Supabase project and synthetic owner/card/page fixture. The full `owner-card-journey.e2e.ts` initially failed at the separate draft endpoint with 403 in dev and production modes. A subsequent focused fix uses the actual Host for local origin validation, preserving configured hosted origins; the complete desktop owner-card journey now passes (1/1) on another disposable local project, including save, publish, activation, scan, rename, reassignment and deactivation. Two origin regressions were added; the unit suite now passes 44 files/286 tests.
- The existing owner journey had an ambiguous generic checkbox locator; it now selects the intended `Hidden` checkbox by accessible name, so future runs can proceed to the separately failing draft request.
- The initial `npm run test:mutation:card-inventory` pass found one no-coverage mutant for the empty search default. A dedicated default-filter regression test was added; the final 31-mutant run has full coverage.

## Guardrails

- No Cloudflare/OpenNext/vinext/R2 implementation, schema/migration change, hosted validation, Production data or provider mutation.
- No unrelated product behavior change, mass formatting, broad rewrite or dead-code removal based only on scanner output.
- A successful Next build is regression evidence only, not Worker compatibility evidence.
- Stop and report if evidence shows a behavior or schema change is necessary.

## Acceptance

- The diff demonstrates a clearer responsibility boundary tied to a mapped migration risk.
- Existing contract behavior is covered and unchanged, including relevant negative/security cases.
- Focused mutation and required regression/browser checks pass or have explicit evidence-backed owner exceptions.
- No unrelated behavior or schema/provider changes are present.

## Gate

G5 in root `GATES.md`. Report before/after ownership and exact regression evidence.

Retained browser evidence is limited to the identified local synthetic desktop owner-card report in the [closeout index](../../../reports/phase1-closeout/README.md). Current integration dependency/continuity repairs and checks are recorded in the [repair index](../../../reports/phase1-integration-repair/README.md); no browser journey was rerun for those tooling-only repairs.
