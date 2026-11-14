# Payments

## Wallet USSD actions missing

- **Symptom:** The Vodafone Cash dialog showed the amount field and disabled message, but not `Open Dialer` or `Copy Full Code` where staging behavior was expected.
- **Verified cause:** Controls depended on build-time `NEXT_PUBLIC_WALLET_USSD_ENABLED === "true"`; E2E and preview launchers supplied an empty value when unset, which behaved as disabled.
- **Solution:** The shared build resolver treats empty/unset values as enabled in every environment; explicit `NEXT_PUBLIC_WALLET_USSD_ENABLED=false` remains the kill switch.
- **Regression guard:** The enabled E2E test checks code, dialer URI, and copy control for Vodafone, Etisalat, and Orange; wallet unit tests check normalization and code shape.
- **Safety boundary:** These are sandbox-derived, carrier-unverified formats. Never request a PIN/OTP or claim payment confirmation. Disable the experimental controls if provider validation requires it.
