# Independent Phase 1 Baseline Reconciliation

Reviewed 2026-11-05 from the PRD/review worktree. The initial reconciliation inspected the named worktrees read-only. The subsequently authorized closeout ran checks against the existing Phase 1 candidate and produced local synthetic browser evidence. The original main checkout and historical trial remain untouched; no hosted data or resources were accessed or mutated.

## Verdict

**Sound with bounded gaps.** The candidate uses the intended approved-main baseline and implements the Phase 1 foundation scope. The closeout below independently closes the blocking final-check, mutation-control, and local browser-evidence gaps. **Phase 1 exit is supported for this candidate; no restart is needed.** The candidate remains uncommitted and unintegrated. Phase 2 implementation has not started.

Remaining limits are the baseline lint warnings, moderate audit advisories, report-only Knip findings, and unverified Codex/Claude host loading/trust. These are explicit, nonblocking Phase 1 limitations; the packet permits deterministic hook-contract evidence when real host lifecycle execution is unavailable. The old browser run's target remains unknown, but a newly retained pass on an identified local synthetic fixture supplies the required evidence.

## Baseline and Worktrees

`230adeca680c0fe7e22b3ece0fd9169764b84ffe` independently resolves to local `origin/main`; it is also the merge base and HEAD of the original `main`, the Phase 1 candidate, and this PRD branch. The candidate has no committed divergence from approved main; all candidate changes are working-tree changes.

| Worktree | Branch and HEAD | State relative to approved main |
| --- | --- | --- |
| PRD/review worktree | `docs/nextap-migration-program-prd`, `230adec` | Same HEAD; existing dirty `docs/README.md`, untracked `GLOSSARY.md` and `docs/program/` preserved. |
| Phase 1 candidate worktree | `phase1/codebase-foundation`, `230adec` | Same HEAD; dirty tracked and untracked Phase 1 files/artifacts. No commit or integration at reconciliation time. |
| Original main checkout | `main`, `230adec` | Same HEAD; separate tracked and untracked changes, preserved and not incorporated. |
| Historical migration trial | `migration-architecture`, `9f347db` | Three commits after `230adec`: `b670586` (a different Phase 1 implementation), `1eacda1`, and `9f347db` (Phase 2 readiness). Also has untracked build/diagnostic directories and SQL. Excluded as candidate evidence. |

The historical trial is not the Phase 1 candidate: it has a different implementation history and later Phase 2 work. Its Phase 1 commit and retained artifacts do not prove the current candidate's gates.

## Gate Evidence

| Gate | Independent finding |
| --- | --- |
| G1 - responsibility map | Supported by the candidate's `docs/ARCHITECTURE.md` changes and source cross-checks. The map covers owner/editor, public publication pointer/snapshot and fallback, cards/contact export, Auth, media, persistence/security boundaries, and tests. |
| G2 - codebook | Supported by `docs/CODEBOOK.md` and `AGENTS.md`: placement, import/runtime rules, tests, budgets, dependencies, and safe removal are actionable and the always-loaded guide points to the codebook. |
| G3 - maintenance checks | Supported by the candidate's boundary rules and fixtures, budget/dependency scripts, report-only Knip command, CI wiring, and weekly report workflow. Retained final lint, budget, dependency and Knip outputs now support execution. The design does not auto-delete code or packages. |
| G4 - mutation baseline | The retained publication JSON records 17 killed/one surviving (94.44%); the sole survivor is the documented no-op assignment at `public-publication.ts:51`. Inventory records 31/31 killed (100%). Both reports embed the current normalized production source. The newly retained 95% negative control exits 1 at 94.44%; accepted publication/inventory thresholds remain 94%/100%. `public-publication.ts` is marked modified in Git status, but HEAD, index, and normalized working-file hashes match; the actual changes are expanded unit tests. |
| G5 - bounded refactor | The `/admin/cards` diff moves query parsing/loading/navigation to `src/lib/admin/card-inventory.ts`; `requireOwner()` remains in the route before the loader call. Focused parser tests, a fresh build, and a new 1/1 desktop owner-card journey pass support the behavior claim. The new browser evidence names the loopback Supabase project and synthetic fixture; the unidentified historical report and app log are excluded from the landable evidence. |
| G6 - continuity | The candidate has a bounded packet validator, hook adapter, Codex/Claude config, contract-shaped tests, and hook-contract research. Continuity tests pass in the retained unit run and `continuity:validate` returns `valid`. Actual Codex/Claude host versions, loading and project trust remain unverified, consistent with the packet. Earlier guard-skill outcomes remain summaries; this closeout changes no production/test source and applies docs-guard to the evidence/status documents. |
| G7 - integrated checks | All checks listed in the closeout checklist now have retained command outputs, exit codes, tool versions and candidate identity. Unit: 44 files/286 tests; SQL: 31 migrations; concurrency and fresh build pass. The high-severity audit exits 0 with five moderate advisories. The historical candidate unstaged `git diff --check` exited 0; that does not establish whitespace cleanliness of staged additions. The source/docs staged check passes while the full staged check reports retained raw-log trailing whitespace. See the evidence index and command table below. |

