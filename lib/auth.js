// lib/auth.js — fixture-store login for authenticated theme QA tests.
//
// Zid storefronts sign in with a MOBILE NUMBER + OTP (no password). This store's
// customer login is delivered via WHATSAPP, reachable directly at:
//   /auth/login?method=whatsapp&redirect_to=/account
//
// Confirmed flow (from the live store, MUI components):
//   phone screen  -> fill mobile -> click the primary "send code" button
//   OTP screen    -> "تحقق من رقم الهاتف", 4 boxes: <input aria-label="OTP digit N"
//                    autocomplete="one-time-code" inputmode="numeric"> -> fill 1234
// The OTP screen also has decoy buttons ("تحقق برسالة نصية", "المتابعة كزائر",
// "إعادة إرسال الرمز") which we must NOT click — handled by a denylist.
//
// On the QA fixture store the OTP is fixed, so login is deterministic in CI.
//
// Env (fixture defaults; CI can override via secrets):
//   QA_LOGIN_PHONE (500000005)  QA_LOGIN_OTP (1234)
//   QA_LOGIN_PATH  (whatsapp login URL below)
//
// login(page) throws a clear error if a step can't be performed; callers should
// test.skip with an actionable message (never a false pass).

import { themed } from './helpers.js';

export const LOGIN = {
  phone: process.env.QA_LOGIN_PHONE || '500000005',
  otp:   process.env.QA_LOGIN_OTP   || '1234',
  path:  process.env.QA_LOGIN_PATH  || '/auth/login?method=whatsapp&redirect_to=/account',
};

const ACCOUNT_ICON = [
  'header a[href*="auth/login" i]', 'header a[href*="login" i]',
  'header a[href*="account" i]', 'header a[href*="customer" i]',
  '[aria-label*="حساب" i]', '[aria-label*="account" i]', '[aria-label*="تسجيل" i]', '[aria-label*="login" i]',
];

const PHONE_SEL = [
  'input[type="tel"]', 'input[name*="mobile" i]', 'input[name*="phone" i]',
  'input[autocomplete="tel"]', 'input[inputmode="tel"]',
  'input[placeholder*="جوال" i]', 'input[placeholder*="رقم" i]', 'input[placeholder*="واتس" i]',
  'input[placeholder*="mobile" i]', 'input[placeholder*="phone" i]', 'input[placeholder*="whats" i]',
  'input[aria-label*="جوال" i]', 'input[aria-label*="phone" i]', 'input[aria-label*="mobile" i]',
];

// OTP boxes (confirmed): aria-label="OTP digit N", autocomplete=one-time-code, inputmode=numeric.
const OTP_BOX = [
  'input[aria-label*="OTP" i]',
  'input[aria-label*="رمز" i]',
  'input[autocomplete="one-time-code"]',
  'input[maxlength="1"]',
  'input[name*="otp" i]', 'input[name*="code" i]', 'input[name*="pin" i]',
  'input[inputmode="numeric"]',
];

const SUBMIT_TEXT = [
  /إرسال الرمز|إرسال الكود|إرسال|التالي|متابعة|استمرار|تحقق|تأكيد|دخول|تسجيل الدخول/i,
  /send ?(code)?|next|continue|verify|confirm|log ?in|sign ?in|submit|get ?code/i,
];

// Buttons we must NEVER click as "submit" (decoys on the OTP/phone screens).
const SUBMIT_DENY = /كزائر|زائر|guest|رسالة نصية|نصية|sms|رجوع|back|إلغاء|cancel|إعادة إرسال|resend/i;

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

/**
 * Click the primary submit/CTA. Text matches first; then a real submit button;
 * then (only if allowFallback) the first visible enabled button NOT in the deny
 * list — this is what actually presses the phone screen's "send code" CTA when
 * it has no matching text. On the OTP screen we pass allowFallback:false so we
 * never hit a decoy ("verify by SMS" / "continue as guest").
 */
