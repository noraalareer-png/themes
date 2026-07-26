// lib/auth.js — fixture-store login for authenticated theme QA tests.
//
// Zid storefronts sign in with a MOBILE NUMBER + OTP (no password). This store's
// customer login is delivered via WHATSAPP, reachable directly at:
//   /auth/login?method=whatsapp&redirect_to=/account
// Going straight to that URL is more reliable than clicking the header icon
// (which can land on a different method / a method-chooser). On the QA fixture
// store the OTP is fixed, so login is fully deterministic in CI.
//
// Flow: open the whatsapp login URL -> fill mobile -> submit (send code) ->
// enter the OTP (4 separate boxes, or a single field) -> submit.
//
// Credentials/flow come from env (with fixture defaults) so nothing sensitive is
// hardcoded and CI can override via GitHub secrets:
//   QA_LOGIN_PHONE  (default 500000005)  fixture mobile number
//   QA_LOGIN_OTP    (default 1234)        fixture one-time code (WhatsApp)
//   QA_LOGIN_PATH   (default whatsapp login URL below)  override the login route
//
// login(page) is resilient and, if it can't perform the flow on this preview,
// THROWS a clear error — callers should test.skip with an actionable message
// (never a false pass), matching the rest of the suite's philosophy.

import { themed } from './helpers.js';

export const LOGIN = {
  phone: process.env.QA_LOGIN_PHONE || '500000005',
  otp:   process.env.QA_LOGIN_OTP   || '1234',
  // Direct WhatsApp login route (confirmed for this store).
  path:  process.env.QA_LOGIN_PATH  || '/auth/login?method=whatsapp&redirect_to=/account',
};

// --- selector pools (first visible match wins) ---

// Fallback only: if no explicit path, try to reach login via the header icon.
const ACCOUNT_ICON = [
  'header a[href*="auth/login" i]',
  'header a[href*="login" i]',
  'header a[href*="account" i]',
  'header a[href*="customer" i]',
  '[aria-label*="حساب" i]',
  '[aria-label*="account" i]',
  '[aria-label*="تسجيل" i], [aria-label*="login" i]',
];

const PHONE_SEL = [
  'input[type="tel"]',
  'input[name*="mobile" i]',
  'input[name*="phone" i]',
  'input[autocomplete="tel"]',
  'input[inputmode="tel"]',
  'input[inputmode="numeric"]',
  'input[placeholder*="جوال" i]',
  'input[placeholder*="رقم" i]',
  'input[placeholder*="واتس" i]',
  'input[placeholder*="mobile" i]',
  'input[placeholder*="phone" i]',
  'input[placeholder*="whats" i]',
];

// OTP is rendered as separate digit boxes on this store (with single-field fallback).
const OTP_BOX = [
  'input[maxlength="1"]',
  'input[autocomplete="one-time-code"]',
  'input[name*="otp" i]',
  'input[name*="code" i]',
  'input[name*="pin" i]',
  'input[inputmode="numeric"]',
  'input[placeholder*="رمز" i]',
  'input[placeholder*="code" i]',
];

const SUBMIT_TEXT = [
  /إرسال الرمز|إرسال الكود|إرسال|التالي|متابعة|استمرار|تحقق|تأكيد|دخول|تسجيل الدخول/i,
  /send ?(code)?|next|continue|verify|confirm|log ?in|sign ?in|submit|get ?code/i,
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
  const submit = page.locator('button[type="submit"], input[type="submit"]').first();
  if ((await submit.count()) && (await submit.isVisible().catch(() => false))) {
    await submit.click();
    return true;
  }
  return false;
}

/** Open the login screen: explicit/whatsapp path (default) or header icon fallback. */
async function openLogin(page) {
  if (LOGIN.path) {
    await page.goto(themed(LOGIN.path));
    await page.waitForLoadState('networkidle').catch(() => {});
    return;
  }
  await page.goto(themed('/'));
  await page.waitForLoadState('domcontentloaded');
  const icon = await firstVisible(page, ACCOUNT_ICON, 8000);
  if (!icon) {
    throw new Error(
      'LOGIN_ENTRY_NOT_FOUND: no login route reachable — set QA_LOGIN_PATH ' +
      '(e.g. /auth/login?method=whatsapp&redirect_to=/account)'
    );
  }
  await icon.click();
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Fill an N-digit OTP across separate boxes, or a single field. */
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
 * Perform the fixture WhatsApp login. Throws with a clear code if a step is missing.
 * @param {import('@playwright/test').Page} page
 * @param {{phone?:string, otp?:string}} creds
 */
export async function login(page, creds = LOGIN) {
  await openLogin(page);

  const phone = await firstVisible(page, PHONE_SEL, 10000);
  if (!phone) {
    throw new Error(
      'PHONE_INPUT_NOT_FOUND: mobile-number field not located on the whatsapp login screen — ' +
      'confirm PHONE_SEL / QA_LOGIN_PATH in lib/auth.js'
    );
  }
  await phone.click();
  await phone.fill(String(creds.phone));
  if (!(await clickSubmit(page))) await phone.press('Enter');

  // Wait for the OTP step (WhatsApp code entry) to appear, then fill it.
  const otpReady = await firstVisible(page, OTP_BOX, 15000);
  if (!otpReady) {
    throw new Error(
      'OTP_STEP_NOT_FOUND: OTP entry did not appear after submitting the phone — ' +
      'confirm the whatsapp code is issued for the fixture number and check OTP_BOX in lib/auth.js'
    );
  }
  if (!(await fillOtp(page, creds.otp))) {
    throw new Error('OTP_FILL_FAILED: could not fill the OTP field(s) — check OTP_BOX in lib/auth.js');
  }
  if (!(await clickSubmit(page))) await otpReady.press('Enter');

  // Logged-in signal: we left the login screen (phone field gone).
  await page.waitForLoadState('networkidle').catch(() => {});
  const stillOnLogin = await firstVisible(page, PHONE_SEL, 3000);
  if (stillOnLogin) {
    throw new Error(
      'LOGIN_DID_NOT_COMPLETE: still on the login form after submitting the OTP — ' +
      'verify the fixture credentials (QA_LOGIN_PHONE / QA_LOGIN_OTP) and the flow'
    );
  }
}
