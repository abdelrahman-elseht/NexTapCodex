# Phase 0 Pages Route Fixture

This disposable Cloudflare Pages fixture tests the real custom hostname while keeping all traffic synthetic. The `/b/*` profile path is static and excluded from Pages Functions. Functions serve the control route, R2-backed media and purge routes, and a `/menu/*` proxy to a separate synthetic Menu Pages project. The Menu fixture proves path routing only; it does not implement the future Menu-enabled profile feature.

## Existing Resources

- Proof Pages project: `nextap-phase0-proof-20261113`
- Proof hostname: `phase0.nextap.services` (Cloudflare association and certificate active)
- Proof `pages.dev` hostname: `nextap-phase0-proof-20261113.pages.dev`
- Menu Pages fixture: `nextap-phase0-menu-20261113`
- Private R2 fixture bucket: `nextap-phase0-media`
- Seeded synthetic R2 object: `phase0/cover.svg`
- Hostinger DNS: one `phase0` CNAME to the proof `pages.dev` hostname; production records and apex nameservers are unchanged

These resources already exist. Do not create duplicate projects/buckets, associate another hostname, or write DNS as part of P0.2/P0.3. The synthetic slug-update gate passed using fresh dedicated paths; see `docs/specs/NEXTAP_PHASE_0_EXECUTION_PLAN.md` and its indexed runtime evidence. The earlier stale cached v1 response is a separate historical cleanup observation, not a current prerequisite. P0.3 is complete under the owner's revised evidence standard: Pages static-asset semantics, route configuration, deployed artifact, and same-window positive-control/tail evidence support no Pages Function invocation or NexTap application-origin request on the observed profile path. An individual cache-tier HIT remains unobserved; do not infer one from `CF-Ray`, matching body hashes, or absent Function events. See the [P0.4 decision review](../../../docs/research/PHASE_0_P0_4_DECISION_REVIEW.md) and its [Cloudflare Pages source](https://developers.cloudflare.com/pages/configuration/serving-pages/). Phase 0 remains incomplete; the decision review records the blocking physical Android gate, unverified synthetic-card journey, and target-performance gates.

## Redeploy Existing Project

Use Wrangler 4 and the existing `.env.cloudflare.local` file without printing or copying its secret values. From this directory:

```sh
cd proof-site
npx -y wrangler@4 pages deploy public --project-name nextap-phase0-proof-20261113 --branch main --commit-dirty=true --env-file ../../../../.env.cloudflare.local
```

For a Menu fixture change, run the equivalent command from `menu-site` with `--project-name nextap-phase0-menu-20261113`. Redeployment updates the existing project; it does not require DNS changes. Keep the proof project's `PHASE0_MEDIA` binding and route configuration intact.

## Boundaries

- Never change the apex nameservers or the existing apex, `www`, `admin`, or `staging` records.
- Do not create a Cloudflare child zone, R2 custom domain, or Workers Route for this free-plan proof.
- Keep all test content synthetic. Do not put customer data, card tokens, cookies, or private media URLs in fixture assets or reports.
- Preserve `/b/phase0-demo`, the Menu fixture, and unrelated resources when cleaning up a test. Do not delete Cloudflare resources until the Phase 0 evidence and teardown decision are recorded.
