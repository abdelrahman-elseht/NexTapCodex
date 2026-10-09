# NexTap Deployment Handoff

Status: **deployment preparation only**. Production traffic, nameservers, and Vercel deployment remain unactivated. Provider resources and DNS-only records are prepared; final activation still requires the approval gate below.

## Repository and branch

- Worktree: `F:\projects\NexTabCodex-production-setup`
- Branch: `chore/production-setup`
- Base: `90fddfa` (`beta01.6` at the time this worktree was created)
- The original checkout and `beta01.5` were not modified.
- No existing application behavior, repository migrations, RLS policies, staging data, or production credentials were changed. The reviewed repository migrations were applied only to the new empty Production project.

## Completed in this branch

- Added `.github/workflows/ci.yml` for pull requests and pushes to `main`, `beta01.5`, and this branch.
- CI runs `npm ci`, lint, TypeScript typecheck, Vitest, and the Next.js production build using non-production placeholder public Supabase values.
- Added ESLint 9 and `eslint-config-next` as development dependencies, `eslint.config.mjs`, and the `npm run lint` script.
- Audited the local migration history: 11 ordered migrations under `supabase/migrations/`, matching the remote staging history listed below.
- Added this handoff with environment isolation, provider findings, monitoring, backup, and rollback procedures.
- Created the clean Supabase `NexTapProduction` project and applied all 11 reviewed migrations without copying staging data.
- Created the Vercel `nextap` project and configured separate Preview/Production public environment variables.
- Created the pending Cloudflare `nextab.services` zone and three DNS-only records; nameservers were not changed.
- Created a dedicated `staging` branch from this setup branch and attached `staging.nextab.services` to it; `beta01.5` was not modified.
- Enabled branch protection on `staging` only: required `quality` check, strict status checks, one approving review, last-push approval, conversation resolution, and no force pushes/deletions.

## Verification

Local commands run in the isolated worktree after `npm ci` and the lint dependency install:

| Check | Result |
| --- | --- |
| `npm run lint` | Passes with 12 pre-existing warnings; 0 errors |
| `npm run typecheck` | Pass |
| `npm test` | Pass: 2 files, 11 tests |
| `npm run build` | Pass; Next.js reports existing `<img>` and unused-variable warnings |
| GitHub Actions `quality` | Pass on `chore/production-setup` run `37957252645` and `staging` run `37957256972` |

The first attempt before installing dependencies could not run because this new worktree had no `node_modules`. `npm ci` then completed. `npm audit` reported dependency advisories; no automated audit fix was applied because it could change versions outside this setup task.

## Environment mapping

| Surface | Supabase URL | `NEXT_PUBLIC_SITE_URL` | Vercel target | Data policy |
| --- | --- | --- | --- | --- |
| Local development | local or developer-selected project | `http://localhost:3000` | Development | Never production data |
| Preview/staging | `NexTabCodex` (`flkakuysakgwfoemgbwn`); owner confirmed development/test data only | `https://staging.nextab.services` | Preview | Isolated from Production |
| Production | New clean Supabase project, separate ref and credentials | `https://nextab.services` | Production | No staging credentials or data |

Required Vercel variables in each target are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, and optional `NEXT_PUBLIC_CONTACT_WHATSAPP`. Store values as encrypted/sensitive variables. Do not add service-role keys to Vercel or browser-exposed variables.

## Supabase inspection and Production project

The authenticated Supabase MCP account exposes one organization (`abdelrahman-elseht`) and an active healthy project named `NexTabCodex`:

- Project ref: `flkakuysakgwfoemgbwn`
- Region: `eu-west-1`
- Database: PostgreSQL 17.11
- Current table row counts include 56 businesses, 56 pages, 562 sections, 28 publications, 308 cards, 11 batches, and 120 audit rows.
- `owner_users` contains 1 row. This is evidence that the project is not empty; treat it as staging only after the owner confirms that no real customer data is present.
- Remote migration history: `initial_schema`, `publish_and_slugs`, `publish_page`, `constraints_indexes`, `immutable_publications`, `owner_audit_insert`, `atomic_section_reordering`, `external_printer_batches`, `template_presets`, `atomic_draft_save`, `quick_actions`.
- Production project: `NexTapProduction`, ref `jezpobjlfvihikplxrta`, region `eu-west-1`, status `ACTIVE_HEALTHY`, URL `https://jezpobjlfvihikplxrta.supabase.co`.
- Production started with zero tables/data. All 11 repository migrations are now recorded and applied in order. The resulting public tables all report zero rows and RLS enabled.
- Production publishable key was retrieved through MCP and stored only in Vercel's sensitive Production variable; it is not printed or committed here.
- Production advisors currently report one warning for the existing `public.create_card_batch(...)` SECURITY DEFINER RPC being callable by `authenticated`. No remediation was applied; review it before production activation.

