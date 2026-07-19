# QA fixture store — data specification (for Zid platform)

Every submitted theme is rendered against **one Zid-controlled test store** with fixed,
known data. Because the data never changes, tests can assert exact values ("price is 100.00
SAR", "coupon TEST10 gives 10% off") instead of vague presence checks. This is what moves
~23 checklist items from "screenshot-assisted" to "fully automatic".

Set up this data once; the E2E suite reads the same known values from `fixtures.json`.

## Store settings
| Setting | Value |
|---------|-------|
| Languages | Arabic + English both enabled |
| Default currency | SAR (ر.س) |
| VAT number | `300000000000003` (test) |
| Commercial registration | `1010000000` (test) |
| Business address | fixed test address, shown in footer |
| Multiple inventory / countries | at least 2 countries enabled (e.g. SA, AE) |
| Loyalty program | enabled, known points rule |
| Store orders | open (a second variant of the store, or a toggle, for the "orders closed" check) |

## Products (fixed slugs so tests can deep-link)
| Slug | Name | Purpose | Key known values |
|------|------|---------|------------------|
| `qa-standard` | Standard Product | baseline PDP + card | price **100.00 SAR**, in stock, no variants |
| `qa-variants` | Variable Product | variant gating, price/image change | variants S/M/L; **M = 120.00**; size **L out of stock**; cannot add to cart without selecting |
| `qa-discount` | Discounted Product | discount display | regular **200.00**, sale **150.00** (**25% off**) |
| `qa-oos` | Out of Stock Product | OOS + notify | qty 0, shows `notify-availability`, add-to-cart disabled |
| `qa-lowstock` | Low Stock Product | low-stock indicator | qty **2**, shows low-stock tag |
| `qa-vat-exempt` | VAT-Exempt Product | VAT-exempt indicator | flagged exempt |
| `qa-qty-limit` | Quantity-Limited Product | quantity limit message | max per order **3** |
| `qa-bundle` | Bundle Product | bundle offer tag + cart | part of bundle "buy 2 get discount" |
| `qa-custom-fields` | Custom Fields Product | custom fields render | 1 text custom field, 1 dropdown |

## Categories (3-level tree)
```
qa-cat-a  (level 1)          → contains qa-standard, qa-discount
  └ qa-cat-a1 (level 2)      → contains qa-variants
      └ qa-cat-a1a (level 3) → contains qa-lowstock
```
Each category has a title, description, image and cover set (for CAT display checks).

## Coupons
| Code | Behaviour | Test |
|------|-----------|------|
| `TEST10` | valid, **10% off** cart | coupon apply success |
| `EXPIRED0` | expired/invalid | coupon error message (CART-coupon) |
| `MINSPEND` | valid only above a min cart value | min-spend / error path |

## Shipping & payments
| Item | Requirement |
|------|-------------|
| Shipping methods | ≥ 2, each with a logo; one with **Cash on Delivery** enabled; known covered cities + price |
| Payment methods | ≥ 2, each with a logo |
| Bank accounts | ≥ 1, with full known details |

## Content pages
| Page | Fixture |
|------|---------|
| Blog | 1 post whose body contains known **HTML** (heading + list) to verify HTML rendering |
| FAQ | 1 known question + answer |
| 404 | (no fixture — hit a random URL) |

## Search
Ensure `qa-standard` is findable by the keyword **"standard"**, and that the keyword
**"zzzq-nonexistent"** returns zero results (for the no-results test).

## Machine-readable companion
Ship a `fixtures.json` next to the tests mirroring the values above, e.g.:
```json
{
  "currency": "ر.س",
  "products": {
    "standard": { "slug": "qa-standard", "price": "100.00" },
    "variants": { "slug": "qa-variants", "priceM": "120.00", "oosVariant": "L" },
    "discount": { "slug": "qa-discount", "regular": "200.00", "sale": "150.00", "pct": 25 }
  },
  "coupons": { "valid": "TEST10", "invalid": "EXPIRED0", "discountPct": 10 },
  "search": { "hit": "standard", "miss": "zzzq-nonexistent" }
}
```
Tests import `fixtures.json`, so if the store data changes, you update one file — not the tests.

## Section coverage — via the partner's own preset (no new preset needed)
Partners already export their theme customization as a **preset JSON** and upload it with the
theme (Partner Dashboard → Customize → Export → upload with the version). That file is the
machine-readable list of which sections the partner placed on each page and their settings —
so it is exactly what section testing needs, and it is already part of the submission.

So we do **not** ask anyone to build a special "all sections" preset. Instead the pipeline:
1. takes the uploaded preset JSON as an input,
2. parses it to list the configured sections per page (`presets[].path` + `settings`),
3. `tests/05_sections.spec.js` verifies each of those renders on the test-store preview.

Sections the theme ships but the partner did **not** place are still covered by the isolated
render check in `/validate`. This tests exactly what the merchant would actually see.

> Note for our team (not the platform team): to finalize the preset parser we need **one
> populated preset example** (with real sections). The sample we have has empty `settings: {}`.