async function clickSubmit(page, { allowFallback = true } = {}) {
  for (const re of SUBMIT_TEXT) {
    for (const role of ['button', 'link']) {
      const el = page.getByRole(role, { name: re }).first();
      if ((await el.count()) && (await el.isVisible().catch(() => false))) {
        await el.click({ timeout: 5000 }).catch(() => {});
        return true;
      }
    }
  }
  const submit = page.locator('button[type="submit"], input[type="submit"]').first();
  if ((await submit.count()) && (await submit.isVisible().catch(() => false))) {
    await submit.click({ timeout: 5000 }).catch(() => {});
    return true;
  }
  if (!allowFallback) return false;
  const buttons = page.locator('button:not([disabled])');
  const bn = await buttons.count();
  for (let i = 0; i < bn; i++) {
    const b = buttons.nth(i);
    if (!(await b.isVisible().catch(() => false))) continue;
    const t = (((await b.innerText().catch(() => '')) || '')).trim();
    if (!t || SUBMIT_DENY.test(t)) continue;
    await b.click({ timeout: 5000 }).catch(() => {});
    return true;
  }
  return false;
}

async function openLogin(page) {
  if (LOGIN.path) {
    await page.goto(themed(LOGIN.path));
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    return;
  }
  await page.goto(themed('/'));
  await page.waitForLoadState('domcontentloaded');
  const icon = await firstVisible(page, ACCOUNT_ICON, 8000);
  if (!icon) throw new Error('LOGIN_ENTRY_NOT_FOUND: set QA_LOGIN_PATH (e.g. /auth/login?method=whatsapp&redirect_to=/account)');
  await icon.click({ timeout: 5000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
}

/** Fill the OTP: one digit per box (aria-label boxes), with fallbacks. */
async function fillOtp(page, code) {
  const digits = String(code).split('');

  // Preferred: aria-label="OTP digit N" boxes (confirmed on this store).
  const named = page.locator('input[aria-label*="OTP" i], input[aria-label*="رمز" i]');
  if ((await named.count()) >= digits.length) {
    for (let i = 0; i < digits.length; i++) {
      await named.nth(i).click({ timeout: 3000 }).catch(() => {});
      await named.nth(i).fill(digits[i]).catch(() => {});
    }
    return true;
  }

  // Fallback: single-char boxes.
  const ones = page.locator('input[maxlength="1"]');
  if ((await ones.count()) >= digits.length) {
    for (let i = 0; i < digits.length; i++) await ones.nth(i).fill(digits[i]).catch(() => {});
    return true;
  }

  // Fallback: one combined field.
  const single = await firstVisible(page, OTP_BOX, 2000);
  if (single) {
    await single.click({ timeout: 3000 }).catch(() => {});
    await single.fill('').catch(() => {});
    await single.type(String(code), { delay: 120 }).catch(() => {});
    return true;
  }
  return false;
}

export async function login(page, creds = LOGIN) {
  await openLogin(page);

  const phone = await firstVisible(page, PHONE_SEL, 10000);
  if (!phone) throw new Error('PHONE_INPUT_NOT_FOUND: mobile field not on the whatsapp login screen — check PHONE_SEL / QA_LOGIN_PATH');
  await phone.click({ timeout: 5000 }).catch(() => {});
  await phone.fill(String(creds.phone));
  await page.waitForTimeout(400);                 // let MUI validation enable the button
  if (!(await clickSubmit(page))) await phone.press('Enter').catch(() => {});

  // Wait for the OTP entry screen ("تحقق من رقم الهاتف").
  const otpReady = await firstVisible(page, OTP_BOX, 15000);
  if (!otpReady) throw new Error('OTP_STEP_NOT_FOUND: OTP entry did not appear after submitting the phone — check the send-code button / OTP_BOX');

  if (!(await fillOtp(page, creds.otp))) throw new Error('OTP_FILL_FAILED: could not fill the OTP boxes — check OTP_BOX');

  // Confirm: many segmented OTPs auto-submit; otherwise click a verify button by
  // TEXT only (no generic fallback, so we never hit "verify by SMS"/"guest").
  await page.waitForTimeout(500);
  if (!(await clickSubmit(page, { allowFallback: false }))) await otpReady.press('Enter').catch(() => {});

  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  const stillOnLogin = await firstVisible(page, PHONE_SEL, 3000);
  if (stillOnLogin) throw new Error('LOGIN_DID_NOT_COMPLETE: still on the login form after OTP — verify QA_LOGIN_PHONE / QA_LOGIN_OTP');
}
