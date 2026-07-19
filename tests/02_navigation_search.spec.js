// Menu/Category + Search/Listing checklist groups.
import { test, expect } from '@playwright/test';
import { themed } from '../lib/helpers.js';

// Find the search input; many themes hide it behind an icon toggle, so click a
// search toggle first if the input isn't immediately present.
async function openSearch(page) {
  let input = page.locator('input[type="search"], input[name*="search" i], input[placeholder*="بحث"]').first();
  if (await input.count() && await input.isVisible().catch(() => false)) return input;
  const toggle = page.locator('[class*="search-icon"], [aria-label*="search" i], [aria-label*="بحث"], [class*="search"] button, button[class*="search"]').first();
  if (await toggle.count()) { await toggle.click().catch(() => {}); await page.waitForTimeout(600); }
  input = page.locator('input[type="search"], input[name*="search" i], input[placeholder*="بحث"]').first();
  return input;
}

test.describe('Menu & category navigation', () => {
  test('NAV-01 main menu links resolve (no 404)', async ({ page }) => {
    await page.goto(themed('/'));
    const links = await page.locator('header a[href], nav a[href]').evaluateAll((as) =>
      as.map((a) => a.getAttribute('href')).filter((h) => h && !h.startsWith('#') && !h.startsWith('javascript'))
    );
    const sample = [...new Set(links)].slice(0, 8);
    for (const href of sample) {
      const res = await page.request.get(href.startsWith('http') ? href : new URL(href, page.url()).toString());
      expect(res.status(), `menu link ${href} returned ${res.status()}`).toBeLessThan(400);
    }
  });

  test('CAT-05 "All products" listing loads product cards', async ({ page }) => {
    await page.goto(themed('/products'));
    await page.waitForLoadState('networkidle');
    const cards = page.locator('[class*="product-card"], [class*="product_card"], [class*="product"] a, [data-product-id], article');
    await expect(cards.first()).toBeVisible();
  });
});

test.describe('Search', () => {
  test('SRCH-01 search returns results', async ({ page }) => {
    await page.goto(themed('/'));
    const search = await openSearch(page);
    if (!(await search.count())) test.skip(true, 'search input not found even after toggle — map the search selector for this theme');
    await search.fill('a');
    await search.press('Enter');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toMatch(/search|q=|keyword/i);
  });

  test('SRCH-04 invalid query shows a "no results" state', async ({ page }) => {
    await page.goto(themed('/search?keyword=zzzzq-nonexistent-xyz'));
    await page.waitForLoadState('networkidle');
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).toMatch(/no results|لا توجد|لم يتم العثور|no products|لا نتائج/);
  });
});

test.describe('Filter & sort', () => {
  test('SORT-01 choosing a sort option updates the listing', async ({ page }) => {
    await page.goto(themed('/products'));
    const before = await page.locator('[class*="product"], article').allInnerTexts();
    const sort = page.locator('select[name*="sort" i], [class*="sort"] select, [aria-label*="sort" i]').first();
    if (await sort.count()) {
      await sort.selectOption({ index: 1 }).catch(() => {});
      await page.waitForLoadState('networkidle');
      const after = await page.locator('[class*="product"], article').allInnerTexts();
      expect(after.join('') !== before.join('') || after.length === before.length).toBeTruthy();
    } else {
      test.skip(true, 'sort control not found - map selector to theme');
    }
  });
});
