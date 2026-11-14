# Phase 1 Development and Staging Resources

Status: the 2026-11-14 synthetic application-shaped D1/R2 recovery and fixture cleanup passed, and migrations `0001`-`0003` are recorded applied in development and staging. The staging Worker health probe remains unverified. The owner-approved 24-hour RPO has no successful scheduled protected generation and is not demonstrated; the four-hour RTO is also unproven. Runtime authorization, owner approval of the complete physical schema, runtime secrets, and credential isolation remain open. Current live Cloudflare resource status is unverified because the latest Wrangler identity check reported `loggedIn=false`.

This runbook records the dedicated resources created for route-independent Phase 1 work. The machine-readable matrix is [`phase1-resource-matrix.json`](phase1-resource-matrix.json). Resource names and IDs are identifiers, not credentials. Credential values are intentionally omitted.

## Resource Matrix

| Environment | D1 database | Cloudflare region | R2 bucket | KV namespace | State |
| --- | --- | --- | --- | --- | --- |
| Development | `nextap-dev-core` (`a64cabf6-b8f4-41aa-84fc-b7fed5d2dde7`) | `WEUR` | `nextap-dev-public` | `nextap-dev-slug-cache` (`58df600b88a94da7806deb7ad5bc90c2`) | Last recorded recovery cleanup left fixture rows removed; current live status unverified |
| Staging | `nextap-staging-core` (`98f7be19-5ab8-47c3-9e36-f7df99d83089`) | `EEUR` | `nextap-staging-public` | `nextap-staging-slug-cache` (`d0154043f05a495c8e5e0ef5dbb81dc1`) | Last recorded recovery cleanup left fixture rows removed; current live status unverified |
| Production | Not created | N/A | Not created | Not created | Not authorized in this Phase 1 work |

The matrix file [`phase1-resource-matrix.json`](phase1-resource-matrix.json) has `checkedAt` 2026-11-13 and is a historical inventory, not a current status check. It predates the recovery bucket and Worker runtime target observations and contains no recovery-bucket or runtime-target fields. The local [`phase1-runtime.wrangler.toml`](phase1-runtime.wrangler.toml) declares `NEXTAP_DB`, `NEXTAP_PUBLIC_MEDIA`, and `NEXTAP_SLUG_CACHE` bindings for development and staging. Recorded deployment metadata showed development Worker version `7de1da94-e479-47bf-9fe4-a72959cbf06f` at 100% with all three expected bindings, but Wrangler reported `No targets deployed`; this is version/binding metadata only, not a deployed service. The recovery run later observed staging Worker version `4746c6e5-38f3-44e6-8db0-f156cacc3550` at 100% with expected bindings; its health and end-to-end read probe are unverified. Runtime secrets are not configured. The recovery bucket `nextap-recovery-backup-20261114-7f3a` was emptied and verified after fixture cleanup; the public-media buckets were not used. The development and staging D1s have 12 application tables plus the Wrangler `d1_migrations` ledger and Cloudflare's internal `_cf_KV` metadata table; all 12 application-table counts were verified zero after cleanup. The migrations remain schema-review candidates, not owner approval. Current Cloudflare resource state is unverified because Wrangler identity reports `loggedIn=false`.

## Verification Evidence

Read-only inventory and identity checks used Wrangler `4.161.0` with `.env.cloudflare.local`; no secret values were printed.

