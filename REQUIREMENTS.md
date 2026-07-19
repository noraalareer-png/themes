# Theme QA automation — requirements to send the team

نبني أتمتة لاختبار ثيمات الباتنرز. عشان نشغّلها نحتاج من التيم الأشياء التالية.
This is everything the platform/infra team needs to provide so the automated theme-QA
pipeline can run end to end. Grouped by owner. Items marked **[BLOCKER]** are needed before
the strong (value-based) version can run; the rest can follow.

---

## 1. Fixed QA test store  **[BLOCKER]**
Owner: platform / data

Create **one Zid-controlled test store** that any submitted theme is rendered against, seeded
with the exact fixtures in `FIXTURE_STORE.md`. Summary of what to add:

- **Store settings:** Arabic + English enabled, SAR currency, test VAT number, test CR number,
  fixed business address, ≥2 countries, loyalty program enabled.
- **9 products with fixed slugs & known values:** `qa-standard` (100.00), `qa-variants`
  (variant M=120, variant L out-of-stock), `qa-discount` (200→150, 25% off), `qa-oos` (qty 0),
  `qa-lowstock` (qty 2), `qa-vat-exempt`, `qa-qty-limit` (max 3), `qa-bundle`, `qa-custom-fields`.
- **3-level category tree:** `qa-cat-a → qa-cat-a1 → qa-cat-a1a`, each with products + image/cover.
- **Coupons:** `TEST10` (valid, 10% off), `EXPIRED0` (expired/invalid), `MINSPEND` (min-cart).
- **Shipping:** ≥2 methods with logos, one with Cash-on-Delivery, known cities + price.
- **Payments:** ≥2 methods with logos. **Bank accounts:** ≥1 with full details.
- **Content:** 1 blog post with known HTML body, 1 FAQ Q&A.

> Deliverable back to us: confirmation the store exists + its **preview base URL**, and any slug
> changes so we can update `fixtures.json`.

## 2. Pass the partner's preset JSON into the pipeline  **[BLOCKER for section coverage]**
Owner: backend / whoever fires the "theme submitted" event

No new preset needs to be created — partners already export and upload a **preset JSON** with the
theme (Customize → Export → upload with the version). We just need that file made available to the
QA run (a URL/path to the uploaded preset, or its contents in the trigger payload). We parse it to
know which sections the partner configured, and test those on the test-store preview. Sections not
in the preset stay covered by `/validate`'s isolated render check.

> Also send us **one populated preset example** (real sections, not empty settings) so we can
> finalize the parser.

## 3. Stable test hooks in themes
Owner: themes team + partner comms

Add the `data-testid` and `data-section-type` attributes in `HOOKS_CONTRACT.md` to the **3 template
themes** on GitHub (so partners inherit them by copying), publish the contract in the theme-dev docs,
and add partner awareness (a note / validate-report recommendation when hooks are missing).

## 4. Theme-status API (to auto-reject)  **[BLOCKER for auto-reject]**
Owner: backend

We need the internal endpoint that sets a theme's review status. Please provide:

- **Endpoint URL** + HTTP method (e.g. `PATCH /internal/themes/{themeId}/status`).
- **Auth:** how the CI authenticates (service token? which header?). Store as a CI secret.
- **Payload shape:** the exact body/enum to set status = **rejected** (and the value for accepted,
  even if we won't use it now), and where to attach the report URL / rejection reason.
- Confirm we should **only** set "rejected" on failure, and **never** change status on pass
  (pass = manual publish by QA).

## 5. Partner email in the submission payload  **[BLOCKER for emailing partner]**
Owner: backend / whoever fires the "theme submitted" event

The event that triggers QA must include the **partner's email** (and theme id + preview base).
We pass it straight into the pipeline. Fields we expect per run:
`{ theme_id, preview_base, partner_email, theme_name, preset_url }`.

## 6. Email sending service
Owner: infra — **decision needed**

We'll send two report emails on failure (one to the partner, one to the internal QA list). Pick one
and give us credentials as CI secrets:

- **SMTP** (a mailbox like `themes-qa@zid.sa`): host, port, user, password.
- **or API provider** (SendGrid / SES / …): API key + verified sender.

Also confirm the **internal QA distribution email** (where our copy goes), e.g. `themes-qa@zid.sa`.
The pipeline supports both; it just needs the chosen one's secrets.

## 7. Report hosting (GitHub Pages)
Owner: us (with repo access)

We publish the HTML report to **GitHub Pages** and deep-link it from the emails/Slack. Needs: a repo
for this pipeline with Pages enabled, and the Slack **incoming webhook** for the QA channel
(`SLACK_WEBHOOK_URL` secret).

---

## Flow this enables
```
theme submitted (theme_id, preview_base, partner_email, theme_name)
        │
        ▼
   run QA  →  structural gate (/validate)  +  functional/visual E2E  +  section checks
        │
        ├─ FAIL → publish HTML report to Pages
        │          → email PARTNER (summary + fixes + report link)
        │          → email INTERNAL QA copy (full detail + report link)
        │          → call status API: set theme = REJECTED
        │
        └─ PASS → Slack notice to QA channel: "Theme accepted, ready to publish"
                   (status unchanged — QA publishes manually)
```

## Secrets checklist (CI)
| Secret | For |
|--------|-----|
| `SLACK_WEBHOOK_URL` | Slack accept notice |
| `THEME_STATUS_API_URL` + `THEME_STATUS_API_TOKEN` | auto-reject |
| `SMTP_*` **or** `EMAIL_API_KEY` + `EMAIL_SENDER` | sending report emails |
| `QA_INTERNAL_EMAIL` | our copy of the report |
