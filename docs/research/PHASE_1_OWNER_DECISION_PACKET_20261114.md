---
Status: owner decisions recorded; staging-test approvals do not authorize live or production enforcement
Owner: NexTap Core engineering
Supersedes: none
Path globs: ["docs/research/**"]
Topic tags: migration, cloudflare, schema, authorization, operations
---

# Phase 1 Owner Decision Packet

This packet records current owner decisions and remaining Phase 1 setup. Staging-test approvals below do not authorize live or production enforcement. Production data, DNS, bindings/configuration, public routing, and cutover remain prohibited.

## Decisions Already Approved

- When the Core profile indicates Menu availability, its link is `/b/{slug}/menu`. Menu remains a separate product; Phase 1 adds no Menu data or runtime dependency.
- Historical direct-profile slugs, including QR/NFC destinations, resolve to their original profile indefinitely and are never reassigned. Tokenized card URLs remain separate.
- `has_menu` defaults to false and its effective value is copied into each immutable publication snapshot.
- Contact projection is versioned and snapshot-only; VCF is derived from the active published snapshot.
- Staff retain the approved global legacy capability set. Unknown staff are denied, and every business-scoped operation requires an explicit business target.
- The proposed numeric rate limits are approved for staging tests only. This does not approve live or production enforcement. Card token fingerprints are abuse signals only, not lookup caps; staging tests must accept legitimate QR/NFC bursts above 10 lookups per minute.
- Recovery time objective is four hours and recovery point objective is 24 hours. Both are approved objectives but unproven. Backup acceptance is blocked because no approved private backup destination or scheduler is configured.
- EEUR is the closest currently supported D1 location hint for El Mahalla El Kubra, Egypt. This is a documented recommendation; existing dev WEUR and staging EEUR resources remain in place. Do not recreate or move them without a verified migration plan.
- Workers Paid at $5/month is the approved starting plan; use Free for tests where equivalent. No additional purchase is authorized.

References: [Phase 1 execution spec](../specs/NEXTAP_PHASE_1_EXECUTION_SPEC.md), [closeout prompt](../../phase1-closeout-prompt), [resource matrix](../../infra/cloudflare/phase1-resource-matrix.json), [environment runbook](../../infra/cloudflare/PHASE_1_ENVIRONMENTS.md).

## Approved Contracts and Remaining Details

### 1. Menu flag storage and publication

The URL behavior and the default/publication behavior are approved. The physical source is a page-level boolean `has_menu`, default false; migration 0003 adds the field. Legacy evidence shows a separate Menu link/provider can appear in page content, but does not establish the Core persistence contract.

**Approved contract:** persist `has_menu` as a non-null boolean on the stable page record, default false, as Core-owned link metadata. Include the effective boolean in each immutable publication snapshot. The admin draft edits it; publication copies the validated value into the new snapshot. Render `/b/{slug}/menu` only from the active published snapshot when true. A draft change must not alter public behavior until publication; deactivation removes the Core profile from public delivery but never changes Menu data or creates a Core-to-Menu request. Keep Menu availability manual and independent of Menu service health.

**Tradeoff:** a page-level field is easy to query and keeps the flag versioned with its profile; putting it on `businesses` would incorrectly couple branch pages and business identity. Snapshotting makes rollback reproduce the old link state. A dynamic Menu availability lookup would be fresher but would violate separation and introduce a runtime dependency.

Remaining implementation gate: a publisher must consume the snapshot helper and tests must prove publication behavior; helper groundwork alone is not runtime publication proof.

### 2. Contact projection and VCF

Legacy `contact_config` is mutable page draft configuration. Publication compiles contact values from enabled and permitted fields; VCF output is derived from the published values, not the draft. The current candidate stores contact draft JSON and a complete publication snapshot but defines no explicit contact projection schema/version.

**Approved contract:** make the canonical contact projection part of each immutable publication snapshot, with an explicit `contactVersion` (initially `1`), enabled state, display name, organization, primary phone and type, ordered allowlisted fields (kind, label, normalized published value, optional phone type), and an optional immutable public photo path. Do not persist a second mutable contact table or a separate per-business projection. The publication's `contactVersion` selects the VCF serializer; old snapshots retain their version and remain reproducible. Exclude draft-only fields, internal IDs/bindings, source section references, unapproved/private media URLs, payment destinations, and notes/URLs that fail existing validation. If contact download is disabled or required values are invalid, publish no VCF projection. A profile publish atomically selects the snapshot whose VCF projection becomes public; rollback restores the prior snapshot and VCF behavior.