- Historical pre-migration inventory reported both dedicated databases with the recorded IDs and zero application-owned tables. This is superseded by migrations `0001`-`0003`; the current recorded schema has 12 application tables in each database.
- `wrangler d1 execute <database> --remote --command 'SELECT 1 AS ready;' --json`: both returned `ready: 1`, `changed_db: false`, and `rows_written: 0`.
- `wrangler r2 bucket list`: both newly created bucket names appeared; no object upload was performed.
- `wrangler kv namespace list`: both namespace IDs/titles appeared.
- `wrangler kv key list --namespace-id <id> --remote`: both returned `[]`.
- `node scripts/cloudflare/phase1-target-check.mjs --environment development --d1 nextap-dev-core --r2 nextap-dev-public --kv 58df600b88a94da7806deb7ad5bc90c2` succeeds; the equivalent production invocation is rejected. Automated guard coverage is in `tests/unit/phase1-target-check.test.ts` (11 passing tests).
- On 2026-11-13, Wrangler `4.161.0` reported migration `0001` pending in each existing development and staging D1. The guarded workflow applied the candidate migration to each declared target and verified one migration in each ledger; subsequent status showed no pending migrations. Both targets then reported 12 application tables plus `_cf_KV` and `d1_migrations`. `PRAGMA foreign_key_check` returned no violations in either database. Verification queries reported `rows_written: 0` and `changed_db: false`. Credential values were not included in commands or evidence.
- Current guarded remote workflow verification reports both `0001_phase1_core_schema.sql` and `0002_permanent_slug_aliases.sql` applied in development (`nextap-dev-core`) and staging (`nextap-staging-core`), with no pending migrations. `PRAGMA foreign_key_check` returned no violations in either environment. Both `slug_registry` tables contained zero rows, so `0002` had no existing reserved slug rows to convert; this is schema/migration evidence, not URL behavior acceptance.
- On 2026-11-14, the guarded remote workflow applied and verified migrations `0001_phase1_core_schema.sql`, `0002_permanent_slug_aliases.sql`, and `0003_approved_page_publication_contracts.sql` in development D1 `nextap-dev-core` (`a64cabf6-b8f4-41aa-84fc-b7fed5d2dde7`) and staging D1 `nextap-staging-core` (`98f7be19-5ab8-47c3-9e36-f7df99d83089`). Both ledgers contain all three migrations. In each database, `business_pages.has_menu` is `INTEGER NOT NULL DEFAULT 0` with a `CHECK (has_menu IN (0, 1))` constraint. `PRAGMA foreign_key_check` returned zero rows in both. Verification reads reported `rows_written: 0` and `changed_db: false`. No credential values were printed or recorded. This confirms remote migration/schema parity only; application behavior and publication semantics are not established by this check.
- An earlier staging `migrations list` attempt used `infra/cloudflare/d1/wrangler.toml`, whose database entry is a local placeholder and does not identify `nextap-staging-core`. Wrangler stopped before making a provider request, so that attempt provides no evidence about staging access or migration state. The current staging status above comes from the corrected guarded remote workflow. No credential values or provider response secrets are recorded.
- A synthetic non-empty SQL restore rehearsal was run on 2026-11-13 before the candidate application migration. After the target guard passed for both environments, a temporary two-row probe table was created in development, exported, imported into the separate staging database, and checked for the same table definition and rows. The probe was then dropped from both databases; at that point both had zero application tables. The exact hash and observed results are in [`PHASE_1_FOUNDATION_EVIDENCE_20261113.json`](../../docs/research/PHASE_1_FOUNDATION_EVIDENCE_20261113.json).
- On 2026-11-14, an authorized read-only query initially found zero rows in all 12 application tables in both environments. A subsequently authorized synthetic application-shaped recovery populated development, restored to staging, and verified row counts/checksums across all 12 tables, relationships, foreign keys, publication manifest/media references, and R2 content. Cleanup then removed all owned fixture rows and four private recovery-bucket objects; predicates returned zero rows, foreign-key checks remained clean, and reads confirmed the objects absent. The private recovery bucket remains in place and empty. This establishes synthetic non-production restore integrity, not production-scale recovery or service usability. See the [recovery procedure](PHASE_1_RECOVERY.md), [closeout status](../../docs/research/PHASE_1_CLOSEOUT_STATUS_20261114.md), and [recovery inventory](../../docs/research/PHASE_1_RECOVERY_INVENTORY_20261114.json).
- The dev Worker version metadata showed version `7de1da94-e479-47bf-9fe4-a72959cbf06f` at 100% with expected bindings, while Wrangler reported `No targets deployed`. The staging recovery observation showed version `4746c6e5-38f3-44e6-8db0-f156cacc3550` at 100% with expected bindings; the smoke bearer was unavailable for result recovery, so health and the end-to-end read probe are unverified. Neither observation proves usable runtime service. Latest Wrangler identity output reported `loggedIn=false`, so current live Cloudflare resource status cannot be confirmed. The approved four-hour RTO and at-most-24-hour RPO remain unproven.

The D1 resources selected different default regions (`WEUR` for development, `EEUR` for staging). This is recorded evidence, not an approved residency or latency choice. Review whether staging should be recreated in the development region before performance or data-residency validation; do not silently treat the regions as equivalent.

## Mutation Guard

