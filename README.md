# Zid (Vitrin) Theme QA Automation

Automates the manual QA pass that runs when a partner submits a theme. Three layers:

| Layer | What it does | Status |
|-------|--------------|--------|
| **1. Structural gate** (`validate_check.py`) | Reads the platform's `/validate?theme=<id>` report, flags failed/missing templates, requirements, recommendations. Deterministic. | Working |
| **2. Functional/visual E2E** (`tests/`, Playwright) | Drives the preview link as a headless browser: navigation, search, add-to-cart, coupon, 404, console errors, broken images, mobile + RTL, **and every theme section (data-driven)**. | Scaffold — selectors need mapping |
| **3. Report + email** (`scripts/build_report.js` + `email_report.js`) | Builds a single-file HTML report and emails it to the requester (Resend), pass or fail. Also on GitHub Pages. | Working |

## Quick start
```bash
pip install beautifulsoup4
npm install && npx playwright install chromium

export PREVIEW_BASE=https://on0xnj.dev.zid.store
export THEME_ID=5e85a37d-3ee6-4e19-b1a5-74e73aadc597

python3 validate_check.py --preview $PREVIEW_BASE --theme $THEME_ID --json validate.json
python3 enumerate_sections.py --preview $PREVIEW_BASE --theme $THEME_ID --out sections.json
npx playwright test
SLACK_WEBHOOK_URL=... node scripts/notify-slack.js
```

## CI
`.github/workflows/theme-qa.yml` runs the full pipeline. Trigger it two ways:
- **Manual:** Actions -> Theme QA -> Run workflow, paste preview base + theme id.
- **On submission:** have the "partner uploaded a theme" event POST a `repository_dispatch`
  (`event_type: theme_submitted`, `client_payload: { preview_base, theme_id }`).

Set repo secret `SLACK_WEBHOOK_URL` for the QA channel notification.

## Test IDs
Each test title starts with a stable ID (e.g. `CART-coupon`, `PDP-05`) that maps back to
the Notion checklist. See `checklist-coverage.md` for the full mapping and which items
are automatable vs. still manual.

## What the team needs to provide
See `REQUIREMENTS.md` — the fixed test store, kitchen-sink preset, theme-status API, partner email
in the payload, and email-service choice. `HOOKS_CONTRACT.md` (partners) + `FIXTURE_STORE.md` (data)
are the specs referenced there.

## The one open decision
Reliable functional assertions need **known store data** (a product with variants, an
out-of-stock item, a valid + invalid coupon, a 3-level category, a bundle...). Today each
theme previews against the partner's own dev store, so data varies. See `DESIGN.md` ->
"Fixture store" for the recommendation.
"# themes" 
