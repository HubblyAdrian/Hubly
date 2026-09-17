# A/B/C — one stated rule, one place

**Status:** built and checked, 2026-09-16. `npm run check:band-rule`
**Rule source:** Adrian, 2026-09-16, verbatim. Not derived, not inferred, not the AI's opinion.

> A — work a **customer is expecting today**. He committed to it; must-do by definition.
> B — his own work **with a deadline**. Important, but nobody is waiting on him.
> C — everything else.
>
> "**AND IT IS A DEFAULT, NOT A FIELD HE FILLS IN.**"
> "BUILD THE ASSIGNMENT IN ONE PLACE so changing the rule costs a line, not a rebuild."
> "`hcDayAddRow` must set a band. An unbanded thing must not silently become C — if it genuinely
> cannot be derived, say so on the row rather than defaulting in silence."

This satisfies MY_DAY.md §9 because it is a **stated rule**, not the AI inventing urgency.

## What was there before (all three defects were in two lines)

`hcItemBand` was:

```js
if(it && it.kind === 'job') return 'A';
var b = String((it && it.band) || '').trim().toUpperCase();
return (b === 'A' || b === 'B' || b === 'C') ? b : 'C';
```

1. **A block became an A.** "doctor's appointment" lives in the `jobs` table, so the owner's own
   appointment rendered as work a customer is expecting. This is the standing "a row is not
   evidence of a person" error: the table's name was read as the item's nature.
2. **Everything else became a C by fall-through**, including items we failed to read. C *means*
   "completely okay if it doesn't happen" — so an unreadable row was silently labelled optional.
3. **`hcAddDayTask` wrote `p_band:'B'` as a literal, with no reason.** That is how every task in
   the corpus carries the pre-rule default.

## Where it lives now

| Thing | Where |
|---|---|
| The rule | `hcDeriveBand(it, dayISO)` — `public/platform-home.html` |
| Its three sentences, as data | `HC_BAND_RULE` |
| The letter alone, for sorts | `hcItemBand(it, dayISO)` — thin wrapper, returns **null** when unplaced |
| The write | `hcAddDayTask` — sends `p_band` + `p_band_reason` from `hcDeriveBand`, never a literal |
| The render | the A/B/C sections, plus a `?` section that appears **only** when something could not be placed |
| The seam | `window.hublyDayUI.deriveBand` / `.bandRule` |

`hcDeriveBand` returns `{ band, source, why }` — never a bare letter, because every caller that
shows a band is allowed to show why.

- `source:'owner'` — he said so. **Read from the record, never re-decided.** A proposal that
  silently re-decides itself the next morning is worse than no proposal.
- `source:'rule'` — derived from the three sentences.
- `source:'other-day'` — a real item, not on the day being banded. Bands are *today's*.
- `source:'unknown'` — could not be derived. `why` is shown to him, on the row.

## Why the stored `tasks.band` is not trusted

`tasks.band` defaults to `'B'` with `band_source='proposed'` — the old default, stamped before
this rule existed. **If the reader trusted that column, changing the rule would cost a migration
over every task in the corpus**, which is exactly what Adrian ruled out. So:

- `band_source = 'owner'` → **his** word. Read.
- `band_source = 'proposed'` → **our** word. Re-derived every read, so the rule is live.

The writer still stamps the derived band and its reason onto the row, because a record that cannot
say why it is a B is a record that cannot be argued with — but the stamp is a **trace** of the
decision, not the source of it.

## One thing found while building it, and one thing left open

**Found and fixed:** `jobs.scheduled_date` is nullable (confirmed against the live schema
2026-09-16; **0 rows** carry a null today). `hcDayItems` compared `String(null)` against the day,
which is never equal, so such a job appeared on **no day at all** — an item in his table and
nowhere on his screen, which is a worse version of the silent fall-through. It now reaches the day
and the rule says out loud that it cannot place it. Tasks had always worked this way two lines
below; the jobs line was the sibling that was wrong.

**LEFT OPEN, with its line numbers — Adrian confirmed this stays recorded here.** `hcLoadJobs` (`public/platform-home.html`, the
`.gte('scheduled_date', fromISO)` / `.lte(...)` pair) excludes a null date in real Postgres, so an
undated job never comes back from the database at all. So what legs 13–14 of the check prove is the
**renderer's** half: handed such an item, it places it in `?` with a reason rather than in C. The
read-side is **not** covered, and the check says so on its face. Not built today because 0 rows
exist and fixing it means either an `.or(...)` filter or a second query, and the rig's fake
implements neither — a change with a blast radius bigger than the defect.

## The check

`scripts/check-band-rule-is-one-place.mjs` — **15 legs, declared `[RULE]` at write time.** Every
leg is one of Adrian's four sentences; none asserts a count, a class name or a layout, so a red leg
here is a product defect and never a stale expectation about markup.

**Seen red on the broken version, in two separate breaks:**

- Restoring the old `hcItemBand` → **10 of 15 red**, including every leg that names a defect above
  (3, 5, 6, 13, 14) and both writer legs (9, 10).
- A second break that trusts the stored `proposed` band and adds a second `C` default → legs **8
  and 11 red**, which the first break happened to pass. Two breaks because one break that leaves a
  leg green has not tested that leg.

Negative assertions in it are **scoped and comment-stripped** (SETTLED 31, via
`scripts/lib/absence.mjs`).

## The absence sweep: attempted, not shipped as a check

SETTLED 31 promised a sweep for file-wide negative assertions. It was written and run: **66 hits
across 25 check files.** It is **not** being shipped, because the overwhelming majority are
`if (!html.includes(x)) fail` — which asserts **presence**, inverted for control flow, and is
perfectly legitimate. Separating those from real absence assertions automatically is not reliable,
and a check that manufactures 60 false findings is the thing Adrian's own rule warns about (*a
sweep produces candidates, never findings*).

What shipped instead is the part that is decidable and universal: `scripts/lib/absence.mjs` —
`codeOf()` (strip the comment that explains the deletion), `bodyOf()` (brace-counted function
scope, never a guessed character window), `codeInBody()`. `confirm-served` already refuses a bare
identifier. New negative assertions use these; the 66 existing candidates are recorded here and
not reported as findings.
