# Deploy — partner web form + GitHub Actions runner

Architecture: the **Vercel form** takes a validation link + email and triggers a **GitHub Actions**
run (which runs the Playwright tests and emails the report via **Resend**). Vercel stays light;
GitHub does the heavy browser work.

```
Partner → [Vercel form] → /api/run → triggers → [GitHub Actions]
                                                     ├─ Layer 1 /validate
                                                     ├─ Layer 2 Playwright
                                                     ├─ build report.html
                                                     └─ email report (Resend) → requester
```

---

## 1) Put the project on GitHub
```bash
cd zid-theme-qa
git init && git add -A && git commit -m "theme qa"
# create a repo (e.g. zidsa/theme-qa) then:
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

## 2) GitHub — enable Pages + add secrets
- **Settings → Pages →** Source: "GitHub Actions".
- **Settings → Secrets and variables → Actions:**
  - Secret `RESEND_API_KEY` — from https://resend.com (API Keys).
  - Variable `EMAIL_FROM` — e.g. `Theme QA <qa@yourdomain.com>` (must be a verified Resend
    sender/domain; for a quick test you can use `onboarding@resend.dev`).
- Make sure the workflow file is at `.github/workflows/theme-qa.yml` (it is) and run it once
  manually (Actions → Theme QA → Run workflow) to confirm it works.

## 3) Resend (email)
- Sign up at https://resend.com → **API Keys** → create one → that's `RESEND_API_KEY`.
- To send from your own domain, add + verify it under **Domains**, then set `EMAIL_FROM` to an
  address on it. For testing, `onboarding@resend.dev` works without a domain.

## 4) GitHub token for the form to trigger runs
- Create a **fine-grained PAT** (https://github.com/settings/tokens):
  - Repository access: only your repo.
  - Permissions: **Actions → Read and write**.
- Copy the token — it becomes `GH_TOKEN` in Vercel.

## 5) Deploy to Vercel
- Import the repo at https://vercel.com/new (framework: "Other").
- **Settings → Environment Variables:**
  | Name | Value |
  |------|-------|
  | `GH_TOKEN` | the fine-grained PAT from step 4 |
  | `GH_REPO` | `<owner>/<repo>` (e.g. `zidsa/theme-qa`) |
  | `GH_REF` | `main` |
  | `GH_WORKFLOW` | `theme-qa.yml` |
- Deploy. Your form is live at `https://<project>.vercel.app`.

## 6) Use it
Open the Vercel URL → paste a validation link + email → **Run**. In a few minutes the report
arrives by email, and the full report is also on GitHub Pages.

---

## Notes
- The form only *triggers* the run; the tests run on GitHub's runners (they can run real browsers).
- Each theme's results are kept under `runs/<theme_id>/` on the runner and published to Pages.
- Costs: GitHub Actions free minutes + Vercel Hobby + Resend free tier cover low volume.
- Security: never commit tokens. All secrets live in GitHub/Vercel settings, not in the repo.