## Scope and Phase Boundary

The source, tooling, and documentation changes align with the Phase 1 foundation tasks: map responsibilities, define the codebook, add maintenance and mutation guardrails, extract one migration-relevant card-inventory boundary, and add continuity adapters. A separate local-origin check change in the draft API and its regression tests support the final owner journey; hosted-origin validation remains configured separately.

The candidate adds Phase 2 research, PRD, and task-planning documents, but this is documentation only. The candidate diff adds no Cloudflare/OpenNext/vinext or Worker dependency/configuration, R2 integration, migration/schema change, Worker deployment, or hosted resource change. Existing Vercel/hosted workflow files in the base are not Phase 1 changes. Phase 2 implementation is not evidenced as started.

## Original Main Changes

The original checkout's changes are distinct and remain untouched:

| Path | Relationship |
| --- | --- |
| `.gitignore` | Candidate adds Stryker temp/log ignores. Original adds `.codex/state/`; its `.vercel` entry duplicates the candidate/base `.vercel/` ignore. Additive changes, preserve both unique entries. |
| `AGENTS.md` | Candidate adds the codebook and Phase 1 packet pointers. Original adds separate UX/DX/AX and open-source-search guidance and changes the document formatting. Same-path overlap; preserve and reconcile deliberately. |
| `docs/README.md` | Candidate adds codebook/program/Phase 2 planning links. Original adds media/R2 research/spec links and revises the dated self-review handoff description. Mostly additive, but links refer to documents local to each worktree; preserve both sets and validate after any future integration. |
| `.codex/` | Candidate adds `.codex/config.toml` for continuity hooks. Original adds `hooks.json`, hook scripts, setup/checkpoint files. These are separate implementations of overlapping Codex hook behavior; do not combine blindly. Neither host loading nor trust is verified. |
| `GATES.md` | Both worktrees have an untracked file at this path with different meanings: candidate Phase 1 G1-G7; original Apps Script G1-G4. Original also has `GATES-codex-hooks.md`. This is a filename collision requiring deliberate preservation if integration is later authorized. |
| Contact editor | Original-only changes affect `business-editor.tsx`, `contact-card-editor.tsx`, `src/lib/business/contact.ts`, and contact UX tests: validation, inherited page name, focus/error behavior and download controls. Candidate does not change these files; its card inventory extraction and draft-origin check are separate. No contact-editor change was overwritten or integrated. |

## Completed Closeout Checklist

Evidence is retained in the [Phase 1 closeout index](../../reports/phase1-closeout/README.md). `candidate-identity.json` records the dirty input set; `candidate-final-verification.json` confirms it is unchanged after the checks and temporary helper removal. Fingerprint: `403d1152f4c9a1238cc96605cefad02c8427aa6c443b4bffe10a25711ee4e84a`. Only evidence files were retained by the historical closeout. Published identity metadata is now explicitly sanitized to omit excluded artifact hashes; the integration repairs below change tooling/test inputs and have their own verification.

