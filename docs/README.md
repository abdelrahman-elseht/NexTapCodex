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
- [Optimization handover](handovers/optimization-experience-handoff.md): optimization phases and follow-up verification.
- [Business Editor reliability handover](handovers/BUSINESS_EDITOR_RELIABILITY_HANDOFF.md): phases 1–3, payment-link limitations, regression results, and browser evidence.
- [Implementation reports](implementation/): detailed reports for completed changes.
- [Research](research/): provider documentation and technical findings.

`handovers/` preserves dated reports and task instructions. Use current source, configuration, and test results to establish present behavior; historical reports retain their original dates and verification scope. Add new handovers here and link them from this index when they supersede existing operational guidance.
