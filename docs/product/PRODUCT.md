# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

NexTap serves two audiences: an internal owner team that creates businesses and manages cards, and customers of those businesses who open a mobile business page from an NFC tap or QR scan. The owner team creates and updates profiles, manages pages and branches, publishes changes, and assigns cards. Business customers want to contact a business, find its location and hours, review it, and browse its services with minimal effort.

## Product Purpose

NexTap provides Egyptian businesses with NFC and QR cards that open a mobile business microsite. A visitor can find the business's contact channels, services, address, hours, social presence, external payment details, and review link in one place.

## Positioning

One persistent card destination serves both NFC taps and QR scans. Owners update the published business page and card assignment in the internal admin without replacing the physical card.

## Operating Context

The internal owner team uses a protected admin application for business and page creation, editing, section ordering, preview and publishing, branches, card assignment and reassignment, activation, batch manufacturing exports, and CSV exports. Visitors open a public page from a phone; primary actions should include WhatsApp, telephone, maps, opening hours, and reviews when those details exist.

## Capabilities and Constraints

- Next.js web application with Supabase-backed data, owner authentication, authorization, and row-level security.
- Public pages and admin tooling support Arabic RTL and English LTR; Arabic is the current default.
- Business pages are assembled from editable ordered sections and can represent contact, hours, social links, external payment information, links, services, galleries, reviews, and branches.
- Cards support QR/NFC resolution, activation, deactivation, assignment and reassignment; batches support manufacturing asset and CSV exports.
- Payments are business-provided external/contact details, including Egyptian options such as InstaPay, Vodafone Cash, and bank transfer. NexTap does not process payments.
- Card resolution must preserve stable card destinations while observing current activation, assignment, and published-page state.
- Preserve existing Supabase integrations and security boundaries. Do not add backend complexity or expose owner credentials.
- Current support for card batch manufacturing is under development; do not remove its changes or depend on unapplied migrations without evidence from the local project.

## Brand Commitments

The product name is NexTap and the supplied NexTap SVG logo is the brand asset. The visual direction uses light/off-white grounds, dark typography, and restrained gold accents from the logo. The supplied Synais screenshots are quality and composition inspiration only, not an identity or layout to duplicate.

## Evidence on Hand

- Brand mark: `public/nextap_logo_vector.svg`.
- Supplied card artwork: `assets/brand/card_design.pdf`.
- Routes, templates, workflows, tests, and database migrations in the repository document existing product behavior. No customer testimonials, named customer roster, or verified aggregate usage figures were provided; do not invent them.

## Product Principles

- One published destination can be reached by either a tap or scan.
- Put the business's most useful customer actions first on mobile.
- Let the owner update a destination without replacing a printed card.
- Make the card, business, and publish state operationally clear to the internal team.
- Support Arabic-first use while preserving a complete English LTR experience.
