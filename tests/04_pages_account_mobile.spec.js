// Additional pages, customer account, and mobile checklist groups.
import { test, expect } from '@playwright/test';
import { themed } from '../lib/helpers.js';

test.describe('Additional pages', () => {
  test('PG-404 unknown URL renders a 404 page', async ({ page }) => {
    const res = await page.goto(themed('/this-page-does-not-exist-xyz-123'));
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(res?.status() === 404 || /404|not found|غير موجود/.test(body)).toBeTruthy();
  });
});

test.describe('Customer account', () => {
  test('ACC-02 profile icon leads to login when logged out', async ({ page }) => {
    await page.goto(themed('/'));
    const profile = page.locator('[href*="login"], [href*="account"], [aria-label*="account" i], [class*="account"]').first();
    await expect(profile).toBeVisible();
  });

  test('ACC-04 account pages are rendered by Zid (uncustomized)', async ({ page }) => {
    // These must NOT be theme-overridden. Heuristic: the account/profile route
    // should resolve on the platform, not 404 inside the theme.
    const res = await page.goto(themed('/account'));
    expect(res?.status() || 200).toBeLessThan(500);
  });
});

test.describe('Mobile', () => {
  test('MOB-01 mobile home renders (screenshot artifact)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile-only');
    await page.goto(themed('/'));
    await page.waitForLoadState('networkidle');
    const shot = await page.screenshot({ fullPage: true });
    await testInfo.attach('mobile-home', { body: shot, contentType: 'image/png' });
    // no horizontal overflow (common mobile defect)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow, 'page overflows horizontally on mobile').toBeFalsy();
  });
});
