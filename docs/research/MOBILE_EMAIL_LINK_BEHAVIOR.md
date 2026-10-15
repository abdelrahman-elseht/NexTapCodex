# Mobile email links: behavior, limits, and implementation decision

Evidence date: **2026-10-14**. Scope: research for the admin experience, inventory deletion, and provider-links feature handoff. No UI changes, external mail, production mutations, or real-device test runs were performed for this document.

## Recommendation

Keep a standards-based **`mailto:` link as the primary Email action**. Change the public renderer so email links navigate in the existing browsing context, and provide an explicit **Copy email** fallback with a visible, selectable email address. This is a sustainable mobile-first approach when the product treats opening an email composer as a request to the device, rather than a guaranteed delivery mechanism. The standard describes composing a message; it explicitly leaves URI resolution to the client, and the user can edit or cancel instead of sending. [S1]

Do not replace the primary action with a Gmail-only URL, a custom Android intent, browser sniffing, or a timed automatic fallback. Different visitors use different mail apps. The web page should preserve their choice and allow them to copy the address when their browser or device does not have a working handler. This is a product recommendation based on the handler model in the platform and browser sources, rather than a claim that every device behaves identically. [S2, S3, S4, S5]

## What the repository currently does

The inspected source is the current local working tree, not evidence of the exact deployment the user opened.