| Exact command | Result |
| --- | --- |
| `npm run lint` | Exit 0; 13 warnings, 0 errors. |
| `npm run typecheck` | Exit 0, including after the final build. |
| `npm test -- --run` | Exit 0; 44 files/286 tests passed, including continuity contracts. |
| `npm run test:db` | Exit 0; 31 migrations, SQL contracts and anonymous publication RPC execution. In-memory PGlite and hard-coded synthetic UUIDs only. |
| `npm run test:db:concurrency` | Exit 0; upgrade, stale-write, issuance/retry, contention, receipt and audit-rollback contracts. Fresh disposable loopback PostgreSQL cluster; synthetic data only. |
| `npm run build` | Initial exit 1 without the required Supabase URL; retained. Subsequent/final exit 0 with `NEXTAP_ENV=test`, URL `http://127.0.0.1:56321`, dummy publishable key and disabled Next telemetry. No source repair was needed. |
| `npm run check:file-budgets -- --base 230adeca680c0fe7e22b3ece0fd9169764b84ffe` | Exit 0; 11 changed source files, 0 unchanged legacy overages. |
| `npm run check:dependency-status -- --base 230adeca680c0fe7e22b3ece0fd9169764b84ffe` | Exit 0; metadata verified for 7 changed direct packages, none deprecated. |
| `npm run check:knip` | Exit 0 as configured report-only; findings retained, no unused-code-free claim or deletion. |
| `npm run continuity:validate` | Exit 0; `valid`. No claim of actual host loading or trust. |
| `npm audit --omit=dev --audit-level=high` | Exit 0; five moderate advisories, no high/critical gate failure. |
| `npx --no-install stryker run reports/phase1-closeout/stryker-negative-control.config.mjs` | Expected exit 1: 17/18 killed, 94.44% below break 95. The temporary config changed only the threshold and report destination, then was removed; its exact text is retained. Accepted config remains at break 94, independently inspected afterward. |
| `node node_modules/e2e/dist/cli/bin.js run tests/e2e/owner-card-journey.e2e.ts --config e2e.phase1-closeout.config.ts --target desktop --workers 1 --retries 0 --output reports/phase1-closeout/browser-local` | Exit 0; 1 selected/executed/passed, 0 failed/flaky/skipped. Run by the retained local fixture wrapper; its log also shows the equivalent npx spelling. Temporary config changed only the app log path and was removed afterward. |

Versions in `tool-versions.log`: Node 22.23.2, npm 10.9.8, TypeScript 5.9.2, ESLint 9.35.0, Vitest 4.1.12, Next.js 15.5.28, Stryker 10.1.1, Knip 6.44.1, Supabase CLI 2.122.0, PGlite 0.5.8/PostgreSQL 18.3 WASM, embedded-postgres 17.10.0-beta.17/PostgreSQL 17.10, local Supabase PostgreSQL 17.11, e2e 0.18.0, and web engine 0.13.0.

The old browser target could not be recovered. Its app log, sibling report and identifier-bearing lookup log were audited and excluded, together with their published artifact hashes. The later identified local synthetic desktop owner-card journey closes the fixture-provenance gap; its loopback target and generated fixtures are documented in the closeout index and identity manifest. Credentials stayed in memory. No hosted resource or schema changed. Earlier direct desktop/mobile journey assertions lack retained reports; they are not counted as independently verified evidence.

## Recommended Integration Steps

1. Review the exact uncommitted candidate diff, new files and retained evidence at the recorded fingerprint. Preserve the evidence index and logs explicitly when preparing a later change set; log files may be ignored by Git.
2. Use a separate clean integration worktree based on the approved main after verifying its current SHA. Apply only the reviewed Phase 1 change set there; leave the dirty original main and historical trial intact.
3. Reconcile the overlapping `.gitignore`, `AGENTS.md`, `docs/README.md`, `.codex` and `GATES.md` work deliberately, preserving both sets of intent and the original-only contact-editor work. The two `GATES.md` meanings need distinct preserved destinations; do not blindly combine the hook implementations or infer host trust.
4. Carry the PRD status, reconciliation review and evidence into that reviewed integration result with portable links. Run the required checks and affected local synthetic journey again if integration changes their inputs, then submit the concrete diff for normal commit/PR approval in a separate task. Phase 2 implementation remains separately scoped and authorized.

No integration, commit, push, deployment or Phase 2 implementation occurred during this closeout. The original dirty checkout's branch, HEAD and status were rechecked and remain unchanged.

## Integration Review Diff

Initially prepared 2026-11-05 in the separate detached worktree `F:/projects/NexTap-contacts-phase1-integration-review`, based on verified `origin/main` SHA `230adeca680c0fe7e22b3ece0fd9169764b84ffe`. The initial review diff was staged without a commit: 89 paths, 16,891 insertions and 4,149 deletions (including retained command output). The candidate remains separately dirty and uncommitted; the original main and historical trial remain untouched. The repaired diff is described below; these initial counts are historical.