**Tradeoff:** embedding avoids dual-write and snapshot drift and preserves historical VCF output, while it is not independently indexed. A separate indexed table would help contact search/export but would duplicate published truth and require publication synchronization. Existing source contract already derives public contact output from publication fields.

Remaining implementation gate: helper tests cover serialization behavior, but no publisher consumes the helper yet. Public photo-path inclusion remains subject to the media publication contract.

### 3. Staff subjects, capabilities, and scope

Legacy internal staff are allowlisted and have global access, with role-derived capabilities: read; edit/media; publish; inventory/export; delete. The target has no staff admission/capability mapping table yet. Runtime checks must deny unknown subjects, missing capabilities, and absent/empty business scope for business-scoped operations.

**Approved contract:** map the immutable Cloudflare Access `sub` value to a D1 staff record and explicit capability grants. Preserve the legacy global capability set: read; edit/media; publish; inventory/export; delete. Unknown staff and ungranted capabilities are denied. Every business-scoped operation requires an explicit business target, which is checked against canonical records; missing or empty scope is denied. Record grant changes in an audit trail with actor, subject, capability, scope, reason, and timestamp.

**Tradeoff:** global capabilities preserve legacy workflow convenience but increase impact of mistaken or compromised accounts. Business-scoped grants reduce exposure and make tests precise but add grant maintenance. A role-only mapping is simpler but less flexible and can obscure scope.

Remaining setup: provision only owner-approved staff subjects and verify the global capability set plus explicit business-target checks at runtime. Do not encode actual staff emails or identities in this packet.

## Rate Limits Approved for Staging Tests

These numeric limits are approved for isolated staging tests only. They are not authorization for live or production enforcement. The key includes environment to prevent counter sharing. Use edge IP limits for anonymous endpoints and application checks for verified staff/business dimensions. Never key on a raw card token or trust caller-supplied identity/scope. Where a staging limit rejects, return `429` with `Retry-After` seconds until the counter window resets. Sign-in and recovery responses must remain indistinguishable for known and unknown accounts. Reject before side effects; preserve the prior publication on publish rejection. Fail closed for protected writes if enforcement is unavailable.

| Operation | Counter key/dimension | Window and proposed limit | Rejection behavior |
| --- | --- | --- | --- |
| Sign-in | Environment + source IP: 10 attempts; environment + normalized account-key HMAC: 5 attempts | 15 minutes | `429` + `Retry-After`; generic auth body |
| Recovery | Environment + source IP: 5 attempts; environment + normalized account-key HMAC: 3 attempts | 30 minutes | `429` + `Retry-After`; generic recovery body |
| Card lookup | Environment + source IP: 120 lookups; environment + keyed token fingerprint is an abuse signal only, with no per-token cap | 1 minute | Staging test may return `429` + `Retry-After` at the IP threshold; accept legitimate QR/NFC bursts above 10 lookups/minute; no card-state detail; never store raw token as key |
| Upload | Environment + verified staff subject + business ID: 20 starts; same key: 3 starts | 1 hour; 1 minute burst | `429` before upload processing/object writes |
| Publish | Environment + verified staff subject + business ID + page ID: 10 publishes; same key: 2 publishes | 1 hour; 1 minute burst | `429` before publication; old active version remains selected |
| Admin mutation | Environment + verified staff subject + business ID: 60 mutations | 1 minute | `429` before mutation; canonical state unchanged |
| Export | Environment + verified staff subject + business ID: 3 starts | 1 hour | `429` before export generation |

Account keys and token fingerprints should be keyed hashes with a secret unavailable to clients, not reversible or logged identifiers. The card lookup threshold is a staging-test value; validate that legitimate QR/NFC traffic above 10 lookups per minute is accepted. A keyed token fingerprint may inform abuse review but must not by itself block lookup or impose a per-token quota. Confirm Cloudflare mechanism/plan semantics before choosing enforcement: Workers rate-limit bindings are approximate and local to a location; WAF rule periods and availability depend on plan. A bounded staging test must demonstrate each approved threshold and `Retry-After` response. If the plan cannot enforce these dimensions, document the supported application-side design before claiming the staging test passed. No live or production limiter may be activated under this approval.

