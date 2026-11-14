# UI Components

| Export | Source | Reuse contract | Primary verification |
| --- | --- | --- | --- |
| `BrandLogo` | `src/components/ui/brand-logo.tsx` | Shared NexTap brand mark for public and admin surfaces | Public journey and visual smoke |
| `SubmitButton` | `src/components/ui/submit-button.tsx` | Submit control with pending state | Form/action E2E and route tests |
| `ConfirmSubmitButton` | `src/components/ui/confirm-submit-button.tsx` | Confirmation affordance for destructive form submission | Destructive-action E2E |
| `AdminNav` | `src/components/admin/admin-nav.tsx` | Owner/admin navigation shell | Admin browser journeys |
| `AdminListLoading` | `src/components/admin/admin-list-loading.tsx` | Shared loading presentation for admin lists | Loading-state unit/E2E tests |
| `AdminFeedback`, `useAdminFeedback` | `src/components/admin/feedback.tsx` | Shared admin success/error feedback state | Admin mutation journeys |
| `MutationForm`, `FilterForm`, `useMutationState` | `src/components/admin/mutation-form.tsx` | Shared admin mutation/filter form behavior | Business/card mutation E2E |
| `useMutationLocks`, `acquireMutation` | `src/components/admin/mutation-locks.ts` | Client-side overlap prevention for keyed mutations; not a database lock | Admin mutation recovery E2E |
| `CopyNfcUrl` | `src/components/admin/copy-nfc-url.tsx` | Copies a stable card destination URL | Card URL/NFC E2E |
| `ManagedImage` | `src/components/business/managed-image.tsx` | Responsive managed-image rendering | `media-rendering.e2e.ts` |
| `PublicSnapshot` | `src/components/business/public-snapshot.tsx` | Renders a public publication snapshot and enabled sections/actions | Public journey and contact/payment/media E2E |
| `GalleryView`, `DeferredGallery` | `src/components/business/gallery-view.tsx`, `deferred-gallery.tsx` | Accessible gallery rendering and deferred interaction | Media rendering E2E |
| `SocialLinks` | `src/components/business/social-links.tsx` | Provider-aware social destinations | `provider-links.e2e.ts`, public journey |
| `PaymentLogo` | `src/components/business/payment-logo.tsx` | Provider-specific payment mark | Payment/provider tests |
| `PaymentAction` | `src/components/business/copy-payment.tsx` | Public payment instruction/copy action; does not process payments | Security and wallet E2E |

Inspect component callers and props before reuse. Keep route-only editor controls under the route's `_components/` folder until they have a stable shared contract.
