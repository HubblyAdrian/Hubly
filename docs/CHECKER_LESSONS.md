# Checks that report a result they did not establish

One class, three instances in a single day (2026-09-08). Kept together because the fix is
different each time and the failure is identical: **a check told us something it had not
actually determined.**

## The class

> A check must distinguish three outcomes, not two: it passed, it failed, or **it did not
> run**. A check that can only say pass/fail will eventually say one of them when the true
> answer was "I could not look" — and it will say it at the worst moment, because the
> conditions that break a checker (a bad install, a missing key, a renamed symbol) tend to
> arrive alongside the conditions that break the product.

The three instances, in the order they were found:

### 1. A checker that failed open
`scripts/check-places-seeded.mjs`'s subject — `seed_business_places()` — swallows its own
failure by design (a signup that 500s is worse than a business with the wrong rail). The
swallow was correct; the silence was not. A `raise warning` goes to a Postgres log nobody
reads, so a failed seed and a successful one were the same observable event. Fixed by
giving the swallow a counter that anyone can re-run.

### 2. A checker blind to a whole capability
`check-owner-id-invariant.mjs` matched `/^\s{4}name: "..."/` and reported "6 declared, 6
reachable" while completely blind to a SEVENTH capability: `storefront` is added by
`HUBLY_CAPABILITY_REGISTRY.push({ … })` after the array literal, at a different indent. The
checker was not wrong about what it looked at; it was wrong about what it looked at being
everything. Fixed by parsing structurally — an object whose own keys include `name` and
`actions` — with no indent assumptions.

### 3. A checker silently disarmed by an unrelated install
`npm install --save-dev esbuild` (needed for two unrelated tests) reset Playwright's browser
cache, and `check-graefs-page.mjs` — the gate standing between us and Graef's live page —
stopped being able to launch a browser. The symptom was a stack trace that read like a hang.
It was neither passing nor failing. It was not looking, and nothing said so.

Fixed by a third exit state: **0 = PASS, 1 = FAIL, 2 = COULD NOT RUN**, with output that
says in words "Graef's page has NOT been checked. Do not read this as safe." Proved against
the real missing-browser condition, not a synthetic break.

## What this costs if you get it wrong

The tempting fix for #3 is to point Playwright at the system Chrome and move on. That is
re-baselining a safety check to make it pass: a different engine can count text runs
differently, so the gate would then either fail falsely or, worse, pass while no longer
detecting the thing it exists to detect. **Re-baselining a safety check to make it green is
how safety checks stop meaning anything.** If the check cannot run, the honest output is
that it cannot run, and the honest action is to wait for it.

## Related

- `scripts/check-destructive-confirm.mjs` carries the sibling lesson: a safety check that
  measures what the SYSTEM OVERWRITES rather than what the USER LOSES will fail precisely on
  the users with the most to lose.
- CLAUDE.md, "ENUMERATE THE HARMLESS SIDE — never the valuable one" is the same family: a
  list of shapes that omits the valuable one reports a number nobody can check.

## 4. A red suite hides the explanation for complaints you already have

Added 2026-09-08, and it is the sharpest version of the class.

The suite had been red for months. Inside it, `record-extraction.test.mjs` was failing on
this:

```
extractPricedServices('Sweep and inspection $189, cap replacement from $340, ...')  ->  []
```

`PRICE_LINE_RE` required a delimiter — a colon, an em/en dash, or ` - ` — between the
service name and the price. `"Full Detail: $180"` matched. `"Full Detail $180"` did not.
The second is how people actually write prices.

**That failing test was the explanation for a complaint already on record.** CLAUDE.md
carries the scar in full: Summit Auto Detail's owner wrote "Prices: Express Wash $60, Full
Detail $180, Ceramic Coating $600" in his first message, his page shipped priceless, and
Hubly's next turn asked him what he charged. We diagnosed that as a missing `setServices`
call. It was also this: the extractor returned `[]` for his exact sentence, and a test in
our own repo had been saying so the whole time.

So the cost of a permanently red suite is not only the defects it stops catching. It is:

> **A red suite hides the explanation for complaints you already have.** The failure was
> not undiscovered — it was sitting in the output, indistinguishable from nineteen other
> red files nobody could triage. Noise does not just delay detection; it buries diagnosis.

This is why "make it green, then keep it green" is not tidiness. A suite nobody can read is
a suite that can hold the answer to a live customer complaint for months without anyone
seeing it.

## 5. Source removed but deployment live (and its mirror)

Two failures with one shape, both on 2026-09-08, in opposite directions:

- **Deployed but uncommitted** — the `operations.read` fix was live on the edge function
  and existed only as an uncommitted diff. Any deploy from HEAD would have silently
  reverted it, and nothing would have reported that.
- **Source removed but deployment live** — `ai-advisorsuper-handlerai-advisor` was deleted
  from the repo while the function stayed ACTIVE on the platform, still able to call
  `api.anthropic.com` directly and still billable.

The class: **what is running and what is written must be reconciled explicitly, in both
directions.** Neither state announces itself, and a deploy list is not the same artefact as
a source tree. Deleting a function means deleting it from the platform, not from the folder.