Before any Phase 1 automation writes, it must load this repository matrix and call the shared target validator with `development` or `staging`, then compare all three resolved Cloudflare resource identities with the declared environment entry before invoking the write. The preflight rejects `production`, `preview`, `test`, unknown environments, incomplete resource entries, shared identities, and mismatched target names/IDs. This is an application-level guard, not a Cloudflare account credential boundary. Use separately scoped credentials per environment before cross-environment mutation tests; the current local token is account-scoped for CLI operations and is not proof that dev credentials cannot mutate staging.

Run from the repository root:

```sh
node scripts/cloudflare/phase1-target-check.mjs \
  --environment development \
  --d1 nextap-dev-core \
  --r2 nextap-dev-public \
  --kv 58df600b88a94da7806deb7ad5bc90c2
```

The check validates declared identities only; it does not grant access, add Worker bindings, or prove runtime isolation.

## Candidate D1 Workflow

[`phase1-d1-workflow.mjs`](../../scripts/cloudflare/phase1-d1-workflow.mjs) provides `status`, `apply`, `backup`, and `restore` commands. It requires the environment and D1, R2, and KV identities and invokes the shared target guard before reading migration files or invoking Wrangler. Production and unknown environments are rejected before any Wrangler command. Wrangler receives a temporary D1-only config built from the checked-in matrix; no Worker, route, R2, or KV configuration is deployed. The default is local D1 with persistent local state under the operating system temporary directory at `nextap-phase1-d1-workflow/<environment>`; this lets repeat runs exercise the same migration ledger. `--remote` is explicit and should only be used with an independently verified non-production auth profile; do not pass an env-file option.

The candidate numbered migration directory is `infra/cloudflare/d1/migrations/`. Owner approval of its physical schema and open policy decisions remains pending. The workflow refuses `apply` when that directory is absent or contains no numbered SQL migrations. Use:

```sh
node scripts/cloudflare/phase1-d1-workflow.mjs apply \
  --environment development \
  --d1 a64cabf6-b8f4-41aa-84fc-b7fed5d2dde7 \
  --r2 nextap-dev-public \
  --kv 58df600b88a94da7806deb7ad5bc90c2
```

The command applies local migrations by default, then reads `d1_migrations` and checks that every numbered file is recorded as applied. Add `--remote` only after confirming the active Wrangler profile and intended account/resource. The remote profile must not depend on `.env.cloudflare.local`; the target check is an application guard, not credential isolation. Status and apply are repeatable: Wrangler applies only unapplied migrations, and the workflow checks the ledger afterward.

The `restore` command accepts a data-only Wrangler SQL export for an explicitly selected development or staging database. It applies and verifies the repository migrations first, checks that the target has no application rows (the Wrangler `d1_migrations` ledger is excluded from application data), imports the artifact, then verifies that rows exist. The SQL validator permits only `INSERT INTO ... VALUES` statements and Wrangler's `PRAGMA defer_foreign_keys`; DDL, drops, alters, views, triggers, and other statements are refused before Wrangler runs. Exports must use `--no-schema` and explicit `--table` flags for application tables; Wrangler also exports its migration ledger otherwise. The command does not compare source/target table counts, values, checksums, referential integrity, or R2 object references, so it is only a transport aid and cannot roll back an already populated database in place.

## Backup and Restore State

The owner-approved RPO is at most 24 hours. The proposed operating cadence is one protected D1 and R2 recovery generation at least every 24 hours, with failed/late run alerting and retry. Retaining 35 daily generations is recommended for owner review, not approved. The exact blocker is that no private backup destination or scheduler has been approved or configured. Cloudflare's official Workflows example schedules D1-to-R2 export daily (`0 0 * * *`); Cloudflare documents Time Travel as current D1 point-in-time recovery, while legacy snapshot backup commands no longer define a current retention policy. Do not repurpose the application-public R2 buckets as backup storage.

The earlier transport rehearsals used direct Wrangler export/import commands. For a future guarded restore, first confirm the source identity, export application data only, and restore into an empty target after migrations. The `backup` command exports the explicit 12-table application allowlist as data-only SQL and writes a companion manifest containing export UTC time, D1 environment/name/ID, selected tables, migration filenames and hashes, and artifact size and SHA-256. It requires `--remote`, `--file`, and `--manifest`; manifests are created exclusively and will not overwrite an existing path. Keep SQL and manifest together in a separately protected backup destination. This command neither schedules backups nor configures protected retention, creates an R2 inventory, or proves freshness. The proposed mechanism for meeting the approved 24-hour RPO is a protected D1/R2 generation at least every 24 hours with alerting and retry. 35 daily generations are recommended but not owner-approved. No private backup destination or scheduler has been approved or configured. Do not repurpose application-public R2 buckets as backup storage:

