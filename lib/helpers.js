// Shared helpers for theme E2E tests.
// The preview link carries the theme id as a query param, so every navigation
// appends ?theme=<THEME_ID>. Also centralises resilient checks (lazy-image
// settling, filtered console errors) so real-store noise doesn't cause false
// failures.

export const THEME_ID = process.env.THEME_ID || '';

/** Build a path with the theme query param preserved. */
export function themed(path = '/') {
  const sep = path.includes('?') ? '&' : '?';
  return THEME_ID ? `${path}${sep}theme=${THEME_ID}` : path;
}

// Console noise we never want to fail on (third-party / analytics / platform).
// Real storefronts always emit some of this; it is not a theme defect.
const CONSOLE_IGNORE = [
  /google|gtag|gtm|analytics|doubleclick/i,
  /facebook|fbevents|connect\.facebook/i,
  /tiktok|snap|snapchat|pinterest|hotjar|clarity/i,
  /favicon/i,
  /Failed to load resource.*(analytics|pixel|beacon)/i,
  /ERR_BLOCKED_BY_CLIENT/i,           // ad-blocker style blocks
  /Content Security Policy/i,
];

/** Attach a filtered console-error collector. Returns the array it fills. */
export function collectConsoleErrors(page) {
  const errors = [];
  const keep = (t) => t && !CONSOLE_IGNORE.some((re) => re.test(t));
  page.on('console', (msg) => { if (msg.type() === 'error' && keep(msg.text())) errors.push(msg.text()); });
  page.on('pageerror', (err) => { const t = String(err); if (keep(t)) errors.push(t); });
  return errors;
}

/** Scroll the page to trigger lazy-loaded images, then wait for them to settle. */
export async function settleImages(page) {
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0;
      const step = () => {
        window.scrollBy(0, window.innerHeight);
        y += window.innerHeight;
        if (y < document.body.scrollHeight && y < 20000) setTimeout(step, 120);
        else { window.scrollTo(0, 0); setTimeout(res, 400); }
      };
      step();
    });
  });
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Return <img> that genuinely failed to load (after settling). Ignores data: URIs. */
export async function brokenImages(page) {
  return page.$$eval('img', (imgs) =>
    imgs
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.getAttribute('src'))
      .filter((src) => src && !src.startsWith('data:'))
  );
}

export async function htmlDir(page) {
  return page.evaluate(() => document.documentElement.getAttribute('dir') || '');
}
