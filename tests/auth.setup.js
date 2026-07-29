// One-time authentication for the whole run.
//
// WHY: logging in inside every account test hammered the WhatsApp auth endpoint
// (5 tests × 2 projects × retries) and hit HTTP 429 (rate limit). This setup logs
// in ONCE (API-first, via lib/auth.js), saves the session to storageState, and the
// account spec reuses it — so the run does a single login and never spams WhatsApp.
//
// Resilient: if login fails, we still write an (unauthenticated) state file so the
// account spec can load it and SKIP cleanly with a clear message — never a false pass.

import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { login } from '../lib/auth.js';
import { AUTH_STATE } from '../lib/authState.js';

setup('authenticate once (fixture customer)', async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_STATE), { recursive: true });

  // Land on the store origin first so the context/cookies are associated.
  await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});

  try {
    await login(page);                       // WhatsApp API verify (one call), UI fallback
    console.log('auth.setup: logged in — session saved to ' + AUTH_STATE);
  } catch (e) {
    console.warn('auth.setup: login failed, writing unauthenticated state (account tests will skip): ' + e.message);
  }

  // Always write the state file (authenticated cookies if login worked, else empty),
  // so storageState in the spec never errors on a missing file.
  await page.context().storageState({ path: AUTH_STATE });
});
