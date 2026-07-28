// lib/auth.js — fixture-store login for authenticated theme QA tests.
//
// PREFERRED: authenticate via Zid's DOCUMENTED WhatsApp auth API (deterministic,
// no fragile UI clicks). See https://docs.zid.sa (Authentication):
//   POST {store}/api/v1/auth/whatsapp         -> requests the code
//     form: mobile_number, country_code, resend
//   POST {store}/api/v1/auth/whatsapp/verify  -> verifies + sets the session
//     form: mobile_number, country_code, code, is_newsletter_subscriber
// page.request shares the cookie jar with the browser context, so after verify
// every page.goto() on the store is authenticated.
//
// FALLBACK: drive the WhatsApp login UI (used only if the API path fails).
//
// On the QA fixture store the OTP is fixed, so login is deterministic in CI.
//
// Env (fixture defaults; CI can override via secrets):
//   QA_LOGIN_PHONE (500000005)  QA_LOGIN_OTP (1234)  QA_LOGIN_COUNTRY_CODE (+966)
//   QA_LOGIN_PATH  (whatsapp login URL, UI fallback)
//   PREVIEW_BASE   (store base URL — already set by the runner/config)

import { themed } from './helpers.js';

export const LOGIN = {
  phone:       process.env.QA_LOGIN_PHONE        || '500000005',
  otp:         process.env.QA_LOGIN_OTP          || '1234',
  countryCode: process.env.QA_LOGIN_COUNTRY_CODE || '+966',
  path:        process.env.QA_LOGIN_PATH         || '/auth/login?method=whatsapp&redirect_to=/account',
};

function storeBase() {
  return (process.env.PREVIEW_BASE || '').replace(/\/+$/, '');
}

/**
 * Preferred login: documented WhatsApp auth API. Sets the session cookie in the
 * browser context (shared via page.request), so later page.goto()s are logged in.
 * @throws on missing base or a non-OK verify response.
 */
export async function loginViaApi(page, creds = LOGIN) {
  const base = storeBase();
  if (!base) throw new Error('API_LOGIN_NO_BASE: PREVIEW_BASE not set');

  const form = { mobile_number: String(creds.phone), country_code: creds.countryCode };

  // 1) Request the code (fixed on the fixture store; harmless if already sent).
  await page.request.post(`${base}/api/v1/auth/whatsapp`, {
    form: { ...form, resend: 'false' },
  }).catch(() => {});

  // 2) Verify the code -> establishes the customer session.
  const res = await page.request.post(`${base}/api/v1/auth/whatsapp/verify`, {
    form: { ...form, code: String(creds.otp), is_newsletter_subscriber: 'true' },
  });
  if (!res.ok()) {
    const body = (await res.text().catch(() => '')).slice(0, 200);
    throw new Error(`API_VERIFY_FAILED: ${res.status()} ${body}`);
  }
  // Some responses signal "registration_needed" — surface it so the caller can skip clearly.
  const data = await res.json().catch(() => ({}));
  if (data && data.status === 'registration_needed') {
    throw new Error('API_REGISTRATION_NEEDED: fixture number is not a registered customer — register it once, or use a registered fixture');
  }
  return true;
}

// ------------------------- UI fallback (unchanged logic) -------------------------

const PHONE_SEL = [
  'input[type="tel"]', 'input[name*="mobile" i]', 'input[name*="phone" i]',
  'input[autocomplete="tel"]', 'input[inputmode="tel"]',
  'input[placeholder*="جوال" i]', 'input[placeholder*="رقم" i]', 'input[placeholder*="واتس" i]',
  'input[placeholder*="mobile" i]', 'input[placeholder*="phone" i]',
];
const OTP_BOX = [
  'input[aria-label*="OTP" i]', 'input[aria-label*="رمز" i]',
  'input[autocomplete="one-time-code"]', 'input[maxlength="1"]',
  'input[name*="otp" i]', 'input[name*="code" i]', 'input[inputmode="numeric"]',
];
const SUBMIT_TEXT = [
  /إرسال الرمز|إرسال|التالي|متابعة|تحقق|تأكيد|دخول|تسجيل الدخول/i,
  /send ?(code)?|next|continue|verify|confirm|log ?in|sign ?in|submit/i,
];
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
async function clickSubmit(page, { allowFallback = true } = {}) {
  for (const re of SUBMIT_TEXT) {
    for (const role of ['button', 'link']) {
      const el = page.getByRole(role, { name: re }).first();
      if ((await el.count()) && (await el.isVisible().catch(() => false))) { await el.click({ timeout: 5000 }).catch(() => {}); return true; }
    }
  }
  const submit = page.locator('button[type="submit"], input[type="submit"]').first();
  if ((await submit.count()) && (await submit.isVisible().catch(() => false))) { await submit.click({ timeout: 5000 }).catch(() => {}); return true; }
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
async function fillOtp(page, code) {
  const digits = String(code).split('');
  const named = page.locator('input[aria-label*="OTP" i], input[aria-label*="رمز" i]');
  if ((await named.count()) >= digits.length) {
    for (let i = 0; i < digits.length; i++) { await named.nth(i).click({ timeout: 3000 }).catch(() => {}); await named.nth(i).fill(digits[i]).catch(() => {}); }
    return true;
  }
  const ones = page.locator('input[maxlength="1"]');
  if ((await ones.count()) >= digits.length) { for (let i = 0; i < digits.length; i++) await ones.nth(i).fill(digits[i]).catch(() => {}); return true; }
  const single = await firstVisible(page, OTP_BOX, 2000);
  if (single) { await single.fill('').catch(() => {}); await single.type(String(code), { delay: 120 }).catch(() => {}); return true; }
  return false;
}
export async function loginViaUi(page, creds = LOGIN) {
  await page.goto(themed(creds.path));
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  const phone = await firstVisible(page, PHONE_SEL, 10000);
  if (!phone) throw new Error('PHONE_INPUT_NOT_FOUND (UI fallback)');
  await phone.click({ timeout: 5000 }).catch(() => {});
  await phone.fill(String(creds.phone));
  await page.waitForTimeout(400);
  if (!(await clickSubmit(page))) await phone.press('Enter').catch(() => {});
  const otpReady = await firstVisible(page, OTP_BOX, 15000);
  if (!otpReady) throw new Error('OTP_STEP_NOT_FOUND (UI fallback)');
  if (!(await fillOtp(page, creds.otp))) throw new Error('OTP_FILL_FAILED (UI fallback)');
  await page.waitForTimeout(500);
  if (!(await clickSubmit(page, { allowFallback: false }))) await otpReady.press('Enter').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
}

/**
 * Log in: try the documented API first (robust), fall back to the UI.
 * Throws with a combined reason if both fail (callers should test.skip).
 */
export async function login(page, creds = LOGIN) {
  try {
    await loginViaApi(page, creds);
    return;
  } catch (apiErr) {
    try {
      await loginViaUi(page, creds);
      return;
    } catch (uiErr) {
      throw new Error(`login failed — API: ${apiErr.message}; UI: ${uiErr.message}`);
    }
  }
}
