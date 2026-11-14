# Legacy Architecture

This folder groups the current Next.js/Supabase implementation map used for compatibility and rollback work. It is evidence about existing behavior, not the target design. The Cloudflare migration PRD owns target contracts and phase acceptance.

## Legacy Sources

- [Legacy implementation map](ARCHITECTURE.md): source ownership, routes, and current change paths.
- [Current model sections](../DATA_MODEL.md): Supabase records and behavior used for parity discovery. The same document separately describes the proposed target model.
- [Current runtime sections](../TECH_STACK.md): checked-in Next.js, Supabase, and legacy diagnostic tooling. The same document labels the Cloudflare target separately.
- [`supabase/migrations/`](../../supabase/migrations/) and [`supabase/tests/`](../../supabase/tests/): authoritative legacy schema, policy, and SQL behavior.

## Historical Evidence

Completed implementation and operations records are archived under [Finished Work](../finished/README.md). Read them only for the task and time period they document; current source, tests, and the active migration PRD take precedence.

## Target Direction

Follow the [Landing Delivery and Supabase Exit PRD](../specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md) for Cloudflare architecture. Keep legacy code and tests while they prove compatibility or rollback behavior, and add target tests as each migration phase introduces runnable contracts.
