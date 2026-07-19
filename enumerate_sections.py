#!/usr/bin/env python3
"""
Enumerate every section a theme ships, from the /validate report.

Themes expose sections that the merchant adds via the theme editor. The set of
section templates is fixed by the theme; which ones actually render on the
storefront depends on editor/preset configuration. This script lists them all
(with their in-isolation render status from /validate) so the E2E suite can
drive a section-by-section check instead of only testing whatever the partner
happened to place on their preview home page.

Output: sections.json = [{ "name": "sections/carousel.jinja", "renders": true }, ...]

Usage:
    python enumerate_sections.py --preview https://on0xnj.dev.zid.store \
                                 --theme <id> --out sections.json
"""
import argparse
import json
import os
import re
import sys

import validate_check as vc  # reuse fetch + text extraction


def sections_from_text(text):
    """Return [{name, renders}] for every sections/*.jinja row in the report."""
    lines = [l.strip() for l in text.splitlines()]
    out = []
    current = None
    status = {"exists": None, "schema": None, "renders": None, "pass": None}

    def flush():
        if current:
            out.append({
                "name": current,
                "renders": status["renders"] if status["renders"] is not None else status["pass"],
                "pass": status["pass"],
            })

    for line in lines:
        m = re.search(r"sections/[\w.-]+\.jinja", line)
        if m:
            flush()
            current = m.group(0)
            status = {"exists": None, "schema": None, "renders": None, "pass": None}
            continue
        if current:
            low = line.lower()
            if "renders" in low:
                status["renders"] = "✓" in line or "pass" in low
            if re.search(r"\bpass\b", low):
                status["pass"] = "✗" not in line
            if re.search(r"(✗|fail|missing)", low):
                status["pass"] = False
    flush()
    # de-dup by name, keep last
    seen = {}
    for s in out:
        seen[s["name"]] = s
    return list(seen.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", default=os.getenv("PREVIEW_BASE"))
    ap.add_argument("--theme", default=os.getenv("THEME_ID"))
    ap.add_argument("--url")
    ap.add_argument("--out", default="sections.json")
    args = ap.parse_args()

    if args.url:
        url = args.url
    elif args.preview and args.theme:
        url = "{}/validate?theme={}".format(args.preview.rstrip("/"), args.theme)
    else:
        print("ERROR: provide --url OR (--preview and --theme)", file=sys.stderr)
        sys.exit(2)

    html = vc.fetch(url)
    text = vc.BeautifulSoup(html, "html.parser").get_text("\n") if vc.HAS_BS4 else html
    sections = sections_from_text(text)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(sections, f, ensure_ascii=False, indent=2)
    print("Found {} sections -> {}".format(len(sections), args.out))
    for s in sections:
        print("  {}  renders={}".format(s["name"], s["renders"]))


if __name__ == "__main__":
    main()
