// Email the single-file HTML report to yourself (or anyone) — in ALL cases,
// pass or fail. Great while testing the solution.
//
// It (re)builds runs/<THEME_ID>/report.html, then emails it as an attachment.
//
// Required env:
//   THEME_ID        the theme you tested
//   REPORT_TO       recipient email (e.g. your own)
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS   (SMTP account to send from)
// Example (PowerShell):
//   $env:REPORT_TO="me@zid.sa"
//   $env:SMTP_HOST="smtp.gmail.com"; $env:SMTP_PORT="587"
//   $env:SMTP_USER="me@gmail.com";   $env:SMTP_PASS="app-password"
//   node scripts\email_report.js
import fs from 'fs';
import { execSync } from 'child_process';

const env = process.env;
const themeId = env.THEME_ID || process.argv[2] || 'default';
const base = `runs/${themeId}`;

// 1) (re)build the report so it's always fresh
try { execSync(`node scripts/build_report.js ${themeId}`, { stdio: 'inherit' }); }
catch (e) { console.error('build_report failed:', e.message); }

const reportPath = `${base}/report.html`;
if (!fs.existsSync(reportPath)) {
  console.error(`No report at ${reportPath}. Run "npx playwright test" first.`);
  process.exit(1);
}

// derive pass/fail for the subject
const read = (p) => { try { return JSON.parse(fs.readFileSync(p,'utf-8')); } catch { return null; } };
const v = read(`${base}/validate.json`); const pw = read(`${base}/results.json`);
let failed = 0; if (pw?.suites){ const w=s=>{(s.specs||[]).forEach(sp=>sp.tests.forEach(t=>{const st=t.results?.[t.results.length-1]?.status; if(st&&!['passed','expected','skipped'].includes(st))failed++;}));(s.suites||[]).forEach(w)}; pw.suites.forEach(w);}
const overall = failed === 0 && (v ? v.passed_gate !== false : true);
const subject = `[Theme QA] ${overall ? 'PASS' : 'FAIL'} — ${themeId}`;

const to = env.REPORT_TO;
if (!to) { console.log(`\nREPORT_TO not set. Report ready at: ${reportPath}\n(set REPORT_TO + SMTP_* to email it automatically)`); process.exit(0); }

// --- Option A: Resend (recommended for servers / CI) ---
if (env.RESEND_API_KEY) {
  const from = env.EMAIL_FROM || 'Theme QA <onboarding@resend.dev>';
  const content = fs.readFileSync(reportPath).toString('base64');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to, subject,
      html,
      attachments: [{ filename: `theme-qa-${themeId}.html`, content }],
    }),
  });
  const out = await r.text();
  if (r.ok) { console.log(`Sent report for ${themeId} to ${to} via Resend  (${subject})`); process.exit(0); }
  console.error(`Resend error ${r.status}: ${out.slice(0, 300)}`); process.exit(1);
}

// --- Option B: SMTP ---
if (!env.SMTP_HOST) {
  console.log(`\nNo email service configured. Report ready at: ${reportPath}\nSet RESEND_API_KEY (+EMAIL_FROM), or SMTP_* , to send to ${to}.`);
  process.exit(0);
}

const nodemailer = (await import('nodemailer')).default;
const t = nodemailer.createTransport({
  host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587),
  secure: Number(env.SMTP_PORT) === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});
const html = fs.readFileSync(reportPath, 'utf-8');
await t.sendMail({
  from: env.SMTP_USER, to, subject,
  text: `Theme QA report for ${themeId}. Result: ${overall ? 'PASS' : 'FAIL'}. Report attached.`,
  html,  // also render inline
  attachments: [{ filename: `theme-qa-${themeId}.html`, path: reportPath }],
});
console.log(`Sent report for ${themeId} to ${to}  (${subject})`);
