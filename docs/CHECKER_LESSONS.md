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
