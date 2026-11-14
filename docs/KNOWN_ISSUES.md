# Known Issues Index

Use the category files below to find verified recurring failures and their regression guards. This page is the stable entry point and contribution rule; issue details live in one category file only.

## Categories

- [Tooling and hooks](known-issues/tooling-and-hooks.md): setup, repository checks, hook behavior, and build tooling.
- [Test runner](known-issues/test-runner.md): Vitest and E2E discovery/runtime failures.
- [Cloudflare setup](known-issues/cloudflare-setup.md): local migration environment and credential-file handling.
- [Media](known-issues/media.md): managed upload and image-format contracts.
- [Payments](known-issues/payments.md): wallet/payment-provider behavior and safety boundaries.

## Add or Update an Issue

When a reusable failure is resolved, add one canonical entry to the matching category. Include the user-visible symptom, verified cause (or label it **Unconfirmed**), solution/workaround, and regression guard. Link the owning source, guide, and test where available. For issues spanning categories, keep one entry under the primary owning domain and cross-link it from other relevant category files. Remove or update an entry when its guard or behavior changes; do not copy dated task history here.
