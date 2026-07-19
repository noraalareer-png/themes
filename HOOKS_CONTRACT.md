# Theme QA hooks contract (for theme partners)

To let automated QA reliably find and test elements in **any** theme, themes must expose a
small set of stable attributes. Without these, tests guess at CSS class names, which differ
per theme and break constantly. These hooks are invisible to shoppers and cost nothing
visually — they only carry meaning for tests and tooling.

Two attributes:

- `data-testid="..."` on interactive / asserted elements.
- `data-section-type="<section-name>"` on each section's root element (the `<name>` from
  `sections/<name>.jinja`).

Rules:
- Values are **lowercase kebab-case**, exactly as listed below (tests match them literally).
- A hook must be **unique per page** unless it's a repeating item (product card, cart line),
  where the same `data-testid` on each repeated root is expected.
- Add hooks to the element the shopper actually interacts with (the real `<button>`, `<input>`,
  `<a>`), not a wrapper.

## Required `data-testid` values

| Area | data-testid | On element | Used by test |
|------|-------------|-----------|--------------|
| Header | `site-logo` | logo img/link | MP-02 |
| Header | `cart-icon` | cart link/button | MP-04, CART-add |
| Header | `cart-count` | cart item-count badge | CART-add |
| Header | `lang-switch` | language toggle | MP-06 |
| Header | `account-icon` | account/login link | ACC-02 |
| Header | `search-input` | search text field | SRCH-01 |
| Listing | `product-card` | each product card root | CAT-05, listing checks |
| Listing | `product-card-title` | title inside card | Products/Card |
| Listing | `product-card-price` | price inside card | Products/Card |
| Listing | `product-card-add` | add-to-cart on card | Cart |
| Listing | `product-card-oos` | out-of-stock indicator | Products/Card |
| Listing | `product-card-discount` | discount badge | Products/Card |
| Listing | `sort-select` | sort control | SORT-01 |
| Listing | `filter-panel` | filter container | Search/Filter |
| Listing | `price-filter-min` / `price-filter-max` | price inputs | Search/Filter |
| Listing | `pagination` | pagination / load-more | SORT/pagination |
| Listing | `no-results` | empty search message | SRCH-04 |
| PDP | `product-title` | product name | PDP-05 |
| PDP | `product-price` | current price | PDP-05 |
| PDP | `product-gallery` | image gallery root | PDP-02 |
| PDP | `variant-option` | each variant selector | PDP variants |
| PDP | `qty-input` | quantity selector | PDP quantity |
| PDP | `add-to-cart` | main add-to-cart button | CART-add |
| PDP | `notify-availability` | notify button (OOS) | Products OOS |
| Cart | `cart-line` | each cart line root | Cart |
| Cart | `cart-line-remove` | remove-item button | Cart qty |
| Cart | `cart-qty` | line quantity input | Cart qty |
| Cart | `coupon-input` | coupon field | CART-coupon |
| Cart | `coupon-apply` | apply-coupon button | CART-coupon |
| Cart | `coupon-message` | coupon success/error text | CART-coupon |
| Cart | `cart-total` | order total line | Cart invoice |
| Cart | `cart-empty` | empty-cart message | CART-empty |
| Cart | `proceed-to-payment` | checkout button | Cart |
| Cart | `continue-shopping` | continue-shopping button | Cart |
| Footer | `footer-vat` | VAT number | FT |
| Footer | `footer-cr` | commercial registration | FT |
| Footer | `footer-address` | business address | FT |
| Footer | `footer-payments` | payment methods area | FT / S&P |
| Footer | `footer-shipping` | shipping methods area | FT / S&P |
| Footer | `footer-copyright` | copyright text | FT-08 |
| Footer | `social-links` | social icons container | MP contact |

## Section hooks

Every section root element carries **two** attributes:

- `data-section-type` — the section's type = the template file name without folder/extension
  (`sections/carousel.jinja` → `carousel`).
- `data-section-id` — the unique instance id. This is the same `section_id` that appears in the
  exported preset JSON, so tests can match an exact placed instance (not just the type). Themes
  already know this id when rendering a section; just echo it onto the root element.

```html
<section data-section-type="carousel" data-section-id="cc63d4d6-cca9-4100-927b-a21959c1ecb0">
  ...
</section>
```

`tests/05_sections.spec.js` reads the placed sections from the partner's preset and locates each
by `data-section-id` first (exact instance), falling back to `data-section-type`. Providing both
makes section coverage precise and robust.

## Example
```html
<!-- product card -->
<article data-testid="product-card">
  <a data-testid="product-card-title" href="...">اسم المنتج</a>
  <span data-testid="product-card-price">100.00 ر.س</span>
  <button data-testid="product-card-add">أضف للسلة</button>
</article>
```

## Roll-out to partners
1. Publish this contract in the theme-development docs (a "QA hooks" page).
2. Add the hooks to the three template themes on GitHub so partners inherit them by copying.
3. Add a validate-report recommendation when required hooks are missing (nudges partners
   without hard-blocking at first).
