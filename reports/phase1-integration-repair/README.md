# Phase 1 Integration Repair Evidence

This work is confined to the uncommitted integration worktree at approved main `230adeca680c0fe7e22b3ece0fd9169764b84ffe`. It repairs privacy/provenance, durable continuity checks, and the optional Babel/Sentry peer conflict. It does not restart Phase 1 or implement Phase 2. The candidate fingerprint in the [historical closeout](../phase1-closeout/README.md) describes the original candidate, not these repaired inputs.

## Acceptance checklist

- Unidentified-target app log, sibling report, and identifier-bearing lookup log excluded; published metadata sanitized. Final staged-value audit scope and results are recorded in the [privacy scan](privacy-scan.json).
- Session validation retains expiry; CI checks the packet contract independently of session freshness. Controlled-clock tests pass, including direct CI validation at a 2030 clock.
- Compatible Stryker versions pinned without adding an override; clean installation and both complete dependency graphs pass. Fresh publication/inventory mutation checks and the negative control pass with the expected outcomes.
- Current command outputs are retained below. Final input identity, relative-target and whitespace verification are recorded separately.

## Dependency repair

Stryker core and Vitest runner are pinned to `9.6.1`. Its instrumenter uses Babel `~7.29.0`; locked Babel `7.29.13` satisfies Sentry's optional `^7.18.5` peer. Stryker `10.0.0` and the original `10.1.1` set use Babel 8. No Babel override or peer-warning suppression was added; the existing unrelated package override is unchanged. The earlier install and build passed; the review found an unsupported optional peer graph, not an observed install/build failure.

Evidence: [registry metadata and rationale](dependency-metadata.log), [clean install](npm-ci.log), [complete lock graph](full-lock-graph.log), [complete installed graph](installed-graph.log), [runtime audit](production-audit.log), and [full-scope audit](dependency-audit.json). Runtime audit exits 0 with five moderate findings. The separate full-dependency audit records 14 moderate findings and no high/critical findings; those scopes must not be conflated.

## Evidence scope

Both historical unidentified-target browser files were audited before exclusion. The related lookup log was excluded too. Their contents and artifact hashes are not included in published metadata. This changes only the integration publication; the candidate and other worktrees remain untouched.

The [identified local synthetic browser report](../phase1-closeout/browser-local/report.json) and [fixture identity](../phase1-closeout/browser-local-identity.json) remain the browser evidence: one desktop journey passed against loopback Supabase with generated fixtures. Its trace is local ignored output and is not in the staged diff. Earlier direct desktop/mobile assertions have no retained reports and are not independently verified here. Actual Codex/Claude host loading and trust remain unverified.

No application workflow, schema, SQL test, browser source, or synthetic fixture input changed in these repairs. Database/concurrency and browser journeys are therefore retained historical checks rather than rerun. Dependency/tooling changes require a fresh install, full unit/lint/type/build checks, scoped mutation runs and dependency checks; those current results are recorded below.

Relative-link checks cover only the inline relative targets actually enumerated. Anchors and external URLs are not verified. Raw CLI logs are retained without whitespace reformatting; the full staged whitespace result is distinct from the source/docs result.

## Current commands and results

All commands ran in this integration worktree after the clean install. Node is `v22.23.2`, npm `10.9.8` and Stryker `9.6.1`. TypeScript `5.9.2`, ESLint `9.35.0`, Vitest `4.1.12` and Next.js `15.5.28` remain unchanged.