Before repairs, the candidate identity was reconciled against approved main and its original fingerprint. The selected non-evidence manifest had 33 included files: 28 raw hashes matched, and five documented portability/header edits differed. The other 54 planning files were excluded. The published metadata now omits hashes/assertions for unidentified-target artifacts. Subsequent tooling and continuity repairs intentionally differ from that historical fingerprint; current verification binds the repaired inputs separately.

The integration diff carries the reviewed Phase 1 source/tooling, program PRD, handoff/task packets, reconciliation, research and necessary identified closeout evidence. The unidentified historical browser app log, sibling report and related identifier-bearing lookup log are excluded. Their artifact hashes are not retained in published metadata. The 54 Phase 2 planning files remain excluded, as do dependencies and generated build output.

The overlapping paths were resolved for this Phase 1-only review as follows:

| Path | Integration review selection |
| --- | --- |
| `.gitignore` | Approved main plus the candidate's `.stryker-tmp/` and `stryker.log` ignores. The original checkout's `.codex/state/` entry remains with that separate worktree. |
| `AGENTS.md` | Keep the candidate's Codebook and Phase 1 packet pointers, phrased to distinguish active work from completed Phase 1 evidence. The original checkout's separate UX/AX/search guidance remains there. |
| `docs/README.md` | Keep Phase 1, PRD, reconciliation and closeout links that resolve inside this diff. Omit links to excluded Phase 2 packets. The original checkout's media/R2 research links remain there. |
| `.codex/` | Keep only the candidate's `.codex/config.toml` continuity adapter. Do not combine the original checkout's separate hook scripts/configuration; actual host loading and trust remain unverified. |
| `GATES.md` | Keep the Phase 1 G1-G7 gates here. The original Apps Script G1-G4 file and `GATES-codex-hooks.md` remain in the original checkout; when that separate work is later integrated, give its Apps Script gates a distinct filename rather than merging meanings. |
| Contact editor | No original-only contact-editor file is included. The dirty original still contains its business/contact editor changes and tests at the same HEAD. |

Historical integration-worktree verification before blocker repair (Node `v22.23.2`, npm `10.9.8`, TypeScript `5.9.2`, ESLint `9.35.0`, Vitest `4.1.12`, Next.js `15.5.28`, Stryker `10.1.1`, Knip `6.44.1`, Supabase CLI `2.122.0`):

| Exact command | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Exit 0; 644 packages installed. npm reported the newly introduced optional Sentry/Babel peer range conflict and ESLint deprecation notice. |
| `npm run lint` | Exit 0; 0 errors and 13 warnings. |
| `npm run typecheck` | Exit 0. |
| `npm test -- --run` | Exit 0; 44 files and 286 tests passed. |
| `npm run test:db` | Exit 0; 31 migrations, SQL contracts, and anonymous publication RPC execution passed. |
| `npm run test:db:concurrency` | Exit 0; loopback disposable PostgreSQL upgrade, stale-write, concurrency and rollback checks passed. |
| `$env:NEXTAP_ENV='test'; $env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:56321'; $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_local_build_only'; $env:NEXT_TELEMETRY_DISABLED='1'; npm run build` | Exit 0; production build completed with the local-only URL. |
| `npm run check:file-budgets -- --base 230adeca680c0fe7e22b3ece0fd9169764b84ffe` | Exit 0; 11 changed source files and 0 unchanged legacy overages. |
| `npm run check:dependency-status -- --base 230adeca680c0fe7e22b3ece0fd9169764b84ffe` | Exit 0; 7 changed direct packages verified and none deprecated. |
| `npm run check:knip` | Exit 0 in report-only mode; findings remain candidates and no removals are claimed. |
| `npm run continuity:validate` | Exit 0; `valid`. |
| `npm audit --omit=dev --audit-level=high` | Exit 0; five moderate advisories and no high/critical threshold failure. |
| `git diff --cached --check -- . ':!reports/phase1-closeout'` | Exit 0 for paths outside the closeout directory. The additional raw-log-only exclusion check also passed, covering structured evidence. |
| `git diff --cached --check` | Exit 2 because preserved raw CLI logs under `reports/phase1-closeout/` contain trailing whitespace from terminal output. The log files are copied byte-for-byte to retain command output; they are excluded from the source/docs whitespace check and are not reformatted. |
| Historical local Markdown target check | Reported no missing relative targets. The final review independently checked 134 inline relative targets. Anchors and external URLs were not verified; current repair counts are recorded below. |

