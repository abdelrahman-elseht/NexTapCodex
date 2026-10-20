# Contacts local handoff

Implementation date: 2026-10-20. Branch: `feature/contacts-local`. Base and current HEAD: `67985fc67de1883553164c04fe7993101b6440bc`. Implementation is committed on this branch under `feat: add contact downloads and independent provider values`; use `git log -1` on the PR branch for the final commit SHA. No merge, hosted migration or deployment was made. Existing user changes to AGENTS.md and supplied specs/reference were preserved.

## Implementation

Reused the existing business editor, page sections, provider item IDs, owner authorization, immutable publications, public eligibility resolvers, managed Storage uploads and Sharp. Added bounded page contact configuration, revision checks and an atomic save/publish RPC; versioned allowlisted publication contact; configurable optional fields and explicit item bindings; private owner preview; JPEG derivatives; vCard 3 serialization; fresh slug/card GET and HEAD downloads. Payment bindings are excluded. Legacy draft writers preserve contact configuration; legacy publication calls compile it. Page selection now allows existing branches.

The reference CTA is one full-width burgundy anchor above the independent tile grid inside Quick Actions. The first configured section owns it, including deliberate suppression when that section is disabled. Fallback and contact-only layouts are supported.

New migration: `supabase/migrations/20261020063654_contacts.sql`. Deploy this before the updated application: the new editor intentionally fails closed if its atomic RPC is absent. New local project: `nextap-contacts-local`, API `http://127.0.0.1:56321`, database port `56322`, shadow port `56320`; see `supabase/config.toml`. No hosted endpoints were used.

## Evidence and acceptance

| ID | Result and evidence |
| --- | --- |
| C1 | Editor operations implemented; unit checks and atomic SQL stale-writer checks pass. Authenticated Save/reload browser journey added but not executed. |
| C2 | SQL contracts verify draft privacy, explicit publication, old snapshots off, disabled publication removal, and legacy preservation. `supabase/tests/contacts.sql`. |
| C3 | 32 actual-component browser layout cases passed at 390/1440 RTL/LTR plus 320/768 smoke: configured, fallback, empty, contact-only, multiple, disabled and disabled-primary. `artifacts/contacts/BROWSER_VERIFICATION.md`, JSON results and screenshots. |
| C4 | Independent vcard-parser checks plus byte assertions pass: v3, Arabic/emoji, repeated phones/URLs, structured N/ADR, escaping, injection and UTF-8 folds. Parser trims continuation whitespace, so the long-Unicode assertion first performs RFC one-byte unfolding. `tests/unit/contacts.test.ts`. |
| C5 | SQL access/stale-publication and mocked HTTP authorization/ownership checks pass. Full Supabase Auth/RLS/PostgREST HTTP coverage remains blocked. `tests/unit/contact-preview.test.ts`, `contact-download.test.ts`, `supabase/tests/contacts.sql`. |
| C6 | Sharp derivative and bounded fetch/fallback tests, GET/HEAD success/error headers pass. Real local Storage integration is pending. |
| C7 | 23-migration PGlite replay passes. Real embedded PostgreSQL passes contact contracts, representative pre-contact draft upgrade, atomic rollback and concurrent save/publish (one winner, one 40001). This uses scaffolded Auth/Storage schemas and does NOT satisfy the complete real Supabase gate. |
| C8 | Typecheck, lint (0 errors, 11 warnings), 181 unit tests, production build and focused component browser matrix pass. Full production owner journey and native imports remain unverified. Impeccable detector returned no findings. |

