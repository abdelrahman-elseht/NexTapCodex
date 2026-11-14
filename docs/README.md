# Documentation Index

## Active Target

The Cloudflare migration PRD is the target contract for new NexTap Core architecture and migration-phase implementation. It defines the Cloudflare delivery path, D1 administration, R2 publication/media, KV fallback lookups, preserved business/card URLs, and separation from the Menu application. Follow its active phase and exit gates before implementing migration behavior.

## Current Baseline

The current Next.js/Supabase implementation remains a compatibility baseline until the matching Cloudflare phase passes its acceptance gates. Current architecture, data, stack, and test documents identify source behavior separately from the target. Keep compatibility checks focused on product outcomes; Supabase/PostgreSQL and Vercel-hosted checks are not default migration gates.

## Authoritative Maps and Contracts

- [Architecture and repository map](ARCHITECTURE.md): self-contained map of current source ownership, Cloudflare scaffolding, migration phase boundaries, common change paths, and documentation ownership. The legacy map is supplemental history, not required for routine agent navigation.
- [Legacy architecture archive](legacy/README.md): legacy code map and links to compatibility evidence.
- [Finished work archive](finished/README.md): completed tasks, prompts, specs, implementation reports, and handovers kept for historical evidence.
- [Technology stack](TECH_STACK.md): verified current runtime/tooling and the target Cloudflare stack, labeled by status.
- [Cloudflare preparation](../infra/cloudflare/README.md): configuration boundaries and the gated future runtime layout.
- [NexTap codebook](../CODEBOOK.md): shared domain vocabulary used by product and implementation docs.
- [Testing guide](TESTING.md): current commands and migration-phase test selection, with legacy coverage labeled as compatibility evidence.
- [Shared components and functions](COMPONENTS.md): entry point to categorized reusable UI/domain contracts.
- [Data model](DATA_MODEL.md): current Supabase source references and Cloudflare target model, labeled separately.
- [Known issues index](KNOWN_ISSUES.md): stable contribution path to categorized recurring failure records and regression guards.
- [Product contract](product/PRODUCT.md): product behavior and constraints.
- [User and admin stories](specs/USER_ADMIN_STORIES.md): stable product behavior, migration-phase acceptance, and compatibility journeys.

## Active Migration Specification

