# Hosted Staging validation progress

Updated: October 13, 2026. This is progress evidence, not Staging acceptance.

## Reviewed implementation

The candidate branch is `chore/hosted-staging-validation`; PR #1 targets
`staging` and remains draft and unmerged. Public landing navigation has no
owner entry points. The regression now checks normalized navigation URLs in
Arabic and English, including absolute URLs, query strings and trailing slashes.
Direct login, owner dashboard and session-refresh journeys remain separate.

Hosted browser access bootstraps a host-only HttpOnly Vercel bypass cookie
through a Node request without redirects. It does not use the runner's
registrable-domain-scoped headers. Cookie setup is repeated after clean-state
and saved-session restoration, and checks that sibling Production domains and
unrelated Vercel tenants cannot receive the cookie. Direct Node requests are
restricted to loopback or the exact stable Staging hostname, with redirects
disabled.

The Staging-only `/api/deployment` endpoint exposes an explicit metadata
allowlist. Protected acceptance waits for the stable alias to serve the checkout
SHA and branch, the isolated Staging Supabase project, a Preview target and a
deployment ID. It verifies the same deployment after tests. A missing or failed
final verification marks the sanitized summary as failed, even when browser
assertions pass. Full runner output, cookies, card URLs and failure traces are
kept out of uploaded hosted artifacts.

## Validation before the hosted identity deployment

- Typecheck and lint passed; lint retains 11 pre-existing warnings, no errors.
- Unit suite passed 103 tests; the final focused deployment/summary regression
  passed 3 tests, adding one further test to the suite.
- A fresh production build passed.
- Local landing suite passed 12 desktop/mobile checks.
- Protected hosted landing and observability selection passed 16 checks against
  the earlier candidate deployment. This validates cookie access and login, but
  does not accept the new source SHA.
- Earlier full hosted read-only coverage passed 41, failed 1 and skipped 20.
  The failure was an owner login exceeding a five-second assertion timeout;
  the focused rerun passed with a bounded 30-second assertion.

## Provider state and isolation

Vercel project `nextap` belongs to team `abdelrahman-867e`. The Staging alias
still follows the candidate branch; Production Branch remains legacy `beta01`.
Production `main` has not been created/configured. Preview and Production
Supabase URLs reference separate projects. The old automation bypass was
revoked and replaced directly by the operator; never retrieve or print raw
project protection configuration.

GitHub's protected `staging` Environment requires owner approval, disallows
administrator bypass and allows only `staging` and this temporary candidate
branch. Its credentials stay in environment secrets and are available only to
the hosted test step. The candidate push trigger bootstraps workflow registration;
remove that temporary trigger and deployment-branch exception after acceptance.

Staging Supabase `flkakuysakgwfoemgbwn` has 21 migrations, owner/Auth fixtures
and synthetic media data. Signup is disabled. Site URL and callback allowlist
are restricted to `https://staging.nextap.services` and its `/auth/callback`.
Production `jezpobjlfvihikplxrta` has 11 migrations and empty application, Auth
and Storage data. All 11 application tables in each project have RLS enabled.
Neither project was linked for migration work in this continuation; no schema
migrations were applied. Never link/mutate Production from a local shell.

Sentry access to `abdelrahman-0n/nextap` works. Hosted DSN/environment setup and
capture evidence remain pending under the post-acceptance provider steps.

## Remaining acceptance and release gates

1. Push the reviewed candidate and verify the new Ready deployment identity.
2. Approve the protected GitHub hosted job and inspect its sanitized summary.
3. Dispatch mutation acceptance explicitly with `allow_mutations=true`, approve
   the environment gate and seed a fresh uniquely namespaced synthetic fixture.
4. Complete non-owner authenticated denial coverage, runtime publication/RPC
   evidence and monitoring acceptance; document diagnostic skips explicitly.
5. Only after acceptance, obtain release/merge authorization before advancing
   `staging`, binding its domain, creating `main` or changing Production Branch.
   The user's standing instruction remains: do not merge anything.
6. Provision protected Production releases, Auth allowlists, schema parity and
   recovery evidence, hosted Sentry variables and the explicit `www` decision.
   Recommended canonical behavior is `www` redirecting to `nextap.services`;
   no DNS or domain change is authorized by this recommendation.

The operator approves hosted jobs at GitHub Actions → the candidate run →
Review deployments → `staging` → Approve and deploy. The agent must not
self-approve this gate. Credentials belong in GitHub/Vercel secret storage,
never chat, committed files or test artifacts.

For migration work, first run
`npx.cmd --yes supabase link --project-ref flkakuysakgwfoemgbwn` and stop for
operator password entry if requested. Production migrations require a protected
release workflow.
