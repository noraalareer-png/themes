# Jira ticket — Fixed QA test store for theme automation

**Project:** (Themes / QA)
**Type:** Task
**Priority:** High
**Labels:** theme-qa, automation, test-store
**Summary / Title:**
[Themes QA] Set up a fixed test store with known data for theme test automation

---

## Description

We're building automation for testing partner themes (replacing the manual QA pass). For the tests
to be **precise and deterministic** (assert "price is 100 SAR" and "coupon gives 10% off", not just
"a price exists"), we need one **Zid-controlled test store** with fixed, known data. Any submitted
theme is applied to this store and the test suite runs against it.

This ticket: set up the store's data per the spec below, deliver the **preview base URL**, and
confirm the final slugs.

> Full spec: (add the link to the "QA Fixture Store" Notion page here)

## Acceptance criteria
- [ ] A Zid-controlled test store exists, and a submitted theme can be applied and previewed on it.
- [ ] All products / categories / coupons / shipping & payment methods below are added with the exact values.
- [ ] Preview base URL delivered + any slug that differs from the spec confirmed.
- [ ] Store settings (VAT / CR / address / two languages / countries) configured as described.

## Sub-tasks (store data)

**1) Store settings**
- Enable Arabic + English, currency SAR.
- Test VAT number, test commercial registration, fixed business address (shown in footer).
- Enable at least 2 countries (SA, AE), and enable the loyalty program.

**2) Products (fixed slugs)**
| Slug | Purpose | Known values |
|------|---------|--------------|
| `qa-standard` | baseline | price **100.00** SAR, in stock, no variants |
| `qa-variants` | variants + gating | sizes S/M/L; **M = 120.00**; **L out of stock**; cannot add to cart without selecting |
| `qa-discount` | discount | regular **200.00**, sale **150.00** (**25%**) |
| `qa-oos` | out of stock + notify | qty 0, "notify when available" button, add-to-cart disabled |
| `qa-lowstock` | low stock | qty **2**, shows low-stock tag |
| `qa-vat-exempt` | VAT exempt | flagged as exempt |
| `qa-qty-limit` | quantity limit | max per order **3** |
| `qa-bundle` | bundle offer | part of a "buy 2 get a discount" bundle |
| `qa-custom-fields` | custom fields | 1 text field + 1 dropdown |

**3) Category tree (3 levels)**
`qa-cat-a → qa-cat-a1 → qa-cat-a1a` — each with title, description, image, cover, and products.

**4) Coupons**
- `TEST10` — valid, **10% off**.
- `EXPIRED0` — expired / invalid.
- `MINSPEND` — valid above a minimum cart value.

**5) Shipping & payments**
- ≥ 2 shipping methods with logos, one with Cash on Delivery, known covered cities + price.
- ≥ 2 payment methods with logos. At least 1 bank account with full details.

**6) Content pages**
- 1 blog post with known HTML (heading + list) to verify HTML rendering.
- 1 FAQ question + answer.

**7) Search**
- `qa-standard` is findable by the keyword **"standard"**.
- The keyword **"zzzq-nonexistent"** returns "no results".

## Definition of done
Deliver the preview base URL + confirm the slugs → we wire the pipeline to it and start running.
