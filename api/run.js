// Vercel serverless function.
// Receives { link, email }, extracts preview base + theme id, and triggers the
// GitHub Actions workflow (the heavy Playwright run happens there, not on Vercel).
//
// Required Vercel env vars:
//   GH_TOKEN   GitHub PAT with "actions:write" on the repo (fine-grained or classic repo scope)
//   GH_REPO    "owner/repo"  (e.g. zidsa/theme-qa)
//   GH_REF     branch to run on (default "main")
//   GH_WORKFLOW workflow file name (default "theme-qa.yml")
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { link, email } = body || {};

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

  const repo = process.env.GH_REPO;
  const token = process.env.GH_TOKEN;
  const ref = process.env.GH_REF || 'main';
  const workflow = process.env.GH_WORKFLOW || 'theme-qa.yml';
  if (!repo || !token) return res.status(500).json({ error: 'الخادم غير مهيأ (GH_REPO/GH_TOKEN)' });

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
      body: JSON.stringify({
        ref,
        inputs: {
          preview_base: previewBase,
          theme_id: themeId,
          report_to: email,
          theme_name: new URL(previewBase).hostname,
        },
      }),
    }
  );

  if (gh.status === 204) return res.status(200).json({ ok: true, preview_base: previewBase, theme_id: themeId });
  const detail = await gh.text().catch(() => '');
  return res.status(502).json({ error: 'تعذّر تشغيل الاختبار على GitHub', status: gh.status, detail: detail.slice(0, 300) });
}
