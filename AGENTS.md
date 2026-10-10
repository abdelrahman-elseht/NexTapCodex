# Repository navigation

Before locating code or adding modules, read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Use [docs/README.md](docs/README.md) to find product specs and historical handovers relevant to the task.

`@/*` resolves to `src/*`. Keep route-specific UI in that route's `_components/` directory and shared code in the documented domain folders. Framework registration files (`middleware.ts` and instrumentation) live directly in `src/` beside `src/app/`.

For source moves, update imports, test aliases/globs, package scripts, CI paths, `.gitignore` exceptions and documentation links. Verify typecheck, unit tests, lint and a fresh production build; Next.js generated types can retain old paths until regenerated. Run relevant existing browser journeys when routes or runtime registrations move.

Use UTF-8-safe file operations and literal paths for bracketed Next.js route directories such as `[id]` and `[slug]`.

If `.codegraph/` exists at the repository root, use CodeGraph before text searches to locate or understand code; otherwise use the architecture map and targeted searches.