Commands executed: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test -- --reporter=dot`, `npm.cmd run test:db`, `npm.cmd run test:db:concurrency`, `npm.cmd run build`. Build used explicit synthetic loopback environment values and disabled Sentry credentials. Browser artifacts are ignored local evidence, not committed application assets. The temporary browser harness was stopped.

## Blockers and exact continuation

Supabase CLI start failed because neither Docker nor Podman is available. Do not substitute hosted Supabase. Install/start a Docker-compatible runtime, start this isolated project, verify its project identity and the API/database ports above, then replay migrations and seed synthetic owner/non-owner, business, main/branch page, card and media fixtures. Never reset another stack.

Set the local public key and owner credentials from that stack, `NEXTAP_ENV=test`, `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56321`, `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3137`, `E2E_SERVER_MODE=production`, and `E2E_ALLOW_MUTATIONS=true`. Set `E2E_CONTACT_BUSINESS_ID`, `E2E_CONTACT_MAIN_PAGE_ID`, `E2E_CONTACT_BRANCH_PAGE_ID`, `E2E_USER_OWNER_USERNAME`, `E2E_USER_OWNER_PASSWORD`. Build against those local values, then run:

```powershell
npx.cmd e2e run tests/e2e/contacts.e2e.ts --config tests/e2e/contacts.local.config.ts
```

The dedicated config never loads `.env.local` and rejects other Supabase origins. Run SQL contracts and concurrency against real local Supabase, plus fresh replay and representative published-data upgrade, before declaring C7 complete. Complete real Storage/photo failure and Auth/RLS/PostgREST access checks.

No real iPhone or Android device was available. Manually verify synthetic imports, Arabic/core fields, photo/notes, cancel and repeat import; record OS/browser versions. A browser download is not native import proof.

Staging prerequisites: finish the blocked local gates, review and commit the diff (excluding unrelated user files and ignored artifacts), obtain the separate hosted authorization, review/apply the new migration before app deployment, then validate Staging download/access/photo/editor behavior. Main release requires separate approval. No production-readiness claim is made by this handoff.


## Provider Fix ? continuation results

Root cause: ItemEditor changed inherited destinations without setting profileOverride; BusinessEditor.updateItems treated that edit as a provider-wide default update. Every inheriting item of the same provider then resolved to the same account. Stable IDs and the existing override schema already supported separate accounts; no provider migration or new table was required.

Changed in this continuation: `src/app/admin/businesses/_components/item-editor.tsx`, `business-editor.tsx`, `src/lib/business/editor-items.ts`, and `tests/unit/provider-item-editing.test.ts`. Direct value/URL edits now become explicit item overrides. Use saved details / Custom value controls retain intentional inheritance. Save these details as business default is a separate draft action. Defaults are initialized once rather than rebuilt after reorder/removal. Additional repeated providers start custom. Duplicate item creates independent IDs and copied destinations, including nested service actions. Reordering locates items by ID. Contacts live preview and binding choices now use the same resolved section values sent to persistence.

Regression evidence: `npx.cmd vitest run tests/unit/provider-item-editing.test.ts` initially failed all three direct-edit cases for WhatsApp, Instagram and Vodafone Cash (expected override true, received false). After the fix all five tests pass. Coverage includes distinct accounts, resolved preview, JSON save/reload boundary, explicit override preservation when defaults change, reorder/delete, duplication, actual public-component destination rendering, selected-instance VCF projection, and frozen-publication isolation from draft edits. These component/unit checks do not establish real Auth/RPC/browser save/reload/publish success. That full provider workflow remains unverified until the local Supabase prerequisite is available.

## Contacts ? refreshed verification

Reused the Contacts implementation already present at the start of this continuation rather than rebuilding it. Fixed the unresolved-provider live-preview gap described above. No additional migration was needed.

Commands rerun successfully: `npm.cmd run typecheck`; `npm.cmd run lint` (0 errors, 11 warnings); `npm.cmd test -- --reporter=dot` (28 files, 181 tests); `npm.cmd run test:db` (23 migrations and all SQL contracts); `npm.cmd run test:db:concurrency` (real embedded PostgreSQL contacts upgrade, stale-writer, atomic/concurrent publication and inventory checks); `npm.cmd run build` (synthetic loopback environment, no hosted credentials); `git diff --check`. Impeccable detection over changed editor files returned no findings.

Browser evidence refreshed using `node artifacts/contacts/layout-harness.cjs` and `node artifacts/contacts/check-layout.cjs`: 32 cases with asserted counts, placement, width, minimum touch height and no overflow at 390/1440 plus 320/768, RTL/LTR. Results: `artifacts/contacts/layout-results-parsed.json`; screenshots: `artifacts/contacts/390-en-configured.png` and sibling captures. The mobile screenshot was visually inspected and shows one burgundy CTA above four lighter tiles in the same rounded container. This is actual public-component layout evidence, not the full production authenticated E2E journey. Temporary server stopped afterward.

Supabase CLI 2.121.0: `npx.cmd supabase start --workdir F:/projects/NexTap-contacts` failed with DockerLifecycleInspectError: docker command not found, podman also not found. No hosted fallback was used. C1 full owner journey, C5 full local Auth/RLS/PostgREST coverage, C6 real Storage and C7 full local Supabase remain pending. C8 production build passes, but the production owner E2E and actual downloaded-file integration remain pending. Real iPhone/Android imports remain unverified. Existing independent parser and HTTP unit checks pass.

Branch: `feature/contacts-local`; base: `67985fc67de1883553164c04fe7993101b6440bc`. Final implementation commit: `feat: add contact downloads and independent provider values` (resolve with `git log -1` on the PR branch). Implementation changes are committed for a staging PR; the unrelated AGENTS.md edit remains uncommitted and preserved. No merge, deployment or hosted mutation occurred. Follow the local continuation and separate Staging authorization prerequisites above before promotion.
