## Summary

<!-- State the user-visible behavior and the reason for the change. -->

## Validation

<!-- Link the exact CI, browser, database, hosted, or release evidence. -->

## Self-review

Self-review owner: @
Risk level: low | medium | high
Blast radius:
Merge danger:
Evidence:

- [ ] SR-1 I inspected the complete diff and traced changed behavior to its callers
- [ ] SR-2 The required quality checks are green for this exact head SHA
- [ ] SR-3 Changed behavior has focused tests, including failure and recovery paths
- [ ] SR-4 Secrets, authorization, data boundaries, and external side effects are checked
- [ ] SR-5 Documentation, rollback, and the merge/release danger are recorded

<!-- Check these for migrations, authorization, deployment, workflow, destructive,
     payment, inventory, or other production-boundary changes. -->
- [ ] SR-H1 I reviewed security and data impact for every high-risk changed file
- [ ] SR-H2 The migration, deployment, or destructive-operation rollback path is explicit
- [ ] SR-H3 The acceptance evidence covers the changed production boundary

<!-- Required only when the base branch is main. -->
- [ ] SR-R1 The release source and accepted Staging SHA are identified exactly
- [ ] SR-R2 Hosted Staging acceptance is complete and its sanitized evidence is linked
- [ ] SR-R3 Migration history, checksums, and environment separation are verified
- [ ] SR-R4 Production recovery, last-known-good deployment, and smoke checks are recorded
- [ ] SR-R5 The promoted tree was compared with the accepted source after merge strategy

Release source SHA:
Accepted Staging SHA:
Hosted Staging acceptance artifact:
Migration history/checksums:
Production recovery target:
Production smoke evidence:
Hotfix base SHA:
