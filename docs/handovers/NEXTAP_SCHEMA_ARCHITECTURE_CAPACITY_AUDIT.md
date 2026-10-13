# NexTap — Schema, Architecture & Capacity Evaluation

You are a Senior SaaS Architect, PostgreSQL/Supabase Engineer, and Performance Engineer.

## Goal
Evaluate the current NexTap database schema and full request architecture, determine exactly when Supabase is used, estimate realistic capacity and free-tier limits, and recommend the simplest changes needed to handle high traffic without overengineering.

## Phase Checklist
- [ ] Phase 1 — Inspect schema and data usage
- [ ] Phase 2 — Trace public/admin request paths and caching
- [ ] Phase 3 — Build capacity and quota model
- [ ] Phase 4 — Perform controlled validation
- [ ] Phase 5 — Produce prioritized recommendations and handoff

## Safety Rules
- Work read-only unless a tiny local-only instrumentation change is required for measurement.
- Do not change Production data, migrations, RLS, DNS, deployments, or environment variables.
- Do not run destructive queries or high-volume tests against Production.
- Do not run a load test against a Vercel-hosted deployment without explicit platform approval.
- Use Staging or local `next start` for controlled tests, and redact all tokens, credentials, customer data, and payment identifiers.
- Do not claim a capacity number without documenting assumptions and evidence.

## Phase 1 — Database & Schema Audit
Use the repository and Supabase MCP to inspect the actual schema.

Document:
- Tables, important columns, relationships, functions, triggers, enums, and Storage buckets.
- Current row counts and approximate table/index sizes.
- RLS policies and which roles can read/write each table.
- Primary keys, foreign keys, unique constraints, partial constraints, and indexes.
- Whether critical lookups are indexed, especially card token, business slug, page/publication version, active card assignment, section ordering, and audit history.
- Which data is normalized versus JSON/JSONB, and whether that choice is appropriate.
- Data growth risks: audit logs, assignment history, media metadata, analytics, and orphaned records.

Create a concise schema/relationship diagram in the final report.

## Phase 2 — Request Path & Cache Audit
Trace these workflows end-to-end and record every database/API/cache dependency:

1. `GET /c/:cardToken`
2. `GET /b/:businessSlug`
3. Admin login and session validation
4. Admin dashboard
5. Business editor and live mobile preview
6. Save Draft, Preview, and Publish
7. Card batch creation, assignment, activation, deactivation, and reassignment
8. Media delivery and image optimization

For each route/workflow, report:
- Number and type of Supabase requests/queries.
- Whether the database is required on every request.
- Cache layer and cache key, if any.
- Cache TTL and invalidation mechanism.
- Browser/CDN response headers.
- Behavior when Supabase is unavailable.
- Whether drafts, auth data, or sensitive values can accidentally enter a public cache.

Specifically verify whether repeated public page visits and card scans reuse cached published data or query Supabase every time.

## Phase 3 — Capacity & Cost Model
Build a transparent model for:
- 10,000, 100,000, 300,000, and 1,000,000 public visits per month.
- Modeled peak rates of 1, 10, 50, and 100 requests/second.
- Cold-cache and warm-cache behavior.

Estimate separately:
- Vercel edge requests, function invocations, compute, and data transfer.
- Supabase database reads/writes, API egress, Storage egress, database size, and connection pressure.
- Image/CDN traffic.
- Effect of optional analytics writes per scan.

Use actual current page request counts and transfer sizes where available. Clearly show which free-tier limit would be reached first and define practical upgrade triggers for Vercel Pro and Supabase Pro.

## Phase 4 — Controlled Validation
Use safe measurements only:
- `EXPLAIN (ANALYZE, BUFFERS)` on representative Staging queries.
- `pg_stat_statements`, Supabase Performance Advisor, and index usage evidence where available.
- Local production build with representative read-only traffic.
- Small gradual tests against Staging only, with strict caps and monitoring.
- Validate cache hits, invalidation after Publish/Reassignment, p50/p95 latency, error rate, and database connection usage.

Do not benchmark Vercel’s CDN or generate abusive traffic.

## Phase 4.5 — Visitor Tracking & Analytics Decision
Audit whether opening a business microsite, scanning a card, or clicking an action currently writes an event to Supabase. Identify the exact tables, code paths, writes per visit, retention, indexes, and potential load/cost. Distinguish page views, card redirect hits, QR vs NFC source, and outbound action clicks; do not assume they are interchangeable.

Compare **keep in Postgres**, **aggregate/sample/batch**, **Vercel Web Analytics**, and **Cloudflare Web Analytics** (including DNS-only compatibility). Evaluate free-tier limits, privacy, bot filtering, custom events, per-business/per-card reporting, and whether 302 redirects can actually be counted. Do not assume a browser pageview tool captures redirect hits or provides a card-level breakdown. Never send public card tokens, payment identifiers, or personal data to analytics.

Recommend the simplest MVP approach: what to retain, disable, replace, or defer, and how to preserve useful business metrics without a synchronous DB write on every visit. **Audit only; do not change tracking or remove tables.**

## Phase 5 — Recommendations
Recommend the smallest practical architecture for MVP and the next scaling step.

Evaluate, without automatically implementing:
- Caching published business snapshots with tag-based invalidation.
- Keeping card redirects browser `no-store` while safely caching token resolution server-side.
- One optimized published snapshot read instead of many joins per visitor.
- Required indexes and query changes.
- Vercel Image Optimization and media limits.
- Supabase connection pooling where direct Postgres connections exist.
- Avoiding synchronous analytics writes on every scan.
- Rate limiting and WAF protection for public redirects, auth, and admin operations.

Separate recommendations into:
1. Required before launch
2. Required at a measurable threshold
3. Not needed yet

## Acceptance Criteria
The audit is complete only when it:
1. States exactly what Supabase is used for and whether it is on the critical path for each public route.
2. Identifies all critical schema constraints and indexes, with evidence.
3. Explains what continues working and what fails during a database outage.
4. Provides a capacity model with explicit assumptions—not a vague “it scales.”
5. Identifies the first likely bottleneck across Vercel, Supabase, media, cache, and client performance.
6. Gives clear upgrade thresholds and a simple scaling plan without Redis, microservices, or unnecessary infrastructure.
7. Makes no Production changes.
8. Determines whether visitor tracking currently writes to Supabase, estimates write volume, and recommends an evidence-based DB-free or low-write analytics alternative with its limitations.

## Deliverable
Create `ARCHITECTURE_CAPACITY_HANDOFF.md` containing:
- Executive summary
- Schema map
- Request-to-database matrix
- Cache/invalidation findings
- Visitor tracking inventory and analytics recommendation (including cost/privacy/302 limitations)
- Query/index findings
- Capacity and quota model
- Bottlenecks ranked Critical/High/Medium/Low
- Required launch fixes
- Upgrade triggers
- Exact evidence, commands, and limitations

Do not implement large changes. Stop after the verified evaluation and handoff.
