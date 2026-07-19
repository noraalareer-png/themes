#!/usr/bin/env python3
"""
Layer 1 - Structural validation gate.

Fetches the platform validation report at:
    https://<preview-host>/validate?theme=<themeId>
parses per-template pass/fail plus the Theme Requirements and Recommendations
sections, prints a summary, and exits non-zero if anything failed.

This is the automated version of "QA opens the /validate link and eyeballs it".
It is deterministic - it only reports what the platform already computes.

Usage:
    python validate_check.py --preview https://on0xnj.dev.zid.store \
                             --theme 5e85a37d-3ee6-4e19-b1a5-74e73aadc597
    PREVIEW_BASE=... THEME_ID=... python validate_check.py --json report.json

Exit codes:
    0  all templates passed, no failed requirements
    1  one or more templates failed / missing, or a requirement failed
    2  could not fetch or parse the report
"""
import argparse
import json
import os
import re
import sys
import urllib.request

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "zid-theme-qa/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_report(html):
    """Extract summary counts, failing templates, requirements, recommendations."""
    text = BeautifulSoup(html, "html.parser").get_text("\n") if HAS_BS4 else html

    def num_after(label):
        m = re.search(r"(\d+)\s*\n?\s*" + re.escape(label), text, re.I)
        return int(m.group(1)) if m else None

    total = num_after("Total Templates")
    passed = num_after("Passed")
    failed = num_after("Failed")

    # Only scan the ACTUAL results region for failing templates. The report begins
    # with help/explanatory text that mentions example templates (e.g.
    # sections/your-section.jinja, products/badge.jinja) and words like "Missing"
    # / "deprecation" — scanning the whole page would flag those as failures.
    # The results live between "Validation Summary" and "Theme Requirements".
    start = text.find("Validation Summary")
    end = text.find("Theme Requirements")
    if start == -1:
        start = 0
    if end == -1 or end < start:
        end = len(text)
    results_region = text[start:end]

    failing = []
    current = None
    for line in [l.strip() for l in results_region.splitlines()]:
        fn = re.search(r"[\w/.-]+\.jinja", line)
        if fn:
            current = fn.group(0)
        if current and re.search(r"(✗|✘|\bfail(ed)?\b|\bmissing\b)", line, re.I):
            if current not in failing:
                failing.append(current)

    requirements_ok = "All requirements met" in text
    recommendations_ok = ("No recommendations at this time" in text
                          or "No recommendations" in text)

    notes = []
    if not requirements_ok:
        m = re.search(r"Theme Requirements\s*(.+?)(?:Recommendations|$)", text, re.S)
        if m:
            notes.append("Requirements: " + " ".join(m.group(1).split())[:500])
    if not recommendations_ok:
        m = re.search(r"Recommendations\s*(.+)$", text, re.S)
        if m:
            notes.append("Recommendations: " + " ".join(m.group(1).split())[:500])

    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "failing_templates": failing,
        "requirements_ok": requirements_ok,
        "recommendations_ok": recommendations_ok,
        "notes": notes,
    }


def evaluate(report):
    """Return True if the theme passes the structural gate."""
    if report.get("failed"):
        return False
    if report.get("failing_templates"):
        return False
    if report.get("requirements_ok") is False:
        return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", default=os.getenv("PREVIEW_BASE"),
                    help="Preview host base, e.g. https://on0xnj.dev.zid.store")
    ap.add_argument("--theme", default=os.getenv("THEME_ID"), help="Theme id (uuid)")
    ap.add_argument("--url", help="Full validate URL (overrides --preview/--theme)")
    ap.add_argument("--json", help="Write structured result to this path")
    args = ap.parse_args()

    if args.url:
        url = args.url
    elif args.preview and args.theme:
        url = "{}/validate?theme={}".format(args.preview.rstrip("/"), args.theme)
    else:
        print("ERROR: provide --url OR (--preview and --theme)", file=sys.stderr)
        sys.exit(2)

    # Each theme gets its own output folder: runs/<theme_id>/. If --json wasn't
    # given, default the result there so themes never overwrite each other.
    if not args.json and args.theme:
        outdir = os.path.join("runs", args.theme)
        os.makedirs(outdir, exist_ok=True)
        args.json = os.path.join(outdir, "validate.json")

    try:
        html = fetch(url)
    except Exception as e:
        print("ERROR: could not fetch {}: {}".format(url, e), file=sys.stderr)
        sys.exit(2)

    report = parse_report(html)
    report["url"] = url
    ok = evaluate(report)
    report["passed_gate"] = ok

    print("Validation report: {}".format(url))
    print("  Templates: {}/{} passed, {} failed".format(
        report["passed"], report["total"], report["failed"]))
    print("  Requirements met: {}".format(report["requirements_ok"]))
    print("  Recommendations clean: {}".format(report["recommendations_ok"]))
    if report["failing_templates"]:
        print("  Failing templates:")
        for t in report["failing_templates"]:
            print("    - {}".format(t))
    for n in report["notes"]:
        print("  ! {}".format(n))
    print("  RESULT: {}".format("PASS" if ok else "FAIL"))

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
