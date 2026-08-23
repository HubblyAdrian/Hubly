#!/usr/bin/env python3
# Body-copy negative-tracking signature (static — no browser needed).
#
# Negative letter-spacing on DISPLAY type (h1/h2/marks) is a style choice and is
# near-universal (~91% of pages). Negative letter-spacing on RUNNING BODY TEXT
# (paragraphs, list items, leads, subheads) is the readability bug a human notices
# ("the letters look too close together") — and it is rare (~4% of pages). This
# checker reports only the body-copy case.
#
# Usage: python3 letter-spacing-check.py corpus.json
# (Re-export corpus.json fresh first — see README. A stale corpus undercounts.)
import json, sys, re

pages = {p["slug"]: p["html"] for p in json.load(open(sys.argv[1]))}

def rules(html):
    css = "".join(re.findall(r"<style[^>]*>(.*?)</style>", html, re.S))
    return re.findall(r"([^{}]+)\{([^{}]*)\}", css)

def is_bodycopy(sel):
    s = sel.lower().strip()
    # exclude display type / marks / monograms / eyebrows / headings
    if any(h in s for h in ("h1","h2","h3","h4",".mark","wordmark","monogram",
                            "symbol","eyebrow",".big","headline","large-mark","logo")):
        return False
    # include paragraphs, list items, leads, subheads, body
    return bool(re.search(r"(^|,|\s)p\b", s) or "lead" in s or "subhead" in s
                or re.search(r"(^|,|\s)body\b", s) or re.search(r"(^|,|\s)li\b", s))

neg = re.compile(r"letter-spacing\s*:\s*(-[0-9.]+\s*(?:px|em|rem)?)")
hits = []
for slug, html in pages.items():
    page_hits = []
    for sel, body in rules(html):
        m = neg.search(body)
        if m and is_bodycopy(sel):
            page_hits.append((sel.strip()[:32], m.group(1).strip()))
    if page_hits:
        hits.append((slug, page_hits))

print("pages with NEGATIVE letter-spacing on BODY/paragraph text: %d/%d (%d%%)"
      % (len(hits), len(pages), round(100 * len(hits) / max(1, len(pages)))))
for slug, ph in hits:
    print("  " + slug)
    for sel, val in ph:
        print("      %-32s %s" % (sel, val))
