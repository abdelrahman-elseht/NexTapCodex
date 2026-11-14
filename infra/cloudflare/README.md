# Cloudflare Preparation

This directory holds migration preparation notes. It contains no deployed configuration, resource IDs, or credentials. Production DNS, routes, and Cloudflare resources remain unchanged until the PRD phase gates authorize them.

## Configuration Boundaries

- Local Next.js values stay in `.env.local`, based on `.env.example`.
- Cloudflare CLI credentials use process/CI variables documented in `.env.cloudflare.example`. The API token is a secret and must never enter application/browser variables.
- Worker runtime bindings and environment-specific D1, KV, R2, and route identifiers belong in Wrangler configuration, not `.env` files. Create that configuration only after the Phase 0 routing proof establishes the serving model and resources exist.
- Cloudflare Access team domain and application audience are identifiers for Access verification, not substitutes for application authorization.
- The selected admin hostname is `admin.nextap.services`. Create its Access application in staging after the route exists, then store the generated audience as `CLOUDFLARE_ACCESS_AUD` in the local secret file or CI secret store.
- Do not add a secret key to public profile delivery. A warm profile route must meet the PRD's static/CDN delivery gate.

## Planned Layout

Keep the existing Next.js application at the repository root while it remains the current admin and profile implementation. Add a dedicated runtime under `workers/` only after the route proof confirms its responsibility and deployment model. Add shared contracts under `packages/` only when more than one runtime consumes the same schema. This avoids moving working routes or creating unused workspace packages before the architecture gate is met.

The present source map and domain ownership rules are in `docs/ARCHITECTURE.md`.
