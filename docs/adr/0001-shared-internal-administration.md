# Shared internal administration with global capabilities

Accepted by the deployment owner on 2026-10-24. Multiple trusted NexTap administrators intentionally manage all businesses in a shared internal administration boundary. Businesses are managed resources, not isolated tenants; there is no sole-owner limit and merchant self-service accounts are not authorized.

Existing administrators retain full access. Roles are global: `administrator` has all capabilities; `publisher` can read, edit, manage media and publish; `editor` can read, edit and manage media; `inventory` can read, assign, manufacture and export cards; `auditor` can read administrative data and audit history. Destructive inventory operations and administrator admission require the full administrator role. These roles do not imply confidentiality between businesses.

Admission requires a deployment operator to explicitly approve an Auth UUID and role in a private database register before adding it to `owner_users`. Auth signup, user-editable metadata, an email domain, a UI check, and an existing browser session cannot confer administrator access. Browser roles have no write privileges on either admission or authorization records. Existing accounts are grandfathered once by migration; later additions fail closed without approval.

Application checks improve feedback; RLS and privileged RPCs enforce capabilities at the database boundary. Resource relationship, revision, idempotency and destructive-operation confirmation checks remain mandatory regardless of role. A future merchant tenancy model requires a separate migration and decision.
