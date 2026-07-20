// Build a single self-contained HTML report for a theme run.
// The headline reflects whether the AUTOMATION completed — not whether the theme
// "passed". Theme results (structural + E2E) are shown below as findings to review.
import fs from 'fs';
import path from 'path';

const themeId = process.env.THEME_ID || process.argv[2] || 'default';
const base = `runs/${themeId}`;
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } };

const validate = read(`${base}/validate.json`);
const pw = read(`${base}/results.json`);

const tests = [];
if (pw?.suites) {
  const walk = (s, file) => {
    const f = s.file || file;
    (s.specs || []).forEach((spec) => spec.tests.forEach((t) => {
      const r = t.results?.[t.results.length - 1] || {};
      const shots = (r.attachments || []).filter((a) => a.contentType === 'image/png' && a.path && fs.existsSync(a.path));
      tests.push({
        title: spec.title, file: f, project: t.projectName || '',
        status: r.status || 'unknown',
        error: (r.error && (r.error.message || '')) || '',
        annotations: (t.annotations || []).map((a) => a.description).filter(Boolean),
        shots,
      });
    }));
    (s.suites || []).forEach((x) => walk(x, f));
  };
  pw.suites.forEach((s) => walk(s));
}

const counts = tests.reduce((a, t) => (a[t.status] = (a[t.status] || 0) + 1, a), {});
const passed = (counts.passed || 0) + (counts.expected || 0);
const failed = tests.filter((t) => !['passed','expected','skipped'].includes(t.status)).length;
const skipped = counts.skipped || 0;
const structuralPass = validate ? validate.passed_gate !== false : null;

// The METRIC: did the automation run end to end? (validate reachable + E2E produced results)
const automationOk = validate !== null && pw !== null;

const esc = (s) => String(s || '').replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const b64 = (p) => { try { return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64'); } catch { return ''; } };
const badge = (st) => {
  const map = { passed:'#2f855a', expected:'#2f855a', failed:'#c53030', timedOut:'#c53030', skipped:'#a0aec0', unknown:'#a0aec0' };
  return `<span style="background:${map[st]||'#a0aec0'};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">${st}</span>`;
};

const rows = tests.map((t) => `
  <tr>
    <td style="white-space:nowrap">${badge(t.status)}</td>
    <td><b>${esc(t.title)}</b> <span style="color:#888">${esc(t.project)}</span>
      ${t.error ? `<div style="color:#c53030;font-size:12px;margin-top:4px;white-space:pre-wrap">${esc(t.error).slice(0,600)}</div>` : ''}
      ${t.annotations.length ? `<div style="color:#b7791f;font-size:12px;margin-top:4px">⚠ ${esc(t.annotations.join(' | ')).slice(0,400)}</div>` : ''}
      ${t.shots.map((s) => `<div><img src="${b64(s.path)}" style="max-width:520px;border:1px solid #ddd;border-radius:6px;margin-top:6px"></div>`).join('')}
    </td>
  </tr>`).join('');

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>Theme QA Report — ${esc(themeId)}</title>
<style>body{font-family:'IBM Plex Sans Arabic',system-ui,Segoe UI,Tahoma,sans-serif;margin:24px;color:#1f0433}
h1{font-size:20px} table{border-collapse:collapse;width:100%} td{border-bottom:1px solid #eee;padding:8px;vertical-align:top}
.hero{padding:14px 18px;border-radius:12px;margin:12px 0;font-size:18px;font-weight:700}
.sum{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0}
.card{border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;min-width:120px}
.big{font-size:22px;font-weight:700}.muted{color:#6b6478;font-size:13px}</style></head><body>
<h1>تقرير اختبار الثيم — ${esc(themeId)}</h1>
<div class="hero" style="background:${automationOk?'#e9f7ef':'#fdecec'};color:${automationOk?'#1f7a4d':'#c02b2b'}">
  ${automationOk ? '✅ اكتمل الاختبار الآلي بنجاح' : '⚠️ لم تكتمل الأتمتة'}
</div>
<p class="muted">المقياس هنا هو <b>نجاح الأتمتة</b> (تشغيل الفحص كامل)، مو حكم نهائي على الثيم.
النتائج أدناه <b>ملاحظات للمراجعة</b> — أي فشل قد يكون خللاً في الثيم أو يحتاج ضبط سيلكتور/بيانات المتجر التجريبي.</p>
<div class="sum">
  <div class="card"><div class="big">${validate ? `${validate.passed}/${validate.total}` : '—'}</div><div class="muted">تمبلتس بنيوية</div></div>
  <div class="card"><div class="big" style="color:#2f855a">${passed}</div><div class="muted">فحوصات ناجحة</div></div>
  <div class="card"><div class="big" style="color:#c53030">${failed}</div><div class="muted">تحتاج مراجعة</div></div>
  <div class="card"><div class="big" style="color:#a0aec0">${skipped}</div><div class="muted">متخطّاة</div></div>
</div>
<p class="muted">الفحص البنيوي (/validate): <b>${structuralPass===null?'لم يُشغّل':structuralPass?'مكتمل':'فيه ملاحظات'}</b>
${validate?.failing_templates?.length ? ' · تمبلتس بها ملاحظات: ' + esc(validate.failing_templates.join(', ')) : ''}</p>
<h3 style="margin-top:22px">تفاصيل الفحوصات</h3>
<table>${rows || '<tr><td>لا توجد نتائج E2E. شغّلي: npx playwright test</td></tr>'}</table>
<p class="muted" style="margin-top:20px">Generated by zid-theme-qa</p>
</body></html>`;

fs.mkdirSync(base, { recursive: true });
const outPath = path.join(base, 'report.html');
fs.writeFileSync(outPath, html);
console.log(`Report written: ${outPath}  (automation ${automationOk ? 'OK' : 'incomplete'}; ${passed} passed, ${failed} to review, ${skipped} skipped)`);
