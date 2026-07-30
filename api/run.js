// Vercel serverless function.
// Receives { link, email, preset? }, extracts preview base + theme id, and triggers
// the GitHub Actions workflow (the heavy Playwright run happens there, not on Vercel).
//
// If the partner attached a preset (.json) on the form, we pass it to the workflow
// (base64 in a workflow input) so the pipeline can extract the placed sections and
// run the section-coverage diff. Nothing is stored: it rides the dispatch once.
//
// Required Vercel env vars:
//   GH_TOKEN   GitHub PAT with "actions:write" on the repo
//   GH_REPO    "owner/repo"
//   GH_REF     branch to run on (default "main")
//   GH_WORKFLOW workflow file name (default "theme-qa.yml")
import zlib from 'zlib';

const PRESET_MAX_RAW = 2000000;  // sane upper bound on the raw preset JSON (2 MB)
const PRESET_MAX_B64 = 60000;    // gzipped+base64 must fit one workflow_dispatch input

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { link, email, preset } = body || {};

  if (!link || !email) return res.status(400).json({ error: 'الرابط والإيميل مطلوبين' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'إيميل غير صحيح' });

  // parse the validation link
  let previewBase, themeId;
  try {
    const u = new URL(link);
    previewBase = u.origin;                       // https://xxxx.dev.zid.store
    themeId = u.searchParams.get('theme');        // ?theme=<uuid>
  } catch { return res.status(400).json({ error: 'رابط غير صالح' }); }
  if (!themeId) return res.status(400).json({ error: 'الرابط ما فيه ?theme= — تأكد إنه رابط الفاليديشن' });

  // preset is REQUIRED: validate it's JSON, then gzip + base64 (JSON compresses
  // ~5-8x, so even large presets fit in one workflow input; the workflow gunzips it).
  if (!preset || typeof preset !== 'string') return res.status(400).json({ error: 'ملف الإعدادات (preset) مطلوب' });
  try { JSON.parse(preset); } catch { return res.status(400).json({ error: 'ملف الإعدادات مو JSON صالح' }); }
  if (preset.length > PRESET_MAX_RAW) {
    return res.status(400).json({ error: 'ملف الإعدادات كبير جدًا — استخدمي رابط preset_url' });
  }
  const presetB64 = zlib.gzipSync(Buffer.from(preset, 'utf-8')).toString('base64');
  if (presetB64.length > PRESET_MAX_B64) {
    return res.status(400).json({ error: 'ملف الإعدادات كبير جدًا حتى بعد الضغط — استخدمي رابط preset_url' });
  }

  const repo = process.env.GH_REPO;
  const token = process.env.GH_TOKEN;
  const ref = process.env.GH_REF || 'main';
  const workflow = process.env.GH_WORKFLOW || 'theme-qa.yml';
  if (!repo || !token) return res.status(500).json({ error: 'الخادم غير مهيأ (GH_REPO/GH_TOKEN)' });

  const inputs = {
    preview_base: previewBase,
    theme_id: themeId,
    report_to: email,
    theme_name: new URL(previewBase).hostname,
  };
  if (presetB64) inputs.preset_b64 = presetB64;

  const gh = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref, inputs }),
    }
  );

  if (gh.status === 204) {
    return res.status(200).json({ ok: true, preview_base: previewBase, theme_id: themeId, preset: !!presetB64 });
  }
  const detail = await gh.text().catch(() => '');
  return res.status(502).json({ error: 'تعذّر تشغيل الاختبار على GitHub', status: gh.status, detail: detail.slice(0, 300) });
}
