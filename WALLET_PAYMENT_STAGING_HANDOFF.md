# Wallet payment Staging handoff

Status: wallet USSD implementation is deployed to the protected Staging branch and passed local plus hosted public QA. No Production changes were made. The Staging feature flag remains disabled, so visitors do not see experimental codes or dialer actions.

## Implementation

- Reused existing provider-aware payment items and profile resolution. Per-item profileOverride values remain independent through the existing Draft/Preview/Save/Publish storage path; no Supabase schema change was needed.
- Wallet recipient fields are text inputs with autoComplete off so leading zeroes are preserved. Saved Egyptian +20 values, including spaced values, normalize to local 01... values for the experimental builder.
- Vodafone Cash, e& money, and Orange Cash open an amount-only localized modal. InstaPay keeps its existing instructions/copy flow.
- Sandbox-derived formats are: Vodafone *9*7*{recipient}*{amount}#; e& *777*1*{recipient}*{amount}#; Orange #7115*1*{amount}*{recipient}#.
- Amounts must be positive with at most two decimal places. The exact generated code is copied only after an explicit user action; # is encoded in tel links.
- Experimental code display, copy, and dialer controls render only when NEXT_PUBLIC_WALLET_USSD_ENABLED=true. Staging currently leaves this unset. No PIN/OTP collection, automatic transfer, or payment confirmation was added.
- The reference file is sandbox material with fictional recipients and GHS examples. It does not validate Egyptian EGP carrier behavior.

## Changed files

- e2e.config.ts
- src/app/admin/businesses/_components/item-editor.tsx
- src/app/globals.css
- src/components/business/copy-payment.tsx
- src/lib/business/wallet-ussd.ts
- tests/unit/wallet-ussd.test.ts
- tests/e2e/wallet-payment.e2e.ts

Pre-existing workspace changes were preserved and are not part of the implementation commit: .gitignore, next-env.d.ts, docs/refrence/, and WALLET_PAYMENT_SOL_6_1_CONTINUATION_PROMPT.md.

## Staging deployment

- Branch: staging
- Source commit: ef30ab8786f38dc11e4afe03dcb2c853f9540702
- Git push: origin/staging advanced from c1332a077e3e9e1079eaa4e19bc0236403174aac; the remote reported its configured protected-rule bypass for the direct Staging instruction.
- Vercel deployment: dpl_BS48qPzRJPe9vjY915jRE3i4vyf8
- Deployment URL: https://nextap-ajm36qjib-abdelrahman-867e.vercel.app
- Stable Staging alias: https://staging.nextap.services
- Vercel build status: Ready; the build cloned branch staging at commit ef30ab8 and completed successfully.
- NEXT_PUBLIC_WALLET_USSD_ENABLED: disabled on Staging. No Production deployment, domain, Supabase project, DNS, or customer record was changed.

## Acceptance results

| Criterion | Result | Evidence and limitation |
|---|---|---|
| Admin wallet numbers save and persist independently | UNVERIFIED | No authorized authenticated Admin mutation fixture was run, so no Staging records were changed. Existing per-item/profileOverride paths were inspected and covered by existing local tests. |
| Provider icons open the corresponding modals | PASS | Local disabled E2E and hosted Staging E2E opened Vodafone, e& money, and Orange modals on desktop and mobile browser targets. |
| Amount is the only required visitor input | PASS | The modal exposes only the localized Amount (EGP) input before the experimental actions. |
| Recipient and amount generate each provider code | PARTIAL / UNVERIFIED | Unit tests cover all three field orders, leading-zero preservation, spaced +20 normalization, positive amount validation, and dialer escaping. Enabled local browser E2E confirms code and dialer controls for all three providers. The formats remain sandbox-derived and are not carrier-verified. |
| Open Dialer and Copy Full Code | PARTIAL / UNVERIFIED | Enabled local browser E2E verifies the controls and URI shape. Staging keeps the flag disabled; browser emulation cannot prove a real dialer or clipboard on a carrier device. |
| Unsupported-device fallback | PARTIAL | The modal explains copy as a fallback and handles clipboard failure in code. Unsupported-device and real clipboard-denial behavior were not independently exercised for wallet actions. |
| Arabic/English, RTL/LTR, and responsive layout | PARTIAL | Arabic/English strings and dir/lang handling are implemented. Desktop/mobile browser coverage is English-only; Arabic visual and accessibility review remain unverified. |
| InstaPay remains unchanged | PASS | Local and hosted focused E2E confirm the existing InstaPay instructions dialog remains separate and no wallet dialog is opened for InstaPay. |
| Existing business workflows remain functional | UNVERIFIED hosted; local checks PASS | Typecheck, unit tests, lint, and build pass. Authenticated Admin Draft/Preview/Publish persistence was not run against a fixture. |
| Independent QA has no unresolved critical failures | UNVERIFIED | No local application failures remain in tested paths, but Admin persistence and real-device/provider compatibility are still open acceptance items. |

