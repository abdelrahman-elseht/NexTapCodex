# Phase 1 Closeout Evidence

Captured 2026-11-05 against the dirty, uncommitted candidate at approved main `230adeca680c0fe7e22b3ece0fd9169764b84ffe`. The sanitized [candidate identity](candidate-identity.json) retains its historical input fingerprint and non-evidence file manifest. The sanitized [final verification](candidate-final-verification.json) retains the identified synthetic report hash. Assertions and hashes for excluded unidentified-target artifacts have been removed from these published copies. The candidate input fingerprint describes the original candidate, not the repaired integration tree. Current repair commands and results are in the [integration repair evidence](../phase1-integration-repair/README.md).

## Historical Candidate Check Results

| Check | Result | Evidence |
| --- | --- | --- |
| Lint | Pass, 0 errors and 13 warnings | [lint-final.log](lint-final.log) |
| Typecheck | Pass, including after the final build regenerated Next type references | [typecheck-final.log](typecheck-final.log) |
| Unit | 44 files, 286 tests passed | [unit.log](unit.log) |
| SQL/database | Pass, 31 migrations and SQL contracts | [database.log](database.log) |
| Database/concurrency | Pass using a disposable loopback PostgreSQL cluster | [database-concurrency.log](database-concurrency.log) |
| Build | Pass with a test environment and loopback URL; the initial no-URL attempt failed before compilation | [build-final.log](build-final.log), [initial failure](build.log) |
| File budgets | Pass: 11 changed source files, no unchanged legacy overages | [file-budgets.log](file-budgets.log) |
| Dependency status | Pass: metadata verified for 7 changed direct packages; none deprecated | [dependency-status.log](dependency-status.log) |
| Knip | Report-only exit 0, findings retained for review; this is not an absence-of-unused-code claim | [knip-final.log](knip-final.log) |
| Continuity | Pass: packet status `valid` | [continuity.log](continuity.log) |
| Production dependency audit | Exit 0 at the high threshold; 5 moderate advisories, no high-severity gate failure | [npm-audit-high.log](npm-audit-high.log) |
| Owner-card browser journey | 1 selected/executed/passed, 0 failed/flaky/skipped; desktop, no retries | [browser-local.log](browser-local.log), [report](browser-local/report.json), [local identity](browser-local-identity.json) |

The Knip compact output groups findings by file: 10 unused-file entries; one `package.json` entry listing `eslint-config-next`, `playwright-core`, and `vcard-parser`; 10 source-file export entries; and 3 type entries. No flagged code or dependencies were removed. Earlier lint/Knip captures included the temporary mutation config; the linked final captures were taken with it absent.

These historical logs predate the integration repairs. Their Stryker version is 10.1.1; the current compatible dependency set and fresh mutation results are recorded in the repair index. Each command log contains the exact invocation and exit code. The successful build used `NEXTAP_ENV=test`, `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56321`, a dummy publishable key, and disabled Next telemetry. It proves the Next build only.

Tool versions are retained in [tool-versions.log](tool-versions.log): Node 22.23.2, npm 10.9.8, TypeScript 5.9.2, Stryker 10.1.1, Knip 6.44.1, Vitest 4.1.12, Next.js 15.5.28, ESLint 9.35.0, Supabase CLI 2.122.0, PGlite 0.5.8 (PostgreSQL 18.3 WASM), embedded-postgres 17.10.0-beta.17 (native PostgreSQL 17.10), and local Supabase PostgreSQL 17.11. Browser runner/engine versions are e2e 0.18.0 and @e2e-dev/web 0.13.0.

## Historical Candidate Mutation Control

The accepted publication JSON has been regenerated during integration repair with Stryker 9.6.1; the historical negative-control artifacts below used 10.1.1. The accepted report remains at `thresholds.break = 94` and records 17/18 killed mutants (94.44%). The isolated negative control changed only the effective break threshold to 95 and the JSON output path; Stryker exited 1 with “Final mutation score 94.44 under breaking threshold 95.” The negative-control JSON records `break: 95`; the accepted [stryker.config.mjs](../../stryker.config.mjs) remains at `break: 94`. Its temporary executable config was removed before the final lint and Knip runs.

Evidence: [negative-control log](stryker-negative-control.log), [negative-control JSON](stryker-negative-control.json), [exact temporary config](stryker-negative-control.config.mjs.txt), [accepted publication JSON](../mutation/public-publication.json), [final threshold check](accepted-threshold-final.log). The [retained-source check](mutation-retained-source-check.log) confirms both accepted mutation reports embed the current normalized production source: publication 17 killed/1 survived, inventory 31 killed/0 survived. The previously documented publication survivor remains the no-op error assignment.

## Browser Target and Synthetic Fixture

The unidentified-target historical browser app log and sibling report were audited and excluded from the landable diff. The related local lookup log was also excluded because it repeated unidentified database identifiers. Neither artifact contents nor their artifact hashes are published here; the original candidate worktree was not changed. These files are not evidence for the identified local browser pass.

The earlier target could not be established. Its unsuccessful local lookup does not prove a local or synthetic origin, and no hosted target was queried to recover it. The later identified synthetic run below is the browser evidence used for Phase 1.

The unchanged `tests/e2e/owner-card-journey.e2e.ts` passed 1/1 on desktop with no retries. [The identity manifest](browser-local-identity.json) binds [the report](browser-local/report.json) to loopback API port `56321`, database port `56322`, project `nextap-contacts-local`, 31 applied migrations and newly generated synthetic `example.test` fixtures. The [runner source](local-browser-runner.mjs.txt) checks loopback origins before fixture creation and keeps credentials in memory. No hosted resource or schema was changed. The synthetic fixture remains local. The report references a trace that exists locally under ignored artifacts but is not part of the staged diff.

The [temporary E2E config](e2e.phase1-closeout.config.ts.txt) changed only the app log destination. Report/artifact output was selected by the CLI; the accepted E2E config was unchanged. The wrapper invoked the installed CLI with `node node_modules/e2e/dist/cli/bin.js run ...`; its equivalent `npx --no-install e2e run ...` spelling appears in the log header. The exact executable and argument vector are also recorded in the identity file and log. Two unselected files emitted missing-`.env.local` collection notices; the selected owner journey collected and passed with zero skips. No other browser journey or mobile pass is claimed.

## Disposition

Historical candidate closeout supports Phase 1 exit without a restart. The separately repaired integration inputs and current checks are documented in the [integration repair evidence](../phase1-integration-repair/README.md) and [reconciliation review](../../docs/program/PHASE_1_RECONCILIATION_REVIEW.md). The candidate remains uncommitted and unintegrated; Phase 2 implementation has not started. Lint warnings, moderate audit findings, report-only Knip candidates, missing retained reports for earlier direct desktop/mobile assertions, and unverified Codex/Claude host loading/trust remain explicit limitations.
The source/docs staged whitespace check passed in the final integration review; the full staged check reported trailing whitespace in retained raw CLI logs. Current repair whitespace and relative-link check results are recorded separately. Anchors and external URLs are not verified by the relative-target check.
