# Documentation index

- [Architecture and repository map](ARCHITECTURE.md): where to locate code and place new modules.
- [Product contract](product/PRODUCT.md): product behavior and constraints.
- [User and admin stories](specs/USER_ADMIN_STORIES.md): acceptance criteria and corresponding browser journeys.
- [Original agent specification](specs/NEXTAP_FROM_SCRATCH_AGENT_SPEC.md): historical implementation requirements.
- [Integration handover](handovers/INTEGRATION_HANDOFF.md): environment and preproduction integration evidence.
- [Observability handover](handovers/OBSERVABILITY_HANDOFF.md): telemetry and performance evidence.
- [Architecture and capacity handoff](handovers/ARCHITECTURE_CAPACITY_HANDOFF.md): read-only schema, request-path, cache, quota, and analytics audit.
- [Launch architecture handoff](handovers/LAUNCH_ARCHITECTURE_HANDOFF.md): security, cache parity, analytics, and operational launch gates.
- [Staging schema reconciliation handoff](handovers/STAGING_SCHEMA_RECONCILIATION_HANDOFF.md): Staging migration history, rollout evidence, and hosted validation gates.
- [Staging validation and production release handoff](handovers/STAGING_VALIDATION_AND_PRODUCTION_RELEASE_HANDOFF.md): current DNS/TLS and Preview state, remaining Auth and hosted tests, first release, rollback, and ongoing staging workflow.
- [Environment separation and CI/CD handoff](handovers/ENVIRONMENT_SEPARATION_AND_CICD_HANDOFF.md): branch, code, data, Auth, Storage, migration, CI/CD, release, and rollback guardrails for isolated Staging and Production.
- [Self-review and release gates](handovers/SELF_REVIEW_RELEASE_GATES.md): automated author-owned diff/risk/evidence checks, bootstrap order, and one-owner `staging` → `main` releases.
- [GitHub PR and release workflow](handovers/GITHUB_PR_AND_RELEASE_WORKFLOW.md): single-owner PR #6 merge path, branch protection choices, Staging acceptance, and future `staging` → `main` releases.
- [Hosted Staging validation progress](handovers/HOSTED_STAGING_VALIDATION_PROGRESS.md): protected hosted workflow, deployment identity evidence, credential confinement and remaining acceptance gates.
- [Hosted Staging validation handoff](../HOSTED_STAGING_VALIDATION_HANDOFF.md): current accepted run, provider access matrix, release gates and copy/paste continuation prompt.
- [Staging admin business creation incident](handovers/STAGING_ADMIN_BUSINESS_CREATION_INCIDENT.md): missing-RPC diagnosis, migration resolution, verification, and prevention guard.
- [Optimization handover](handovers/optimization-experience-handoff.md): optimization phases and follow-up verification.
- [Business Editor reliability handover](handovers/BUSINESS_EDITOR_RELIABILITY_HANDOFF.md): phases 1–3, payment-link limitations, regression results, and browser evidence.
- [Admin UX, card deletion, provider links and mobile email handoff](handovers/ADMIN_UX_CARD_DELETION_PROVIDER_EMAIL_HANDOFF.md): feature scope, acceptance criteria, database/browser guardrails, and promotion sequence.
- [Implementation reports](implementation/): detailed reports for completed changes.
- [Research](research/): provider documentation and technical findings.

`handovers/` preserves dated reports and task instructions. Use current source, configuration, and test results to establish present behavior; historical reports retain their original dates and verification scope. Add new handovers here and link them from this index when they supersede existing operational guidance.

- [Contacts local handoff](../CONTACTS_LOCAL_HANDOFF.md): implementation, local verification, blocked Supabase/native gates and Staging prerequisites.