- [Landing delivery and Supabase exit PRD](specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md): the Cloudflare target, phase plan, exit gates, and compatibility requirements.
- [Phase 0 execution plan](specs/NEXTAP_PHASE_0_EXECUTION_PLAN.md): P0.3 route proof complete under the owner's revised evidence standard; Phase 0 remains incomplete. Includes the measured P0.2 lab baseline, accepted limitations, remaining gates, evidence requirements, and credential prerequisites. The complete sanitized P0.2 report is [indexed here](research/PHASE_0_P0_2_BROWSER_BASELINE_SANITIZED.json); the P0.3 runtime evidence is [indexed here](research/PHASE_0_P0_3_RUNTIME_EVIDENCE_20261113.json).
- [Phase 1 execution spec (owner-approved route-independent scope)](specs/NEXTAP_PHASE_1_EXECUTION_SPEC.md): records the owner-approved `/b/{slug}/menu` and indefinite historical-alias contracts, which explicitly supersede conflicting PRD clauses while leaving the PRD unchanged. It recommends EEUR as the closest supported D1 location hint for Egypt; current dev WEUR/staging EEUR resources remain in place, with sampled API latency medians effectively tied. Also records RTO/RPO status and Phase 0's remaining gates. It does not implement Menu, static publication, admin replacement, production configuration, or cutover.
- [Phase 1 development and staging resources](../infra/cloudflare/PHASE_1_ENVIRONMENTS.md): D1/R2/KV inventory, candidate migrations, guarded workflows, restore evidence, and runtime/binding gaps.
- [Phase 1 authorization and operations controls](../infra/cloudflare/PHASE_1_CONTROLS.md): staging identity, capability, credential-isolation, logging, rate-limit, deployment, and rollback controls with current proof gaps.
- [Phase 1 operational checks](../infra/cloudflare/PHASE_1_OPERATIONS.md): deployment preflight, temporary reachable staging smoke procedure, redaction, and rate-limit evidence status.
- [Phase 1 recovery procedure](../infra/cloudflare/PHASE_1_RECOVERY.md): approved four-hour RTO and at-most-24-hour RPO target, guarded D1/R2 restore checks, and representative rehearsal requirements; operational attainment remains unproven.
- [Phase 1 closeout status (2026-11-14)](research/PHASE_1_CLOSEOUT_STATUS_20261114.md): current gate assessment; Phase 1 remains not complete, and the local scheduled-backup workflow remains an unapproved candidate with operational RPO unproven.
- [Phase 1 recovery inventory (2026-11-14)](research/PHASE_1_RECOVERY_INVENTORY_20261114.json): sanitized evidence for the synthetic 12-table restore, integrity checks, and fixture cleanup; scheduled generation and monitoring remain unproven.
- [Sentry Cron check-ins from GitHub Actions (2026-11-14)](research/SENTRY_CRON_CHECKIN_GITHUB_ACTIONS_20261114.md): implementation contract and monitoring limitations for scheduled backup check-ins.
- [Phase 1 D1 schema decisions](../infra/cloudflare/d1/SCHEMA_DECISIONS.md): owner decisions and physical-schema review candidate; migrations `0001`-`0003` are applied to remote development and staging. Verification found no slug rows and clean foreign-key checks; the complete schema remains unapproved.
- [Phase 1 legacy parity inventory](research/PHASE_1_LEGACY_PARITY_INVENTORY.md): verified current staff capabilities, slug/publication/card/media behavior, and target decisions still requiring approval.
- [Phase 1 Phase 3 JavaScript delivery handoff](research/PHASE_1_PHASE_3_JS_DELIVERY_HANDOFF.md): route-independent planning for static payload delivery; it does not authorize route implementation, production publication, or cutover.
- [Phase 1 foundation evidence snapshot](research/PHASE_1_FOUNDATION_EVIDENCE_20261113.json): dated sanitized resource and earlier export/import evidence. Its migration status predates remote application of candidate migrations `0001` and `0002`; see the current environment runbook/schema decision record for migration state. The earlier staging status failure was caused by a placeholder configuration mismatch, not a provider permission failure.
- [Engineering foundation PRD](specs/NEXTAP_ENGINEERING_FOUNDATION_PRD.md): agent guidance, adaptive tests, dependency and architecture checks, and project hook boundaries that support the migration.

## Supporting Evidence

Completed feature briefs, task prompts, implementation reports, and dated handovers are under [Finished Work](finished/README.md). They preserve task-time evidence and are not current instructions. The completed [Agent documentation maintenance concept brief](finished/specs/AGENT_DOCUMENTATION_MAINTENANCE_CONCEPTS_BRIEF_20261114.md) records the EGM-reviewed rationale behind the current memory, architecture, documentation-review, and known-issue organization rules. Use [Research](research/) for dated research findings, including [Phase 0 custom-hostname gate options](research/PHASE_0_CUSTOM_HOSTNAME_GATE_OPTIONS.md) and the [Phase 0 P0.4 decision review](research/PHASE_0_P0_4_DECISION_REVIEW.md), which records P0.3 complete under the revised evidence standard and Phase 0 incomplete, and the [shared administration ADR](adr/0001-shared-internal-administration.md) for the current authorization capability decision.

- [Profile gallery, FAQ, and WhatsApp feature assessment](research/CLOUDFLARE_PROFILE_FEATURES_COST_AND_PERFORMANCE_20261114.md): current migration contracts, $5 Workers quota implications, image delivery recommendations, and Phase 3 additions. A [Lavish visual review](research/CLOUDFLARE_PROFILE_FEATURES_REVIEW_20261114.html) summarizes the architecture and tradeoffs.
