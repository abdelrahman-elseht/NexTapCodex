# Add to Contacts UX handoff

Implementation is on the existing `staging` checkout. No Production changes or deployment were made.

## Browser behavior

The public contact link now uses a user-initiated same-tab navigation to the `.vcf` endpoint, without an HTML `download` attribute. Successful responses use `text/vcard; charset=utf-8` and `Content-Disposition: inline; filename="business-contact.vcf"`. A separate visible link forces the `attachment` response for browsers that do not open a contact handler. Both paths use the same fresh publication/card eligibility checks and no-store security headers. The page says to confirm import on the device and does not claim automatic saving. Unit tests verified both response modes and that the CTA has no download attribute while its fallback does.

Route headers were verified in unit/HTTP response tests. A desktop Chrome UI smoke against the synthetic SSR component harness confirmed the rendered inline CTA has no `download` attribute and the separate fallback link does. The actual `.vcf` navigation was not exercised in a browser. iOS Safari and iOS Chrome remain unverified; native-device behavior is tracked separately below.

## vCard data

Validated website, WhatsApp, social, and custom-field web links are emitted as repeated standard vCard `URL` properties. An optional ASCII-safe `TYPE` label is included when a label exists; the readable label and WhatsApp/social value remain in `NOTE` for compatibility. Distinct phone and URL properties are covered by the independent `vcard-parser` unit test. The existing owner-managed Contact photo picker uses the business logo upload role and its bounded, metadata-stripped JPEG derivative; if that asset is absent, the photo property is omitted. NFC and QR artwork is not used.

## Native device status

No physical iPhone or Android device was available for this change. iOS Contacts/Safari/Chrome and Android Contacts/Chrome import previews, link tapping, photo display, cancellation, and repeat-import behavior are **unverified**. Browser emulation must be reported separately from those native results.

Validation: 187 unit tests, typecheck, lint (0 errors; 11 existing warnings), disposable PGlite migration/SQL contracts, and production build passed. A real app browser run and full authenticated E2E journey require the isolated local Supabase Auth/Storage/PostgREST stack and synthetic owner fixtures described in `CONTACTS_LOCAL_HANDOFF.md`; Docker/Podman were unavailable at the last check. No hosted database was used as a substitute.
