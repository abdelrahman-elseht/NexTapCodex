# Self-review and release gates

Updated: October 15, 2026.

This repository can operate with one owner without removing the quality gates.
The owner still uses GitHub's administrator bypass for the one-person approval
requirement, but the bypass is available only after the automated `self-review`
check passes and the PR contains an author-owned evidence checklist.

This is an auditable automated self-review. It is not equivalent to an
independent human approval. If a trusted collaborator becomes available, their
approval remains valuable and the existing one-approval rule continues to
require it during ordinary merges.

## What the gate checks

`.github/workflows/self-review.yml` runs as `pull_request_target`. It checks out
the trusted **base** branch and reads the pull request through GitHub's
read-only API; it never executes code or installs dependencies from the PR
branch. The check is named `self-review` so it can be required by branch
protection.

The evaluator in `scripts/ci/self-review.mjs`:

- requires the PR author to identify themselves as the self-review owner;
- requires the complete-diff, exact-SHA, test, security, and rollback checklist;
- classifies migrations, SQL, authorization, deployment, workflow, payment,
  inventory, package, and other production-boundary files as high risk;
- requires additional security, rollback, and production-boundary evidence for
  high-risk changes;
- rejects secret-like files and likely secret assignments in added lines;
- requires a release source SHA, migration/environment evidence, recovery target,
  smoke evidence, and an exact accepted Staging SHA for `staging` → `main`;
- requires a successful manual Hosted Staging workflow for the exact release
  SHA before a Staging release can pass; and
- writes a sanitized JSON manifest containing the changed-file fingerprint,
  risk classification, checklist, warnings, and errors as a 90-day artifact.

The existing `quality` check remains required. The self-review check adds
structured review evidence; it does not replace typechecking, tests, database
contracts, builds, hosted acceptance, or branch protection.

## Pull request authoring

The repository template in `.github/pull_request_template.md` supplies the
fields. Complete only the items that apply; the evaluator decides which items
are mandatory from the changed files and target branch.

Every PR must include:

```text
## Self-review

Self-review owner: @your-login
Risk level: low | medium | high
Blast radius: <affected route, domain, data, or deployment>
Merge danger: <irreversible operation, compatibility risk, or none>
Evidence: <links to exact checks and reports>

- [x] SR-1 ...
- [x] SR-2 ...
- [x] SR-3 ...
- [x] SR-4 ...
- [x] SR-5 ...
```

Do not copy the literal placeholders into a real PR. The owner must match the
PR author, and the checklist must be checked after the final push; stale
attestations are rejected by the normal `synchronize` run and by stale-review
dismissal in branch protection.

## Bootstrap sequence

The first installation needs one controlled bootstrap because `main` does not
yet contain the trusted workflow:

1. Merge the self-review implementation PR into `staging` using the existing
   Staging administrator bypass after its quality check passes.
2. Confirm that future feature PRs to `staging` run a green `self-review` check.
3. Apply `.github/branch-protection-staging.json` through Repository Settings
   or the authenticated API. It adds `self-review` beside `quality` while
   keeping the one-approval rule, conversation resolution, and no force pushes.
4. Prepare the first `staging` → `main` release with the complete release
   evidence below. The `main` base does not run this workflow until the first
   bootstrap release puts it on `main`; perform that one release using the
   manual checklist, exact quality/hosted evidence, and administrator bypass.
5. After the workflow exists on `main`, apply
   `.github/branch-protection-main.json`. It keeps one approval for normal
   collaboration, requires `quality` and `self-review`, retains linear history,
   and sets administrator enforcement off so the sole owner can use the
   explicit bypass.

The API form, from a checkout containing these files, is:

```powershell
npx.cmd -y gh-axi api PUT /repos/abdelrahman-elseht/NexTapCodex/branches/staging/protection --input .github/branch-protection-staging.json
npx.cmd -y gh-axi api PUT /repos/abdelrahman-elseht/NexTapCodex/branches/main/protection --input .github/branch-protection-main.json
```

Read the live protection response after each change. Do not apply the `main`
file before the trusted workflow is present on `main`, or the required check can
remain pending for the bootstrap PR.

## Normal feature flow

1. Branch from the latest `staging` tip.
2. Open a PR into `staging` and complete the template's self-review section.
3. Wait for `quality` and `self-review` to pass. Fix the PR and repeat the
   checklist after every push.
4. Use the administrator bypass only after both checks pass and conversations
   are resolved. Squash the PR and record its merge SHA.
5. Run the protected Hosted Staging workflow with synthetic fixtures when the
   change needs mutation acceptance. Keep the exact staging SHA and sanitized
   summary.

## Normal release flow

1. Open a PR from `staging` into `main` after hosted acceptance completes.
2. Fill all release fields in the self-review section:

   - `Release source SHA` must equal the PR head SHA;
   - `Accepted Staging SHA` must equal that same SHA for a `staging` head;
   - `Hosted Staging acceptance artifact` must link the sanitized report;
   - `Migration history/checksums` must identify the reviewed migration set;
   - `Production recovery target` must name the last-known-good deployment and
     data recovery point; and
   - `Production smoke evidence` must link the controlled smoke report.

3. Wait for the required `quality` and `self-review` checks. The self-review
   gate also verifies a successful manual `hosted-e2e.yml` run for the exact
   staging SHA.
4. Review the generated `self-review-<PR>-<SHA>` artifact and record its
   fingerprint in the release notes when the change is high risk.
5. Use Squash and merge or Rebase and merge. With the one-owner policy, choose
   GitHub's **Merge without waiting for required reviews / Bypass branch
   protections** only after the checks pass. Record `self-review completed`,
   the evidence links, and the resulting `main` SHA in the PR.
6. Verify the Production target, Supabase project, migration application,
   deployment ID, smoke checks, monitor window, and rollback target. A green
   GitHub check does not prove that Vercel used the intended Production
   environment.

## What this does not automate

The gate cannot independently decide whether a product choice is wise, verify
physical mobile devices, restore deleted customer data, or authorize a
Production migration. Those remain explicit evidence and operator decisions in
the [environment separation handoff](ENVIRONMENT_SEPARATION_AND_CICD_HANDOFF.md)
and [staging release handoff](STAGING_VALIDATION_AND_PRODUCTION_RELEASE_HANDOFF.md).

If the evaluator is unavailable or the evidence is incomplete, stop at the
protected branch. Do not remove the required check, reduce approvals to zero,
or push directly to `main` as a workaround.
