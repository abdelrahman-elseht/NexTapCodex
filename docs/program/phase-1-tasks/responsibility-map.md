# Task 1.1: Responsibility and Risk Map

## Contract

Update `docs/ARCHITECTURE.md` from the source at this worktree. Show current route-to-domain-to-provider/database flows, ownership, runtime/security boundaries and test evidence for owner editing, public pages/publication reads, card QR/NFC resolution, authentication and media. Identify risk candidates by responsibility and contracts, not file length.

## Read first

- `docs/ARCHITECTURE.md` and `docs/product/PRODUCT.md`.
- `src/app/admin/businesses/`, `src/app/b/[slug]/`, `src/app/auth/`, `src/app/admin/cards/`, and `src/app/api/admin/media/`.
- Related modules under `src/lib/business/`, `src/lib/auth/`, `src/lib/cards/`, `src/lib/media/`, and `src/lib/supabase/`.
- `supabase/migrations/`, `supabase/tests/`, focused files in `tests/unit/` and `tests/e2e/`, `package.json`, and `.github/workflows/ci.yml`.

Read only source linked from the architecture section relevant to a claim; expand when a trace crosses another boundary. Treat existing migration handoffs as historical evidence.

## Work

1. Trace each required user flow from route/entry through validation/workflow to provider or database call and test.
2. In the public-read trace, record active publication pointer resolution, immutable snapshot retrieval, five-second slug cache, five-second compatibility fallback and the SQL authorization/state contract. Confirm each detail in current source and migration tests.
3. Inventory major route/UI, domain, infrastructure, database/migration, test and shared-contract responsibilities. Mark gaps instead of inferring coverage.
4. Identify candidate risk boundaries with concrete change reasons such as mixed query/pagination/render ownership, duplicated provider policy, security-sensitive authorization, visibility/revocation rules, URL/media validation or shared invariants.
5. Update the architecture map and gradual target boundaries. Preserve existing conventions; do not create a new module in this task.

## Guardrails

- The packet's example files and line counts are prompts for inspection, not a required split list.
- Separate observed behavior from intended behavior and local evidence from hosted state.
- Public modules must not gain draft reads, owner-only imports or credentials.
- Do not infer Cloudflare compatibility from the Next build.

## Acceptance

- Every named flow has a source-linked entry, owning module, persistence/security boundary, tests or explicit test gap.
- Public pointer/snapshot/fallback behavior and relevant SQL policy are accurate at the task base.
- Risk candidates explain why change is risky and identify likely tests; no candidate is selected solely by line count.
- Enumerated relative link targets resolve; anchors and external URLs remain outside that check. Source/docs staged whitespace passes; full staged raw-log whitespace findings are reported separately.

## Gate

G1 in root `GATES.md`. Report changed paths, source traces, candidates and open questions before Task 1.2.
