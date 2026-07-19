# QA Fixture Store — Test Store Data Specification

> For the platform team. Goal: one Zid-controlled test store with fixed, known data that any
> submitted theme is rendered against for automated theme QA. The data is fixed so tests can
> assert **exact values** (price is 100 SAR, coupon gives 10% off) — not just element presence.

## What we need back from you
- [ ] **Preview base URL** of the test store (a submitted theme gets applied to it and previewed).
- [ ] Confirmation of the final **slugs** (if any differ from below).

---

## 1) Store settings
| Setting | Value |
|---------|-------|
| Languages | Arabic + English (both enabled) |
| Currency | SAR |
| VAT number | test value (shown in footer) |
| Commercial registration | test value (shown in footer) |
| Business address | fixed address, shown in footer |
| Countries | at least 2 (SA, AE) |
| Loyalty program | enabled, with a known points rule |
| Orders status | open (with the ability to test an "orders closed" state) |

## 2) Products (fixed slugs)
| Slug | Purpose | Known values |
|------|---------|--------------|
| `qa-standard` | baseline product | price **100.00** SAR, in stock, no variants |
| `qa-variants` | variants | sizes S/M/L; **M = 120.00**; **L out of stock**; cannot add to cart without selecting a variant |
| `qa-discount` | discount | regular **200.00**, sale **150.00** (**25% off**) |
| `qa-oos` | out of stock | qty 0, shows "notify when available", add-to-cart disabled |
| `qa-lowstock` | low stock | qty **2**, shows low-stock tag |
| `qa-vat-exempt` | VAT exempt | flagged as exempt |
| `qa-qty-limit` | quantity limit | max per order **3** |
| `qa-bundle` | bundle offer | part of a "buy 2 get a discount" bundle |
| `qa-custom-fields` | custom fields | 1 text field + 1 dropdown |

## 3) Category tree (3 levels)
```
qa-cat-a            (level 1)  → qa-standard, qa-discount
  └ qa-cat-a1       (level 2)  → qa-variants
      └ qa-cat-a1a  (level 3)  → qa-lowstock
```
Each category: title + description + image + cover.

## 4) Coupons
| Code | Behaviour |
|------|-----------|
| `TEST10` | valid — **10% off** the cart |
| `EXPIRED0` | expired / invalid (to test the error message) |
| `MINSPEND` | valid only above a minimum cart value |

## 5) Shipping & payments
| Item | Requirement |
|------|-------------|
| Shipping methods | ≥ 2 with logos, one with **Cash on Delivery**, known covered cities + price |
| Payment methods | ≥ 2 with logos |
| Bank accounts | ≥ 1 with full details |

## 6) Content pages
| Page | Data |
|------|------|
| Blog | 1 post with known **HTML** body (heading + list) to verify HTML rendering |
| FAQ | 1 known question + answer |

## 7) Search
- `qa-standard` is findable by the keyword **"standard"**.
- The keyword **"zzzq-nonexistent"** returns "no results".

---

**Once ready:** send us the preview base URL + confirm the slugs, and we'll wire the automation to it and start running.
