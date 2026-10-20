# Flexible phone and landline support

Implemented on `main`, 2026-10-21. Changes remain in the working tree. No commit, push, deployment, hosted migration, or hosted test-data mutation was performed.

## Behavior and implementation

- Phone/Call entries accept Egyptian landlines, mobile numbers, international numbers, short business numbers, and service codes. There is no country, carrier, prefix, E.164, or subscriber-length requirement.
- `src/lib/business/phone.ts` centralizes safety checks. Allowed characters are ASCII digits, spaces, `+`, parentheses, hyphens, dots, `*`, and `#`. A plus may appear only once at the beginning of the compact dial value, and at least one digit is required. Unsupported characters cause rejection rather than being stripped into a different destination. Controls, including trailing CR/LF, URL syntax, percent escapes, letters, and extension parameters are rejected.
- Display and saved values retain the original text. Only generated `tel:` links and vCard telephone properties remove visual separators. Hashes become `%23` in links to avoid URL fragments. Unsafe legacy values produce no telephone link. General existing storage-size limits remain; they do not encode numbering-plan rules.
- Multiple Phone/Call entries have independent values, labels, stable IDs, and optional types: Mobile, Landline, Work, Other. Populated phone entries cannot be overwritten by shared provider defaults. Existing duplication, reordering, and explicit custom-value behavior is retained.
- Admin item editors, nested service buttons, contact configuration, Live Preview, draft save/publish, and public components carry phone types and raw values. Landline entries use a shared monochrome desk-phone glyph with the existing SVG stroke style. Public phone tiles, rows, and fallback Call buttons show saved text.
- Add to Contacts supports an explicit primary phone, the page's Find us phone, any enabled page Phone/Call entry (including nested service actions), or an included contact phone field. Bindings are page-local and explicit. Removed/disabled sources fail validation instead of silently choosing another number. Disabled service parents exclude their nested actions.
- Contact fields inherit their saved source's type unless explicitly overridden. vCard 3 emits `CELL` for Mobile, `WORK,VOICE` for Landline/Work, and `VOICE` for Other. Untyped legacy entries retain `WORK,VOICE`. A landline alone is sufficient for a contact file.
- WhatsApp and mobile-wallet normalization rules remain unchanged. Their separate Egyptian-mobile rules are intentionally outside Phone/Call validation.

Examples:

| Saved/display value | Telephone link |
| --- | --- |
| `(02) 2345-6789` | `tel:0223456789` |
| `+44 (20) 7123-4567` | `tel:+442071234567` |
| `123` | `tel:123` |
| `*123#` | `tel:*123%23` |
| `12+34`, `123;ext=4`, or text containing controls | No generated link; new Phone/Call saves rejected |

## Database and preservation

New migration: `supabase/migrations/20261020210229_flexible_phone_support.sql`.

It replaces private contact phone validation and compilation, adds a private page-local binding resolver, and freezes original phone text plus safe enum types into contact projections. The new resolver has an empty search path and is not executable by public/anon/authenticated roles. Existing authorization, payment-binding exclusions, contact limits, managed-photo rules, revision checks, atomic publication, and immutable snapshots remain in place.

No stored-number rewrite or destructive schema change is included. Existing published snapshots stay frozen; publish an edited page to use its new contact configuration. The new migration must be applied to the intended environment before the app uses the new contact configuration keys. It has only been applied to disposable test databases during this task.

## Verification

| Check | Result |
| --- | --- |
| `npm.cmd test` | PASS: 34 files, 242 tests |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS: zero errors, 13 existing warnings |
| `npm.cmd run test:db` | PASS: all 26 migrations and nine SQL contract suites, including `phone-support.sql`, using PGlite |
| `npm.cmd run test:db:concurrency` | PASS: fresh embedded PostgreSQL; phone/contact contracts, upgrade preservation, stale-writer and concurrent publication checks |
| Fresh `npm.cmd run build` | PASS with explicit loopback-only Supabase settings, synthetic public key, disabled Sentry credentials |
| Impeccable detector on changed UI | PASS: no findings |
| `git diff --check` | PASS |
| Database-independent E2E layout journey | PASS: desktop and mobile, 2/2 |
| Actual public-component browser fixture | PASS: phone display/link checks at 390px and 1440px |
| Full Local Supabase owner/browser E2E | BLOCKED: missing Docker/Podman runtime and local stack/fixtures |

