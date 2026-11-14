# Tooling and Hooks

## Fresh checkout has no installed tools

- **Symptom:** `npm run typecheck` exits with `tsc: not found` in a new worktree or clean checkout.
- **Verified cause:** Dependencies are not installed; `node_modules` is ignored and is not part of the repository.
- **Solution:** Run `npm ci` from the repository root. It installs locked versions without changing the lockfile.
- **Regression guard:** Check that `node_modules/.bin/tsc` exists before treating a missing executable as a source failure.

## Stop review lint exceeds its timeout

- **Symptom:** Stop reports ESLint as unavailable and keeps the session blocked although changed-file lint could pass.
- **Verified cause:** Focused ESLint exceeded 40 seconds for one file in this workspace, exceeding earlier seven-second and 40-second limits.
- **Solution:** Allow 60 seconds for focused ESLint and 90 seconds for the complete Stop hook, which may also run an 18-second Terra review.
- **Regression guard:** Keep the Stop timeout above the combined lint, Terra, and finalization budget; exercise `lintChangedFiles` with the real ESLint command when changing limits.

## Stop review cannot reconcile the current worktree

- **Symptom:** Stop cannot read Git state or misses edits made outside tracked edit tools.
- **Verified cause:** A 250 ms Git status timeout was shorter than measured repository status time, and final review trusted only the edit ledger rather than reconciling all changed paths and fingerprints.
- **Solution:** Bound Git reads at five seconds, allow SessionStart 15 seconds for baseline fingerprints, and reconcile final Git state with baseline and post-edit fingerprints.
- **Regression guard:** Cover Bash-only changes, same-path edits after capture, missing baselines, malformed/overflowed ledgers in `tests/unit/session-review.test.ts`.

## Custom Next.js build directory rewrites generated type references

- **Symptom:** A build using `NEXTAP_BUILD_DIR` changes `tsconfig.json` and `next-env.d.ts` to reference the custom output directory.
- **Verified cause:** Next.js updates generated TypeScript references from its configured build directory.
- **Solution:** Prefer `.next` when no concurrent Next.js process needs isolation. After an isolated custom-directory build, inspect both files and restore only build-generated references to standard `.next` paths.
- **Regression guard:** Run `git diff -- tsconfig.json next-env.d.ts` after custom builds and remove only temporary generated output.

## Terra secret redaction must consume quoted values with spaces

- **Symptom:** A credential assignment such as `password = "a private password"` could send part of the credential to Terra.
- **Verified cause:** The redaction pattern stopped at whitespace instead of consuming the full quoted value.
- **Solution:** Match quoted assignment values through their closing quote before replacement with `[REDACTED]`.
- **Regression guard:** Keep a test with a quoted credential containing spaces. Redaction remains heuristic; do not send confidential or customer data for model review.

## Terra only caches a literal clean response

- **Symptom:** A response beginning with `PASS` plus commentary could be treated and cached as clean.
- **Verified cause:** Prefix matching accepted extra model text after the pass marker.
- **Solution:** Cache only when the complete trimmed response equals `PASS`; treat additional text as findings.
- **Regression guard:** Keep a test proving `PASS` plus commentary is not clean. Model findings do not certify test execution.
