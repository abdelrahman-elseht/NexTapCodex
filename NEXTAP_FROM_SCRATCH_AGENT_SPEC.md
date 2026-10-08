# NexTap — Build-from-Scratch Agent Specification

**Mission:** Build and test the smallest secure, working NexTap MVP **from an empty repository**. This document is the sole product brief: **there is no starter ZIP, existing code, prior schema, or brand asset attached**. Implement the app; do not stop at a plan or mockup.

## 1. Product, goal, and constraints

NexTap sells preprinted NFC/QR cards to Egyptian businesses. Every card carries a **permanent, unpredictable** URL, `https://nextab.services/c/{token}`. After sale, the owner assigns it to a customizable business microsite, `https://nextab.services/b/{slug}`. The URL printed/encoded on the card **never changes**, even when its business, page slug, or status changes. Many cards may open one business page. **Card targets are internal NexTap pages only.**

**MVP goal:** In one private dashboard, the NexTap owner can create a business, customize and publish its mobile page, create a batch of physical cards, assign/activate a card, and have the next NFC tap/QR scan open the correct page. Approximate starting scale: **100 businesses × 100 visits/day**. Keep costs very low, target **$0–5/month initially where feasible**, without falsely promising that production hosting/storage will be free.

**Default stack (do not debate without a blocker):** Next.js App Router + TypeScript + Tailwind CSS; one modular monolith; Supabase PostgreSQL, Auth, and Storage; Vercel-compatible deployment; no Redis, microservices, paid dependencies, or complex queues. One **Owner** account; no self-service merchant accounts. Use supported stable package versions. Implement simple reusable typed sections and 3 visual templates, not separate site codebases.

**UI:** Arabic-first RTL, English LTR; premium/minimal, white background, dark text, restrained gold accents, fast mobile pages. Brand name **NexTap**, domain **nextab.services** (intentional difference). Since no logo/art file is supplied, create a tasteful text-based placeholder; **do not claim exact brand colors were extracted**. Public pages must show useful actions above the fold.

## 2. In scope — pages and features

| Module | Must deliver |
|---|---|
| **Landing `/`** | Branded responsive landing: clear NFC/QR pitch, 3-step how-it-works, benefits, sample microsite/demo link, WhatsApp/contact CTA; no registration or payment checkout. |
| **Owner dashboard `/admin`** | Secure login; overview counts; business list/create/edit/archive and page activate/deactivate; card batch generation, inventory/search/filter, assignment/activation/deactivation/reassignment and history; preview/publish; usable on phone while onboarding a shop. |
| **Microsite `/b/{slug}`** | Fast public profile: cover/hero, logo, business name/category/tagline, description, hours, phone/WhatsApp/email, address + Google Maps, social links, external payment methods, Google Reviews button, custom CTA links; optional menu/services/gallery. Hide absent/disabled fields. Support business color choices. |
| **Section editor** | Add, remove, reorder (accessible up/down controls acceptable), toggle, rename sections; edit/delete/reorder **individual items** inside Social, Payments, Links, Services, etc.; draft → preview → publish. Switching template retains content. Validate structured schemas; no arbitrary HTML/JS. |
| **Templates** | Three polished starting layouts: **Café/Restaurant**, **Retail/Services**, **Minimal/Professional**. Category presets can share the same components. |
| **Egypt-focused links** | Instagram, Facebook, TikTok, WhatsApp, YouTube and other optional links; InstaPay/Vodafone Cash and similar methods as **verified external URLs or plain/copyable payment instructions**, not assumed deep links; Google Reviews as configured external URL only. Never take payments or fetch ratings. |
| **Cards `/c/{token}`** | Secure random tokens; generate ≥1,000 in one batch; internal serial + manufacturing CSV containing token and correct **QR and NFC** URLs; unassigned branded screen; assign to published pages; activate, disable, replace, reassign with confirmation and audit history. Different source labels may use the same token with `?via=qr` / `?via=nfc`, but must resolve to the same destination. |
| **Branches** | Allow one business to have a main page and optional branch page(s), or direct branch cards to its main page, with minimal data relationships; no advanced hierarchy UI. |
| **Images** | Owner-only upload to Supabase Storage, type/size restrictions, safe paths, display optimization and lazy-load noncritical media. |
| **Operations** | Versioned migrations, strong DB constraints and RLS, friendly error/empty states, basic audit logs, README and deployment configuration. |

