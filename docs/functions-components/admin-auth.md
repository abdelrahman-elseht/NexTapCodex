# Admin and Authorization Functions

| Export | Source | Reuse contract | Primary verification |
| --- | --- | --- | --- |
| `requireOwner`, `AdminCapability` | `src/lib/auth/owner.ts` | Server-side owner capability authorization in the current integration | `auth-session.test.ts`, auth/non-owner E2E |
| `authorizeMutation`, `mutationResponse`, `databaseFailure` | `src/lib/admin/mutation.ts` | Current admin mutation authorization and response helpers | Admin route tests |
| `boundedJson`, `boundedForm` | `src/lib/admin/mutation.ts` | Bounded parsing for admin mutation payloads | Route/security tests |
| `encodePageCursor`, `decodePageCursor`, `cursorFilter`, `pageUrl`, `cursorForRow` | `src/lib/admin/pagination.ts` | Cursor-based admin list pagination and URL construction | Pagination tests and admin journeys |
| `loadBusinessEditorPages` | `src/lib/business/business-editor-pages.ts` | Loads current editor page data for owner workflows | Business editor page tests |

These functions are server-side and some depend on the current Supabase authorization/data model. For Cloudflare target code, follow the migration PRD and port the required capability contract through the target auth adapter; do not carry over an implementation just because its name matches.