Provider status: Vodafone Cash UNVERIFIED, e& money UNVERIFIED, Orange Cash UNVERIFIED. All three match the supplied sandbox ordering only.

## Verification evidence

- npm.cmd run typecheck: PASS after the final source/test edits.
- npm.cmd run lint: PASS, 13 existing warnings and 0 errors.
- npm.cmd test -- --maxWorkers=1 --minWorkers=1: PASS, 32 files and 203 tests.
- npm.cmd run build: PASS locally. The Vercel Staging build also completed successfully.
- Local disabled wallet E2E: run 01a16973-4eda-704d-b7b8-5599526b230e, 2/2 desktop/mobile, http://127.0.0.1:3137/demo. It covers all three modal opens, amount field, disabled-state fallback, and the separate InstaPay dialog.
- Local enabled wallet E2E: run 01a16961-73ee-709e-8c42-f9967bface6b, 2/2 desktop/mobile. It covers all three provider code surfaces, Open Dialer URI shape, and Copy Full Code visibility. This is browser emulation only.
- Hosted Staging wallet E2E: run 01a16972-4a9b-76f0-ab8f-0cbeab225a69, 2/2 desktop/mobile, base origin https://staging.nextap.services. Vercel SSO protection was handled by the repository's host-only cookie bootstrap; the experimental flag remained disabled.
- Latest local report: .e2e/report.json records run 01a16973-4eda-704d-b7b8-5599526b230e.
- Local screenshots:
  - .e2e/artifacts/desktop/tests_e2e_wallet-payment.e2e.ts__wallet_20payment_20actions_20open_20an_20amount-only_20modal_20with_20sandbox_-25299da6/default/attempt-0/screenshots/001-wallet-payment-modal.png
  - .e2e/artifacts/desktop/tests_e2e_wallet-payment.e2e.ts__wallet_20payment_20actions_20open_20an_20amount-only_20modal_20with_20sandbox_-25299da6/default/attempt-0/screenshots/002-wallet-payment-modal.png
  - .e2e/artifacts/desktop/tests_e2e_wallet-payment.e2e.ts__wallet_20payment_20actions_20open_20an_20amount-only_20modal_20with_20sandbox_-25299da6/default/attempt-0/screenshots/003-wallet-payment-modal.png
  - .e2e/artifacts/mobile/tests_e2e_wallet-payment.e2e.ts__wallet_20payment_20actions_20open_20an_20amount-only_20modal_20with_20sandbox_-25299da6/default/attempt-0/screenshots/001-wallet-payment-modal.png
  - .e2e/artifacts/mobile/tests_e2e_wallet-payment.e2e.ts__wallet_20payment_20actions_20open_20an_20amount-only_20modal_20with_20sandbox_-25299da6/default/attempt-0/screenshots/002-wallet-payment-modal.png
  - .e2e/artifacts/mobile/tests_e2e_wallet-payment.e2e.ts__wallet_20payment_20actions_20open_20an_20amount-only_20modal_20with_20sandbox_-25299da6/default/attempt-0/screenshots/003-wallet-payment-modal.png
- Matching local traces are in each desktop/mobile attempt-0/trace/trace.zip directory beside the screenshots. Artifacts are redacted by the runner.

## Bugs fixed

- Wallet builder normalization now accepts the spaced +20 values used by the demo and stored profiles while retaining strict Egyptian mobile validation.
- The focused E2E now covers all three wallet providers. Its enabled-state URI assertion accepts valid Vodafone/e& tel:*...%23 and Orange tel:%23...%23 forms.
- The earlier InstaPay expectation and screenshot-helper API issues were corrected; both were test-fixture issues, not application defects.

## Remaining limitations

- No authenticated Admin independent-recipient or Draft/Preview/Publish persistence journey was run.
- No Arabic visual/accessibility journey was run.
- No real device, dialer, clipboard, SIM, carrier, or provider contract test was run. Browser emulation does not establish carrier compatibility.
- Keep the Staging/public flag disabled until authoritative provider documentation and real-device testing validate each format.

## Production readiness

NOT READY. Do not enable NEXT_PUBLIC_WALLET_USSD_ENABLED or release the sandbox-derived formats to Production. Real-device carrier compatibility remains UNVERIFIED. This handoff stops before Production.
