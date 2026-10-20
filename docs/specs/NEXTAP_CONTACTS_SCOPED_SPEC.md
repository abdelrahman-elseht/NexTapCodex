# NexTap — Add to Contacts: Scoped Implementation Spec

## Goal and authority
Complete one feature: the Owner configures a business contact card; a visitor taps **Add to Contacts** inside Quick Actions and receives one valid `.vcf` from approved published information. The user completes the device's import/confirmation. Never promise silent saving, automatic synchronization, or identical native layouts.

This brief replaces the original plan's cross-feature dependencies, not its security guarantees. Inspect the current code, migrations, and evidence first: the original document mixes a planning baseline with completed-task checkboxes. Reuse verified implementation; complete gaps rather than rebuild it. Historical checkmarks are not current test results.

## Phase checklist
- [ ] 1. Inspect the current implementation and establish an isolated local Supabase baseline.
- [ ] 2. Complete only missing contact editor, publication, photo, and download behavior.
- [ ] 3. Run focused unit, real-local-database, HTTP, browser, and available native checks.
- [ ] 4. Produce a concise handoff; stop before hosted changes or merges.

## Scope
**Include:** feature toggle; core name/organization/primary phone; optional managed photo; editable additional phones, emails, websites, addresses, WhatsApp/social links, hours, notes, and custom text. Support add/edit/remove/reorder/visibility, explicit bindings/overrides, private preview, Save Draft, Publish, and public download.

Preserve existing main/branch selection and page-specific values; never substitute another branch's contact information. Fix only the page selection needed to operate an existing branch contact configuration, not the entire branch-management UI.

**Exclude:** new business-URL access policies, subscription/expiry/pause systems, a separate admin-scroll feature, general editor redesign, new analytics, infrastructure, and a combined three-feature regression project. Preserve already-implemented access/scroll behavior. Native contact synchronization and automatic duplicate merging are not promised. The separately requested duplicate-provider bug is handled by the companion execution prompt, not an expanded Contacts roadmap.

## Local-first boundary
Work from the current approved checkout containing the latest relevant changes, in an isolated feature branch/worktree. Record its base commit; do not switch or rewrite another agent's working branch.

Use Supabase CLI with a Docker-compatible runtime for **local Postgres, Auth, Storage, and PostgREST**. Confirm application, database, and test endpoints belong to this isolated local stack before every mutation. Separate ports/project identity from other worktrees. A localhost Next.js URL does not prove Supabase is local; a connected hosted MCP is not a local database.

Replay repository migrations and synthetic fixtures on a disposable local database; use an explicitly local reset only on that disposable target. Do not edit shared historical migrations, reset another developer's database, run remote `db push`/history repair, or access hosted data as a fallback. If local prerequisites are unavailable, report the blocker and continue independent checks.

Later release order: approved local changes → reviewed Staging migrations and app deployment → hosted validation → separately approved `main` release. This task stops at local handoff.

## Implementation contracts

### 1. Contact data and publication
Reuse the existing contact configuration/schema when present. Otherwise add only the minimal bounded contact persistence needed by the existing draft/publication architecture. Do not create parallel tables or rewrite the schema to match proposed filenames.

Keep stable field IDs and explicit binding-versus-override values. Retain the original bounds: 30 optional fields including disabled rows; 64 KiB configuration; 16 KiB page overrides; labels 100 characters; URLs 2,048; emails 254; ordinary text 2,000 characters/8 KiB; combined NOTE 8,000 characters/32 KiB. Enforce relevant limits server-side.

An enabled card requires a valid display name and primary phone. Resolve explicit page values before that page's approved profile values and explicitly shared defaults. Use existing validated Egyptian/international normalization; never silently use a WhatsApp number as the primary phone. Bind repeated providers to a specific item, not an arbitrary first provider match. Additional distinct numbers/URLs remain distinct.