```sh
npx wrangler d1 export nextap-dev-core \
  --remote \
  --output /secure/backup/nextap-dev-core.sql \
  --compatibility d1 \
  --no-schema \
  --table businesses --table business_pages --table page_sections \
  --table slug_registry --table page_publications --table media_assets \
  --table publication_media --table card_batches --table cards \
  --table card_assignment_history --table audit_events --table operation_receipts

node scripts/cloudflare/phase1-d1-workflow.mjs restore \
  --environment staging \
  --d1 98f7be19-5ab8-47c3-9e36-f7df99d83089 \
  --r2 nextap-staging-public \
  --kv d0154043f05a495c8e5e0ef5dbb81dc1 \
  --file /secure/backup/nextap-dev-core.sql \
  --remote
```

The guarded restore applies the current candidate migration set to the selected target before importing. It rejects schema DDL in the SQL file and refuses to import if any application table already contains rows. Use an export from the same reviewed migration version; this workflow does not compare source and target migration hashes or guarantee a compatible schema version.

Wrangler export emits a short-lived signed download URL in console output; keep terminal/CI logs private and do not copy that URL into evidence. Store the SQL file in an access-controlled backup location and record its checksum separately. The run above used `/tmp/nextap-dev-core-phase1-empty-export.sql` as an ephemeral artifact and did not retain it in the repository.

An initial empty logical SQL export/import rehearsal was run from `nextap-dev-core` into `nextap-staging-core`. The export was 32 bytes with SHA-256 `309d1516f5d4f4f792b17106f7b761312f848c634e3028d70e6eb8ed39df7398` and contained only `PRAGMA defer_foreign_keys=TRUE;`. Wrangler imported one statement, writing zero rows. This proved only the empty-database toolchain path.

A second rehearsal used a disposable table named `phase1_restore_probe_20261113`, with two synthetic rows (`restore-a` / `synthetic-alpha` / 1 and `restore-b` / `synthetic-beta` / 2). Wrangler `4.161.0` exported the development database in D1-compatible SQL format to a 388-byte file with SHA-256 `f013a8c3c94d4e2524bca7f0a52d918ebbecf42d2f879304b0b9c38a0a8a92b5`. The file imported successfully into staging. Queries confirmed the same table definition and both exact rows in source and target; Wrangler reported seven rows written during import (schema/restore statements and fixture rows), and zero rows written during verification queries. The import command completed in 10.9 seconds as measured by the local command runner; this is command duration only, not an RTO measurement. The fixture table was dropped from both databases afterward, and both report zero application tables. The temporary SQL file and export log were removed. No application schema, relational business fixture, R2 object, or production data was involved.

This validates the synthetic D1 SQL export/import path and row preservation only. It does not establish application data integrity, referential integrity, artifact references, runtime bindings, credential isolation, backup cadence, or Phase 1 restore acceptance. The source and target are in different Cloudflare regions (`WEUR` and `EEUR`), so this run does not establish regional parity.

### Local Application-Shaped Restore Rehearsal

On 2026-11-13, Wrangler `4.161.0` ran a local-only rehearsal using two disposable D1 databases and a temporary Wrangler config. The same candidate migration was applied to source and target. The source received synthetic records for one business, one main page, canonical and historical slugs, one publication, one card batch, one active card, and one assignment-history event. A D1-compatible data-only export was generated with `--no-schema` and explicit `--table` flags for those seven application tables, then imported into the migrated target. The 2,080-byte SQL artifact had SHA-256 `9a045f92a049f254d8458f2e42ab10e82fa792e0f543b30e709e118849bc912d`.

Target verification returned business=1, page=1, slugs=2, publication=1, batch=1, card=1, assignment-history=1; a join across business, page, canonical slug, publication pointer, card, and history matched one fixture; `pragma_foreign_key_check` returned zero rows. Wrangler local stages used `d1 migrations apply <database> --local --config <temporary-wrangler.toml>`, source seeding via `d1 execute <source> --local --config <temporary-wrangler.toml> --file <synthetic-seed.sql> --json`, export via `d1 export <source> --local --config <temporary-wrangler.toml> --output <data.sql> --compatibility d1 --no-schema --skip-confirmation` with repeated `--table <application-table>` options, and restore via `d1 execute <target> --local --config <temporary-wrangler.toml> --file <data.sql> --json`. All temporary configs, fixture SQL, exports, and local databases were removed after the run.

