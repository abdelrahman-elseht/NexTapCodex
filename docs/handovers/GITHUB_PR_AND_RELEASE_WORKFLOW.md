# GitHub PR and release workflow

Updated: October 15, 2026.
Repository: `abdelrahman-elseht/NexTapCodex`.

This runbook describes the single-owner workflow for promoting code through
`feature/*` → `staging` → `main`. Re-read the live branch rules before each
release; GitHub settings and check names are provider state, not source code.

## Current repository state

The live GitHub inspection for PR #6 found:

- PR #6 is `feature/admin-ux-card-deletion-provider-links` → `staging`.
- `quality`, `Vercel`, and `Vercel Preview Comments` passed.
- No review has been submitted and the repository currently has one owner/admin
  collaborator.
- `staging` requires the strict `quality` check, one approval, approval of the
  last push, and conversation resolution. Administrator enforcement is off, so
  the repository owner can use the administrator bypass for this PR.
- `main` requires the strict `quality` check, one approval, approval of the last
  push, and conversation resolution. It also requires linear history and
  enforces administrators. A sole PR author cannot approve their own PR, so the
  current `main` policy intentionally prevents a self-merge.

Check current state with the repository's GitHub wrapper (PowerShell uses
`npx.cmd` because the `npx.ps1` shim may be blocked by execution policy):

```powershell
npx.cmd -y gh-axi pr view 6 --full --comments --reviews
npx.cmd -y gh-axi pr checks 6
npx.cmd -y gh-axi api /repos/abdelrahman-elseht/NexTapCodex/branches/staging/protection --full
npx.cmd -y gh-axi api /repos/abdelrahman-elseht/NexTapCodex/branches/main/protection --full
```

## Merge PR #6 into `staging` as the only owner

1. Confirm the PR base is `staging`, the head SHA is the commit you tested, all
   required checks are green, and every conversation is resolved. For this
   feature, do not treat the green PR checks as hosted destructive acceptance;
   run the protected Staging mutation journey after the merge.
