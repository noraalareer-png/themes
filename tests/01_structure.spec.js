// Main Page + global structural checks (checklist: "Main Page", "Footer").
// Presence/attribute assertions that work against ANY store data. Tuned to avoid
// common false positives on real themes (multiple favicons, hidden switchers,
// lazy images, third-party console noise).
import { test, expect } from '@playwright/test';
import { themed, collectConsoleErrors, brokenImages, settleImages, htmlDir } from '../lib/helpers.js';

// Console errors: on an uncontrolled preview, third-party noise is unavoidable,
// so this is a WARNING by default. Set CONSOLE_STRICT=1 (e.g. on the fixed test
// store) to make same-theme console errors fail the build.
const CONSOLE_STRICT = process.env.CONSOLE_STRICT === '1';

test.describe('Main page structure', () => {
  test('MP-01 favicon is present', async ({ page }) => {
    await page.goto(themed('/'));
    await expect(page.locator('link[rel~="icon"]').first()).toHaveCount(1);
  });

  test('MP-02 store logo renders (header)', async ({ page }) => {
    await page.goto(themed('/'));
    const logo = page.locator('header img, header svg, nav img, [class*="logo"] img, [class*="logo"] svg').first();
    await expect(logo).toBeVisible();
  });

  test('MP-04 cart icon is present', async ({ page }) => {
    await page.goto(themed('/'));
    const cart = page.locator('[href*="cart"], [class*="cart"], [aria-label*="cart" i], [aria-label*="سلة"]').first();
    await expect(cart).toBeVisible();
  });

  test('MP-06 a language switch exists (may be hidden in a menu)', async ({ page }) => {
    await page.goto(themed('/'));
    // themes often hide the switcher behind a menu, so assert existence not visibility
    const count = await page.locator('[class*="lang"], [href*="/ar"], [href*="/en"], [aria-label*="language" i]').count();
    expect(count, 'no language switch found in DOM').toBeGreaterThan(0);
  });

  test('MP-07 fonts load without failed font requests', async ({ page }) => {
    const failed = [];
    page.on('requestfailed', (r) => { if (/\.(woff2?|ttf|otf)(\?|$)/i.test(r.url())) failed.push(r.url()); });
    await page.goto(themed('/'));
    await page.waitForLoadState('networkidle');
    expect(failed, `failed font requests: ${failed.join(', ')}`).toHaveLength(0);
  });

  test('FT-01 footer is present', async ({ page }) => {
    await page.goto(themed('/'));
    await expect(page.locator('footer, [class*="footer"]').first()).toBeVisible();
  });

  test('FT-08 footer has copyright / content', async ({ page }) => {
    await page.goto(themed('/'));
    const footerText = (await page.locator('footer, [class*="footer"]').first().innerText()).trim();
    expect(footerText.length).toBeGreaterThan(0);
  });
});

test.describe('Global health (every page)', () => {
  const pages = [['home', '/'], ['products', '/products'], ['categories', '/categories'], ['cart', '/cart']];
  for (const [name, path] of pages) {
    test(`GH-console ${name}`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await page.goto(themed(path));
      await page.waitForLoadState('networkidle');
      if (errors.length) {
        const msg = `console errors on ${name}: ${errors.slice(0, 8).join(' | ')}`;
        if (CONSOLE_STRICT) expect(errors, msg).toEqual([]);
        else { test.info().annotations.push({ type: 'warning', description: msg }); console.warn('WARN', msg); }
      }
    });

    test(`GH-img ${name} has no broken images`, async ({ page }) => {
      await page.goto(themed(path));
      await settleImages(page);
      const broken = await brokenImages(page);
      expect(broken, `broken images on ${name}: ${broken.slice(0, 8).join(' | ')}`).toEqual([]);
    });
  }
});

test.describe('RTL / localization', () => {
  test('L10N-01 Arabic storefront renders RTL', async ({ page }) => {
    await page.goto(themed('/'));
    expect((await htmlDir(page)).toLowerCase()).toBe('rtl');
  });
});