The new unit tests exercise safe/unsafe formats, hash encoding, independent values, typed primary bindings, included contact fields as primary, stale/disabled sources, nested disabled parents, landline-only vCards, actual public rendering, unchanged WhatsApp normalization, and the real server-action save boundary with a mocked database RPC. Database tests verify formatting/type preservation, draft isolation, publication, nested bindings, contact-field primary selection, invalid types, page isolation, and helper privileges.

PGlite and embedded PostgreSQL results are additional database evidence; neither is a full Local Supabase Auth/PostgREST/Storage integration result.

## Delegated browser/E2E verification and remaining gate

Browser/E2E work was delegated to GPT-6.1 Sol at medium reasoning effort as requested. Updated journeys:

- `tests/e2e/contacts.e2e.ts`: landline-only main contact, independent international mobile/`CELL`, preview, draft/reload, publish, download, and disable across main/branch pages.
- `tests/e2e/business-editor-actions.e2e.ts`: international landline, safe telephone link, saved Call entry selected as primary, and `WORK,VOICE` contact download.
- `tests/e2e/contacts.local.config.ts`: repaired config-relative discovery and repository app working directory; strictly requires `http://127.0.0.1:56321` and production server mode.

Database-independent browser evidence: `npm.cmd exec -- e2e run tests/e2e/quick-actions-layout.e2e.ts` passed desktop and mobile (2/2) with explicit loopback settings. An ignored synthetic SSR harness rendered the actual public component at 390px and 1440px. It verified unchanged displayed landline/international/service-code values and `tel:0212345678`, `tel:+4402071234567`, and `tel:*123%23` destinations. Desktop overflow was false. Screenshots: `artifacts/contacts/phone-support-390.png` and `artifacts/contacts/phone-support-1440.png`. These fixture checks do not establish authenticated persistence or public database-backed downloads.

The guarded local runner started the app, but the owner journey was skipped because disposable fixture credentials/mutations were not configured. The anonymous route check received 503 instead of its expected 404 because Local Supabase was unavailable. This is an unsuccessful integration run, not a pass. Docker and Podman were unavailable on Windows and Ubuntu WSL; local API/database ports 56321/56322 were closed. No hosted fallback was used.

To finish the integration gate, start a Docker-compatible runtime and this repository's isolated Local Supabase project (`nextap-contacts-local`). Verify project identity and ports before applying migrations. Provision synthetic owner credentials and owned main/branch page fixtures. Set:

```text
NEXTAP_ENV=test
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<actual local public key>
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3137
E2E_SERVER_MODE=production
E2E_ALLOW_MUTATIONS=true
E2E_USER_OWNER_USERNAME=<synthetic local owner email>
E2E_USER_OWNER_PASSWORD=<synthetic local owner password>
E2E_CONTACT_BUSINESS_ID=<local fixture UUID>
E2E_CONTACT_MAIN_PAGE_ID=<local fixture UUID>
E2E_CONTACT_BRANCH_PAGE_ID=<local fixture UUID>
```

Build freshly against those local settings, with Sentry uploads disabled, then run:

```powershell
npm.cmd exec -- e2e run --config tests/e2e/contacts.local.config.ts
```

Run the editor-actions journey with an equivalently guarded local runner and synthetic credentials, and run SQL contracts against the actual isolated Local Supabase database. Acceptance criterion 8 remains pending until these full local integration journeys pass. Native iOS/Android import behavior was not verified by this task.
