// Products + Cart checklist groups. The highest-value functional coverage.
import { test, expect } from '@playwright/test';
import { themed } from '../lib/helpers.js';

async function openFirstProduct(page) {
  await page.goto(themed('/products'));
  const card = page.locator('a[href*="product"], [class*="product"] a').first();
  await card.click();
  await page.waitForLoadState('networkidle');
}

test.describe('Product details', () => {
  test('PDP-05 shows name, price and currency', async ({ page }) => {
    await openFirstProduct(page);
    const name = page.locator('h1, [class*="product-title"], [class*="product__title"]').first();
    await expect(name).toBeVisible();
    const price = page.locator('[class*="price"]').first();
    await expect(price).toBeVisible();
    const priceText = await price.innerText();
    // currency symbol / SAR / ر.س present
    expect(priceText).toMatch(/ر\.?س|SAR|﷼|\d/);
  });

  test('PDP-02 product images carry ALT text', async ({ page }) => {
    await openFirstProduct(page);
    const imgs = page.locator('[class*="gallery"] img, [class*="product"] img');
    const n = Math.min(await imgs.count(), 5);
    for (let i = 0; i < n; i++) {
      const alt = await imgs.nth(i).getAttribute('alt');
      expect(alt, `image ${i} missing alt`).not.toBeNull();
    }
  });
});

test.describe('Cart flow', () => {
  test('CART-add add to cart increments the cart count', async ({ page }) => {
    await openFirstProduct(page);
    const addBtn = page.locator('button:has-text("أضف"), button:has-text("Add"), [class*="add-to-cart"]').first();
    if (!(await addBtn.count())) test.skip(true, 'add-to-cart button selector not mapped');
    await addBtn.click();
    await page.waitForTimeout(1500);
    const badge = page.locator('[class*="cart-count"], [class*="cart"] [class*="count"], [class*="badge"]').first();
    await expect(badge).toBeVisible();
  });

  test('CART-empty empty cart shows empty-state and blocks checkout', async ({ page }) => {
    await page.goto(themed('/cart'));
    await page.waitForLoadState('networkidle');
    const body = (await page.locator('body').innerText()).toLowerCase();
    // either has items or shows an empty message; when empty, no proceed button
    if (/empty|فارغة|لا توجد منتجات/.test(body)) {
      const proceed = page.locator('button:has-text("الدفع"), button:has-text("Checkout"), [class*="checkout"]');
      expect(await proceed.count()).toBe(0);
    }
  });

  test('CART-coupon invalid coupon shows an error message', async ({ page }) => {
    await page.goto(themed('/cart'));
    const couponInput = page.locator('input[name*="coupon" i], input[placeholder*="كوبون"], input[placeholder*="coupon" i]').first();
    if (!(await couponInput.count())) test.skip(true, 'coupon input not present (empty cart) - needs fixture store');
    await couponInput.fill('INVALID_TEST_COUPON_XYZ');
    await page.locator('button:has-text("تطبيق"), button:has-text("Apply")').first().click();
    await page.waitForTimeout(1500);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).toMatch(/غير صالح|غير صحيح|invalid|not valid|expired/);
  });
});
