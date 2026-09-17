# Every button a generated page renders — pressed, not read

**2026-09-17.** Adrian: *"ACTIONS TRACE TO CAPABILITY. Press every button a generated page can
render — Book Now, Get a Quote, Join, Buy, Call — and print what each actually does. How many live
pages render a button that leads nowhere."*

`node scripts/measure-page-buttons.mjs` · corpus re-exported at run time · **188 stored pages
(market 6 · internal 1 · test 181)** — a rate over this corpus is a rate over our own drafts.

## THE ANSWER TO THE QUESTION HE ASKED

**Of the five he named, ZERO lead nowhere.** 444 CTA-worded controls:

| where they go | |
| --- | --- |
| a Hubly route (`?book=1`, a quote, a join) | **332** |
| the phone (`tel:`) | **87** |
| an anchor on the page | 18 |
| a relative path | 7 |
| **dead** | **0** |

## Everything on the pages, not just the words we thought to look for

2,299 interactive controls. The sweep classifies EVERY anchor, button, `role=button` and submit by
**where it goes** — a closed set — rather than matching CTA words, because every list of "words that
look like a call to action" we have written has undercounted.

| | |
| --- | --- |
| an anchor on this page | 838 |
| a Hubly route | 550 |
| the phone | 246 |
| submits the form it is in | 187 |
| **DEAD — a `#id` that was never written** | **6, on 3 pages (2%)** |
| unknown from reading (a handler attached in script) | 450 |

The six dead ones, by name: `mobile-auto-detailing-in-los-angeles` "Work" ×2 and "See work space"
→ `#work`; `window-washing` "Gallery" → `#gallery`; `pike-sons-tree-service` "Our work" ×2 →
`#work`. **A nav link to a section the model never wrote.**

## A SWEEP PRODUCES CANDIDATES. THESE WERE PRESSED.

**The first version of this called 456 controls "NOWHERE" and was 83% wrong in its own sample.**
Six were pressed and five of them did something: a `<button>` with no `onclick` attribute is not a
button with no handler — the page's own `<script>` attaches listeners, which no amount of reading
can see. So the static pass now says "I cannot tell" where it cannot tell, and all 450 unknowns were
pressed in a real mount:

| | |
| --- | --- |
| pressed | **450** |
| did something | **177** |
| close controls pressed with nothing open — **the wrong state, not a defect** | **178** |
| **did nothing** | **95** |

**The 178 matter as a lesson.** They are the mobile-nav `×`. Pressing "close" while nothing is open
correctly does nothing, and counting that as a dead control is the wrong-state error — the same
mistake as testing a claimed feature on a draft.

**The 95 that did nothing, by their own words**, are almost entirely the page's own brand block:
`"SR Summit Roofing"`, `"W Window Cleaning"`, `"CK Copperwick Kilns Pottery in Provo, Ut"`,
`"Maple & Muddy"` — a logo rendered as a button, which does nothing because you are already on the
page it would take you to. Plus **five × `"Ask a question"`** — the embedded chat launcher
(`.hd-chat-launch`), whose handler comes from a script that the isolated mount does not run.

**So the residue worth looking at is: the logo-as-a-button, and whether the chat launcher works on
a live claimed page.** The second could not be settled here — the one business I tried it on
(`hearth-and-iron`) is UNCLAIMED, and its subdomain correctly serves the marketing page instead of a
site. It needs a claimed business and a real visit.

## ⚠ THE DENOMINATOR EXCLUDES THE CLASSIC STORE — and that is not a small footnote

This sweep reads `business_documents.rendered_html`: **the freeform store**. The CLASSIC store is
`businesses.meta`, and **four market businesses serve classic** (aquaspeed, bucket-mobile-detailing,
devdetailing661, Graef — Adrian, 2026-09-16: *"CLASSIC IS A SUPPORTED PATH, NOT A LEGACY EXCEPTION"*).
None of their buttons are in any number above.

**It shows immediately.** `check-walk-assertions` drives the LIVE page of
`crestview-window-cleaning` — a classic page — and reports a dead `#services` link and a missing
`#service-area` target. That page is not in this sweep's 188 at all.

**So the honest statement of the result is: of the CTA controls on 188 freeform pages, zero lead
nowhere — and the classic pages have not been swept.** Doing it needs a second reader over
`businesses.meta`, which is the two-store split arriving in a measurement.

## What this measurement cannot see

- It presses in an isolated mount. A control whose handler comes from the shell, or from a script
  the mount does not load, is indistinguishable from a dead one — which is exactly what happened to
  "Ask a question", and why it is reported as a question and not as a defect.
- "Did something" is measured as a change in scroll, element count, class, or open state. A control
  that fires a network request and changes nothing on screen reads as inert here.