| Exact command/check | Observed result | Output |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | Exit 0; 625 packages. Existing ESLint deprecation notice; no Babel/Sentry peer conflict. | [install](npm-ci.log) |
| `npm ls --package-lock-only --all --offline --loglevel=error` | Exit 0, full lock graph. | [lock graph](full-lock-graph.log) |
| `npm ls --all --offline --loglevel=error` | Exit 0, full installed graph. Optional unavailable packages are not peer incompatibilities. | [installed graph](installed-graph.log) |
| `npm test -- --run tests/unit/continuation.test.ts` | Exit 0; 9/9 on the final refreshed packet. | [focused tests](continuity-focused-final.log) |
| `node scripts/continuity/continuation.mjs validate-contract` | Exit 0, valid. | [CI contract](continuity-contract.log) |
| `npm run continuity:validate` | Exit 0, valid at the current session date. | [session validation](continuity-session.log) |
| `Get-Content -LiteralPath 'reports/phase1-integration-repair/future-clock-runner.mjs.txt' -Raw \| node --input-type=module` | Controlled `2030-01-01` clock: actual root CI contract exit 0/valid; actual session validation exit 1/stale. Both exit and output are checked. | [runner](future-clock-runner.mjs.txt), [output](future-clock.log) |
| `npm test -- --run` | Exit 0; 44 files, 290 tests. | [unit](unit-all.log) |
| `npm run lint` | Exit 0; 13 warnings, 0 errors. | [lint](lint.log) |
| `npm run typecheck` | Exit 0 before and after build. | [before](typecheck-before-build.log), [after](typecheck-after-build.log) |
| `npm run test:mutation:publication` | Exit 0; 17 killed/1 equivalent survivor, 94.44%, break 94. | [log](mutation-publication.log), [JSON](../mutation/public-publication.json) |
| `npm run test:mutation:card-inventory` | Exit 0; 31 killed/0 survivors, 100%, break 100. | [log](mutation-card-inventory.log), [JSON](../mutation/card-inventory.json) |
| `npx.cmd stryker run reports\phase1-integration-repair\negative-control.config.mjs` | Expected exit 1; 94.44% below 95. Temporary executable removed; accepted config remains at 94. | [log](mutation-negative-control.log), [JSON](mutation-negative-control.json), [retained config text](negative-control.config.txt) |
| `npm run build` with the exact environment in its log | Exit 0; test environment, loopback Supabase validation URL, dummy public key and telemetry disabled. No real fixture/database interaction is claimed. | [build](build.log) |
| `npm run check:file-budgets -- --base 230adeca680c0fe7e22b3ece0fd9169764b84ffe` | Exit 0; 11 changed source files, no unchanged legacy overages. | [budgets](file-budgets.log) |
| `npm run check:dependency-status -- --base 230adeca680c0fe7e22b3ece0fd9169764b84ffe` | Exit 0; seven changed direct packages have metadata, no deprecation reported for those versions. | [metadata check](dependency-status.log) |
| `npm run check:knip` | Exit 0 in report-only mode; retained findings are not automatically removed. | [Knip](knip.log) |
| `npm audit --omit=dev --audit-level=high` | Exit 0; five moderate runtime findings. | [runtime audit](production-audit.log) |
| `npm audit --package-lock-only --json` | Exit 1; 14 moderate including development scope, no high/critical. | [full audit](dependency-audit.json) |

The [registry responses](dependency-selection.json) and [lock comparison](lock-identity.json) support the dependency choice. Relative to approved main, the lock has 193 added paths, one removed nested package path and two existing-path version changes; no same-version integrity or resolved-URL changes. Root manifest fields agree and all resolved hosts are the npm registry.

Both regenerated accepted mutation JSON files and the new negative-control JSON embed source matching current production files after line-ending normalization. Only the threshold/report destination differs in the negative control. The original closeout negative-control output remains explicitly historical.

## Final staged verification

The [repaired input identity](verified-inputs.json) binds the staged executable/configuration inputs and current retained command outputs to approved main. It is produced with `Get-Content -LiteralPath 'reports/phase1-integration-repair/capture-identity.mjs.txt' -Raw | node --input-type=module`; [the retained capture source](capture-identity.mjs.txt) states the exact scope and hash algorithm. The original candidate fingerprint is retained only as historical provenance. The final staged tree SHA is reported outside this tree to avoid self-reference.

`Get-Content -LiteralPath 'reports/phase1-integration-repair/verify-staged.mjs.txt' -Raw | node --input-type=module` checks inline relative targets against staged files/directories, excluded paths and sanitized metadata fields, and runs both exact whitespace commands. [Its source](verify-staged.mjs.txt) and [actual results](staged-checks.json) are retained. Source/docs and structured evidence pass `git diff --cached --check -- . ':(exclude,glob)reports/**/*.log'` (exit 0). The full `git diff --cached --check` exits 2 for trailing whitespace in retained raw CLI logs; this is not a full-whitespace pass. Relative targets have no missing entries in the enumerated scope; anchors and external URLs were not verified.

The separate [privacy scan](privacy-scan.json) records the excluded-value comparison and secret-pattern audit, with scope and limitations. The three excluded artifacts are absent from the index, and the removed artifact-hash/unchanged assertions are absent from the published identity metadata. No other worktree was accessed or changed. No Phase 2 implementation or original-main contact-editor changes were added by these repairs.

Disposition: all three repair blockers are resolved; the Phase 1 diff is acceptable to land with the documented limitations. The final privacy scan covered all 123 staged paths with zero extracted-identifier/checked-credential matches. The final relative-target check covered 183 targets in 25 changed Markdown files with zero missing targets. The full whitespace check retains 160 findings in 18 raw logs; the source/docs and structured-evidence check passes. The next step is a separately authorized landing on the branch/worktree Phase 2 will use; Phase 2 implementation must be a separate task after landing.
