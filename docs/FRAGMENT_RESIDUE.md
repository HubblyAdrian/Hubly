# The fragment-link residue, grouped — 2026-09-13

**Grouped before anything is fixed**, at Adrian's instruction: *"Group the 21 'did nothing'
clicks by the shape of the link and its target, not by page. If they collapse to one or two
shapes, that is one bug with twenty faces and the fix is small."*

They collapse to **one shape, and it is not a bug** — plus **three real defects of a second,
already-known kind.**

## The grouping

Re-ran the 20 repaired pages that had exactly one failing link, capturing per-link detail.
**22 failing clicks:**

| shape | count | target ids |
|---|---|---|
| **the click could not land** | **19** | `#main` ×17, `#menu`, `#services` |
| **target id missing** | 3 | `#work` ×2, `#gallery` |

Nineteen of the twenty-two, on **19 distinct pages**, are this:

```html
<a data-hc="page.text.1" class="skip-link" href="#main">Skip to content</a>
```

**A "Skip to content" link.** The standard accessibility affordance, deliberately hidden until
keyboard focus. The rig refused to press it — correctly, because it has no pointer-reachable
box — and `measure-fragment-links.mjs` recorded that refusal as *"did nothing"*, i.e. as a
defect on the page.

**One shape, twenty faces, and the fix was to the measurement.** It now tests
pointer-reachability first and counts keyboard-only links in their own column rather than
dropping them — a silently shrinking denominator is how a number stops meaning anything.

## The three that ARE defects, and they are one known kind

| page | link | target |
|---|---|---|
| `mobile-auto-detailing-in-los-angeles` | `#work` | no such element |
| `pike-sons-tree-service` | `#work` | no such element |
| `window-washing` | `#gallery` | no such element |

**A nav item promising a section the generator did not write.** Already on record as a
GENERATOR defect rather than a runtime one — `crestview-window-cleaning`'s `#service-area` was
the first instance (Lesson 43's follow-up, `docs/OPEN_FINDINGS.md`). The runtime handler is
working perfectly; there is nothing to scroll to.

**So the residue is 3, not 21**, and all three are the same generator defect we already knew
about. No new class.

## The 41 that navigated the frame away

Not yet grouped — they are a separate question and the corpus run does not record which link
each was. **The prior is that they are the known fragment-in-srcdoc case**: a `srcdoc`
document has no URL of its own, so `#x` resolves against the PARENT and the browser navigates
the frame to the site root. That is the exact defect `fragmentScrollHtml()` was written for,
and every page still missing it scores 0 of 43 — so the expectation is that the 41 cluster on
the 21 unrepaired pages rather than the repaired ones. **Stated as a prior, not a finding; it
needs the same per-link grouping the 21 just got.**
