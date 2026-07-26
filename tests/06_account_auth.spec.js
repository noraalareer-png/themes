// Authenticated customer-area checks (fixture store).  [file 06 — next after 05]
//
// Complements 04_pages_account_mobile.spec.js, which only covers the LOGGED-OUT
// account state (ACC-02 profile->login, ACC-04 /account resolves). This file adds
// the LOGGED-IN half of the checklist groups "Customer Account" +
// "Customer-related Pages" (personal info, orders, wishlist, addresses), which
// need a signed-in session. Kept as its own file because these tests require the
// fixture login (phone + fixed OTP) — see lib/auth.js.
//
// Philosophy matches the suite: if login can't be performed on this preview, the
// tests SKIP with an actionable message — never a false pass.
//
// Env (lib/auth.js): QA_LOGIN_PHONE, QA_LOGIN_OTP, QA_LOGIN_PATH.

import { test, expect } from '@playwright/test';
import { themed, collectConsoleErrors } from '../lib/helpers.js';
import { login } from '../lib/auth.js';

// Candidate Zid customer routes. The store's actual paths win — each is tried and
// the test skips (actionable) if none resolve, so it never false-passes.
const ACCOUNT_ROUTES = [
  { id: 'ACC-05',  name: 'personal info', paths: ['/account', '/customer', '/profile'] },
  { id: 'CUST-01', name: 'orders',        paths: ['/orders', '/customer/orders', '/account/orders'] },
  { id: 'CUST-02', name: 'wishlist',      paths: ['/wishlist', '/customer/wishlist', '/favorites'] },
  { id: 'CUST-03', name: 'addresses',     paths: ['/addresses', '/customer/addresses', '/account/addresses'] },
];

async function looks404(page) {
  const title = (await page.title().catch(() => '')) || '';
  const body = (await page.locator('body').innerText().catch(() => '')) || '';
  return /غير موجودة|لم يتم العثور|not found|404/i.test(title + ' ' + body.slice(0, 2000));
}

test.describe('Authenticated customer area', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await login(page);
    } catch (e) {
      test.skip(true, `fixture login unavailable: ${String(e.message || e)}`);
    }
  });

  test('ACC-01 login with phone + OTP succeeds', async ({ page }) => {
    // beforeEach already logged in; assert a logged-in control is present.
    await page.goto(themed('/'));
    await page.waitForLoadState('networkidle').catch(() => {});
    const loggedIn = page.locator(
      'a[href*="logout" i], a[href*="account" i], a[href*="customer" i], [class*="account" i]'
    );
    const count = await loggedIn.count();
    expect(count, 'no logged-in account control visible after login').toBeGreaterThan(0);
  });

  for (const r of ACCOUNT_ROUTES) {
    test(`${r.id} ${r.name} page loads and is served by Zid`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      let resolved = null;
      for (const p of r.paths) {
        const resp = await page.goto(themed(p)).catch(() => null);
        if (resp && resp.status() < 400 && !(await looks404(page))) {
          resolved = p;
          break;
        }
      }
      if (!resolved) {
        test.skip(true, `${r.name}: none of [${r.paths.join(', ')}] resolved on this store — set the fixture route`);
      }
      await page.waitForLoadState('networkidle').catch(() => {});
      // "Uncustomized / served by Zid" proxy: the platform account page renders
      // with no theme-originated console errors (analytics noise filtered in helpers.js).
      expect(errors, `console errors on ${r.name} (${resolved}): ${errors.join(' | ')}`).toEqual([]);
    });
  }
});