Two failed variants are recorded because they exposed recovery constraints. Importing the full schema-and-data export into a completely empty target failed with `no such table: main.page_publications` while inserting the source's non-null `business_pages.published_publication_id` reference. The tables are mutually related; Wrangler's dump ordering can attempt a row that references a table not yet created. Cloudflare's import guidance requires referenced tables to exist before importing dependent rows. The recovery path therefore applies the checked-in migrations first, then imports only data with an explicit application-table allowlist. This preserves the schema and normal foreign-key validation. A `--no-schema` export without explicit application `--table` selections also included Wrangler's `d1_migrations` ledger and failed on the target with `UNIQUE constraint failed: d1_migrations.id`; explicit application table selections exclude that ledger.

### Fresh Local Migration-First Restore Check

On 2026-11-13, Wrangler `4.161.0` ran the focused local integration test below. The test created uniquely named source and target D1 databases under a temporary directory, applied the candidate migration to both, seeded a cyclic page/publication reference plus slug and card/history rows, exported only the seven seeded application tables with `--no-schema`, and restored through the guarded workflow. It removed its temporary configs, SQL files, and D1 state on exit.

```sh
RUN_PHASE1_D1_RESTORE=1 npx vitest run tests/unit/phase1-d1-restore.test.ts
```

The run passed in 183.09 seconds. The SHA-256 over all rows in the seven application tables matched source to target: `ab7394e3542e28148c523e0f1d21473efa93bf1f65c72f709f9f333f82417377`. The separate relationship-query SHA-256 matched at `b79884964ed5ad9581bae4c306c92a79b362259f5fa2ec9d520839df69fd8278`; the join returned one expected row. Counts matched at one each for `businesses`, `business_pages`, `slug_registry`, `page_publications`, `card_batches`, `cards`, and `card_assignment_history`; `PRAGMA foreign_key_check` returned zero violations. This is a local synthetic fixture check, not application-data restore acceptance or an RTO measurement. It does not exercise aliases, R2 objects, production data volume, regional restore, credential isolation, or runtime bindings.

The physical schema remains an owner-review candidate. `has_menu` and indefinite, non-reassignable historical aliases are approved logical contracts recorded in the [Phase 1 execution spec](../docs/specs/NEXTAP_PHASE_1_EXECUTION_SPEC.md); migration `0003` adds the `has_menu` field in development and staging. Backup destination protection remains unresolved. The four-hour RTO and 24-hour RPO are approved but remain unproven. This rehearsal does not establish Phase 1 restore acceptance.

The proposed backup policy is a protected D1/R2 generation every 24 hours, encrypted private storage, access controls, per-generation integrity metadata, and a recommended 35 daily generations pending owner approval. These controls are not provisioned. Before a meaningful restore drill, use per-table counts/checksums, object references, and a distinct isolated non-production restore target. Do not mark restore acceptance passed until a representative D1/R2 fixture is restored and verified, a usable service smoke succeeds, and incident-to-usable-service duration and discrepancies are recorded. Full evidence is in [`PHASE_1_FOUNDATION_EVIDENCE_20261113.json`](../../docs/research/PHASE_1_FOUNDATION_EVIDENCE_20261113.json).

## Cloudflare References

- D1 setup and database creation: [D1 Getting Started](https://developers.cloudflare.com/d1/get-started/).
- D1 import/export behavior: [Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/).
- D1 point-in-time recovery: [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).
- Scheduled D1-to-R2 backup example: [Cloudflare Workflows](https://developers.cloudflare.com/workflows/examples/backup-d1/).
- D1 point-in-time recovery: [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).
- Scheduled D1-to-R2 backup example: [Cloudflare Workflows](https://developers.cloudflare.com/workflows/examples/backup-d1/).
- R2 buckets: [R2 buckets](https://developers.cloudflare.com/r2/buckets/).
- KV namespace setup: [Workers KV Getting Started](https://developers.cloudflare.com/kv/get-started/).
- Wrangler `4.161.0` command help was checked locally for D1 `migrations apply`, `execute`, and `--local` / `--remote` / `--persist-to` support. The D1 migrations directory is configured through Wrangler's `migrations_dir` field, so the workflow generates a temporary D1-only config and removes it when the command exits.
- Official references: [D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/) and [D1 import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/).
