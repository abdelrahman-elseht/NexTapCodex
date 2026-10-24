# Security and Performance Implementation Record

This record covers the staging-tree implementation of `NEXTAP_SECURITY_PERFORMANCE_IMPROVEMENTS_SPEC.md`. It is source and local-fixture evidence; hosted provider behavior remains deployment evidence.

## Source trace

- CI hosted E2E now runs only from `staging`; deployment verification rejects any branch other than `staging` and still pins the commit, Preview target, Vercel deployment shape, and staging Supabase project.
- Draft saves read a bounded body before form parsing, reject invalid content types, and cap the draft field, sections, nested items, provider profiles, and decoded text. Owner and same-origin checks remain before mutation.
- Public publication resolution validates the slug before Supabase access and uses a 256-entry, five-second LRU-style cache with expired-entry eviction and a 32-lookup in-flight cap.
- Application budgets cover password login, card resolution/public publication, contact preview/download, media upload, draft mutation, exports, and controlled Sentry diagnostics. They are process-local budgets; distributed enforcement remains a provider/WAF fact.
- Application security headers cover CSP, frame protection, HSTS, referrer policy, MIME sniffing, permissions, and private admin/API caching.
- Manufacturing URLs use the configured environment origin. Forwarded request headers are accepted only for local development/tests.
- `saveBusiness` uses `update_business_page`, and `createBranch` uses the existing atomic `create_admin_page` RPC; both enforce owner authorization and business/page relationships at the database decision point.

## Local validation record

Commands run in the repository worktree:

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:db
npm.cmd run test:db:concurrency
npm.cmd run build
```

All checks passed. The unit suite ran 35 files and 233 tests; the SQL harness applied 27 migrations and passed all contracts; the real PostgreSQL concurrency suite passed; and the production build completed. The focused security tests cover fixed-length and chunked oversized draft bodies, missing bodies, invalid content types, draft structure limits, invalid public slugs, bounded rate-limit keys, and forged hosted export origins. Lint completes with existing warnings and no errors.

## Deployment facts still requiring owner observation

The repository cannot prove Vercel Deployment Protection, Supabase Auth password limits, provider/WAF distributed limits, effective response headers at `staging.nextap.services`, or the deployed Storage bucket policy. These remain `needs_validation` until observed against the stable staging deployment. No hosted load or availability traffic was run by this implementation.
