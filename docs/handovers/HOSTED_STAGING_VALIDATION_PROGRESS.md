# Hosted Staging validation progress

Updated: October 14, 2026 (Cairo). This records the accepted hosted Staging
validation run and completed protected release preparation.

Current state supersedes older pending-release wording below: PR #1 is merged
into `staging`; protected `main` is the GitHub default and Vercel Production
Branch at accepted SHA `856bbd42d59fb3c6f92a6ad5eacd7f12c4923f31`; Vercel
deployment `dpl_6u6SXJEnWqQRDLmGcZopJ4sbhoMY` is READY/PROMOTED; Production
migrations were applied through Supabase MCP; and `www.nextap.services` is a
verified Vercel `308` redirect to `nextap.services`. Only Production Auth
owner setup and an authenticated owner smoke remain operator-only follow-up.


## Reviewed implementation

The candidate branch is `chore/hosted-staging-validation`; PR #1 targeted
`staging` and is now merged. Public landing navigation has no
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

## Current hosted acceptance

PR #1 had four passing required checks (`quality`, hosted E2E, Vercel and
Vercel Preview Comments) before merge. The accepted hosted
run is [38476685140](https://github.com/abdelrahman-elseht/NexTapCodex/actions/runs/38476685140)
on commit `645768a32aae61a32578a886acc6569c2e7f26ef`:

- Ready Preview deployment `dpl_8LThxa7vtTVF5HKfJjYFfTcvPGtR` served
  `https://staging.nextap.services` with `target: preview`, the candidate
  branch, and Supabase project `flkakuysakgwfoemgbwn` before and after tests.
- Desktop and mobile hosted journeys discovered and selected 66 checks;
  64 executed, 63 passed, 0 failed, 2 skipped, 0 unselected.
- The two skips are the controlled Sentry diagnostic cases. The one flaky
  result was the desktop `media-upload` journey; its retry passed. The suite
  therefore passed, but zero flaky results are not yet a release requirement.
- Mutation acceptance used a fresh namespaced synthetic fixture. The sanitized
  summary is the only uploaded artifact; credentials, cookies, card URLs and
  runner traces were not published.

The preceding local checks remain historical evidence: typecheck, lint (11
pre-existing warnings), unit tests, database contracts, production build,
`git diff --check`, and focused local browser coverage all passed before this
hosted run. They were not repeated because the accepted hosted run changed no
source.

The ignored local `.e2e/report.json` is an interrupted pre-acceptance run from
the previous checkout and contains protected-login failures; it is not used as
acceptance evidence. GitHub run `38476685140` is the authoritative hosted result.

## Provider state and isolation

Vercel project `nextap` belongs to team `abdelrahman-867e`. The Staging alias
now follows protected branch `staging`; Vercel Production Branch is protected
`main`, and `beta01` remains unused. Remote `main` points to the accepted
release SHA. Preview and Production
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
Production `jezpobjlfvihikplxrta` has 20 migrations after nine reviewed forward
migrations were applied through Supabase MCP. Its application tables remain
empty and all 11 application tables in each project have RLS enabled. Never
link/mutate Production from a local shell.

Sentry access to `abdelrahman-0n/nextap` works. Vercel Preview metadata now
contains the DSN and public DSN plus `staging` environment variables; values
remain in provider secret storage. A read-only Sentry check for the hosted run
found no staging errors or warning logs and did find staging traces. No
controlled diagnostic events were run because those two cases were skipped.

## Earlier hosted failures and follow-up

The earlier failed mutation run `38475906843` stopped in preflight because its
owner credential could not authenticate; it produced no E2E report and is not
the accepted result. The accepted run supersedes it after the protected owner
fixture was refreshed. The bounded 30-second login assertion and publication
polling fixes are included in the accepted commit.

A synthetic Staging-only non-owner was provisioned with generated credentials
stored directly in GitHub Environment secrets `E2E_USER_NON_OWNER_USERNAME` and
`E2E_USER_NON_OWNER_PASSWORD`. It is not on `owner_users`. Direct verification
proved dashboard denial (307 to unauthorized login), upload API denial (401)
and zero visible business/owner rows under RLS. The protected suite now includes
UI rejection and direct authenticated-session denial coverage for this fixture.
Staging has two Auth users and one owner; Production still has no Auth users,
owners, businesses or Storage objects at the isolation readback.

## Remaining acceptance and release gates

1. Decide whether the single retried desktop media-upload result must be
   eliminated. The current suite passes with one flaky result and CI does not
   require zero flakes.
2. Correlate the hosted publication journey with the Phase 6 pointer/snapshot
   RPC path if that evidence is required; the browser run alone does not prove
   which cached reader executed.
3. Preserve the release flow `feature/* -> staging -> main -> Production` and
   leave legacy `beta01` unused.
4. Set Vercel Production Branch to `main` in the dashboard, configure
   Production Auth and the real owner account, approve the protected
   Production deployment, then run controlled Production smoke checks.
5. The documented `www` decision is complete: Vercel redirects
   `www.nextap.services` to `nextap.services` with status `308`.
The operator approves hosted jobs at GitHub Actions â†’ the candidate run â†’
Review deployments â†’ `staging` â†’ Approve and deploy. The agent must not
self-approve this gate. Credentials belong in GitHub/Vercel secret storage,
never chat, committed files or test artifacts.

For migration work, first run
`npx.cmd --yes supabase link --project-ref flkakuysakgwfoemgbwn` and stop for
operator password entry if requested. Production migrations require a protected
release workflow.
