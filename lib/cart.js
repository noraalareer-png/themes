// lib/cart.js — reliable "open a product" + "add to cart" + "verify cart" helpers.
//
// WHY: clicking "the first product link" on the listing was landing on the CART
// (an icon/quick-action anchor got clicked instead of the product), so PDP tests
// saw the empty-cart page. And add-to-cart WORKS on this store, but verifying it
// via a single header-badge selector failed (the badge is a tiny red number with
// a theme-specific class). So we (1) navigate straight to a real PDP, (2) do the
// add action (handling a disabled button via variant selection), and (3) verify
// success with MULTIPLE signals — header badge, mini-cart drawer, or the /cart
// page showing a line item — before ever failing/skipping.

import { themed } from './helpers.js';

// Add-to-cart button variants (confirmed text on this store: "أضف للسلة").
export const ADD_TO_CART = [
  'button:has-text("أضف للسلة")',
  'button:has-text("أضف")',
  'button:has-text("اضف")',
  'button:has-text("إضافة")',
  'button:has-text("للسلة")',
  'button:has-text("السلة")',
  'button:has-text("Add to cart")',
  'button:has-text("Add to bag")',
  'button:has-text("Add")',
  'a:has-text("أضف للسلة")',
  '[class*="add-to-cart" i]',
  '[class*="add_to_cart" i]',
  '[class*="addToCart" i]',
  'button[class*="cart" i]',
  '[data-testid*="add" i]',
];

const PDP_TITLE = [
  'h1',
  'h2[class*="title" i]',
  '[class*="product-title" i]',
  '[class*="product__title" i]',
  '[class*="product-name" i]',
  '[class*="product_name" i]',
  '[class*="productName" i]',
  '[data-testid*="title" i]',
];

// Variant/option controls to try when the add button is disabled (variant gating).
const VARIANT_OPTION = [
  '[class*="variant" i] button:not([disabled])',
  '[class*="variant" i] label',
  '[class*="option" i] button:not([disabled])',
  '[class*="size" i] button:not([disabled])',
  '[class*="attribute" i] button:not([disabled])',
  'select[class*="variant" i]',
];

function toPath(href) {
  try {
    if (href.startsWith('http')) { const u = new URL(href); return u.pathname + u.search; }
  } catch { /* ignore */ }
  return href.split('#')[0];
}

/**
 * Open a real product detail page (navigates directly to the URL, no fragile clicks).
 * @returns {Promise<string|null>} the product path opened, or null if none worked.
 */
export async function openFirstProduct(page) {
  await page.goto(themed('/products'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const links = page.locator('a[href*="/products/" i], a[href*="/product/" i]');
  const n = await links.count();
  const tried = new Set();

  for (let i = 0; i < n && tried.size < 12; i++) {
    const href = await links.nth(i).getAttribute('href');
    if (!href) continue;
    const path = toPath(href);
    if (!/\/products?\/[^/?#]+/i.test(path)) continue;             // a specific product
    if (/\/(cart|wishlist|favorites|account|auth)\b/i.test(path)) continue;
    if (tried.has(path)) continue;
    tried.add(path);

    await page.goto(themed(path), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const hasAdd = await page.locator(ADD_TO_CART.join(', ')).count();
    const hasTitle = await page.locator(PDP_TITLE.join(', ')).count();
    if (hasAdd || hasTitle) return path;
  }
  return null;
}

/**
 * Open a product and add it to the cart. Handles a disabled add button by
 * selecting the first available variant/option, then retrying.
 * @returns {Promise<{ok:boolean, reason?:string, path?:string}>}
 */
export async function addFirstProductToCart(page) {
  const path = await openFirstProduct(page);
  if (!path) return { ok: false, reason: 'no product detail page reachable from /products' };

  const addBtn = page.locator(ADD_TO_CART.join(', ')).first();
  if (!(await addBtn.count())) return { ok: false, reason: 'add-to-cart button not found on the PDP', path };

  await addBtn.scrollIntoViewIfNeeded().catch(() => {});

  // If the button is disabled (variant gating), pick the first available option.
  if (!(await addBtn.isEnabled().catch(() => true))) {
    const opt = page.locator(VARIANT_OPTION.join(', ')).first();
    if (await opt.count()) {
      await opt.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  await addBtn.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1800);              // allow cart update / drawer / toast
  return { ok: true, path };
}

/**
 * Verify the cart actually has items, checking several signals in order:
 *   1) a header cart badge/count showing a positive number
 *   2) an open mini-cart drawer containing a product
 *   3) the /cart page showing a line item (not the empty state)
 * @returns {Promise<boolean>}
 */
export async function cartHasItems(page) {
  // 1) header badge/count with a positive number
  const badges = page.locator(
    '[class*="cart-count" i], [class*="cart_count" i], [class*="cart" i] [class*="count" i], ' +
    '[class*="cart" i] [class*="badge" i], header [class*="badge" i], [class*="cart" i] sup, ' +
    '[data-testid*="cart-count" i]'
  );
  const bn = await badges.count();
  for (let i = 0; i < bn; i++) {
    const t = (await badges.nth(i).innerText().catch(() => '')) || '';
    const num = parseInt(t.replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(num) && num > 0) return true;
  }

  // 2) mini-cart drawer with a product line
  const drawer = page.locator(
    '[class*="cart" i][class*="drawer" i] a[href*="/product" i], ' +
    '[class*="mini-cart" i] a[href*="/product" i], [class*="cart-drawer" i] img'
  );
  if (await drawer.count()) return true;

  // 3) fall back to the /cart page
  await page.goto(themed('/cart'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  if (/فارغة|فارغ|empty|لا توجد منتجات/.test(body)) return false;
  const lineItems = await page.locator(
    'a[href*="/products/" i], [class*="cart-item" i], [class*="line-item" i], [class*="cart_item" i]'
  ).count();
  return lineItems > 0;
}

export { PDP_TITLE };
