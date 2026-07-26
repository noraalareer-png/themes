// lib/auth.js — fixture-store login for authenticated theme QA tests.
//
// Zid storefronts sign in with a MOBILE NUMBER + OTP (no password). On the QA
// fixture store the OTP is fixed, so login is fully deterministic in CI.
//
// Flow (confirmed): click the ACCOUNT ICON in the header -> phone screen ->
// submit -> enter the 4-digit OTP (four separate boxes) -> submit.
//
// Credentials come from env (with fixture defaults) so nothing sensitive is
// hardcoded and CI can override via GitHub secrets:
//   QA_LOGIN_PHONE  (default 500000005)   fixture mobile number
//   QA_LOGIN_OTP    (default 1234)         fixture one-time code
//   QA_LOGIN_PATH   (optional)             explicit login route, e.g. /auth
//
// login(page) is resilient and, if it can't perform the flow on this preview,
// THROWS a clear error — callers should test.skip with an actionable message
// (never a false pass), matching the rest of the suite's philosophy.

import { themed } from './helpers.js';

export const LOGIN = {
  phone: process.env.QA_LOGIN_PHONE || '500000005',
  otp:   process.env.QA_LOGIN_OTP   || '1234',
  path:  process.env.QA_LOGIN_PATH  || '',
};

// --- selector pools (first visible match wins; icon-in-header is primary) ---

const ACCOUNT_ICON = [
  'header a[href*="login" i]',
  'header a[href*="auth" i]',
  'header a[href*="account" i]',
  'header a[href*="customer" i]',
  'header [class*="account" i] a, header a[class*="account" i]',
  'header [class*="user" i] a, header a[class*="user" i]',
  '[aria-label*="حساب" i]',
  '[aria-label*="account" i]',
  '[aria-label*="login" i], [aria-label*="تسجيل" i]',
];

const PHONE_SEL = [
  'input[type="tel"]',
  'input[name*="mobile" i]',
  'input[name*="phone" i]',
  'input[autocomplete="tel"]',
  'input[inputmode="tel"]',
  'input[placeholder*="جوال" i]',
  'input[placeholder*="رقم" i]',
  'input[placeholder*="mobile" i]',
  'input[placeholder*="phone" i]',
];

// OTP is rendered as four separate digit boxes on this store.
const OTP_BOX = [
  'input[maxlength="1"]',
  'input[autocomplete="one-time-code"]',
  'input[name*="otp" i]',
  'input[name*="code" i]',
  'input[inputmode="numeric"]',
];

const SUBMIT_TEXT = [
  /إرسال|التالي|متابعة|استمرار|تحقق|تأكيد|دخول/i,
  /send|next|continue|verify|confirm|log ?in|sign ?in|submit|get ?code/i,
];

async function firstVisible(page, selectors, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      if ((await loc.count()) && (await loc.isVisible().catch(() => false))) return loc;
    }
    await page.waitForTimeout(200);
  }
  return null;
}

async function clickSubmit(page) {
  for (const re of SUBMIT_TEXT) {
    for (const role of ['button', 'link']) {
      const el = page.getByRole(role, { name: re }).first();
      if ((await el.count()) && (await el.isVisible().catch(() => false))) {
        await el.click();
        return true;
      }
    }
  }
  // generic submit button fallback
  const submit = page.locator('button[type="submit"], input[type="submit"]').first();
  if ((await submit.count()) && (await submit.isVisible().catch(() => false))) {
    await submit.click();
    return true;
  }
  return false;
}

/** Open the login screen via the header account icon (or explicit path). */
async function openLogin(page) {
  if (LOGIN.path) {
    await page.goto(themed(LOGIN.path));
    return;
  }
  await page.goto(themed('/'));
  await page.waitForLoadState('domcontentloaded');
  const icon = await firstVisible(page, ACCOUNT_ICON, 8000);
  if (!icon) {
    throw new Error(
      'ACCOUNT_ICON_NOT_FOUND: header account icon not located — ' +
      'set QA_LOGIN_PATH to the login route, or adjust ACCOUNT_ICON in lib/auth.js'
    );
  }
  await icon.click();
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Fill a 4 (or N) digit OTP across separate boxes, or a single field. */
async function fillOtp(page, code) {
  const digits = String(code).split('');
  const boxes = page.locator('input[maxlength="1"]');
  const n = await boxes.count();
  if (n >= digits.length) {
    for (let i = 0; i < digits.length; i++) await boxes.nth(i).fill(digits[i]);
    return true;
  }
  const single = await firstVisible(page, OTP_BOX, 2000);
  if (single) {
    await single.fill(String(code));
    return true;
  }
  return false;
}

/**
 * Perform the fixture login. Throws with a clear code if any step can't be found.
 * @param {import('@playwright/test').Page} page
 * @param {{phone?:string, otp?:string}} creds
 */
export async function login(page, creds = LOGIN) {
  await openLogin(page);

  const phone = await firstVisible(page, PHONE_SEL, 10000);
  if (!phone) {
    throw new Error(
      'PHONE_INPUT_NOT_FOUND: mobile-number field not located on the login screen — ' +
      'confirm PHONE_SEL in lib/auth.js'
    );
  }
  await phone.fill(String(creds.phone));
  if (!(await clickSubmit(page))) await phone.press('Enter');

  // Wait for the OTP step to appear, then fill it.
  const otpReady = await firstVisible(page, OTP_BOX, 12000);
  if (!otpReady) {
    throw new Error(
      'OTP_STEP_NOT_FOUND: OTP boxes did not appear after submitting the phone — ' +
      'confirm the store issues a fixed OTP for the fixture number and check OTP_BOX in lib/auth.js'
    );
  }
  if (!(await fillOtp(page, creds.otp))) {
    throw new Error('OTP_FILL_FAILED: could not fill the OTP boxes — check OTP_BOX in lib/auth.js');
  }
  if (!(await clickSubmit(page))) await otpReady.press('Enter');

  // Logged-in signal: the phone field is gone (we left the login screen).
  await page.waitForLoadState('networkidle').catch(() => {});
  const stillOnLogin = await firstVisible(page, PHONE_SEL, 3000);
  if (stillOnLogin) {
    throw new Error(
      'LOGIN_DID_NOT_COMPLETE: still on the login form after submitting the OTP — ' +
      'verify the fixture credentials (QA_LOGIN_PHONE / QA_LOGIN_OTP) and the flow'
    );
  }
}
