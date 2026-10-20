# NexTap — Contacts Implementation + Independent Provider Values


Work on `feature/contacts-local`, based on the latest approved checkout containing the current relevant implementation. Reuse that branch if it already exists safely; do not reset it, rewrite another agent's worktree, or rebuild working code because the old plan calls it “proposed.”

## Task checklist
- [ ] 1. Inspect existing Contacts implementation; confirm isolated local Supabase.
- [ ] 2. Reproduce and fix independent values for repeated providers.
- [ ] 3. Complete only the missing Contacts requirements from the scoped spec.
- [ ] 4. Run focused tests and return one local handoff.

## A. Repeated-provider bug
Currently, adding two WhatsApp items forces them to share one number. The same problem may affect other providers. Each item must support its own account/destination, even when provider type and icon are identical.

**Required behavior**
- Two WhatsApp buttons may use numbers A and B. Two Instagram buttons may use different handles/URLs. Apply the same item-identity rule to supported providers like payments , etc; do not add unrelated new platforms.
- Keep `providerId` (type), stable `itemId` (instance), display label, and value/binding separate. Reuse existing IDs/override fields where available.
- Inspect both client state/React keys AND validation, normalization, shared-profile resolution, draft RPC persistence, publication, and public rendering. Do not assume this is only an icon/UI bug.
- Editing one item changes that item only. An inherited item's direct edit becomes an explicit item override; updating a shared default is a separate intentional action.
- Preserve existing shared-default inheritance for items intentionally using it. Do not remove cross-section reuse to fix this bug. Offer “Use saved details” / “Custom value” using existing controls where possible.
- A new additional item can accept an independent value. Duplicating an item creates a new stable ID and independently editable value, not a shared mutable reference.
- Never key/deduplicate/overwrite items by `providerId`, label, or array position alone. Reorder/remove operations act by stable item identity. Preserve optional labels and accessible provider fallbacks.
- Contacts bindings must resolve the explicitly selected provider item/account; never silently use the first WhatsApp/Instagram match. Include only opted-in public values in the VCF.

Prefer the existing shared-default-plus-item-override model. Do not introduce a new multi-account subsystem/table unless the inspected schema genuinely cannot support this behavior; document any necessary minimal migration.

**Required regression**
Reproduce the bug with a failing test. Then verify two different WhatsApp numbers and two different Instagram accounts through edit → live preview → save/reload → publish → correct public destinations. Change only B, reorder, delete A, and confirm B stays correct. Change a shared default and verify explicit overrides remain unchanged while intentional inheritors update in the draft only. Verify enabled Contacts exports the selected distinct values without leaking unpublished changes. Use synthetic accounts; never send messages or payments during tests.

## Approved Quick Actions visual target
Use the attached `contact-quick-actions-reference.jpg` as the layout reference: **one full-width burgundy rounded “Add to Contact →” CTA on top**, with the existing Quick Actions (e.g., Call / Menu / Order / Location) in a row of **up to four lighter tiles directly underneath**, inside the same light rounded container. Do not implement the CTA as another small tile, duplicate it, or make a separate section. Keep the icons/actions dynamic, respect the existing design system, and verify the exact placement in mobile screenshots. The screenshot is a reference, not a flattened image to render.

## B. Complete Contacts
Implement only missing requirements in `NEXTAP_CONTACTS_SCOPED_SPEC.md`, including the bounded VCF/photo contract, one Quick Actions button, private draft/publication isolation, current route permissions, and actual downloaded-file validation. Keep provider-fix and contact changes in separate coherent commits where practical.

## Environment, testing, and delivery
Use real **local Supabase Postgres/Auth/Storage/PostgREST** with synthetic fixtures. Verify all mutation targets; the hosted Supabase MCP is not authorization to touch Staging/Production. No remote migrations, seeds, resets, deployment, or merges in this task.

Use the installed E2E skill and browser tools where useful, not repetitively. Follow the scoped spec's verification matrix, including real-local-database tests and unavailable-native-device reporting. Preserve existing appearance, publishing, card redirects, and access controls. Never expose credentials.

Return `CONTACTS_LOCAL_HANDOFF.md` with separate Contacts and Provider Fix results: root cause, changed files/migrations, actual commands/results, evidence, unresolved blockers, and approved-next-step requirements for Staging. Do not mark local success as hosted or native-device verification. Execute, test, and stop at the local handoff.
