# When Hubly started writing pages freehand — and what evergreen actually is

Report only. Nothing changed. Established from the database and `git log`, not from memory.

## THE PREMISE IS WRONG, AND THAT IS THE FINDING

**evergreen-yard-care was made by the freeform generator.** Its v1 is
`created_by: ai`, `format: html`, **2026-08-30 03:53** — ten days AFTER the switch to
freeform. It is not a survivor of an older, better path. It is what today's generator
produced on one particular morning.

And the design system was there at **v1**, not accreted over 162 versions:

| present in v1 | |
|---|---|
| `:root` token block | `--green:#2f5d45 --green-deep:#10271c --paper --tan --shadow --radius:22px` — **byte-identical to v162** |
| `.cards` grid, `.card`, `.card-body`, `.price`, `.section-kicker` | all present |
| `data-hubly-service`, `aspect-ratio` on the card image | present |
| `<article class="card">` | **3 in v1**, 6 in v162 |

CSS grew 8,387 → 12,735 bytes across 161 patches; the tokens never moved.
(`data-hc-section` is NOT the generator's — `stampFreeformHtml` adds it after generation.)

**So there is no old way to go back to.** The generator that wrote the page Adrian points at
is the generator running now. What separates evergreen from the rest is not its path:

| | versions |
|---|---|
| median page (all kinds) | **2** |
| market pages, median | 2 |
| next most-iterated page (`dawn-patrol-coffee`) | 18 |
| **evergreen-yard-care** | **162** |

## THE SWITCH

**Commit `c2ff42d`, 2026-08-20 14:15:43 -0600 — "Freeform is how Hubly builds a page; AST is
how it rebuilds an old one."** The stated reason, quoted:

> *"Every session so far made freeform possible. None made it the default, so a freeform page
> only ever existed when the AST build FAILED — not a path anyone could choose, just where you
> landed on a timeout. This flips it."*

It branches on what is already stored, not on a flag: an existing AST page keeps AST,
everything else — no document, or a freeform one — gets freeform.

## WAS THE TRADE MEASURED? YES ON COST. NO ON QUALITY.

The commit carries real numbers, and they are all speed and tokens:

> *"input tokens down ~5x, build time roughly halved, and the p90 no longer sits 4.6s under a
> hard timeout"* — freeform 80–103s wall-clock vs an AST baseline of build p50 125.8s / p90
> 145.4s against a 150s ceiling, prompt avg 7,656 → ~1,365–1,809.

**Consistency, editability and design quality were never measured — not then and not since.**
`git log` contains **zero** commits comparing the two paths on any of them. Worse, the variance
was recorded as a WIN:

> *"Three pages, three genuinely different shapes — dark utility-first for the roofer, warm
> editorial serif for the photographer, monogram-and-menu for the bakery."*

And the costs we have spent this month paying were written down that day, as a gap list rather
than a blocker: *"no booking, no enquiry form, no reviews, no map, no photographs, no logo in
the header, **no structural editing**, no styling controls, no design rationale"* — plus the
structural note that a freeform page renders in an iframe so nothing the shell wires to
`#hc-doc-root` can reach inside it. That iframe line is the same fact behind the srcdoc
fragment-link defect we repaired this week, recorded on the day of the switch.

## WHAT EXISTED BEFORE — and it is still here

`supabase/functions/_shared/hubly_document.ts` (born `b3aa8f4`, 2026-08-05), the AST/classic
renderer. It is a real component system, not a template:

- a named component vocabulary — `HublyBooking`, `HublyReviews`, `HublyCustomerPortal`,
  `HublyContactForm`, `HublyMap`, `HublyChat`;
- `hd-`-prefixed classes and an `hd-` anchor namespace so page ids cannot collide with the app;
- reserved empty states (`data-hd-placeholder`) that the public page drops and the builder keeps;
- **structural editing** — `add_node`, `move_node`, `remove_node`, `replace_node`, `update_text`,
  `update_attrs`.

It is still in the repo and still maintained (last touched `803af7c`, 2026-09-09). It is
reachable ONLY for a page already stored as AST.

There is also `public/journey-os/design-system.js` (`HublyDS`, 2026-07-26) with **Rule #14 —
"If a UI pattern already exists in Hubly: DO NOT rebuild it."** That is Lesson 49 written seven
weeks early. It governs the owner-facing Operate modules, NOT generated customer pages.

## THE CORPUS, EITHER SIDE OF THE SWITCH

| era | first format | latest format | pages |
|---|---|---|---|
| after 2026-08-20 | html | html | **159** (152 test, 6 market, 1 internal) |
| before | ast | html | 7 (born AST, since replaced by freeform) |
| before | html | html | 7 (freeform only because the AST build failed) |
| before | ast | ast | **1** |

**173 of 174 pages are freeform. One page in the entire corpus is still AST.**

## WHY THIS OUTRANKS ANY SINGLE DEFECT

Almost everything fought this month is downstream of pages having no shared structure: the
services donor guessing, the hours predicate re-recognising a schedule from markup, anchors
stamped on whatever shape the model chose, nav links to sections that were never written, CTAs
with nothing behind them, 41% of pages carrying text nobody can read. A generator emitting
known components makes those defects **unreachable** rather than fixed.

**But the honest framing is not "freeform vs AST".** evergreen proves the freeform model CAN
produce a coherent design system in a single call — it did, on 2026-08-30, and the tokens it
wrote that morning are still the ones on the page. The problem is VARIANCE: nothing requires
the next generation to do it, nothing measures whether it did, and nothing can be relied on
afterwards. The question for Adrian is therefore not "which generator" but **"what must be
fixed rather than invented"** — the services block is the first answer to that and is already
specified (`docs/SERVICES_BLOCK_SPEC.md`).
