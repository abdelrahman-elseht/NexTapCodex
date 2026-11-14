# Functions and Components Catalog

This catalog helps agents find existing shared behavior before adding code. It covers stable interfaces with reuse value; it is not an inventory of every private helper. Search the catalog, source exports, and imports/callers before implementing similar behavior. Confirm that a candidate has the same domain meaning, runtime, authorization, failure behavior, and side effects before reusing it. Similar names do not imply equivalent behavior.

## Categories

- [UI components](ui.md)
- [Business and profile functions](business.md)
- [Admin and authorization functions](admin-auth.md)
- [Media functions](media.md)
- [Card and manufacturing functions](cards.md)
- [Security and observability functions](security-observability.md)

## Catalog Rules

- Record stable shared interfaces, their source path, responsibility, runtime/side effects, and primary tests. Keep one-route UI and private helpers near their callers.
- Add or update an entry when a shared interface is added, moved, or changes contract. Include its owner, contract, runtime/side effects, and primary test; remove entries when the implementation is retired.
- Add focused unit tests for pure shared contracts and browser tests for user-visible behavior. Treat the listed test path as a pointer and verify the current tests and callers.
- Check the active migration phase before reusing legacy integrations in target code. Preserve product behavior where required, but keep runtime-specific adapters behind the appropriate seam.
- Add Cloudflare Worker/D1/KV/R2 entries only when the implementation exists and has a real caller. Do not catalog hypothetical modules or add placeholder packages.
- For genuinely new reusable behavior, first search GitHub for well-maintained, highly starred projects with a matching use case. Treat stars as a discovery signal only: inspect the upstream implementation, license, maintenance, security posture, and compatibility; use it for design inspiration and adapt the result to this repository's Codebook and architecture rules.
- Prefer a focused local implementation when upstream code does not fit the contract. Add a concise catalog entry after the shared implementation and tests exist; do not add hypothetical entries.
- Evaluate changes for user experience (UX), agent experience (AX), and developer experience (DX): make user flows understandable and accessible, make repository behavior easy for agents to discover and verify, and keep interfaces and ownership straightforward for developers to maintain and scale.
- Terra may use this catalog as a reuse index, but a review must also inspect relevant registered guidance, callers, tests, and implementation. Catalog similarity alone does not establish a defect.