## 3. Non-goals / out of scope

No business-owner logins, team-management UI, subscriptions/billing, card e-commerce, NexTap payment processing, real Google star ratings, advanced analytics, complex visual drag-and-drop canvas, arbitrary HTML/script embeds, custom merchant domains, native mobile apps, Redis, microservices, queues, booking integrations, complex branch hierarchies, or public deployment/DNS changes without approval. **Do not implement unrelated features or refactor working code for aesthetics.**

## 4. Architecture and critical rules

- **Data model:** At minimum `owner_users`/owner authorization, `businesses`, `business_pages` (main/branch), `page_sections` (ordered typed JSON with validation), `page_publications` or immutable published snapshot/version, `card_batches`, `cards`, `card_assignment_history`, `media_assets` as needed, and `audit_logs`. Choose a compact schema; explain constraints in README.
- **Card safety:** Each card has one effective page assignment at a time. Use DB transactions or atomic functions for activation/reassignment; enforce uniqueness (token, serial, slug), foreign keys and history. Handle conflicting updates safely. Never expose internal numeric IDs on public pages.
- **Redirects:** `/c/{token}` checks *current* card state and destination on every request; only redirect to a validated **internal** published NexTap page. Use **302 + `Cache-Control: no-store`**. No open redirects or redirect loops. Invalid/unassigned/disabled/replaced tokens show an intentional branded non-sensitive state. Old `/b/{slug}` direct links should resolve safely after a slug rename.
- **Caching:** Cache **published page content** by immutable publication ID/version (and static images with suitable browser/CDN headers). Read a small, fresh page status/version before displaying public content; unpublished/disabled content must not leak from cache. No cached card redirects. No full published-content database fetch on every repeat visit when the version is unchanged. No Redis. Account for Vercel runtime/cache behavior; validate after deployment rather than assuming local memory survives instances.
- **Auth/security:** Supabase Auth (server-side session checks, secure cookies); restrict mutations and drafts to the Owner through **both** server authorization and Supabase RLS/grants. Provide MFA setup or support where practical. Prevent XSS, CSRF where applicable, SQL injection, path traversal, unsafe URLs, unauthorized Storage uploads, leaked secrets and verbose production errors. Add basic login/write rate limits; note in-memory limits are instance-local and not DDoS protection.
- **UX/performance:** Render public pages server-first with minimal client JavaScript, responsive images, alt text and keyboard-accessible controls; use metadata/social previews and proper Arabic/English direction. Fail safely and visibly on broken links/data.
- **Hosting:** Prepare for Vercel; **do not deploy** without approval. Vercel Hobby is not appropriate for a commercial launch under its usage terms; identify a compliant launch option and costs before production.

## 5. Acceptance criteria (binary, evidence-backed)

| ID | Given / When / Then — **PASS only if verified** |
|---|---|
| **AC01** | Opening `/` on phone/desktop shows landing content, demo and working contact links; no broken navigation or horizontal overflow. |
| **AC02** | Anonymous/non-owner requests to `/admin` or any write API are denied; authenticated Owner can use the dashboard; private data remains inaccessible through direct Supabase calls. |
| **AC03** | Owner creates a business with a unique slug/template; it persists in real Supabase and can be found and edited in the admin list. |
| **AC04** | Saving a draft never changes the public page; preview displays the draft only to Owner; Publish exposes the new version; disabling the page stops public access immediately. |
| **AC05** | Owner adds/removes/hides/reorders 4 sections, changes titles, publishes; public page shows the precise new order and enabled sections. |
| **AC06** | Social section configured with Instagram and TikTok only displays exactly those two; owner can add/remove an individual item without code changes. Same rule for Payments and Links. |
| **AC07** | Hero/cover, description, opening hours, contacts and Maps link display correctly on mobile; optional empty fields produce no blank rows or dead buttons. |
| **AC08** | InstaPay/Vodafone Cash show a validated external URL or copyable instructions; Google Reviews opens its configured link; **no money passes through NexTap**. |
| **AC09** | Valid image uploads and renders; invalid/oversized file is rejected; anonymous/non-owner uploads and private reads are blocked by policies. |
| **AC10** | Generate 1,000 unassigned cards with **1,000 distinct unpredictable tokens**; CSV exports stable serial, QR URL and NFC URL under `nextab.services`. No destination required at manufacture time. |
| **AC11** | Active card scans redirect to the assigned **internal, published** page; invalid/unassigned/inactive/disabled/replaced cards show the intended safe state with no leaked IDs. |
| **AC12** | Reassign card A→B with confirmation; the very next request using its *unchanged* token points to B; assignment history contains both assignments; browser/CDN cannot retain redirect to A. |
| **AC13** | Two cards may point to one page; slug change does not affect either card; old business URLs have a deliberate safe result. |
| **AC14** | A main business page and one optional branch page can exist, and each card can target either. |
| **AC15** | Anonymous Supabase access cannot read drafts, token inventory or audit logs or modify data; RLS and route authorization are tested, and URLs/section data cannot inject scripts/open redirects. |
| **AC16** | Repeated visits reuse published content and images where appropriate; changing publication version updates content, while disable/reassign takes effect on the next request. Document actual test method/results, not speculative cache savings. |
| **AC17** | Arabic RTL and English LTR render correctly, mobile layout is usable, and public page primary actions work with keyboard/touch. |
| **AC18** | Dependency install, typecheck, automated tests and production build pass; full **create → edit → preview → publish → generate/assign → scan → reassign** journey works against the connected Supabase project (no mock-only pass). |

