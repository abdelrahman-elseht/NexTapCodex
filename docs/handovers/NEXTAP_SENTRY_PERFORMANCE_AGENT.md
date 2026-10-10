# NexTap â€” Sentry Integration & Performance Audit

You are a senior Next.js engineer specializing in observability and web performance. Work autonomously in a **new isolated branch/worktree** named `chore/observability-audit`, created from the **latest tested integration branch** (or the latest committed application branch if integration is not ready). Never interfere with active worktrees.

## Phase Checklist
- [x] **Phase 1 â€” Inspect & baseline:** Review current code/monitoring; measure site performance before changes.
- [x] **Phase 2 â€” Integrate Sentry:** Add lightweight, privacy-safe error monitoring for Next.js.
- [x] **Phase 3 â€” Validate:** Confirm client/server capture, compare performance, run tests.
- [x] **Phase 4 â€” Handoff:** Deliver one concise report with evidence and prioritized fixes.

## Goal
Make NexTap observable before launch **without changing business functionality**. Identify actual speed, accessibility, and technical problems, and install Sentry so errors can be investigated after release.

## Scope

### 1. Performance & Quality Audit
Use **Chrome DevTools MCP**, Lighthouse/PageSpeed, and installed **E2E/Playwright skill** only as necessary (avoid redundant tool runs). Test a local production build or isolated Staging/Preview URL; do not mutate live customer data.

Audit:
- Landing page `/`
- A representative published business microsite `/b/:slug`
- Permanent card redirect `/c/:token` (dedicated synthetic test card only)
- Admin login and dashboard
- Business editor and live mobile preview

Measure **mobile first**, then desktop: Lighthouse Performance/Accessibility/SEO/Best Practices, LCP, CLS, TBT (and INP only if real-user or suitable interaction data exists), TTFB, image weight, JS payload, network requests, caching, console errors, failed assets, RTL/responsiveness. Use 2â€“3 comparable runs on key public pages; distinguish lab results from field metrics. Capture a baseline and rank actual findings by impact. Do **not** invent scores.

### 2. Sentry Integration
Use connected **Sentry MCP** for inspection/project configuration where available, and the official **`@sentry/nextjs` SDK** for actual application telemetry. Check existing setup first to avoid duplicate instrumentation.

- Configure client and server monitoring, plus edge instrumentation only if that runtime is used.
- Add environment (`staging`/`production`) and release identification; configure source maps securely if feasible.
- Start with error monitoring and low tracing sample rate (around 5% or less initially). Disable Session Replay, profiling, excessive logs, and unnecessary integrations.
- Capture actionable failures in card redirects, admin actions, publishing, and public pages **without recording full card tokens or sensitive payloads**.
- Configure a small number of high-value alerts for new critical errors, if available on the current plan.
- Sanitize URLs, breadcrumbs, headers, user data, payment identifiers, cookies, and Supabase credentials before sending events. Never publish secrets or private source maps.
- Keep Staging and Production events distinguishable; test only in the safe environment.

### 3. Verification
- Trigger controlled **client and server test errors** only in local/Staging; verify they actually appear in Sentry with expected environment/release data.
- Compare public-page performance before and after the Sentry integration to identify monitoring overhead.
- Run typecheck, unit tests, production build, `git diff --check`, and relevant non-destructive E2E smoke tests.
- If useful, add a **small, non-blocking Lighthouse CI baseline** to existing CI (do not introduce new infrastructure or brittle hard gates).
- Fix **Sentry-integration regressions** only. Document unrelated performance problems as recommendations, **do not undertake large optimizations or UI redesign**.

## Acceptance Criteria
1. Sentry captures verified client/server test errors without leaking sensitive data.
2. Staging and Production instrumentation are isolated and identifiable.
3. No existing card/business/admin functionality is broken; tests and build pass or blockers are documented.
4. Measured mobile/desktop findings have evidence and severity, not guesses.
5. Before/after performance comparison is recorded; instrumentation is lightweight.
6. No Production data, DNS, deployments, or existing branches are modified.

## Safety & Out of Scope
No Supabase migrations, UI redesign, broad performance refactoring, paid add-ons, or changes to Production services. Do not deploy, merge to `main`, or expose `.env.local` secrets. Ask for approval only for real external blockers or production-impacting actions.

## Deliverable
Create **`docs/handovers/OBSERVABILITY_HANDOFF.md`** with: phases completed, Sentry setup and verification evidence, performance scores by route/device, top issues ranked Critical/High/Medium/Low, exact commands and test results, changed files, cost/privacy considerations, remaining blockers, and next steps. Stop after validated implementation and audit; do not deploy.

