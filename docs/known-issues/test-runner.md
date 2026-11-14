# Test Runner

## Publication resolver test exceeds the default timeout

- **Symptom:** The first test in `tests/unit/public-publication.test.ts` can exceed Vitest's default five seconds; a later test may report a missing mocked RPC result.
- **Verified cause:** The first test took about 25 seconds in this environment. The follow-on mock failure is not independently established and may be caused by the timed-out test continuing while mocks reset.
- **Solution:** The two affected tests use a local 30-second timeout; the rest of the suite keeps Vitest's five-second default.
- **Regression guard:** Keep the timeout local and watch its duration. If it remains near 25 seconds on a normally provisioned runner, investigate the resolver/dependency path instead of raising every timeout.

## E2E runner requires a supported Node 22 patch

- **Symptom:** `e2e` and `@e2e-dev/web` reject Node `22.22.1` before loading CLI commands.
- **Verified cause:** Both packages require `^22.22.3 || >=24.8.0`.
- **Solution:** Use repository pin `22.23.5` through `.nvmrc` or an equivalent version manager.
- **Regression guard:** Keep `.nvmrc`, `package.json` engines, and CI Node versions aligned; check package engine requirements before upgrades.

## E2E test listing still loads application configuration

- **Symptom:** `e2e list` exits with `CONFIG_LOAD_FAILED` and an invalid `NEXT_PUBLIC_SUPABASE_URL`, even though it does not start the app.
- **Verified cause:** `e2e.config.ts` imports the app's Supabase environment assertion at module load; the runner loads config for discovery.
- **Solution:** Supply valid non-production test environment values (or a local `.env.local`) before listing tests.
- **Regression guard:** Keep discovery config side-effect free where possible. Never use production credentials or weaken environment assertions for convenience.

## E2E collection requires a local env file that CI does not create

- **Symptom:** Test listing or collection fails with `ENOENT` for `.env.local` before selecting tests.
- **Verified cause:** `tests/e2e/contacts-ux.e2e.ts` and `tests/e2e/image-crop.e2e.ts` previously loaded the optional file unconditionally, though CI injects variables and clean checkouts omit local secrets.
- **Solution:** Treat `.env.local` as optional while retaining runner/CI variables.
- **Regression guard:** Do not add mandatory local env-file reads at module import time. Keep project and mutation assertions in test setup.
