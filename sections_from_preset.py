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
- settings   -> the configured content (headings, texts, images ...)

Output: sections.json =
[ { "name": "sections/main-slider.jinja", "slug": "main-slider",
    "page": "templates/home.jinja", "locale": "ar",
    "section_id": "cc63...", "order": 0, "display": true,
    "match_texts": ["<a heading/text from settings to find on the page>", ...] }, ... ]

`match_texts` powers CONTENT-BASED section verification: the E2E suite confirms each
placed section actually rendered by finding its configured text on the storefront — no
theme hooks or class-name guessing required.
"""
import argparse
import json
import re
import sys

# Generic strings that appear across many sections -> poor discriminators, skip them.
GENERIC = {
    "تسوق الان", "تسوق الآن", "تسوق", "اشتر الآن", "اطلب الان", "المزيد", "عرض الكل",
    "shop now", "buy now", "view all", "read more", "more",
}

# Keys whose string values are good, stable identifiers for a section.
TEXT_KEYS = re.compile(r"(heading|title|subtitle|description|text|badge)", re.I)


def slug(template):
    return re.sub(r"\.jinja$", "", re.sub(r"^sections/", "", template or ""))


def norm(s):
    return " ".join((s or "").split()).strip()


def extract_match_texts(settings):
    """Pull up to 3 distinct, non-generic heading/text strings from a section's settings."""
    found = []

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if isinstance(v, str):
                    s = norm(v)
                    if (TEXT_KEYS.search(k or "")
                            and len(s) >= 4
                            and not s.startswith("#")            # color
                            and not s.startswith("http")          # url
                            and not s.replace(".", "").isdigit()  # number
                            and s.lower() not in GENERIC):
                        found.append(s)
                else:
                    walk(v)
        elif isinstance(o, list):
            for x in o:
                walk(x)

    walk(settings or {})
    # Prefer longer (more unique) strings; drop near-duplicates/substrings; cap at 3.
    picked = []
    for s in sorted(set(found), key=lambda x: -len(x)):
        if all(s not in p and p not in s for p in picked):
            picked.append(s)
        if len(picked) >= 3:
            break
    return picked


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
                    "match_texts": extract_match_texts(comp.get("settings", {})),
                })
    return out


def drop_shared_match_texts(sections):
    """Remove match_texts that appear in more than one section, so a section is never
    located by text that actually belongs to a different section (e.g. a heading a
    merchant copy-pasted into two blocks)."""
    from collections import Counter
    counts = Counter()
    for s in sections:
        for t in set(s.get("match_texts", [])):
            counts[t] += 1
    for s in sections:
        s["match_texts"] = [t for t in s.get("match_texts", []) if counts[t] == 1]
    return sections


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
    sections = drop_shared_match_texts(sections)

    json.dump(sections, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    if not sections:
        print("WARNING: no sections extracted — preset may be empty or shaped differently.",
              file=sys.stderr)
    print("Extracted {} section placements -> {}".format(len(sections), args.out))
    for s in sections:
        tags = (s["match_texts"][0][:30] + "…") if s["match_texts"] else "(no match text)"
        print("  {:24} page={:22} locale={} match={}".format(s["slug"], s["page"], s["locale"], tags))


if __name__ == "__main__":
    main()
