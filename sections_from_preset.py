#!/usr/bin/env python3
"""
Parse the partner's uploaded preset JSON into the list of sections configured per page.

The preset is exported from the theme editor (Customize -> Export) and uploaded with the theme.
Confirmed structure:

    { "presets": [
        { "path": "templates/home.jinja",
          "settings": { "components": {
              "ar": [ {"display": true, "settings": {"order": 0, ...},
                       "template": "sections/main-slider.jinja",
                       "section_id": "cc63...."}, ... ],
              "en": [ ... ]
          } } },
        ...
    ] }

Each component is one placed section instance:
  - template   -> which section (sections/<name>.jinja)
  - display    -> whether it is actually shown (false = placed but hidden)
  - section_id -> unique instance id (matches data-section-id in the HTML, if themes emit it)
  - settings.order -> position on the page
Components are per-locale (ar / en) and may differ between locales.

Output: sections.json =
    [ { "name": "sections/main-slider.jinja", "slug": "main-slider",
        "page": "templates/home.jinja", "locale": "ar",
        "section_id": "cc63...", "order": 0, "display": true }, ... ]

By default only display:true sections are emitted (what the merchant actually sees). Use
--include-hidden to also list placed-but-hidden ones.
"""
import argparse
import json
import re
import sys


def slug(template):
    return re.sub(r"\.jinja$", "", re.sub(r"^sections/", "", template or ""))


def parse_preset(doc, include_hidden=False):
    out = []
    for preset in doc.get("presets", []):
        page = preset.get("path", "")
        components = (preset.get("settings", {}) or {}).get("components", {}) or {}
        for locale, items in components.items():
            if not isinstance(items, list):
                continue
            for comp in items:
                if not isinstance(comp, dict):
                    continue
                template = comp.get("template", "")
                if not template:
                    continue
                display = comp.get("display", True)
                if not display and not include_hidden:
                    continue
                out.append({
                    "name": template,
                    "slug": slug(template),
                    "page": page,
                    "locale": locale,
                    "section_id": comp.get("section_id"),
                    "order": (comp.get("settings", {}) or {}).get("order"),
                    "display": bool(display),
                })
    return out


def dedup_for_tests(sections):
    """One entry per (slug, page, locale) — the E2E suite tests each unique placement once."""
    seen = {}
    for s in sections:
        key = (s["slug"], s["page"], s["locale"])
        if key not in seen:
            seen[key] = s
    return list(seen.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("preset", help="Path to the uploaded preset JSON")
    ap.add_argument("--out", default="sections.json")
    ap.add_argument("--include-hidden", action="store_true")
    ap.add_argument("--all-instances", action="store_true",
                    help="keep every instance (default de-dups per slug/page/locale)")
    args = ap.parse_args()

    doc = json.load(open(args.preset, encoding="utf-8"))
    sections = parse_preset(doc, include_hidden=args.include_hidden)
    if not args.all_instances:
        sections = dedup_for_tests(sections)

    json.dump(sections, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    if not sections:
        print("WARNING: no sections extracted — preset may be empty or shaped differently.",
              file=sys.stderr)
    print("Extracted {} section placements -> {}".format(len(sections), args.out))
    for s in sections:
        print("  {:24} page={:22} locale={} display={}".format(
            s["slug"], s["page"], s["locale"], s["display"]))


if __name__ == "__main__":
    main()
