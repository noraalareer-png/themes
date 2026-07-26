// lib/cart.js — reliable "open a product" + "add to cart" helpers.
//
// WHY: clicking "the first product link" on the listing was landing on the CART
// (an icon/quick-action anchor got clicked instead of the product), so PDP tests
// saw the empty-cart page and failed. These helpers instead READ a real product
// URL from the listing and navigate straight to it, then verify it's a PDP before
// acting — no fragile clicks on overlay icons.

import { themed } from './helpers.js';

// Add-to-cart button variants (Arabic + English + class/testid patterns).
export const ADD_TO_CART = [
  'button:has-text("أضف")',
  'button:has-text("اضف")',
  'button:has-text("إضافة")',
  'button:has-text("للسلة")',
  'button:has-text("السلة")',
  'button:has-text("أضف إلى السلة")',
  'button:has-text("Add to cart")',
  'button:has-text("Add to bag")',
  'button:has-text("Add")',
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

function toPath(href) {
  try {
    if (href.startsWith('http')) { const u = new URL(href); return u.pathname + u.search; }
  } catch { /* ignore */ }
  return href.split('#')[0];
}

/**
 * Open a real product detail page. Reads product links from the listing and
 * navigates to the first one that is an actual product (not cart/wishlist/etc)
 * and that looks like a PDP (has a title or an add-to-cart button).
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
    // must point to a specific product, not the listing or a customer route
    if (!/\/products?\/[^/?#]+/i.test(path)) continue;
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
 * Open a product and add it to the cart.
 * @returns {Promise<{ok:boolean, reason?:string, path?:string}>}
 */
export async function addFirstProductToCart(page) {
  const path = await openFirstProduct(page);
  if (!path) return { ok: false, reason: 'no product detail page reachable from /products' };

  const addBtn = page.locator(ADD_TO_CART.join(', ')).first();
  if (!(await addBtn.count())) return { ok: false, reason: 'add-to-cart button not found on the PDP', path };

  await addBtn.scrollIntoViewIfNeeded().catch(() => {});
  await addBtn.click().catch(() => {});
  await page.waitForTimeout(1800);              // allow cart update / drawer
  return { ok: true, path };
}

export { PDP_TITLE };
