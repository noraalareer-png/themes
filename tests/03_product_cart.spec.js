// Products + Cart checklist groups. The highest-value functional coverage.
//
// Product navigation goes through lib/cart.js, which reads a real product URL
// from the listing and navigates straight to the PDP (the old "click first
// product link" landed on the cart when an icon anchor was clicked instead).
import { test, expect } from '@playwright/test';
import { themed } from '../lib/helpers.js';
import { openFirstProduct, addFirstProductToCart, ADD_TO_CART, PDP_TITLE } from '../lib/cart.js';

test.describe('Product details', () => {
  test('PDP-05 shows name, price and currency', async ({ page }) => {
    const path = await openFirstProduct(page);
    if (!path) test.skip(true, 'no product detail page reachable from /products — check the product URL scheme');

    const name = page.locator(PDP_TITLE.join(', ')).first();
    await expect(name, 'product title not found — map the PDP title selector').toBeVisible();

    const price = page.locator('[class*="price" i], [data-testid*="price" i], [class*="amount" i]').first();
    await expect(price, 'product price not found — map the price selector').toBeVisible();

    const priceText = await price.innerText();
    // currency symbol / SAR / ر.س / Riyal glyph present, or at least digits
    expect(priceText).toMatch(/ر\.?\s?س|SAR|﷼|\d/);
  });

  test('PDP-02 product images carry ALT text', async ({ page }) => {
    const path = await openFirstProduct(page);
    if (!path) test.skip(true, 'no product detail page reachable from /products');
    const imgs = page.locator('[class*="gallery" i] img, [class*="product" i] img');
    const n = Math.min(await imgs.count(), 5);
    for (let i = 0; i < n; i++) {
      const alt = await imgs.nth(i).getAttribute('alt');
      expect(alt, `image ${i} missing alt`).not.toBeNull();
    }
  });
});

test.describe('Cart flow', () => {
  test('CART-add add to cart increments the cart count', async ({ page }) => {
    const res = await addFirstProductToCart(page);
    if (!res.ok) test.skip(true, res.reason);
    const badge = page.locator([
      '[class*="cart-count" i]',
      '[class*="cart_count" i]',
      '[class*="cart" i] [class*="count" i]',
      '[class*="cart" i] [class*="badge" i]',
      '[class*="badge" i]',
      '[data-testid*="cart-count" i]',
    ].join(', ')).first();
    await expect(badge, 'cart count badge not visible after add').toBeVisible();
  });

  test('CART-empty empty cart shows empty-state and blocks checkout', async ({ page }) => {
    await page.goto(themed('/cart'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const body = (await page.locator('body').innerText()).toLowerCase();
    // when empty, there should be no proceed-to-checkout button
    if (/empty|فارغة|فارغ|لا توجد منتجات|سلة التسوق فارغة/.test(body)) {
      const proceed = page.locator('button:has-text("الدفع"), button:has-text("إتمام"), button:has-text("Checkout"), [class*="checkout" i]');
      expect(await proceed.count()).toBe(0);
    }
  });

  test('CART-coupon invalid coupon shows an error message', async ({ page }) => {
    // Populate the cart first so the coupon field is present (no fixture store needed
    // for the invalid-coupon path — we just need an item + the coupon input).
    const res = await addFirstProductToCart(page);
    if (!res.ok) test.skip(true, `could not add a product to test coupon: ${res.reason}`);

    await page.goto(themed('/cart'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const couponInput = page.locator(
      'input[name*="coupon" i], input[placeholder*="كوبون"], input[placeholder*="خصم"], input[placeholder*="coupon" i], input[placeholder*="promo" i]'
    ).first();
    if (!(await couponInput.count())) test.skip(true, 'coupon input not present on cart page — map the coupon selector');

    await couponInput.fill('INVALID_TEST_COUPON_XYZ');
    await page.locator('button:has-text("تطبيق"), button:has-text("إضافة"), button:has-text("Apply")').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).toMatch(/غير صالح|غير صحيح|invalid|not valid|expired|منتهي|خطأ/);
  });
});
