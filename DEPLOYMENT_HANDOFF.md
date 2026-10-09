# NexTap Deployment Handoff

Status: **deployment preparation only**. Production traffic, nameservers, Supabase production creation, Vercel deployment, and DNS writes remain unactivated pending explicit approval and provider access.

## Repository and branch

- Worktree: `F:\projects\NexTabCodex-production-setup`
- Branch: `chore/production-setup`
- Base: `90fddfa` (`beta01.6` at the time this worktree was created)
- The original checkout and `beta01.5` were not modified.
- No application behavior, migrations, RLS policies, Supabase data, or production credentials were changed.

## Completed in this branch

- Added `.github/workflows/ci.yml` for pull requests and pushes to `main`, `beta01.5`, and this branch.
- CI runs `npm ci`, lint, TypeScript typecheck, Vitest, and the Next.js production build using non-production placeholder public Supabase values.
- Added ESLint 9 and `eslint-config-next` as development dependencies, `eslint.config.mjs`, and the `npm run lint` script.
- Audited the local migration history: 11 ordered migrations under `supabase/migrations/`, matching the remote staging history listed below.
- Added this handoff with environment isolation, provider findings, monitoring, backup, and rollback procedures.

## Verification

Local commands run in the isolated worktree after `npm ci` and the lint dependency install:

| Check | Result |
| --- | --- |
| `npm run lint` | Passes with 12 pre-existing warnings; 0 errors |
| `npm run typecheck` | Pass |
| `npm test` | Pass: 2 files, 11 tests |
| `npm run build` | Pass; Next.js reports existing `<img>` and unused-variable warnings |

The first attempt before installing dependencies could not run because this new worktree had no `node_modules`. `npm ci` then completed. `npm audit` reported dependency advisories; no automated audit fix was applied because it could change versions outside this setup task.

## Environment mapping

| Surface | Supabase URL | `NEXT_PUBLIC_SITE_URL` | Vercel target | Data policy |
| --- | --- | --- | --- | --- |
| Local development | local or developer-selected project | `http://localhost:3000` | Development | Never production data |
| Preview/staging | `NexTabCodex` (`flkakuysakgwfoemgbwn`) only after confirming it contains no customer data | `https://staging.nextab.services` | Preview | Isolated from Production |
| Production | New clean Supabase project, separate ref and credentials | `https://nextab.services` | Production | No staging credentials or data |

Required Vercel variables in each target are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, and optional `NEXT_PUBLIC_CONTACT_WHATSAPP`. Store values as encrypted/sensitive variables. Do not add service-role keys to Vercel or browser-exposed variables.

## Supabase inspection

The authenticated Supabase MCP account exposes one organization (`abdelrahman-elseht`) and an active healthy project named `NexTabCodex`:

- Project ref: `flkakuysakgwfoemgbwn`
- Region: `eu-west-1`
- Database: PostgreSQL 17.11
- Current table row counts include 56 businesses, 56 pages, 562 sections, 28 publications, 308 cards, 11 batches, and 120 audit rows.
- `owner_users` contains 1 row. This is evidence that the project is not empty; treat it as staging only after the owner confirms that no real customer data is present.
- Remote migration history: `initial_schema`, `publish_and_slugs`, `publish_page`, `constraints_indexes`, `immutable_publications`, `owner_audit_insert`, `atomic_section_reordering`, `external_printer_batches`, `template_presets`, `atomic_draft_save`, `quick_actions`.
- No migration or SQL write was executed.

Advisories observed (not changed): `public.rls_auto_enable()` is callable as a SECURITY DEFINER function by `anon` and `authenticated`; `public.create_card_batch(...)` is callable by `authenticated`; leaked-password protection is disabled; several indexes are currently unused. Review and remediate in the appropriate staging change process before production activation. Do not patch the existing project as part of this handoff.

Production creation is pending because it is a billable, externally visible resource operation. When approved, create a new project in organization `ywfepswoxgojuplkyrsn`, apply the reviewed migration set in order, verify migration history/tables/RLS/advisors, create separate Auth redirect URLs and publishable keys, and record the new ref here. Never clone staging data into Production.