2. Open [PR #6](https://github.com/abdelrahman-elseht/NexTapCodex/pull/6) while
   signed in as the repository owner.
3. Open the merge dropdown and choose **Merge without waiting for required
   reviews** (GitHub may label this **Bypass branch protections**). Confirm the
   administrator bypass and use **Squash and merge**. Keep the PR title as the
   squash subject and delete the feature branch after the merge.
4. If the normal merge button is available, the wrapper can perform the normal
   squash merge:

   ```powershell
   npx.cmd -y gh-axi pr merge 6 --squash --delete-branch
   ```

   If GitHub reports that the required review blocks the command, use the web
   administrator-bypass control; `gh-axi` does not expose a separate `--admin`
   flag.
5. Record the resulting merge SHA and verify that the remote `staging` branch
   contains it:

   ```powershell
   git fetch origin --prune
   git rev-parse origin/staging
   npx.cmd -y gh-axi pr view 6
   ```

The bypass is appropriate here only because the live `staging` rule does not
include administrators. It does not create an approval review, and it should
not be described as independent review.

## Accept the feature on Staging

A push to `staging` runs CI and the hosted workflow's read-only path. The
feature's destructive owner journeys require an explicit, synthetic-fixture
acceptance run:

```powershell
npx.cmd -y gh-axi workflow run hosted-e2e.yml --ref staging --field allow_mutations=true
npx.cmd -y gh-axi run list --workflow hosted-e2e.yml --branch staging --limit 5
```

Use the hosted summary artifact and verify the tested SHA, Staging Vercel
project/deployment, Staging Supabase project, fixture run ID, desktop/mobile
counts, and any skipped journeys. Do not run the mutation suite against
Production data. The detailed migration, hosted-validation, and recovery gates
are in [the environment handoff](ENVIRONMENT_SEPARATION_AND_CICD_HANDOFF.md)
and [the staging release handoff](STAGING_VALIDATION_AND_PRODUCTION_RELEASE_HANDOFF.md).

## Prepare the future `staging` → `main` release

Create a release PR only after the accepted Staging report is complete. The
release PR should state:

- the exact accepted Staging SHA and the source tree being promoted;
- the complete diff since the previous `main` release;
- migration filenames/checksums and whether Staging and Production histories
  are compatible;
- the Staging deployment ID and hosted acceptance artifact;
- Production environment, domain, Auth/Storage/Sentry checks;
- controlled Production smoke checks and the last-known-good deployment/data
  recovery target.

A release PR can be opened from the GitHub UI or with:

```powershell
npx.cmd -y gh-axi pr create `
  --base main `
  --head staging `
  --title "Release: staging to main" `
  --body-file release-pr.md
```

Before merging, compare the exact source and tree. A squash merge creates a new
`main` commit, so rerun required checks on that commit and confirm its tree is
the accepted Staging tree. `main` requires linear history, so use **Squash and
merge** or **Rebase and merge**, never a merge commit.

## Choose the one-owner `main` policy deliberately

With the current `main` protection, there is no legitimate self-approval path:
the PR author cannot approve their own PR, and administrator enforcement blocks
an administrator bypass. Choose one of these policies before the first solo
release:

### Keep independent review (recommended for production)

Leave `main` unchanged and add a trusted collaborator or team with permission
to approve release PRs. Keep one approval, last-push approval, conversation
resolution, strict `quality`, and linear history. This preserves an independent
check on Production changes.

### Allow a documented owner bypass

If this is intentionally a single-owner repository, edit the `main` branch
rule in **Repository settings → Branches → main → Edit** and turn off the
administrator-enforcement/bypass-blocking option (the UI wording varies between
classic branch protection and rulesets). Keep the pull-request requirement,
strict `quality`, conversation resolution, and linear history enabled. You may
retain the one-approval requirement as a signal for normal collaboration; the
owner will still use **Merge without waiting for required reviews** for a solo
release.

This is a governance change: it trades independent approval for an auditable
self-review. Record the decision in the release PR and complete the checklist
below. Do not silently weaken checks or push directly to `main`.

Do not reduce the required approval count to zero merely to make the button
available. If a fully solo repository is a deliberate choice, retain the
quality, conversation, linear-history, and pull-request gates and use the
explicit administrator bypass with a recorded self-review.

The equivalent protection readback should show `enforce_admins.enabled: false`:

```powershell
npx.cmd -y gh-axi api /repos/abdelrahman-elseht/NexTapCodex/branches/main/protection --full
```

Changing that setting is a repository-policy operation. Make it in GitHub
Settings after deciding which policy applies; do not paste an unreviewed API
mutation into a release script.

## Merge and verify the release

1. Confirm the release PR's required checks are green and its conversations are
   resolved.
2. On the chosen policy, merge with **Squash and merge** (or **Rebase and
   merge**) and record the new `main` SHA. If using the owner-bypass policy,
   use the administrator-bypass control and write `self-review completed` plus
   the evidence links in the PR.
3. Verify the push workflow and any provider deployment. The repository's
   checked-in CI currently runs `quality` for pushes to `main`; it is not, by
   itself, proof that Production has the right Vercel target or environment.

   ```powershell
   git fetch origin --prune
   $mainSha = git rev-parse origin/main
   $mainSha
   npx.cmd -y gh-axi run list --workflow ci.yml --branch main --limit 5
   npx.cmd -y gh-axi api "/repos/abdelrahman-elseht/NexTapCodex/commits/$mainSha/check-runs" --full
   ```

4. Confirm Vercel is building the `main` branch with Production variables and
   the intended Production Supabase project. Apply reviewed migrations once
   through the protected release path, then run only the approved small
   Production smoke checks. Do not move a Staging-built deployment alias to
   Production.
5. Record the release SHA, deployment ID, migration set, smoke result, monitor
   window, last-known-good deployment, and data recovery procedure in the
   release handoff.

For a Production hotfix, branch from `main`, release it through the same checks,
and merge the exact fix back into `staging` before starting more feature work.

## Solo release checklist

Copy this into a release PR and replace each placeholder:

```text
Source
- [ ] Accepted Staging SHA: <sha>
- [ ] Main release tree compared with the accepted Staging tree
- [ ] Complete diff reviewed since the previous Main release

Checks and acceptance
- [ ] PR quality checks are green
- [ ] Conversations are resolved
- [ ] Hosted Staging acceptance artifact: <run/link>
- [ ] Migration history/checksums verified
- [ ] No Production mutation journey or customer data was used

Policy
- [ ] Main branch protection read immediately before merge
- [ ] Independent approval: <reviewer/link>, or owner-bypass decision recorded
- [ ] Self-review evidence: <links to tests, hosted report, and diff>

Production
- [ ] Production Vercel project/target/branch and variables verified
- [ ] Production Supabase project and migration target verified
- [ ] Backup/recovery and last-known-good deployment recorded
- [ ] Controlled smoke checks completed: <report/link>
- [ ] Release SHA/deployment ID/monitor window recorded
```

This runbook complements the more detailed [environment separation and CI/CD
handoff](ENVIRONMENT_SEPARATION_AND_CICD_HANDOFF.md); it does not authorize
Production data deletion, migration, or deployment by itself.
