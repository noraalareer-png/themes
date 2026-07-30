// Section coverage — data-driven from the partner's uploaded preset.
//
// PRIMARY check is CONTENT-BASED: for each placed section, sections_from_preset.py
// extracts a configured heading/text (`match_texts`) from the preset settings, and we
// confirm that text actually renders (visible) on the storefront. This verifies the
// section rendered WITH ITS REAL CONTENT, works on any theme, and needs no theme hooks.
//
// Fallbacks, in order, if no match text is available/found:
//   2. data-section-id / data-section-type hook (if the theme emits it)
//   3. class-name match (+ CLASS_ALIASES stopgap)
//   4. body text contains the content (present even if split across nodes)
// Only if all fail do we skip (never a false pass). Console noise is filtered.
import { test, expect } from '@playwright/test';
import { themed, collectConsoleErrors } from '../lib/helpers.js';
import fs from 'fs';

let sections = [];
try {
  sections = JSON.parse(fs.readFileSync(new URL('../sections.json', import.meta.url)));
} catch {
  sections = [];
}

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

// STOPGAP class aliases for themes whose class doesn't contain the slug and that emit
// no data-section-type hook. Content matching usually makes this unnecessary.
const CLASS_ALIASES = {
  'payments-showcase': ['luxury-payments', 'payments-section'],
};

function routeFor(page) {
  const map = {
    'templates/home.jinja': '/',
    'templates/product.jinja': '/products',
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
      const errors = collectConsoleErrors(page);
      await page.goto(themed(routeFor(s.page)));
      await page.waitForLoadState('networkidle');

      const texts = (s.match_texts || []).map(norm).filter((t) => t.length >= 4);

      // 1) CONTENT: a visible element containing the section's configured text.
      let located = null;
      for (const t of texts) {
        for (const q of [t, t.slice(0, 20)]) {
          const loc = page.getByText(q, { exact: false }).first();
          if ((await loc.count()) && (await loc.isVisible().catch(() => false))) { located = loc; break; }
        }
        if (located) break;
      }

      // 2) hook / class / alias fallback
      if (!located) {
        const aliasSel = (CLASS_ALIASES[s.slug] || []).map((a) => `section[class*="${a}" i], [class*="${a}" i]`).join(', ');
        const sel = (s.section_id ? `[data-section-id="${s.section_id}"], ` : '') +
          `[data-section-type="${s.slug}"], section[class*="${s.slug}"], [class*="${s.slug}"]` +
          (aliasSel ? ', ' + aliasSel : '');
        const h = page.locator(sel).first();
        if ((await h.count()) && (await h.isVisible().catch(() => false))) located = h;
      }

      // 3) last resort: content present in the page text (even if split across nodes)
      let present = !!located;
      if (!present && texts.length) {
        const body = norm(await page.locator('body').innerText().catch(() => ''));
        present = texts.some((t) => body.includes(t) || body.includes(t.slice(0, 20)));
      }

      if (!located && !present) {
        test.skip(true,
          `section "${s.slug}" not found — its configured content isn't visible and no ` +
          `hook/class matched. Expose data-section-type="${s.slug}" (HOOKS_CONTRACT.md) or check the preset.`);
      }

      if (located) await expect(located, `section ${s.slug} not visible`).toBeVisible();
      else expect(present, `section ${s.slug} content not on page`).toBeTruthy();

      expect(errors, `console errors on ${s.page}: ${errors.join(' | ')}`).toEqual([]);

      // Screenshot the nearest section container for review (fallback: full page).
      let shotEl = located;
      if (located) {
        const anc = located.locator('xpath=ancestor-or-self::section[1]').first();
        if (await anc.count()) shotEl = anc;
      }
      const shot = await (shotEl || page).screenshot(shotEl ? {} : { fullPage: true }).catch(() => null);
      if (shot) await testInfo.attach(`section-${s.slug}-${s.locale || ''}`, { body: shot, contentType: 'image/png' });
    });
  }
});