Optional fields must be deliberately included. Compile `snapshot.contact` as a versioned public allowlist: never serialize raw drafts, disabled/private fields, admin notes, payment identifiers, or actor IDs. Old snapshots without contact data remain disabled until explicitly published. Shared draft edits do not republish other pages.

Reuse or minimally extend existing revision/RPC contracts. Stale writes must be rejected without losing recoverable local edits; publication must atomically freeze the validated page/contact projection. Failed save-and-publish must not leave a partial publication. Check reachable legacy writers cannot erase new contact fields. Extend only the paths necessary for those guarantees.

### 2. Editor and public placement
Show contact settings in the existing editor with immediate local preview and field-specific validation. Private draft test download requires Owner authorization and must not publish or expose an anonymous draft URL. Preserve unrelated draft values, focus, and normal scroll behavior.

**Approved visual reference — `contact-quick-actions-reference.jpg` (user-supplied screenshot):** Reproduce the *layout and hierarchy* shown in the screenshot. The Quick Actions container has a **single full-width dark burgundy, rounded “Add to Contact →” button as its first row**, followed immediately by the existing **up to four cream/light action tiles in one row** (illustrated: Call, Menu, Order, Location), all inside one rounded light panel. Match the reference’s restrained spacing, alignment, visual weight, icon sizing, and button-to-tiles relationship; use NexTap’s existing design tokens rather than hardcoding screenshot dimensions. The contact CTA must NOT appear as a fifth tile, floating button, standalone section, or elsewhere in the hero. The four tiles remain independently configurable; the screenshot is a layout reference, not a mandate to hardcode those four actions. On smaller widths, tiles may reflow without overflow; the CTA stays full width above them. Use a clear text/arrow label, adequate contrast, accessible focus, and a minimum 44px touch target.

Render exactly one full-width contact anchor above tiles in the first configured Quick Actions section. A deliberately disabled primary section stays hidden; do not move its button into a secondary section. If no Quick Actions section is configured, use the existing fallback container. Enabled-but-empty/contact-only states may show the button alone; disabling Contacts preserves other tiles. Do not count the contact button toward the four-tile row limit.

Keep existing NexTap styling, RTL/LTR, keyboard focus, and at least 44px touch height. Use a user-initiated same-origin download anchor, not the external `_blank` wrapper. Provide localized import/help text; never report “Contact saved” from an HTTP response.

### 3. vCard and photo
Retain a verified existing serializer. Otherwise select one small reviewed implementation; do not mandate an old package version or spend the task comparing libraries.

Produce one UTF-8 **vCard 3.0**: BEGIN/END, VERSION, FN, N, ORG, primary/repeated TEL, and supported EMAIL/ADR/URL properties. Use readable NOTE for opted-in social links, WhatsApp, hours, and custom labels rather than promise native custom-field portability. For a business, preserve structured N without inventing a person's identity. Do not mix v4 syntax into v3.

Validate property/parameter allowlists, escaping, structured components, CRLF, final newline, no BOM, and Unicode-safe folding. Retain the original conservative 75-UTF-8-octet line budget. Reject unsafe URLs and property/header injection. Use independent parser checks plus byte assertions, not only the serializer's own round-trip. Omit card-token self-links by default.

Reuse managed media/Sharp. Precompute an immutable JPEG derivative at upload/publish, not per download: maximum 384×384, no stretching/upscaling, metadata stripped, target ≤100 KiB, hard cap 200 KiB. Total VCF ≤300 KiB. Only approved business-owned media may be fetched, with byte/time bounds; no arbitrary remote URLs. Missing media produces a valid text-only card. Keep references in the projection, not base64 in PostgreSQL; preserve referenced assets if publication fails or rolls back.

### 4. Download access and responses
Reuse the application's **current** access rules/resolvers for `/b/[slug]/contact.vcf` and `/c/[token]/contact.vcf`; do not implement the deferred access system. Fresh eligibility checks must precede any cached payload. Resolve only the current allowed publication/card assignment. Known old publication IDs, disabled contacts, inactive cards, and draft URLs must not bypass access.