## Credential and Staging Setup

### Local files and variable names

Keep values only in ignored local service-specific files: `.env.cloudflare.local` for Cloudflare operator credentials and `.env.migration.local` only for migration tooling's other provider credentials. Both match `.env*` in `.gitignore`; do not consolidate them into `.env.local`, which belongs to legacy app/E2E workflows. `.env.cloudflare.local` is documented as unsafe to use while its permissions/mount remain unsafe. This packet was written without reading any local secret file.

Existing documented names: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_ACCESS_TEAM_DOMAIN`, and `CLOUDFLARE_ACCESS_AUD`. The staging Access audience is generated only after its app exists. Proposed separate operator-token variables are `CLOUDFLARE_DEV_API_TOKEN` and `CLOUDFLARE_STAGING_API_TOKEN`; the current examples do not define these, so select a non-secret loader convention before adding them. Do not put secret values in chat, checked-in files, Wrangler `vars`, browser variables, logs, evidence, or command output.

### Least privilege by task

Create different tokens for development and staging, with resource selectors restricted to the corresponding D1 database, R2 bucket, KV namespace, and Worker. Use separate Cloudflare accounts if the required token/resource selectors cannot enforce environment boundaries. Do not grant zone, DNS, route, production, or unrelated account access.

| Task | Minimum Cloudflare permission family to request, scoped to that environment |
| --- | --- |
| Read identity/inventory and verify bindings | Account `Workers Scripts:Read`, `D1:Read`, `Workers KV Storage:Read`, `R2 Storage:Read` |
| Apply D1 migrations or restore a disposable target | Account `D1:Edit` on that environment's named D1 only |
| Upload/list/delete synthetic R2 objects for approved staging tests | Account `R2 Storage:Edit` on that environment's named bucket only |
| Read/write KV for approved isolated tests | Account `Workers KV Storage:Edit` on that environment's namespace only |
| Deploy or roll back the Phase 1 Worker | Account `Workers Scripts:Edit` on that environment's Worker; read permissions for D1/KV/R2 metadata as needed by preflight |
| Create/update staging Access app/policies | Cloudflare Zero Trust `Access: Apps and Policies:Edit` for staging application/policy; no production hostname or zone/DNS permission |

Permission labels can vary by Cloudflare token UI/API version; choose the exact current permission from Cloudflare's token permission catalog and verify a denied cross-environment operation. Do not elevate a single shared account token to stand in for two environment credentials. Runtime secrets are separate from operator tokens. `CLOUDFLARE_ACCESS_TEAM_DOMAIN` and `CLOUDFLARE_ACCESS_AUD` are verifier configuration identifiers, not credentials. The Worker verifier must validate Access JWT signature, team issuer, exact audience, expiry, and subject using Cloudflare's published Access signing keys; never log the JWT.

### Staging Access app and test identities

Create a self-hosted Access app only after the staging admin hostname/route is established. Use the approved identity provider, default-deny policy, allow only individually approved NexTap test identities, and require MFA. Record the Access team domain and the app-generated audience under the staging environment. The application verifier needs the JWKS/certificates endpoint derived from the team domain and must compare issuer, `aud`, `exp`, and `sub`; it must not accept an Access cookie as app authorization by itself.

Provision distinct test identities, without recording addresses or recovery secrets here:

- Anonymous browser/request with no Access session: denied at edge.
- Authenticated non-staff identity not present in the application mapping: denied by default-deny Access policy or app mapping, with the app denial independently exercised in a controlled test.
- Allowed staff with no capability: Access passes, every protected operation denied.
- Allowed staff with capability but no business scope and with an empty scope list: business-scoped operations denied.
- Allowed staff with explicit capability and one permitted business scope: expected operation succeeds; another business is denied.
- Sign-out/session expiry identity: signing out clears the session and subsequent request is denied; test expired JWT behavior.
- MFA recovery identity: exercise the IdP's documented recovery path in staging and verify a recovered session still requires application capability/scope.

Keep recovery codes and MFA factors in the IdP, never in repository files or test fixtures. Run these as synthetic identities against staging only.

Official Cloudflare references: [API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/), [API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/), [Access applications](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/), [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/), [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/), [Access MFA requirements](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/), [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Workers rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), and [WAF rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/).

## Phase 1 Gates Waiting on These Decisions or Setup

The Phase 1 execution spec remains the acceptance authority. The following gates cannot pass until owner decisions and setup are in place and evidence is produced:

- **Physical schema and publisher integration:** the owner-approved `has_menu`, snapshot-only versioned contact projection, and staff-capability contracts are implemented in migration `0003_approved_page_publication_contracts.sql`, applied to dev/staging. Snapshot-helper groundwork exists in [`publication-snapshot.ts`](../../workers/phase1-foundation/src/publication-snapshot.ts), with focused tests, but no publisher consumes it. Implement publisher integration and verify published output; close the remaining manifest/content limits and other concrete findings in [schema review](../../infra/cloudflare/d1/PHASE_1_SCHEMA_REVIEW.md). The reviewed original candidates remain `0001_phase1_core_schema.sql` SHA-256 `478cf395ae7e861de607848b1ebd1f3d5d48fe0377f5778a19f98d084f6a483a` and `0002_permanent_slug_aliases.sql` SHA-256 `bcba868fcdf45783b33072323f6ed97f21c16a2a5c25f5b1c4a5eb79f0d5aee3`; applied migrations remain immutable.
- **Runtime authorization:** create staging Access, configure verifier values, map subjects and capabilities, then prove anonymous, non-staff, no-capability, missing/empty-scope, wrong-business, allowed-capability, sign-out, expiry, and MFA-recovery outcomes.
- **Environment isolation/deployment:** provision separate least-privilege dev/staging credentials and prove cross-environment denial; deployed binding identities and protected deployment/rollback still need evidence. Local target guards do not constrain Cloudflare credentials.
- **Rate limiting:** thresholds are approved for staging tests only. Confirm enforcement support and demonstrate bounded synthetic staging traffic, including acceptance of legitimate QR/NFC bursts above 10 lookups/minute. Do not activate live/production enforcement under this approval.
- **Recovery:** the approved four-hour RTO and 24-hour RPO need backup/restore evidence. No approved private backup destination or scheduler is configured, so scheduled backup and representative D1/R2 recovery are blocked. Existing 183.09-second local synthetic restore is not RTO proof; current remote app tables were empty and no representative recovery was performed.
- **Remaining Phase 1 controls:** backup policy, restore integrity, logging integration/redaction, staging deploy/rollback and any other acceptance evidence listed in the [closeout status](PHASE_1_CLOSEOUT_STATUS_20261114.md) remain open as recorded there.

Phase 0 remains separately incomplete: physical Android evidence and the dedicated synthetic-card journey remain open; do not roll those into Phase 1 or treat them as waived. See [Phase 0 execution plan](../specs/NEXTAP_PHASE_0_EXECUTION_PLAN.md).

## Repository Evidence

- Target and phase boundary: [active migration PRD](../specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md), [Phase 1 execution spec](../specs/NEXTAP_PHASE_1_EXECUTION_SPEC.md), [DATA_MODEL](../DATA_MODEL.md), [CODEBOOK](../../CODEBOOK.md).
- Schema candidate and findings: [schema decisions](../../infra/cloudflare/d1/SCHEMA_DECISIONS.md), [schema review](../../infra/cloudflare/d1/PHASE_1_SCHEMA_REVIEW.md), migrations `0001_phase1_core_schema.sql` and `0002_permanent_slug_aliases.sql` under `infra/cloudflare/d1/migrations/`.
- Legacy parity: [parity inventory](PHASE_1_LEGACY_PARITY_INVENTORY.md); `supabase/migrations/202610080001_initial_schema.sql`, `202610080002_publish_and_slugs.sql`, `202610080003_publish_page.sql`, `202610080005_immutable_publications.sql`, `20261020063654_contacts.sql`, `20261024020834_internal_admin_capabilities.sql`, and `20261014210855_admin_inventory_operations.sql`; corresponding contract tests are listed in the schema review.
- Operational/recovery/current environment evidence: [controls](../../infra/cloudflare/PHASE_1_CONTROLS.md), [operations](../../infra/cloudflare/PHASE_1_OPERATIONS.md), [recovery](../../infra/cloudflare/PHASE_1_RECOVERY.md), [environment runbook](../../infra/cloudflare/PHASE_1_ENVIRONMENTS.md), [resource matrix](../../infra/cloudflare/phase1-resource-matrix.json), [closeout status](PHASE_1_CLOSEOUT_STATUS_20261114.md).
