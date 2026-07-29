#!/usr/bin/env python3
"""
Section coverage — did the partner place every section the theme ships?

Compares:
  SHIPPED sections  = every sections/*.jinja the theme ships   (from the /validate report)
  PLACED  sections  = sections the partner put in the preset    (from the preset export JSON)

Emits coverage.json + a human summary. Nothing is stored long-term: the partner's
preset is consumed here (extract -> match -> test) and can be discarded after.

Usage:
  python sections_coverage.py --preset preset.json --validate validate_report.html
  # --validate accepts the saved /validate report (html/text) OR a JSON list/obj of
  #   shipped section names (e.g. ["sections/hero.jinja", ...]).
  # --fail-on-missing  -> exit 1 if any shipped section is not placed (policy gate).
"""
import argparse
import json
import re
import sys


def slug(t):
    return re.sub(r"\.jinja$", "", re.sub(r"^sections/", "", t or ""))


def placed_from_preset(doc, include_hidden=False):
    """Section slugs the partner placed (display:true) across all preset pages."""
    placed = set()
    for preset in doc.get("presets", []):
        comps = (preset.get("settings", {}) or {}).get("components", {}) or {}
        for _locale, items in comps.items():
            if not isinstance(items, list):
                continue
            for comp in items:
                if not isinstance(comp, dict):
                    continue
                template = comp.get("template", "")
                if not template.startswith("sections/"):
                    continue
                if not comp.get("display", True) and not include_hidden:
                    continue
                placed.add(slug(template))
    return placed


def shipped_from_validate(raw):
    """Shipped section slugs. Accepts a JSON list/obj of names, else scans report text."""
    try:
        j = json.loads(raw)
        seq = j if isinstance(j, list) else j.get("sections", [])
        out = set()
        for x in seq:
            name = x if isinstance(x, str) else (x.get("template") or x.get("name") or x.get("slug"))
            if name and ("sections/" in name or "/" not in name):
                out.add(slug(name))
        if out:
            return out
    except (ValueError, AttributeError):
        pass
    return {slug(x) for x in re.findall(r"sections/[a-z0-9._-]+\.jinja", raw, re.I)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preset", required=True, help="partner preset export JSON")
    ap.add_argument("--validate", required=True, help="/validate report (html/text) or shipped-list JSON")
    ap.add_argument("--out", default="coverage.json")
    ap.add_argument("--include-hidden", action="store_true")
    ap.add_argument("--fail-on-missing", action="store_true")
    args = ap.parse_args()

    doc = json.load(open(args.preset, encoding="utf-8"))
    placed = placed_from_preset(doc, include_hidden=args.include_hidden)
    shipped = shipped_from_validate(open(args.validate, encoding="utf-8").read())

    unplaced = sorted(shipped - placed)
    placed_not_shipped = sorted(placed - shipped)
    covered = placed & shipped
    cov_pct = round(100 * len(covered) / len(shipped), 1) if shipped else 0.0

    result = {
        "shipped_count": len(shipped),
        "placed_count": len(covered),
        "coverage_pct": cov_pct,
        "shipped": sorted(shipped),
        "placed": sorted(placed),
        "unplaced": unplaced,                    # shipped but the partner didn't place them
        "placed_not_shipped": placed_not_shipped # placed but not in the theme inventory (odd)
    }
    json.dump(result, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"Section coverage: {len(covered)}/{len(shipped)} shipped sections placed ({cov_pct}%)  -> {args.out}")
    if unplaced:
        print("  UNPLACED (shipped but not in the preset — only isolated /validate render tested):")
        for m in unplaced:
            print("   -", m)
    else:
        print("  ✓ every shipped section is placed in the preset")
    if placed_not_shipped:
        print("  note: placed but not found in the theme inventory:", placed_not_shipped)

    if args.fail_on_missing and unplaced:
        sys.exit(1)


if __name__ == "__main__":
    main()