Success: `text/vcard; charset=utf-8`, safe attachment filename, `private, no-store, max-age=0`, `nosniff`, `noindex`, and `no-referrer`. HEAD follows the same checks without a body. Ineligible downloads return a real generic 404; dependency failure returns a generic 503, not a successful HTML download. Preserve existing applicable rate limits/429 behavior.

Do not add a preflight request merely to announce success, a database write per download, synchronous image conversion, or shared caching of token-specific bytes. Keep credentials, contact values, and card tokens out of logs/telemetry.

## Acceptance and focused verification

| ID | Required evidence |
| --- | --- |
| C1 | Editor add/edit/remove/reorder/toggle/bind/override survives Save → reload; live preview updates; stale writes do not erase newer edits. |
| C2 | Draft changes stay private; Publish produces the approved contact projection; old snapshots default off; disabling and publishing denies future downloads. Existing imported contacts are not remotely removed. |
| C3 | With the supplied screenshot as reference, exactly one full-width burgundy “Add to Contact →” button appears **above** (not inside) the Quick Actions tile grid, in the same rounded container; up to four configurable tiles per row retain their behavior and responsive layout. Verify configured, fallback, contact-only, multiple-section, and disabled states without duplicates. |
| C4 | Downloaded bytes parse independently as one valid v3 card; Arabic/emoji, distinct repeated phones/URLs, escaping, limits, and injection fixtures pass. |
| C5 | Local Auth/RLS/RPC and HTTP tests deny anonymous draft access, cross-business/page/media access, inactive-card and stale-publication bypasses, including warm-cache paths. |
| C6 | Managed photo is bounded and reused; missing photo gives text-only VCF; GET/HEAD/error headers and bodies are verified. |
| C7 | Fresh local migration replay and an upgrade from representative pre-contact local data pass; atomic publish/rollback and concurrency are tested on real local Supabase, not mocks/PGlite alone. |
| C8 | Build/checks and focused browser workflows pass; evidence and native-device limitations are reported honestly. |

Run repository typecheck, lint, unit tests, production build, and relevant SQL contracts. Discover actual installed test commands; do not invent script names. Use table-driven unit/API cases for limits and state permutations rather than repeating every case through the browser.

Run one focused E2E suite on a **local production build**: configure → preview → save/reload → publish → actual VCF download/parse → disable/publish. Include a branch fixture and protected/invalid routes. Use 390px mobile and 1440px desktop with RTL/LTR; lightweight layout smoke at 320px and 768px. Reuse existing card/editor regression checks; run the relevant final regression once after fixes. Inspect screenshots/VCF bytes and use traces for failures, not every tool on every step.

On available real iPhone Safari and Android Chrome/Contacts, manually verify import, Arabic/core fields, photo/notes, cancel, and repeat import using synthetic contacts. Record versions and actual behavior. Browser emulation/download success is not native import proof. Unavailable devices remain **unverified**: do not block unrelated local work or claim device compatibility/production readiness.

## Handoff and stop
Create `CONTACTS_LOCAL_HANDOFF.md`: base/final commit, reused versus changed implementation, migrations/local target, C1–C8 results with evidence paths, remaining blockers, native test status, and exact Staging prerequisites. Re-run affected failures, not endless whole-app optimization. No automatic merge, hosted migration, or deployment.

## Primary implementation references
- Scope and acceptance criteria: https://docs.github.com/en/copilot/tutorials/cloud-agent/get-the-best-results
- Local stack and database tests: https://supabase.com/docs/guides/local-development and https://supabase.com/docs/guides/local-development/cli/testing-and-linting
- vCard 3.0 contract: https://www.rfc-editor.org/rfc/rfc2426
- Browser download verification: https://playwright.dev/docs/downloads
