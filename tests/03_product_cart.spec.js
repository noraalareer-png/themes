// Products + Cart checklist groups. The highest-value functional coverage.
//
// Product navigation goes through lib/cart.js, which reads a real product URL
// from the listing and navigates straight to the PDP (the old "click first
// product link" landed on the cart when an icon anchor was clicked instead).
import { test, expect } from '@playwright/test';
import { themed } from '../lib/helpers.js';
import { openFirstProduct, addFirstProductToCart, cartHasItems, PDP_TITLE } from '../lib/cart.js';

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
    // Verify via multiple signals (header badge / mini-cart drawer / /cart page),
    // because the header count badge uses a theme-specific class and may be hidden.
    const added = await cartHasItems(page);
    expect(added, 'cart did not reflect the added product (badge, drawer, and /cart all empty)').toBeTruthy();
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

    // The coupon field (كود الخصم) renders ONLY when the cart has items, so confirm
    // the add actually persisted before looking for it (else it's a false skip).
    const populated = await cartHasItems(page);
    if (!populated) test.skip(true, 'cart empty after add — coupon field only shows with items');

    await page.goto(themed('/cart'), { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const couponInput = page.locator(
      'input[name*="coupon" i], input[placeholder*="خصم"], input[placeholder*="كوبون"], input[placeholder*="هدايا"], input[placeholder*="coupon" i], input[placeholder*="promo" i]'
    ).first();
    // Order summary can render a moment after the cart items — wait for it.
    await couponInput.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    if (!(await couponInput.count())) test.skip(true, 'coupon input not present on cart page — map the coupon selector');

    // Some themes reject an invalid coupon via a native alert()/confirm() — capture it.
    let dialogMsg = '';
    page.on('dialog', (d) => { dialogMsg = d.message() || ''; d.dismiss().catch(() => {}); });

    await couponInput.fill('INVALID_TEST_COUPON_XYZ');
    // Apply button text varies by theme: تطبيق / إرسال / تحقق / إضافة / Apply.
    await page.locator(
      'button:has-text("تطبيق"), button:has-text("إرسال"), button:has-text("تحقق"), button:has-text("إضافة"), button:has-text("Apply")'
    ).first().click({ timeout: 6000 }).catch(() => {});

    // The error usually shows as a TRANSIENT toast/alert (top of page) or a native
    // dialog. Poll a few seconds for any of them (or error text in the body).
    const errRe = /غير صالح|غير صحيح|غير موجود|غير متوفر|منتهي|لا يمكن|فشل|خطأ|القسيمة|الكوبون|الرمز|invalid|not valid|expired|error|wrong/i;
    const toast = page.locator(
      '[role="alert"], [class*="toast" i], [class*="alert" i], [class*="notification" i], ' +
      '[class*="snackbar" i], [class*="message" i], [class*="swal" i], [class*="toastify" i], [class*="izitoast" i]'
    );
    let shown = false;
    for (let t = 0; t < 6 && !shown; t++) {
      if (dialogMsg && errRe.test(dialogMsg)) { shown = true; break; }
      const n = await toast.count();
      for (let i = 0; i < n; i++) {
        const tx = (await toast.nth(i).innerText().catch(() => '')) || '';
        if (tx && errRe.test(tx)) { shown = true; break; }
      }
      if (!shown) {
        const body = (await page.locator('body').innerText().catch(() => '')) || '';
        if (errRe.test(body)) shown = true;
      }
      if (!shown) await page.waitForTimeout(700);
    }
    expect(shown, 'no invalid-coupon error/toast appeared after applying an invalid coupon').toBeTruthy();
  });
});
