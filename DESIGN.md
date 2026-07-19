# Theme QA Automation — Design

## The problem today
When a partner submits a theme, QA does a manual pass:
1. Partner uploads the theme; QA is notified.
2. QA opens the validation link `/validate?theme=<id>` and reads the report.
3. QA walks the Notion checklist (~116 checks across 10 groups) on the preview store.

Steps 2 and 3 are manual and slow, and the coverage/consistency depends on the reviewer.

## Key finding
**Step 2 is already automated by the platform.** The `/validate?theme=<id>` endpoint returns
a full per-template report (exists / schema valid / renders) plus Theme Requirements and
Recommendations. We don't rebuild this — we just *read it programmatically* and gate on it.

So the real automation work is **step 3**: the functional/visual checklist.

## Architecture — three layers

```
partner uploads theme
        │
        ▼
┌───────────────────────┐   reads the platform report, gates on
│ Layer 1: Structural    │   failed/missing templates + requirements
│ validate_check.py      │   → deterministic, done
└───────────┬───────────┘
            ▼
┌───────────────────────┐   headless browser drives the preview link:
│ Layer 2: Functional E2E │  navigation, search, add-to-cart, coupon,
│ Playwright (tests/)    │   404, console errors, broken images, mobile+RTL
└───────────┬───────────┘   → ~72% of checklist automatable
            ▼
┌───────────────────────┐   aggregate → Slack Pass/Fail + HTML report,
│ Layer 3: Report/Notify │   gate the CI job
│ notify-slack.js + CI   │   → done
└───────────────────────┘
```

Each E2E test title carries a stable ID (e.g. `CART-coupon`, `PDP-05`) mapped to the
Notion checklist, so a failure points straight at the checklist item.

## Coverage
See `checklist-coverage.md`. Estimated split: **~84 automatable, ~23 screenshot-assisted,
~9 manual** out of 116. The 84 are where the time savings come from; the 23 get a
screenshot attached so review is seconds, not minutes.

## The one decision that gates reliability: a fixture store
Functional assertions with specific *values* (a valid vs. invalid coupon, an out-of-stock
product, a 3-level category, a configured bundle, VAT-exempt item) need **known store data**.
Today each theme previews against the partner's own dev store, so the data is unpredictable
and value-based tests would be flaky.

Two options:

1. **Standard QA fixture store (recommended).** Zid maintains one seeded store with a fixed
   catalog: products with variants / discounts / out-of-stock / bundles / VAT-exempt,
   a 3-level category tree, valid + invalid coupons, shipping/payment methods, bank accounts,
   loyalty, a blog and FAQ. Every submitted theme is rendered against it. This makes the full
   ~84 checks deterministic and unlocks visual-baseline (screenshot-diff) testing for most of
   the 23 semi-auto items.

2. **Data-agnostic tests (what the current scaffold does).** Assert *presence and behaviour*
   rather than specific values (there is a price and a currency symbol; adding to cart
   increments the badge; an invalid coupon shows *some* error). Works on any store, but can't
   verify value correctness and skips checks when the fixture isn't present.

The scaffold ships as option 2 so it runs today; option 1 is the upgrade that maximises
coverage. This is the main thing to align on.

## Sections & the theme editor
A theme ships a set of **sections** (27 in the sample theme). Merchants add, configure,
reorder and remove them in the **theme editor**, and the chosen set renders on the storefront.
This splits into two testable concerns:

- **Which sections are actually used** — the partner exports a **preset JSON** from the editor and
  uploads it with the theme. `sections_from_preset.py` parses it into the sections placed per page
  — the real source of truth for what the merchant sees. No special QA preset is created.
- **Full section inventory (isolated render)** — every `sections/*.jinja` the theme ships;
  `/validate` reports each one's exists / schema / renders status, and `enumerate_sections.py`
  captures it. Sections shipped but not placed in the preset are covered here only.
- **On-page render with real settings** — a section can pass in isolation but break when placed
  with actual content (long titles, many items, empty state, RTL). `tests/05_sections.spec.js`
  is **data-driven from `sections.json`**: for every section it asserts the section is visible on
  the storefront, has no broken images, triggers no console errors, and attaches a screenshot for
  visual review — on both desktop and mobile.

**What this needs to be reliable:**
1. A **"kitchen-sink" QA preset** — a preset/preview where *every* section is placed with
   representative settings, so all sections are on one page to test. This is the section-level
   version of the fixture store, and Zid already supports theme presets.
2. A **stable per-section hook in the rendered HTML** — e.g. `data-section-type="carousel"`.
   Without it we fall back to class-name guessing, which is brittle. Asking themes to emit this
   one attribute makes section coverage rock-solid and is a small ask of partners.

Testing the *editor UI itself* (drag/drop, add/remove, settings apply) is platform QA, not theme
QA — out of scope here. What we verify is the **output**: given sections are configured, they
render correctly.

## Trigger & rollout
- **Trigger:** partner-upload event fires a `repository_dispatch` (`theme_submitted`) with
  `{preview_base, theme_id}`, or QA runs the workflow manually with the theme id.
- **Output:** in all cases the single-file HTML report is built and **emailed to the requester**
   (via Resend) and published to GitHub Pages. No Slack; email only.
- **Suggested rollout:**
  1. Ship Layer 1 gate now (zero risk, pure read).
  2. Run Layer 2 in "report-only" (non-blocking) for a few weeks; map selectors to the real
     theme DOM and tune flaky checks.
  3. Stand up the fixture store; convert presence-checks to value-checks; add screenshot
     baselines.
  4. Make the gate blocking once green rate is stable.

## Decisions (confirmed)
| Question | Decision |
|----------|----------|
| Render submitted theme on a Zid-controlled store? | **Yes** — one QA fixture store; enables value-based (exact-value) tests. See `FIXTURE_STORE.md`. |
| Do previews need auth in CI? | **No** — previews are publicly reachable; CI opens them directly. |
| Stable selectors / test hooks? | **Yes** — themes will emit `data-testid` + `data-section-type`; partners informed via docs. See `HOOKS_CONTRACT.md`. |
| Kitchen-sink preset for section testing? | **Yes** — a "QA — All Sections" preset places every section. |
| HTML report hosting for Slack link? | **GitHub Pages** — permanent per-run URL published from CI. |

With all five confirmed, the target is **value-based** tests (not just presence): ~84 checklist
items plus every section run fully automatically; ~23 semi-auto items become automatable via the
fixture store + visual baselines; ~9 stay manual. Deliverables to build the strong version:
`HOOKS_CONTRACT.md` (partners), `FIXTURE_STORE.md` (platform), and `fixtures.json` (test values).