Staging advisories observed (not changed): `public.rls_auto_enable()` is callable as a SECURITY DEFINER function by `anon` and `authenticated`; `public.create_card_batch(...)` is callable by `authenticated`; leaked-password protection is disabled; several indexes are currently unused. Review and remediate in the appropriate staging change process before production activation. Do not patch the existing staging project as part of this handoff.

Production advisors after migration apply report one warning for `public.create_card_batch(...)` being callable by `authenticated`. No remediation was applied in either project.

The project creation cost confirmation returned `$0/month` for organization `ywfepswoxgojuplkyrsn`. Auth users, owner allowlist rows, customer data, and storage objects were not copied. Configure the Production Auth redirect allowlist and owner account only after the final activation approval.

## Vercel

- Project: `nextap`, ID `prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ`, account/team ID `team_j1AHLbF49M6Ob2sm2QBz7sA5`.
- Framework/build settings: Next.js, Node `22.x`, install `npm ci`, build `npm run build`.
- No deployment exists and `live` is false. The project is not yet linked to the GitHub repository; this was left manual because linking enables future automatic deployments.
- Preview and Production variables are isolated and verified by Vercel metadata. Preview points to `flkakuysakgwfoemgbwn` (staging); Production points to `jezpobjlfvihikplxrta` (clean production). Sensitive publishable keys are not readable through metadata.
- Domains attached to the project and verified by Vercel: `nextab.services`, `admin.nextab.services`, and `staging.nextab.services`. The staging domain has no branch binding; it does not target `beta01.5`.
- Keep Vercel Hobby limitations in mind; the existing project handoff states that Hobby is not suitable for commercial launch terms.

Preview uses only `flkakuysakgwfoemgbwn` because the owner confirmed development/test data only. Production uses the newly created Production ref. Use separate Supabase Auth Site URL/redirect allowlists for `staging.nextab.services` and `nextab.services`.

## GitHub protection

The remote repository is public and reports `beta01` as its default branch. The requested `main` branch does not exist. `beta01.5` exists and is unchanged/unprotected. The new `staging` branch is protected with `quality` required, one approving review, strict status checks, last-push approval, conversation resolution, and force pushes/deletions disabled. Production-branch protection remains pending because there is no production branch yet. GitHub accepted this configuration on the public repository.

## Cloudflare DNS

Cloudflare MCP authenticated as `elsehtabdelrahman@gmail.com`. Zone `nextab.services` was created in account `a401ce0eabf88b4042e48ba94180234b`, ID `e6df0803efd4b1bdaac8e20a07dc360a`, Free Website plan, status `pending`. Nameservers were not changed and the zone is not authoritative. DNS-only records were prepared with `proxied=false`:

| Name | Type | Target | Proxy |
| --- | --- | --- | --- |
| `nextab.services` | A | `76.76.21.21` | DNS only |
| `admin.nextab.services` | CNAME | `cname.vercel-dns.com` | DNS only |
| `staging.nextab.services` | CNAME | `cname.vercel-dns.com` | DNS only |

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

1. Establish the intended production branch. The remote repository currently has no `main`; `beta01.5` exists and remains unprotected. Add protection to the future production branch with required `quality` status checks, one approving review, and no force pushes/deletions.
2. Link `abdelrahman-elseht/NexTapCodex` to Vercel project `nextap` only after reviewing automatic-deployment behavior. With Vercel CLI authenticated, use `npx vercel@latest link --yes --team team_j1AHLbF49M6Ob2sm2QBz7sA5 --project prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ`, then `npx vercel@latest git connect https://github.com/abdelrahman-elseht/NexTapCodex --scope team_j1AHLbF49M6Ob2sm2QBz7sA5`. Connect the new `staging` branch to Preview and verify environment target selection remains isolated; no Vercel deployment was made.
3. The owner confirmed `NexTabCodex` contains only development/test data; it is mapped to Preview/Staging.
4. Configure Supabase Auth redirect allowlists and the Production owner account separately. Enable leaked-password protection and review the Production advisory before activation.
5. Confirm Cloudflare account/registrar ownership. Add the Cloudflare nameservers only with explicit approval; until then, the pending zone and records remain non-authoritative.
6. Verify Preview against staging data, verify Production against the clean project, and capture CI, auth, database, DNS, backup, and rollback evidence.
7. For final activation only: obtain explicit approval, change registrar nameservers to `carl.ns.cloudflare.com` and `stella.ns.cloudflare.com`, verify DNS propagation, deploy the approved commit, smoke-test the production URLs, and then promote the alias. Do not merge to `main` or publish customer-facing traffic before that approval.
