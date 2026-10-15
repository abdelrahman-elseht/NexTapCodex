# Staging admin business creation incident

Incident date: 2026-10-15 13:43-13:44 UTC  
Environment: Staging (`flkakuysakgwfoemgbwn`, `staging.nextap.services`)  
Status: resolved

## Symptom

The owner form at `/admin/businesses/new` accepted valid values and then showed
the generic Arabic mutation error:

```text
تعذر تنفيذ العملية. راجع البيانات وأعد المحاولة؛ لم يتم تأكيد النجاح.
```

## Evidence and cause

The application route calls `public.create_admin_page(uuid, jsonb, jsonb)`.
Supabase edge logs showed repeated `POST 404` responses for
`/rest/v1/rpc/create_admin_page` with PostgREST error `PGRST202`.

Staging had the application migration files in the deployed source, but its
database migration history stopped at `20261014065007` and did not contain the
inventory/admin-operations migration that defines this RPC and its private
receipt table. This was a deployment-order problem, not invalid form data or
an owner authorization failure.

## Resolution

The checked-in migration
`supabase/migrations/20261014210855_admin_inventory_operations.sql` was applied
once through Supabase MCP to the Staging project. Supabase recorded it as the
forward-only history entry `20261015135954 / admin_inventory_operations`.

Verification completed after application:

- Staging migration history contains the new entry (23 entries total).
- `public.create_admin_page(uuid, jsonb, jsonb)` exists and is executable by
  `authenticated` users.
- `private.admin_operation_receipts` and the other migration-owned private
  tables exist.
- An owner-context creation probe returned `{ "ok": true }` inside a
  transaction; the transaction was rolled back and follow-up checks found zero
  probe businesses, pages, or receipts.
- Local `test:db`, unit tests (140 tests), typecheck, lint, build, and
  `git diff --check` passed. Lint retains 11 existing warnings.
- Production was not queried or changed.

## Prevention

Hosted Staging preflight now performs a no-write `create_admin_page` schema
probe with null input and requires the function's expected `22023` validation
error. A missing RPC will fail preflight as `PGRST202` before hosted journeys
run.

For every future release, apply the reviewed migration set to the target
Supabase project before or as part of deployment, then verify both migration
history and the required RPC signatures. The remote history version may differ
from the source filename timestamp when Supabase MCP creates the history entry;
record both values in the release evidence.

## Operator follow-up

Retry the business creation form on Staging. If it fails again, capture the
UTC time and inspect the `create_admin_page` edge-log entry before changing
application code. Do not retry the migration: first confirm the history entry
and function signature are present.
