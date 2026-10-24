# Known Issues and Regression Guards

## Managed image uploads

- **Symptom:** The admin image picker rejected AVIF files before upload, and large AVIF files could be rejected by the browser or server even though Sharp can decode them.
- **Root cause:** The picker `accept` attribute, browser header inspection, and server optimizer each maintained separate JPEG/PNG/WebP allowlists. Updating only one layer made the user-visible contract inconsistent.
- **Guard:** AVIF is now listed in the picker and help text, recognized by the bounded ISO-BMFF `ispe` dimension inspection, accepted by Sharp, and covered by real-byte unit tests. The server still verifies bytes, dimensions, animation state, and the 5 MiB limit.
- **When changing formats:** Update all four layers together and add a generated real-image test. Do not trust filename extensions or MIME declarations.

## Wallet USSD actions

- **Symptom:** The Vodafone Cash dialog showed only the amount field and the disabled message; `Open Dialer` and `Copy Full Code` were missing on a deployment where the staging behavior was expected.
- **Root cause:** The controls were behind a build-time `NEXT_PUBLIC_WALLET_USSD_ENABLED === "true"` check. E2E and preview launchers injected an empty value when unset, so the empty value behaved as disabled.
- **Guard:** The shared build resolver treats empty/unset values as enabled in every environment so the released UI cannot silently lose the controls. An explicit `NEXT_PUBLIC_WALLET_USSD_ENABLED=false` remains the kill switch. The enabled E2E test asserts the code, dialer URI, and copy control for Vodafone, Etisalat, and Orange; the wallet unit tests cover normalization and code shape.
- **Safety boundary:** These are sandbox-derived, carrier-unverified formats. The modal must never request a PIN/OTP or claim payment confirmation. Set the explicit flag to `false` if provider validation requires disabling the experimental controls.
