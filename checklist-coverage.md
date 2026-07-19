# Checklist coverage matrix

Maps the Notion "Vitrin (Theme) Checklist" (~116 checks across 10 groups) to how each
item gets tested. Three classes:

- **A = Automatable** — deterministic browser/HTTP assertion, data-agnostic. Built or trivially buildable.
- **S = Semi (screenshot-assisted)** — automation captures a screenshot / DOM state; a human confirms visual correctness, OR it becomes fully automatable with a fixture store + visual baseline.
- **M = Manual** — subjective/visual judgement or needs specific merchant config that only a human can confirm.

| Group | Items | A | S | M | Notes |
|-------|------:|--:|--:|--:|-------|
| Main Page (incl. Footer) | 15 | 9 | 4 | 2 | favicon, logo, cart icon, languages, footer blocks, copyright default = A. "consistent fonts", shipping/payment logos "align with design" = S. Multiple-Inventory popup, loyalty program = M (needs config). |
| Menu & Category | 7 | 6 | 1 | 0 | menu reflects dashboard, 3-level nav, breadcrumb, All Products/All Categories, category redirect = A. Category cover/image display = S. |
| Search & Listing | 11 | 10 | 1 | 0 | enter-to-search, valid/invalid query, filters, price filter, sort options, pagination >24 = A. Filter visual layout = S. |
| Products | 43 | 28 | 11 | 4 | name/price/currency, alt text, variant gating, out-of-stock + notify, quantity limits, low-stock, VAT-exempt = A. Image quality, badge styling, "easily distinguishable discounts" = S. Bundle offers, custom fields correctness = M (needs configured products). |
| Cart | 21 | 15 | 3 | 3 | add/remove/qty, coupon valid+invalid messages, empty-cart blocks checkout, continue-shopping, proceed-to-payment redirect, invoice lines = A. Loyalty redeem, shipping progress bar = S. Dynamic bundle in cart, gifting = M (needs config). |
| Shipping & Payments | 5 | 3 | 2 | 0 | redirect + section presence = A. Logos/details layout = S. |
| Additional Pages | 3 | 3 | 0 | 0 | 404 page, blog HTML render, FAQ display = A. |
| Customer Account | 5 | 5 | 0 | 0 | profile icon redirect, side menu, "no customization / rendered from Zid" = A (assert route served by platform, not overridden). |
| Customer-related Pages | 5 | 5 | 0 | 0 | Personal info/orders/wishlist/addresses/checkout "uncustomized" = A (same platform-route assertion). |
| Mobile Screen | 1 | 0 | 1 | 0 | mobile viewport screenshot + no horizontal overflow = S. |
| **Total** | **116** | **84** | **23** | **9** | ~72% fully automatable, ~20% screenshot-assisted, ~8% stays manual. |

## Reading the numbers
- **84 checks (72%)** can run with zero human involvement — this is the bulk of the QA time savings.
- **23 checks (20%)** get a screenshot + DOM snapshot attached to the report so the reviewer confirms in seconds instead of clicking through the store. With a fixture store + visual baselines, most of these move to fully automatable.
- **9 checks (8%)** stay manual because they depend on specific merchant configuration or genuine visual taste (bundle offers, loyalty, "aligns with theme design").

## Keeping this in sync
The Notion checklist is the source of truth. A small sync step (read the public checklist,
map each item's stable ID to a test) keeps this matrix and the E2E suite aligned as the
checklist evolves — no manual re-transcription of the 116 items.

## Sections axis (cross-cutting)
Beyond the 116 checklist items, the theme ships **N sections** (27 in the sample theme) that
render on the storefront via the editor. These are covered separately and data-driven:

- `enumerate_sections.py` lists every section + its isolated render status (from `/validate`) → `sections.json`.
- `tests/05_sections.spec.js` runs, per section: **visible on page (A), no broken images (A),
  no console errors (A), + screenshot for visual review (S)** — on desktop and mobile.

Fully automatable once (a) a kitchen-sink preset places every section, and (b) each section emits
a stable `data-section-type` hook. Until then it runs against the current preview and skips (with an
actionable message) any section it can't locate — never a false pass.
