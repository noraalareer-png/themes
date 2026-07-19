// Playwright config. Targeting comes from env so it can run any theme:
//   PREVIEW_BASE  e.g. https://i1o0np.dev.zid.store   (required)
//   THEME_ID      e.g. 8f46acc0-01d6-4dcb-b1f9-873e8684f0a6
//   LOCALE_PATH   optional locale prefix (e.g. /ar-us)
//   CONSOLE_STRICT=1  make console errors fail (use on the fixed test store)
import { defineConfig, devices } from '@playwright/test';

const PREVIEW_BASE = process.env.PREVIEW_BASE;
const LOCALE_PATH = process.env.LOCALE_PATH || '';
const THEME = process.env.THEME_ID || 'default';
const OUT = `runs/${THEME}`;            // every theme gets its own folder

if (!PREVIEW_BASE) {
  throw new Error(
    '\n\nPREVIEW_BASE is not set. Set the theme you want to test first:\n' +
    '  $env:PREVIEW_BASE="https://<host>.dev.zid.store"; $env:THEME_ID="<uuid>"\n' +
    '  then run in the SAME window:  npx playwright test\n'
  );
}
if (!process.env.THEME_ID) console.warn('\nWARNING: THEME_ID not set - pages load without ?theme=<id>.\n');
console.log('\n>> Testing preview: ' + PREVIEW_BASE + '  (theme: ' + THEME + ')');
console.log('>> Results will be saved in: ' + OUT + '\n');

export default defineConfig({
  testDir: './tests',
  outputDir: OUT + '/test-results',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: OUT + '/playwright-report', open: 'never' }],
    ['json', { outputFile: OUT + '/results.json' }],
  ],
  use: {
    baseURL: PREVIEW_BASE + LOCALE_PATH,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
});