| Source | Current behavior | Implication for the feature |
| --- | --- | --- |
| [`src/components/business/public-snapshot.tsx:45`](../../src/components/business/public-snapshot.tsx#L45), `actionHref` | Trims the email `value`, checks a simple email regular expression, and returns `mailto:${address}`. | The email action already uses the standard scheme. Review address validation and URI encoding while changing navigation. |
| [`src/components/business/public-snapshot.tsx:64`](../../src/components/business/public-snapshot.tsx#L64), `ExternalLink` | Applies `target="_blank"` and `rel="noopener noreferrer"` to every link routed through this helper. | Email inherits a request for a new browsing context. |
| [`src/components/business/public-snapshot.tsx:86`](../../src/components/business/public-snapshot.tsx#L86), `SocialSection`; line 96, `QuickActions`; `GenericItems` in the same file | Non-payment links, including configured email links, use `ExternalLink`. | Cover email in social tiles, quick actions, generic rows, and nested item actions; do not fix only one visible button. |
| [`src/components/business/copy-payment.tsx:26`](../../src/components/business/copy-payment.tsx#L26) | Existing payment controls catch clipboard rejection and distinguish copied/failed states. | There is a local pattern for clipboard feedback, but payment-specific instructions and hidden recipient rules should not be copied into email UX. |

The current combination of a non-HTTP URI and `target="_blank"` is a plausible contributor to a blank tab: HTML chooses a target browsing context before navigation, and a non-fetch scheme can be handed to external software without producing a page document. [S6, S7] **This does not diagnose the user's Chrome incident.** Its cause could involve the deployment's actual markup, the desktop/mobile operating system, the installed/default mail app, Chrome's protocol-handler settings, or an application that is not configured. Record those facts before calling the issue fixed.

## Guarantees versus platform expectations

| Case | What primary sources establish | What still needs testing |
| --- | --- | --- |
| `mailto:person@example.com` | RFC 6068 defines the address syntax and composition semantics. It does not mandate the way a client resolves the URI. The action does not immediately contact a mail server or prove a message was sent. [S1] | Whether the chosen mail app opens, whether the recipient is correct, and what happens when the user cancels. |
| iPhone/iPad | Apple documents choosing a default Email app to open links for sending email. [S2] | Test actual Safari and Chrome on supported iOS versions with Apple Mail and a supported third-party app. Do not claim Apple's default-app documentation proves every browser/profile setting combination. |
| Android | Android's official developer examples use `ACTION_SENDTO` with the `mailto:` scheme to target email-capable apps; the example checks that an activity can resolve the intent before starting it. [S3] | Chrome-to-OS handoff, chooser behavior, selected app, configured account, and no-handler behavior on real Android devices. The native intent example is evidence of platform support, not a promise about all Chrome installations. |
| Desktop Chrome | Google's Chrome documentation describes protocol handlers as allowing a site to handle tasks such as creating an email message. WHATWG includes `mailto` among schemes that websites may register to handle, with user-agent-controlled registration. [S4, S5] | OS mail handler, registered/allowed webmail handler, blocked handler, and a machine without an email handler. Installing Chrome alone does not establish which app or website will handle mail. |
| In-app browsers and managed devices | HTML external-software navigation can involve prompts and restrictions, including sandboxing/user activation. [S7] | Browsers inside messaging/social apps, work-profile restrictions, and the ability to return to the business page. Treat these as environments to measure, rather than guaranteed failures. |

The user's successful iPhone test is useful evidence for that device and configuration. It cannot establish Android coverage or diagnose desktop Chrome. Conversely, one Chrome blank page does not invalidate `mailto:` as a platform-supported choice.

## Real-life limits

1. **A usable handler and account are external dependencies.** A browser can hand off, prompt, use a registered web handler, or display an error/other inline content. The web page does not install or configure a visitor's mail app. [S2, S3, S5, S7]
2. **Opening is not sending.** RFC 6068 allows the user to change or abandon the draft. The site must not show “Email sent”, “Email delivered”, or “Mail app opened” based solely on a click, a timeout, or the page becoming hidden. The ordinary hyperlink standards described here provide no delivery receipt or positive mail-app acknowledgement. [S1, S6, S7]
3. **`mailto:` is a composition link, not a contact-form transport.** If a future requirement demands accepting a message without a visitor's email app, that is a separate contact-form/backend feature with its own delivery, spam, and privacy requirements. [S1]
4. **Keep messages simple.** RFC 6068 supports address, subject, and a plain-text body. Do not rely on attaching files, formatting HTML email, populating arbitrary headers, or long message bodies across clients. The body field is intended for short text messages, and the creator cannot expect the resolver to understand more than subject/body. [S1, sections 2 and 4]
5. **Encoding matters.** `?`, `=`, `&`, `#`, and percent escapes have URI meaning. RFC 6068 prescribes percent encoding, including UTF-8 for appropriate fields and `%0D%0A` for body line breaks. A valid-looking address must not accidentally introduce a query/header or fragment. Common plus addressing must remain correct. [S1, sections 2 and 5]
6. **Copy can fail too.** The asynchronous Clipboard API is exposed in secure contexts and can reject writing when permission is not allowed. Retain a selectable address and honest error feedback even when the clipboard API is unavailable or denied. [S8]

## Proposed implementation contract

These are feature recommendations for review in the implementation handoff; this research did not apply them to the application.

- Render Email as a direct semantic anchor with a validated `mailto:` destination and an accessible name. Use the current browsing context: omit `target` where no inherited base target changes it, or explicitly use `_self`. Apply the same principle to `tel:` links when reviewing the shared link helper. Avoid `window.open`, redirect chains, and asynchronous JavaScript before the user-initiated native link activation. [S6, S7]
- Classify destinations by scheme/provider behavior in a small shared policy so that all public rendering paths use the same rule. Preserve the documented HTTPS/payment policies; an email fix should not accidentally change every external link.
- Provide a visible **Copy email** control beside or in a clearly reachable email detail affordance. Display the exact recipient address in selectable text, with left-to-right address direction in Arabic layouts. A user must find the fallback without the app guessing whether the composer opened.
- For English/Arabic, localize action/help/status copy. Suggested labels: “Email” / “البريد الإلكتروني”; “Copy email” / “نسخ البريد الإلكتروني”. Suggested help: “If your email app doesn't open, copy this address and use it in your preferred mail app.”
- A successful clipboard write may show “Email address copied.” A rejection should show “Couldn't copy. Select and copy the address below.” Announce feedback through an appropriate status region and keep focus predictable.
- Keep the link usable before hydration and when JavaScript is disabled. Clipboard enhancement may require JavaScript; reading/selecting the address should remain available.
- Do not require visitors to change device settings during the main flow. Optional help can explain that their default mail app/browser handler controls the handoff, and should avoid brittle settings paths for every OS version.
- Preserve authorization and existing content validation. Add meaningful cases for trimming, common plus addresses, URI delimiters, malformed email values, and hidden/disabled items. If subject/body are not a requested feature, do not introduce them just for this fix.

## Acceptance criteria for email

- Every enabled, valid email action in quick actions, social tiles, generic rows, nested item actions, published pages, and previews uses the intended direct `mailto:` URI with no `_blank` target or popup script.
- Tapping Email does not deliberately create an extra browser tab. On tested supported devices with a configured handler, the expected compose flow appears with the correct recipient. Record any OS/browser prompts as part of the result.
- A visitor can obtain the email address even when no handler opens or clipboard writing fails. The page does not claim launch, send, or delivery success.
- Copy writes the plain email address, not the `mailto:` prefix. Success/failure messages match the actual result, are localized, and remain accessible to keyboard/screen-reader users.
- Canceling the composer and returning to the browser leaves the business page usable. Nested links/buttons are avoided, and the copy action does not trigger the email anchor.
- Phone, payment, and ordinary HTTPS links retain their accepted behavior, including the existing payment same-context navigation requirement.
- Automated evidence and real-device evidence are recorded separately; browser emulation is never described as proof of native email-app launch.

## Validation matrix

No entries below have been executed for this research. Use dedicated fixture addresses; **open and cancel drafts only, without sending mail**.

| Environment | Setup | Checks | Evidence required |
| --- | --- | --- | --- |
| Real iPhone, Safari | Configured Apple Mail default | Correct recipient, no deliberate blank tab, cancel/back, copy fallback | iOS/browser version, default app, observed result |
| Real iPhone, Chrome | Same device/default, then a supported third-party default app | Correct handler/recipient, prompts, return path, copy | iOS/Chrome/app versions and default configuration |
| Real Android, Chrome | Gmail installed with a configured account | Composer recipient, chooser/default behavior, cancel/back | Android/Chrome/app versions and app-selection state |
| Real Android, Chrome | Another email app, such as Outlook, with a configured account | Selected/default app respected, recipient preserved, return path | Same configuration evidence |
| Android, Chrome | No usable email handler/account; dedicated test device/profile | Record actual OS/browser behavior; address/copy remain usable | Observed behavior, without assuming a specific error dialog |
| Desktop Chrome | Working OS mail handler | Correct recipient, no deliberate blank tab, cancel/back | OS/Chrome/default app versions |
| Desktop Chrome | A registered and allowed webmail handler | Correct webmail compose flow and recipient | Handler/provider and settings state |
| Desktop Chrome | No handler or disallowed handler | Record actual behavior; manual address fallback works | OS/Chrome/settings and resulting tab state |
| Real iOS/Android in-app browser | A business URL opened inside a representative messaging/social app | Native handoff/prompt if permitted; manual fallback; return path | Host app, OS, browser surface, actual result |
| Playwright/e2e desktop and mobile viewport | Public test fixtures; controlled clipboard success/rejection | URI/target attributes; email fallback; Arabic/English; keyboard/focus; public/preview parity | Test output and screenshots/trace where useful |

Use the existing **e2e** runner for repository browser journeys. Use **Playwright MCP** or **chrome-devtools-axi** for inspecting actual link attributes, the browser's tabs, console errors, and public/preview behavior. A desktop Playwright browser or mobile viewport does not reproduce the operating system's email resolver, installed apps, or accounts. Real-device results close that remaining gate.

Useful automated assertions: the expected email anchor has exactly the intended `href`; its `target` is absent or `_self`; no application popup logic is invoked; Copy email resolves/rejects with corresponding status; invalid/disabled emails are not rendered as actionable unsafe links; Arabic layout preserves an understandable email address. Do not make an automated pass depend on sending mail or opening the agent operator's personal mail application.

## Source register

All successful sources below were read on **2026-10-14**. They establish standards/platform capabilities; they are not device-test evidence for NexTap.

- **S1 — IETF/RFC Editor, RFC 6068, “The 'mailto' URI Scheme”.** [Plain-text RFC](https://www.rfc-editor.org/rfc/rfc6068.txt), [RFC information and HTML rendering](https://www.rfc-editor.org/info/rfc6068/). Sections 2–5 define syntax, composition semantics, header limits, and encoding. Section 3 explicitly says that URI specifications do not mandate how a scheme is resolved.
- **S2 — Apple Support, “Change your default apps for features on iPhone and iPad”.** [Official support article](https://support.apple.com/en-us/121430). Lists Email as the app used when opening links to send email; the article's guidance refers to updated OS versions and supported apps.
- **S3 — Android Developers, “Common intents”, Email section.** [Official platform documentation](https://developer.android.com/guide/components/intents-common#Email). Shows `ACTION_SENDTO` plus `mailto:` for email-capable apps and checks `resolveActivity` before calling `startActivity`.
- **S4 — Google Chrome Help, “Change site settings permissions”, Computer.** [Official Chrome support article](https://support.google.com/chrome/answer/114662?hl=en). Describes Protocol Handlers and creating a message in an email client.
- **S5 — WHATWG HTML Standard, “Custom scheme handlers: the registerProtocolHandler() method”.** [Specification](https://html.spec.whatwg.org/multipage/system-state.html#custom-handlers). Includes `mailto` in the scheme allowlist and describes user-agent-controlled registration.
- **S6 — WHATWG HTML Standard, “Following hyperlinks”.** [Specification](https://html.spec.whatwg.org/multipage/links.html#following-hyperlinks). Selects a target navigable before navigating the href.
- **S7 — WHATWG HTML Standard, “Non-fetch schemes and external software”.** [Specification](https://html.spec.whatwg.org/multipage/browsing-the-web.html#non-fetch-schemes-and-external-software). Allows external handoff without changing the target document, or inline error/handler UI, and describes activation, sandbox, and confirmation considerations.
- **S8 — W3C, “Clipboard API and events”, `writeText` and permission/security sections.** [Specification](https://w3c.github.io/clipboard-apis/#dom-clipboard-writetext). Secure-context API, asynchronous success, and rejection when a clipboard write is not allowed. [Mozilla's API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) confirms practical secure-context and `NotAllowedError` behavior.

## Open facts to record before release

- Which Chrome platform exhibited the blank page: desktop Windows/macOS, Android, or iOS; exact versions and handler/default-app state.
- Which deployed page/preview and link location reproduced the report, and the deployed anchor's exact href/target.
- The feature branch's chosen no-handler fallback presentation, covered in both supported languages.
- Actual physical-device results and any supported-browser exception accepted by the product owner. Do not mark these complete from source inspection or browser viewport emulation.
