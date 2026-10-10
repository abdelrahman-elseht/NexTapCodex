> Follow-up decision (2026-10-09): the user explicitly requested that complete payment URLs pasted into Provider link open directly. These owner-supplied HTTPS URLs now use `external_url` and same-tab navigation. They take priority over clipboard fallback. The findings below still constrain generated links and claims of an official `verified_deep_link` contract; they do not block opening an explicitly supplied link. No real recipient URL/token is recorded here.

# Payment provider destination research

Research date: 2026-10-09 (UTC)

## Implementation recheck (2026-10-09)

The official InstaPay home and Q&A URLs below and Vodafone's Money Transfer URL were fetched again during implementation, all returning HTTP 200. InstaPay describes the mobile app's Send Money to IPA flow and beneficiary verification; Vodafone still documents `*9*7#`, recipient number, amount, and PIN. No recipient-prefill URL/URI grammar or token encoding was documented on these sources. The InstaPay pages reviewed did not link to `ipn.eg`; its ownership and `/S/x/` token contract remain unverified. No example token was visited, generated, or used as a destination.

| Provider | Supported surface verified in sources | Exact recipient-prefill URL/URI grammar | Recipient fields allowed in a NexTap destination |
| --- | --- | --- | --- |
| InstaPay | Official mobile-app flow; web Q&A is help, not a payment handoff | None documented in the reviewed sources | None verified; IPA/mobile identifiers are in-app beneficiary inputs only |
| Vodafone Cash | Egyptian Vodafone service flow initiated with `*9*7#`; web page is help | None documented in the reviewed source | None verified; recipient phone and amount are entered in the provider flow |

Implementation decision: preserve `copy_identifier` for InstaPay and Vodafone Cash. An intentional card action copies the configured identifier without displaying it, then opens identifier-free provider instructions. Clipboard failure asks the payer to obtain details directly from the business. `instructions` displays generic guidance only, including for bank transfers. Provider `external_url` or unverified deep-link overrides cannot bypass the recipient-prefill gate. Custom external checkout URLs retain their explicit `external_url` behavior. The fallback is the same on desktop, mobile, and devices without the app. NexTap never submits or confirms a payment.

This note records first-party provider documentation checked for recipient identifiers,
transfer flows, and recipient-prefill/deep-link support. A provider page describing an
in-app or USSD flow is not evidence that a public web URL or mobile URI scheme exists.
NexTap must not process a payment or manufacture an undocumented scheme.

## InstaPay (Egypt)

**First-party sources**

- [InstaPay official Q&A](https://www.instapay.eg/?page_id=348&lang=en), page published 10 December 2021 (the official search result metadata), accessed 2026-10-09.
- [InstaPay official home page](https://www.instapay.eg/?lang=en), accessed 2026-10-09.

The official Q&A says that an Instant Payment Address (IPA) is a simplified per-app
address that can be used to send and receive money instead of full bank details, and
shows the form `name@instapay`. It lists the supported beneficiary details as:

- IPA (Instant Payment Address)
- mobile number
- digital-wallet mobile number
- bank account number or IBAN
- a debit, credit, or prepaid card for a member bank

For receiving money, the same Q&A says to share an IPA or mobile number, or initiate a
collect request. It also says that InstaPay retrieves beneficiary information recorded
at the bank as an additional validation step for IPA and mobile-number transfers. These
are identifiers and in-app operations, not a public URL format.

The official pages do **not** publish a `https://` payment URL, Android intent, iOS
universal link, custom URI scheme, or documented query parameters that prefill an IPA,
mobile number, amount, or collect request. No recipient-prefill deep link is therefore
verified for InstaPay as of the research date. Do not emit an invented URL such as an
`instapay://` link.

**Implementation recommendation**

- Treat InstaPay destinations as `copy_identifier` when the business supplies an IPA
  or permitted recipient mobile identifier. Keep the identifier out of public card text
  and accessibility names; reveal it only in an intentional copy action or secure
  instructions flow.
- Treat collect requests as `instructions`; the payer must start/approve the request in
  the official InstaPay app.
- An `external_url` may point to the official InstaPay site for general information, but
  it is not a payment action and must not claim recipient prefill.
- Use `verified_deep_link` only if InstaPay publishes a first-party scheme/contract in
  future documentation and the implementation pins that exact format.

## Vodafone Cash (Egypt)

**First-party sources**

- [Vodafone Egypt official Vodafone Cash page](https://web.vodafone.com.eg/en/vodafone-cash), accessed 2026-10-09. The page has no visible publication date.
- [Vodafone Egypt official Money Transfer page](https://web.vodafone.com.eg/en/money-transfer), accessed 2026-10-09. The page has no visible publication date.

Vodafone's official Vodafone Cash page describes the service as an e-wallet and links
to the Money Transfer page. It states that money can be transferred to any Vodafone
number in Egypt. The official Money Transfer page gives the concrete flow:

1. Dial `*9*7#`.
2. Choose the money-transfer service.
3. Enter the mobile number receiving the transfer.
4. Enter the amount (the page states 5 EGP to 60,000 EGP).
5. Enter the Vodafone Cash PIN.

The page also states that the recipient need not already be registered for Vodafone
Cash and lists transfer fees and limits. This is an official USSD/app/service flow;
it does not define a web URL, Android intent, iOS universal link, or custom URI scheme
that accepts a recipient number or amount.

The official pages do **not** document recipient-prefill deep links. No verified public
Vodafone Cash payment URI was found as of 2026-10-09. Do not invent a `vodafonecash://`
scheme, append a phone number to an undocumented URL, or imply that NexTap can submit
the transfer.

**Implementation recommendation**

- Treat a Vodafone Cash recipient phone number as `copy_identifier` only. Do not place
  the number in visible public card text, `aria-label`, image alt text, or an href.
- Provide an `instructions` action that opens the user's normal dialer/USSD entry point
  only if the product can do so without embedding undocumented recipient parameters;
  otherwise show the official `*9*7#` steps and let the payer enter the number in the
  Vodafone flow.
- An `external_url` may link to Vodafone's official Money Transfer page as help content,
  but it is not a prefilled payment destination.
- Use `verified_deep_link` only after Vodafone publishes a first-party scheme and
  recipient-prefill contract.

## Destination-strategy decision table

| Provider | Recipient data documented by provider | Verified recipient-prefill deep link | Safe default strategy | Notes |
| --- | --- | --- | --- | --- |
| InstaPay | IPA (`name@instapay`), mobile number, digital-wallet mobile number, bank/IBAN, supported card; collect request | None found in official docs | `copy_identifier` or `instructions` | The app performs beneficiary validation and authorization. |
| Vodafone Cash | Vodafone mobile number; USSD transfer flow | None found in official docs | `copy_identifier` or `instructions` | Official flow is `*9*7#`; payer enters recipient and amount in Vodafone's flow. |
| Any provider without a published scheme | Provider-specific identifier only | Unverified | `copy_identifier` or `instructions` | Never infer a URI scheme from a brand name or a third-party article. |

`external_url` is appropriate for an official help/provider page. It is not equivalent
to a payment deep link and must not be presented as recipient-prefilled. `verified_deep_link`
is reserved for a URL/URI format explicitly published by the provider and confirmed to
carry only the recipient information the provider says it supports.

## Scope and source limitations

This is a documentation review, not a payment attempt. Provider sites can change their
flows; re-check the linked first-party pages before adding a deep-link strategy. No
credentials, recipient values, or payment transactions were used. NexTap remains a
directory/action surface and does not process or confirm payments.