The local synthetic owner-card journey was not rerun because its source, test, temporary config, and fixture inputs are byte-identical to the candidate run; only documentation, evidence paths, and portable links changed. The retained run `01a1ace3-6598-78ce-8232-a3cb95675fdc` passed 1/1 against loopback project `nextap-contacts-local` at `127.0.0.1:56321` / database port `56322`, with the synthetic `example.test` owner fixture recorded in `browser-local-identity.json`. No hosted data or resources were accessed.

There are no unresolved content conflicts within the Phase 1-only diff. The separate Apps Script `GATES.md` filename collision is explicitly deferred to a future integration of that original-only work, and must be renamed to a distinct destination then. No Phase 2 implementation, commit, push or deployment occurred.

## Final Integration Blocker Repairs

Repairs were confined to `F:/projects/NexTap-contacts-phase1-integration-review` at approved main `230adeca680c0fe7e22b3ece0fd9169764b84ffe`. No Phase 1 restart, Phase 2 implementation, commit, push or merge occurred. The other worktrees were not accessed.

1. The unidentified-target historical app log and sibling report were audited and excluded, along with the lookup log that repeated unidentified identifiers. Published identity metadata is labeled as sanitized and omits those artifacts' hashes and unchanged-file assertions. The later identified local synthetic desktop report is the browser evidence used here.
2. Session expiry still applies to actual validation/save/restore and hooks. CI now invokes `node scripts/continuity/continuation.mjs validate-contract` for schema, format, size and secret checks without session freshness. Controlled-clock tests pass; direct root CLI checks at `2030-01-01` produce contract `valid`/exit 0 and session `stale`/exit 1.
3. Exact Stryker core/runner `9.6.1` uses Babel `7.29.13`, satisfying Sentry's optional Babel 7 peer without a new override. Clean `npm ci`, complete lock graph and complete installed graph pass. The earlier install and build also passed: the blocker was an introduced peer incompatibility, not an observed install/build failure.

[Current commands, raw outputs, registry responses and lock comparison](../../reports/phase1-integration-repair/README.md) are retained for these repaired inputs. Focused continuity is 9/9; full unit is 44 files/290 tests; lint is 0 errors/13 warnings; typecheck and fresh local-only production build pass. Publication mutation is 17/18 at 94.44%, break 94; inventory is 31/31 at 100%. A fresh negative control exits 1 at 94.44% under 95, and accepted configuration stays at 94. The runtime high-threshold audit passes with five moderate findings; a separate audit including development scope reports 14 moderate and no high/critical. Knip remains report-only.

Database/concurrency and browser inputs did not change, so those checks were not rerun. The retained identified synthetic desktop journey is the only independently retained browser pass; earlier direct desktop/mobile claims lack reports. Its trace is ignored local output, outside the staged diff. Hook host loading and trust remain unverified. Source/docs whitespace, full raw-log whitespace, relative-target checks and final privacy/input identity are reported in the repair evidence, with anchors and external URLs explicitly outside the link check.

Final staged verification uses the retained scripts in the repair evidence: source/docs and structured evidence whitespace passes (exit 0), while the full raw-log-inclusive check exits 2 for retained CLI trailing whitespace. The staged inline-relative-target check has no missing targets; anchors and external URLs were not checked. The three excluded artifact paths and removed artifact hash/assertion fields are absent from the index; targeted privacy-audit scope and results are retained separately. The repaired input identity and current command-output hashes are distinct from the historical candidate fingerprint. Exact final path/stat counts and the staged tree SHA are returned with this repair task, outside the tree to avoid self-reference.

Repair disposition: all three integration blockers are resolved. The targeted final privacy audit scanned all 123 staged paths with zero extracted-identifier or checked-credential matches and no unreadable paths. The final link check covers 183 inline relative targets across 25 changed Markdown files, with zero missing targets. The full whitespace check records 160 findings across 18 retained raw logs; source/docs and structured evidence pass. Within these stated scopes, the repaired Phase 1 diff is acceptable to land. Phase 1 does not need restarting. Land it on the branch/worktree intended for the next phase in a separately authorized integration task; Phase 2 implementation remains a separate task after landing. Missing earlier desktop/mobile reports, unverified host hook loading/trust, lint warnings and moderate audit findings remain documented limitations.