## Vercel

Vercel MCP returned no teams or projects for the authenticated account, so no project, environment variable, domain, deployment, or traffic setting was changed. Connect the GitHub repository to a Vercel project manually or with an authorized Vercel account, then configure Preview and Production targets independently. Keep Vercel Hobby limitations in mind; the existing project handoff states that Hobby is not suitable for commercial launch terms.

Preview should use only `flkakuysakgwfoemgbwn` after the no-customer-data decision. Production must use the newly created Production ref. Use separate Supabase Auth Site URL/redirect allowlists for `staging.nextab.services` and `nextab.services`.

## GitHub protection

The remote repository is public and currently reports `beta01` as its default branch. The requested `main` branch does not exist; `beta01.5` exists and is unprotected. No protection write was attempted because changing `beta01.5` would interfere with the existing branch. After an administrator establishes the intended production branch and confirms the account plan supports protection, require the `quality` check, one approving review, and disable force pushes/deletions on that production branch.

## Cloudflare DNS

Cloudflare MCP authenticated as `elsehtabdelrahman@gmail.com`, but `GET /zones?name=nextab.services` returned no zone. No DNS record, nameserver, proxy, or traffic change was made. After the account/zone is available, prepare (DNS-only) records:

| Name | Type | Target | Proxy |
| --- | --- | --- | --- |
| `nextab.services` | CNAME/ALIAS per Cloudflare/Vercel guidance | Vercel production target | DNS only |
| `admin.nextab.services` | CNAME | Vercel production target | DNS only |
| `staging.nextab.services` | CNAME | Vercel preview target | DNS only |

Confirm existing records and Vercel verification values before any write. Do not change nameservers, enable production traffic, or proxy these records without approval.

## Admin security and operations

- Keep the owner allowlist (`owner_users`) administrator-managed; verify anonymous users and authenticated non-owners receive the existing denied responses.
- Configure Supabase Auth redirect allowlists separately per environment and enable leaked-password protection before production.
- Keep service-role/database credentials server-side only; rotate publishable keys through the provider consoles if exposed.
- Monitor Vercel deployment/build/runtime errors, Supabase Auth/database logs and security/performance advisors, Cloudflare DNS/zone audit events, and application audit logs.
- Enable scheduled Supabase backups and perform a restore drill before production. Retain migration files and a dated schema/migration inventory with every release.

## Rollback

1. Stop promotion and leave the current Production deployment serving traffic.
2. Repoint the Vercel Production alias to the last known-good deployment or use Vercel rollback; do not delete the database.
3. If a schema release is incompatible, disable the new application deployment and restore the database from the most recent verified backup only with approval. Prefer a forward-compatible migration over destructive rollback.
4. Keep Cloudflare records DNS-only and unchanged during rollback unless the approved runbook requires a target correction.
5. Verify `/`, `/login`, an admin denial, a published public page, and a card resolution URL against the correct environment before resuming promotion.

## Pending manual actions and exact activation gate

1. Confirm GitHub repository access and enable branch protection for `main` with required `quality` status checks, one approving review, and no force pushes/deletions. GitHub plan support and repository permissions must be checked by an administrator; no branch-protection write was attempted here.
2. Connect the repository to Vercel and confirm Preview/Production projects or environments exist with isolated variables. Run a non-production preview deployment first.
3. Confirm `NexTabCodex` has no real customer data before using it for Preview/Staging.
4. Obtain approval for the billable new Supabase Production project, create it cleanly, apply and verify the reviewed migrations, and record its URL/ref without copying staging data.
5. Confirm Cloudflare access to `nextab.services`, inspect current DNS, and prepare DNS-only Vercel records without changing nameservers.
6. Verify Preview against staging data, verify Production against the clean project, and capture CI, auth, database, DNS, backup, and rollback evidence.
7. For the final activation only: obtain explicit approval, add/verify the Production domain in Vercel, create/verify the three DNS-only records in Cloudflare, update the Production Auth allowlist and Vercel variables, deploy the approved commit, smoke-test the production URLs, and then promote the alias. Do not merge to `main` or publish customer-facing traffic before that approval.
