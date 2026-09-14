# Costing the hours gap — measured 2026-09-14, before building anything

`business.setHours` was ruled to be named honestly: **two doors, not three.** Talk to me (the
action) and do it yourself (the hours rows in Edit details). No "show me where" — that mechanism
does not exist for any capability in the product.

Then: cost the hours **extractor** as a gap. The measurement is
`node scripts/measure-hours-capture.mjs`, and **it does not support building the extractor
first.** The expensive gap is somewhere else.

---

## 1. Extraction — measured, and it is not the problem

| | |
|---|---|
| businesses in the corpus (fixtures excluded) | **195** |
| …with at least one owner message | **64** |
| …whose owner MIGHT have stated hours (the form below) | **10 of 64** — market 7 · internal 2 · test 55 in the denominator |
| …of those, hours actually in the record (either store) | **9 of 10** |
| the miss | 1, a test draft |

**The form counted, named because a heuristic counts a form and not a fact:** a clock time
(`8`, `8am`, `8:30 pm`), a range (`9-5`, `9 to 5`), a weekday or weekend word, or one of the
words this detector has already been burned by — *closed, hours, open, appointment, call for*.
Deliberately over-generous: over-counting the denominator **understates** the capture rate, which
is the safe direction for a number that would argue for building something.

**Two things this number is not.** It is a ceiling on what was missed, not a count of it — a
business is in the denominator because a message *looked* like it might carry hours. And it does
not prove causation: the record holding hours is not proof that *this message* is where they came
from.

**The sample is thin — 10 conversations — and that is itself the finding.** There is not enough
evidence here to justify building an extractor, and there would not be even if the rate were
worse.

## 2. What the same query found instead: **the ask never happens**

| | |
|---|---|
| assistant messages in the corpus | 259 |
| …that mention hours at all | **16** |
| …that ASK for hours | **1** |

CLAUDE.md's own measured rule: a stated fact is captured ~40% of the time when it is merely
mentioned in passing, ~80% when Hubly asked the question first. **Hubly has asked for hours once,
ever.** Every hours fact we hold arrived because someone volunteered it.

**This is the cheap half.** The ask costs a line in the gap ladder that already exists
(`hcPickNextGap` / `hcMaybeAskNextGap`, one ask at a time, already gated and checked). No
extractor, no new surface.

## 3. The expensive gap is PLACEMENT, and it is not the extractor

| freeform pages (latest version, fixtures excluded) | **174** |
|---|---|
| carrying a `data-hubly-hours` anchor | **7** |
| whose text looks like it shows hours, with no anchor | **58** |
| market pages | 6 |
| market pages with the anchor | **1** |

**So a captured hours fact usually cannot reach the page.** The record accepts it, the reply says
it was saved, and 167 of 174 pages have nowhere to put it — no anchor, and therefore no update
path. That is the gap CLAUDE.md already names as open for hours, logo, service area and contact,
and the ruled shape of the fix is **one anchor pass at generation** (the way
`markServiceAnchorsInFreeform` works for prices), never a matcher per markup shape.

**And it is the shape that makes "saved" a half-truth.** `set_business_hours` writes the record;
`syncFreeformFacts` no-ops for hours. The owner is told the thing happened, and on 96% of pages
the visible half did not.

## 4. The order this argues for

1. **Ask for hours** — one rung in the ladder that already exists. Cheapest, and the measured
   effect is the largest (~40% → ~80% capture on every fact, not just this one).
2. **Stamp the hours anchor at generation** — the ruled shape, one pass, alongside the service
   anchor that already works. Until it exists, a write that says "saved" is true about the record
   and silent about the page.
3. **The extractor** — last, and only if 1 and 2 are done and the misses are still there. The
   evidence today does not support building it, and **a fix aimed at a gap nobody measured is how
   two days went into inferring a design that was already in the product** (Lesson 49).

**Nothing is built here.** This is the costing, and the costing says the extractor is third.
