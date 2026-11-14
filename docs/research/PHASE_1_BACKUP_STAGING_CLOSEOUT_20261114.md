# Phase 1 Backup Staging-Test Candidate Closeout

**Status:** Candidate prepared for owner-authorized staging backup test; no workflow has been dispatched and no external service was contacted during this preparation.

The workflow defines a daily 00:15 UTC schedule and manual selection of one fixed non-production target. Both jobs use the protected `staging` GitHub Environment and the authorized DEV R2 credential pair. The existing required-reviewer protection remains in effect, so scheduled execution is not unattended. The Sentry setup job configures and verifies both Cron monitors and the failure-notification workflow before either backup job can start. Check-in delivery during a backup is best-effort; a successful backup does not prove alert delivery.

The runner exports only the fixed 12-table allowlist after verifying all three migration-ledger entries. It copies each source-media object to the private recovery bucket, preserves object headers and custom metadata, and verifies body hashes and metadata on readback. It verifies the D1 export, manifest, and final `SUCCESS.json`; failures return a failed job status and attempt a `FAILURE.json` diagnostic. It does not apply retention or provide a transactional snapshot across D1 and R2.

The focused tests cover environment restrictions, workflow target/credential mapping, schedule alignment, Sentry check-in state transitions, backup hashes, and R2 metadata/readback verification. Passing local tests establishes code behavior only. Effective Cloudflare/R2 permissions, workflow branch-dispatch constraints, Sentry API scope/readback, actual generation, notification delivery, unattended scheduling, retention, representative restore, and the approved four-hour RTO and 24-hour RPO remain unverified. Do not mark Phase 1 complete based on this candidate.

See the [recovery procedure](../../infra/cloudflare/PHASE_1_RECOVERY.md), [sanitized recovery inventory](PHASE_1_RECOVERY_INVENTORY_20261114.json), and [Sentry Cron API research](SENTRY_CRON_CHECKIN_GITHUB_ACTIONS_20261114.md).
