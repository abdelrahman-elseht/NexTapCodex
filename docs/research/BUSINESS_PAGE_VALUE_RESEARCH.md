# Additive Value for NexTap Business Pages

**Question:** What new, lightweight additions could help local businesses use their NexTap page in everyday customer interactions without redesigning the existing page or turning NexTap into a complex operations platform?

**Scope:** Product/source review and first-party web guidance. This is research, not implementation approval. Recommendations are hypotheses to validate with Egyptian local businesses; sources establish product patterns and technical guidance, not NexTap conversion outcomes.

## Current Setup to Preserve

The user-provided page screenshot shows a photo/profile header, Add to Contact, an eight-action grid (Call, WhatsApp, InstaPay, Email, Location, Google Reviews, Booking, CV), social links, About, Payments, opening hours, and NexTap attribution. Keep these sections and their order intact in proposals.

The product already supports ordered sections for contact, hours, social links, external payments, links, services, galleries, reviews, and branches. The demo includes WhatsApp, calls, booking, reviews, and payment actions. These are existing capabilities, not new feature recommendations. Sources: [`PRODUCT.md`](../product/PRODUCT.md), [`src/lib/business/content.ts`](../../src/lib/business/content.ts), [`src/components/business/public-snapshot.tsx`](../../src/components/business/public-snapshot.tsx).

The current gallery is deferred until near the viewport, but renders as a grid and its images open directly. A horizontal, CTA-bearing featured strip would be new presentation/content behavior. Existing performance evidence identifies the cover image as the LCP resource and notes the gallery's potential media cost; additions should remain bounded and below the cover. Sources: [`deferred-gallery.tsx`](../../src/components/business/deferred-gallery.tsx), [`gallery-view.tsx`](../../src/components/business/gallery-view.tsx), [`NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md`](../specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md).

## Net-New Additions

| Rank | Addition | Daily value | Complexity / owner burden | Performance risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | **Featured updates/offers:** 1-5 horizontally scrollable photo/text cards with one labeled CTA each. | Lets an owner share what is happening now and gives customers a reason to revisit or act. Google Business Profile supports updates, offers, events, and action buttons; this is pattern evidence, not proof of NexTap outcomes. | Low-medium if it reuses the current media/editor/publish workflow; owner must keep content fresh. | Medium from image bytes; low runtime risk with CSS scroll-snap, native links, and no autoplay/slider JavaScript. | Strongest new candidate. Add as an optional section without moving existing page sections. Begin manual, bounded, and with no scheduler or automatic expiry. [Google Business Profile posts](https://support.google.com/business/answer/7342169?hl=en); [MDN scroll snap](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Scroll_Snap/Basic_concepts). |
| 2 | **“Before you visit” FAQ:** a few business-maintained answers to practical questions: pickup, parking, appointment vs walk-in, delivery area, payment, or returns. | Reduces repeated calls and uncertainty before a customer visits or orders. | Low; static text and existing publishing. Business must keep answers accurate. | Very low; native `<details>`/`<summary>` works without a JavaScript accordion. | Add an optional short section in the existing stack; hide when empty. Do not infer business-specific policies. Validate keyboard use and both languages. |
| 3 | **Contextual WhatsApp message starters:** a button next to an offer or relevant content opens WhatsApp with a short draft message, such as “Is the seasonal blend available today?” | Makes an existing communication channel easier to use and gives the business a more specific inquiry. | Low-medium; build a safely encoded `wa.me` URL from the configured business number and text. No inbox or message storage. | Very low; ordinary external link. | Keep the current WhatsApp action untouched. Add optional context-specific prompts; let the visitor review and send, and provide a fallback when no number is configured. |

## Additional Variants

These are lower-priority alternatives/additions for consideration. They preserve the same current page stack and should not all be added at once.

| Idea | Example | Reuse vs new work | Tradeoff |
| --- | --- | --- | --- |
| Upcoming events/classes | Two dated rows with a link to ask or reserve | New optional static section; use current external booking/contact links | Owners must remove old dates; no calendar engine or scheduled expiry initially. |
| Starting prices | “From EGP 250” on a service with a WhatsApp action | Reuse Services item text/value/actions | Show only when accurate; distinguish starting estimates from confirmed quotes. |
| Entrance/parking directions | Short landmark or entrance note beside directions | Reuse current location/map action; may need a short optional text field | Must be owner-supplied and accurate; do not add embedded map by default. |
| Service/delivery areas | Static neighborhood names with a “check your area” message | New optional text section | Keep manually maintained; no distance calculation or live availability claim. |
| Share this page | Native share action with copy-link fallback | Small client-side capability; no backend or referral tracking | Browser support varies; provide a reliable copy fallback and keep Add to Contact separate. [MDN Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share). |

## Safe Shape

- Preserve the current profile, Add to Contact, eight action tiles and their order, social links, About, Payments, hours, and footer. New content is optional and inserted into the current stacked layout.
- Bound featured content to a few cards; photos are optional. Use responsive derivatives, explicit dimensions, useful alternative text, and lazy loading below the cover. Never lazy-load the actual LCP image. [web.dev: Optimize LCP](https://web.dev/articles/optimize-lcp); [web.dev: browser-level image lazy loading](https://web.dev/articles/browser-level-image-lazy-loading).
- Use CSS overflow and scroll snap. Avoid autoplay, timers, and a carousel dependency. Keep the first card and its action understandable even if the visitor does not swipe.
- Keep the FAQ short and owner-authored. Use native disclosure behavior, and do not claim parking, delivery, appointment, or availability policies unless the business entered them.
- URL-encode WhatsApp prompt text, including Arabic, and never send automatically. The customer must review and confirm in WhatsApp.
- Do not add expiry, campaign analytics, a constant ad feed, order processing, reservations, loyalty, CRM, or a message inbox before interviews establish a need.

## Validation

Interview a small mix of cafés/restaurants, salons, clinics/professionals, and retailers. Ask about recent customer questions, stale or repeated information, who will maintain offers/answers, and which next action customers should take. Prototype additions in the current mobile section stack in Arabic and English; check scroll discoverability, CTA comprehension, keyboard use, and long text. Measure bytes and LCP on representative low-end Android devices before rollout.

## Sources

- Google Business Profile Help, posts for updates/offers/events and action buttons: <https://support.google.com/business/answer/7342169?hl=en>
- MDN Web Share API, device share behavior: <https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share>
- MDN CSS scroll-snap concepts: <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Scroll_Snap/Basic_concepts>
- web.dev LCP optimization: <https://web.dev/articles/optimize-lcp>
- web.dev browser-level image lazy loading: <https://web.dev/articles/browser-level-image-lazy-loading>
- NexTap product contract: [`docs/product/PRODUCT.md`](../product/PRODUCT.md)
- Existing page sections/actions: [`src/lib/business/content.ts`](../../src/lib/business/content.ts), [`src/components/business/public-snapshot.tsx`](../../src/components/business/public-snapshot.tsx)