**Definition of done:** AC01–AC18 have real evidence, no unresolved critical security issue, source + migrations are supplied, and any unverified item is marked **PARTIAL/BLOCKED**, never PASS.

## 6. Execution instructions — avoid loops

1. **Start from empty repository.** Briefly inspect the working directory and connected Supabase project (via MCP); confirm project/environment **before any writes**. No ZIP or existing code is assumed. If there is unrelated code, do not destroy it.
2. **Plan once, very briefly:** output a ≤10-line implementation checklist and create the scaffold. Do not repeatedly regenerate specs or compare stacks. Make documented safe defaults; ask **at most 3 blocking questions** if a decision risks data loss, secrets or significant scope changes.
3. **Implement vertical slices in order:** (a) Supabase schema/RLS/Auth → (b) business + publish + public page → (c) card batch/assignment/redirect → (d) sections/templates and Egyptian links → (e) landing/dashboard polish + images → (f) security/performance/tests. Keep the app runnable after each slice.
4. **Supabase MCP:** inspect project, apply **checked-in versioned migrations** non-destructively, and verify table/index/constraint/RLS behavior against the **actual connected project**. Never reset a shared database, delete data, grant broad anonymous rights, expose secrets, create paid resources, or deploy without explicit approval. If no project is connected, keep coding/migrations/tests local and report the blocker honestly.
5. **E2E skill:** use **selectively**, only to verify cross-page behavior (Owner login, edit/publish, reorder, assign/scan/reassign) or diagnose a specific UI failure. Run one meaningful final golden-path E2E; avoid repetitive browsing/screenshots. Prefer unit/integration tests for pure logic and RLS.
6. **Test and fix:** run install, typecheck, unit/integration tests and production build. Validate RLS with anonymous and Owner contexts. Fix failures before moving on. Never claim a feature works based on visual appearance alone.
7. **Stop condition:** stop implementing when AC01–AC18 pass or when an external permission/access blocker prevents safe completion. Do not introduce Phase-2 features. Document remaining work clearly; do not hide failed checks.

## 7. Exact deliverables / handoff

Deliver **only** these files plus a 5–10-line chat summary:

1. `nextap-mvp.zip`: full runnable source, `.env.example`, SQL migrations, test files, `README.md`, and deployment instructions; **exclude** real `.env` secrets, `node_modules`, build artifacts and credentials.
2. `NEXTAP_HANDOFF.md` (target 1–2 pages): implemented architecture; migration + Supabase environment status; AC01–AC18 `PASS/PARTIAL/BLOCKED` evidence table; commands run with real results; important file paths; required environment variable **names only**; known issues; cost/deployment caveats; exact next 3 steps.

**Reference practices:** [GitHub Spec Kit](https://github.com/github/spec-kit/blob/main/templates/spec-template.md) · [Supabase SSR Auth](https://supabase.com/docs/guides/auth/server-side) · [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
