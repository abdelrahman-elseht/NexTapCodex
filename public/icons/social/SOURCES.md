Social brand icons are vendored from the Simple Icons project: https://github.com/simple-icons/simple-icons
Each SVG is distributed under CC0 1.0 Universal (public domain dedication). Simple Icons versions and brand records can be checked in its package metadata and icon source. Assets are stored locally so public profile views do not depend on a third-party icon CDN.
Files currently included: Facebook, Google, Instagram, LinkedIn, Messenger, Pinterest, Snapchat, Telegram, TikTok, WhatsApp, X, and YouTube.

LinkedIn is a locally hosted monochrome adaptation of the LinkedIn brand mark for icon-only use. InstaPay and Vodafone Cash use the supplied local monochrome SVGs under `public/icons/payment/`; Orange Cash uses its local SVG, and Etisalat Cash uses an in-code wordmark. See `../payment/SOURCES.md` for the current payment asset provenance and source decisions.

Payment asset sources and licensing:

- `instapay.png`: downloaded from the official InstaPay Egypt website media asset at https://www.instapay.eg/wp-content/uploads/2022/03/logo.png on 2026-10-09. It is used only as a provider identifier; NexTap does not imply endorsement or process payments. The source site did not expose a separate asset license, so the original URL is retained for review and replacement if its terms change.
- `vodafone.png`: rasterized locally from the official Vodafone Egypt logo geometry embedded in the public Vodafone Cash page at https://web.vodafone.com.eg/en/vodafone-cash on 2026-10-09. It is used only as a provider identifier; NexTap does not imply endorsement or process payments. The local SVG fallback remains under the same directory.
- `linkedin.svg`: monochrome local adaptation of the LinkedIn mark, based on the Simple Icons project (CC0 1.0) and normalized to black for consistency with the social icon set.

- `dribbble.svg`, `medium.svg`: existing local monochrome wordmark placeholders created for NexTap provider identification; no remote dependency.

Provider artwork updated 2026-10-15 (Africa/Cairo):

- `github.svg`, `behance.svg`, `artstation.svg`: actual monochrome paths vendored unchanged from Simple Icons **13.21.0**, replacing the prior text rectangles. Exact URLs: `https://raw.githubusercontent.com/simple-icons/simple-icons/13.21.0/icons/{github,behance,artstation}.svg`. [Pinned license](https://raw.githubusercontent.com/simple-icons/simple-icons/13.21.0/LICENSE.md): CC0 1.0. The upstream [source register](https://raw.githubusercontent.com/simple-icons/simple-icons/13.21.0/_data/simple-icons.json) cites `https://github.com/logos`, `https://www.behance.net`, and `https://www.artstation.com/about/logo`, respectively. Brand/trademark rights remain with their owners; CC0 does not imply endorsement.
- `talabat.svg`: official [Talabat website logo](https://www.talabat.com/assets/images/remix-logo.svg), observed on `https://www.talabat.com/egypt`. Original letter geometry retained; orange backing removed, cream letter fill changed to black, and viewBox cropped to `20 14 185 42` for icon use. No separate permissive asset license was exposed; used only to identify the provider.
- `fast.png`: official [Google Play listing artwork](https://play-lh.googleusercontent.com/B83S5Y5SonEHhwem0CbDO0oyo1RmTdWoRuA2QQ9C0y1LNfZzg_kWY0ayvHUlmAqnuwj_2cXWqbRze-fi7Jrr0g=s0-br30) from the exact `com.ZED.zid_app` listing. Converted from the 512×512 source to a 361×361 transparent monochrome PNG by retaining the existing white artwork as black, removing its red background, and adding centered padding. No tracing or generated geometry. The supplied Apple app `1671447192` shows matching artwork. No separate permissive asset license was exposed; used only to identify the provider.

See [delivery-provider research](../../../docs/research/DELIVERY_PROVIDER_BRAND_SOURCES.md) for exact primary-source links, audience/destination limitations, conversion details, and the pending physical-device checks. All five assets are served locally; no external icon CDN is required.
