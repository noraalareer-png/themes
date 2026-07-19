// Section coverage — data-driven from the partner's uploaded preset.
//
// sections_from_preset.py turns the preset into sections.json:
//   [{ name:"sections/main-slider.jinja", slug:"main-slider", page:"templates/home.jinja",
//      locale:"ar", section_id:"cc63...", order:0, display:true }, ...]
//
// For each placed (display:true) section we open the page it lives on and assert it renders
// with no broken images / console errors, and attach a screenshot. Locating uses, in order:
//   1. data-section-id="<section_id>"     (exact instance — most precise; from the preset)
//   2. data-section-type="<slug>"         (section type — see HOOKS_CONTRACT.md)
//   3. class-name fallback                (brittle; skips with an actionable message if absent)
import { test, expect } from '@playwright/test';
import { themed } from '../lib/helpers.js';
import fs from 'fs';

let sections = [];
try {
  sections = JSON.parse(fs.readFileSync(new URL('../sections.json', import.meta.url)));
} catch {
  sections = [];
}

// Map a preset page path to a storefront route.
function routeFor(page) {
  const map = {
    'templates/home.jinja': '/',
    'templates/product.jinja': '/products',      // opens listing; product tests cover PDP
    'templates/products.jinja': '/products',
    'templates/category.jinja': '/categories',
    'templates/categories.jinja': '/categories',
  };
  return map[page] || '/';
}

test.describe('Section rendering coverage (from preset)', () => {
  if (!sections.length) {
    test('sections manifest present', () => {
      test.skip(true, 'sections.json missing — run: python sections_from_preset.py <preset>');
    });
  }

  for (const s of sections) {
    const title = `SEC-${s.slug}${s.locale ? '-' + s.locale : ''}`;
    test(`${title} renders on ${s.page || 'home'}`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));

      await page.goto(themed(routeFor(s.page)));
      await page.waitForLoadState('networkidle');

      const hook = page.locator(
        (s.section_id ? `[data-section-id="${s.section_id}"], ` : '') +
        `[data-section-type="${s.slug}"], ` +
        `section[class*="${s.slug}"], [class*="${s.slug}"]`
      ).first();

      if (!(await hook.count())) {
        test.skip(true,
          `section "${s.slug}" not found — expose data-section-id="${s.section_id}" ` +
          `or data-section-type="${s.slug}" in the theme (see HOOKS_CONTRACT.md)`);
      }

      await expect(hook, `section ${s.slug} not visible`).toBeVisible();

      const broken = await hook.locator('img').evaluateAll((imgs) =>
        imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src'))
            .map((i) => i.getAttribute('src'))
      );
      expect(broken, `broken images in ${s.slug}: ${broken.join(', ')}`).toEqual([]);
      expect(errors, `console errors on ${s.page}: ${errors.join(' | ')}`).toEqual([]);

      const shot = await hook.screenshot().catch(() => null);
      if (shot) await testInfo.attach(`section-${s.slug}-${s.locale || ''}`, { body: shot, contentType: 'image/png' });
    });
  }
});
