# NexTap Program Glossary

- **Codebook:** The concise repository guide for responsibilities, placement, imports, runtime constraints, naming, tests, deprecation and safe code removal. It complements AGENTS.md and docs/ARCHITECTURE.md rather than replacing them.
- **Compaction recovery packet:** A short durable note that records task objective, decisions, constraints, worktree/base, reviewed files, changes, checks, unknowns and next action. It restores work continuity; it is not a verbatim transcript.
- **Cutover:** An explicitly approved change that sends Production traffic to the new hosting path. Staging success alone does not authorize it.
- **Functional parity:** Support for the required application workflows and security behavior in Staging using synthetic or owner-approved test fixtures. It does not mean copying Production records.
- **Managed media:** Images uploaded or referenced through NexTap's managed-media paths, including validation, storage, URLs, privacy and public delivery.
- **Mutation testing:** Deliberately changing code behavior in test runs to see whether assertions detect it. Mutants need triage; the raw score is not a quality guarantee.
- **Published snapshot:** The approved public representation of a business page. It must exclude drafts, private contact data, owner-only information and credentials.
- **Synthetic fixture:** Test data created specifically for validation, not copied, exported or derived from Production customer data.
- **Worker runtime proof:** Evidence from a Cloudflare Worker build and execution path, including required routes and bindings. A Next.js build alone is not Worker proof.
