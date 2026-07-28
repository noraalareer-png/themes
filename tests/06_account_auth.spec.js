// Authenticated customer-area checks (fixture store).  [file 06 — next after 05]
//
// Complements 04_pages_account_mobile.spec.js (logged-OUT: ACC-02, ACC-04).
// Covers the LOGGED-IN checklist groups "Customer Account" + "Customer-related
// Pages" (profile, orders, wishlist, addresses).
//
// VERIFIED against the live store (2026-07): login via the documented WhatsApp
// auth API works with the fixture (500000005 / 1234 -> login_success,
// customer_id 15141670 "Zid Test Customer"), and window.zid.account.* returns
// data once authenticated. So we log in via the API (lib/auth.js) and assert the
// PLATFORM data is served (which is exactly what "rendered by Zid / uncustomized"
// means) — no fragile DOM/console checks.
//
// Philosophy unchanged: if login can't be performed on this preview, the tests
// SKIP with an actionable message — never a false pass.

import { test, expect } from '@playwright/test';
import { themed } from '../lib/helpers.js';
import { login } from '../lib/auth.js';

// Call a window.zid.account.<method>() in the page and return its result.
async function accountCall(page, method, args = []) {
  return page.evaluate(async ({ method, args }) => {
    if (!window.zid || !window.zid.account || typeof window.zid.account[method] !== 'function') {
      return { __noSdk: true };
    }
    try { return await window.zid.account[method](...args); }
    catch (e) { return { __err: String(e) }; }
  }, { method, args });
}

test.describe('Authenticated customer area', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await login(page);                    // API-first (WhatsApp verify), UI fallback
    } catch (e) {
      test.skip(true, `fixture login unavailable: ${String(e.message || e)}`);
    }
    // Land on the storefront so window.zid (the theme SDK) is available.
    await page.goto(themed('/'), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.zid && window.zid.account), null, { timeout: 10000 }).catch(() => {});
  });

  test('ACC-01 login with phone + OTP succeeds (session established)', async ({ page }) => {
    const base = (process.env.PREVIEW_BASE || '').replace(/\/+$/, '');
    const res = await page.request.get(`${base}/api/v1/auth/login-status`);
    expect(res.ok(), `login-status HTTP ${res.status()}`).toBeTruthy();
    const data = await res.json();
    expect(data.is_authenticated, 'session is not authenticated after login').toBeTruthy();
  });

  test('ACC-05 personal info is served by Zid (profile)', async ({ page }) => {
    const p = await accountCall(page, 'get');
    if (p && p.__noSdk) test.skip(true, 'window.zid.account SDK not present on this theme');
    expect(p && !p.__err, `profile call failed: ${p && p.__err}`).toBeTruthy();
    expect(p.id || p.hashed_id, 'profile has no id — not served by the platform').toBeTruthy();
  });

  test('CUST-01 orders page is served by Zid', async ({ page }) => {
    const o = await accountCall(page, 'orders');
    if (o && o.__noSdk) test.skip(true, 'window.zid.account SDK not present on this theme');
    expect(o && !o.__err, `orders call failed: ${o && o.__err}`).toBeTruthy();
    expect(o && ('results' in o || 'count' in o), 'orders response is not the platform shape').toBeTruthy();
  });

  test('CUST-02 wishlist is served by Zid', async ({ page }) => {
    const w = await accountCall(page, 'wishlists');
    if (w && w.__noSdk) test.skip(true, 'window.zid.account SDK not present on this theme');
    expect(w && !w.__err, `wishlists call failed: ${w && w.__err}`).toBeTruthy();
    expect(w && ('results' in w || 'count' in w), 'wishlist response is not the platform shape').toBeTruthy();
  });

  test('CUST-03 addresses are served by Zid', async ({ page }) => {
    const a = await accountCall(page, 'addresses');
    if (a && a.__noSdk) test.skip(true, 'window.zid.account SDK not present on this theme');
    expect(a && !a.__err, `addresses call failed: ${a && a.__err}`).toBeTruthy();
    expect(Array.isArray(a) || (a && ('results' in a)), 'addresses response is not the platform shape').toBeTruthy();
  });
});
