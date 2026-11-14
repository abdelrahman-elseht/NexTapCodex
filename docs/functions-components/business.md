# Business and Profile Functions

| Export | Source | Reuse contract | Primary verification |
| --- | --- | --- | --- |
| `PublicationSnapshot`, `PublicationSection` | `src/lib/business/publication.ts` | Visitor-facing publication projection; current persistence is legacy-specific | Publication and rendering tests |
| `publicSlugPattern`, `getPublicPublication` | `src/lib/business/public-publication.ts` | Public slug validation and published snapshot resolution | `public-publication.test.ts`, public security E2E |
| `safeUrl`, content schemas, `parseSectionContent`, `reorderSectionIds` | `src/lib/business/content.ts` | Safe content validation and section ordering | Content and editor tests |
| `businessSlugSchema`, `parseDraftPayload` | `src/lib/business/draft.ts` | Slug/draft validation; persistence stays with caller/service | Draft/editor tests |
| `providerMetadata`, `normalizeProviderValue`, `phoneHref`, `whatsappHref`, `paymentLinkHref` | `src/lib/business/providers.ts` | Provider labels, value normalization, and safe action destinations | Provider unit tests and provider-link E2E |
| `compileContact`, contact schemas and projections | `src/lib/business/contact.ts` | Validates editor contact data and compiles a safe public projection | Contact unit tests and `contacts.e2e.ts` |
| `contactResponse`, `downloadContact` | `src/lib/business/contact-download.ts` | Builds or serves a contact download; may read a managed photo | `contact-download.test.ts`, contacts E2E |
| `contactCropSchema`, `cropRectangle`, `contactPhotoUrl` | `src/lib/business/contact-crop.ts` | Contact-photo crop validation and URL projection | `contacts-ux.test.ts`, contacts UX E2E |
| `saveCompletionMessage`, `needsExitWarning` | `src/lib/business/editor-save.ts` | Save acknowledgement and unsaved-work warning decisions | Editor-save unit/E2E tests |
| `buildWalletUssdCode`, `dialerHref` | `src/lib/business/wallet-ussd.ts` | Configured wallet dialer payload formatting | Wallet unit/E2E tests |
| `serializeVCard`, `foldVCardLine` | `src/lib/business/vcard.ts` | Contact projection serialization to VCF | Contact download tests |

Provider, phone, slug, publication, and contact helpers encode NexTap-specific rules. Read their tests and the [Codebook](../../CODEBOOK.md) before adapting them to a new runtime.
