# Known issues

Open defects that are understood, deliberately not fixed yet, and should not be
rediscovered from scratch. Each entry says what is wrong, why it was left, and
what would settle it.

---

## Optional-chained provider flags default to "yes" when the provider is missing

**Status:** open, deliberately not fixed
**Found:** 2026-08-15, during the `!== false` sweep

`marketplace_providers.accepting_new_jobs`, `weekend_jobs` and
`accept_quote_requests` are `boolean not null default true`
(`supabase/migrations/20260719010000_marketplace_foundation.sql:32,34,45`). NULL
is not representable, so for any value **read from that table** `x !== false`
and `!!x` are identical, and `true` is the intended product default. That part is
settled — those call sites were reviewed and correctly left alone.

The real exposure is the sites that optional-chain through a provider object
that may itself be `undefined`:

- `supabase/functions/_shared/booking_engine.ts:312` — `provider?.weekend_jobs !== false`
- `supabase/functions/_shared/booking_engine.ts:318` — `provider?.accepting_new_jobs !== false`

When `provider` is undefined — no marketplace provider row, a failed lookup, a
business that never joined the marketplace — `provider?.weekend_jobs` evaluates
to `undefined`, and `undefined !== false` is `true`. The absence of a provider is
therefore read as a provider who accepts weekend jobs and is accepting new work.
That is a different failure from the column default: it is not "the provider said
yes", it is "there is no provider at all, so we said yes on their behalf".

**Why not fixed now:** flipping these changes who receives work. Getting it wrong
in the safe-looking direction (defaulting to `false`) can silently stop providers
from being offered jobs, which is worse than the current over-permissiveness and
is not visible in a test run. It needs a product decision plus a look at whether
a provider-less business should reach this code path at all.

**What would settle it:** decide what a missing provider row means at
`booking_engine.ts:305-320`. Most likely the caller should not be computing
availability for a business with no provider, in which case the fix is a guard at
the call site rather than a different boolean default.

---

## `payment_setting` has two sources of truth, and the server reads only one

**Status:** open, deliberately not fixed
**Found:** 2026-08-16, while adding per-package payment overrides

The account-level payment mode is stored in two places that can disagree:

| Where | Written / read by | Authoritative? |
|---|---|---|
| `businesses.meta.paymentSetting` (+ `depositType`, `depositVal`, `depositMessage`) | `booking_engine.ts:120` `resolvePaymentRule()` | **YES — this is what decides charges** |
| `businesses.payment_setting` (real column) | client only: `hubly.html:14398`, `:16994`, `:17321`, `:17822` | no — no server code reads it |

`resolvePaymentRule()` is the only server-side resolver of payment terms, and it
reads `getBusinessMeta(business)` exclusively. The `payment_setting` column is a
parallel copy the booking path never consults. The client reads it on load
(`:14398`, `:17321`) and writes it on save (`:16994`, `:17822`), so an owner can
end up looking at a UI driven by one field while their customers are charged
according to the other.

Note the mismatch is wider than the one field: the server needs four values
(`paymentSetting`, `depositType`, `depositVal`, `depositMessage`) and only the
first has a column equivalent, so the column could never be authoritative
without also adding the other three.

**Why not fixed now:** collapsing them is a data decision, not a code one. Any
row where the two disagree has to resolve one way, and picking wrong changes
what a real business charges real customers. It needs a read of production
first — how many rows disagree, and in which direction.

**What would settle it:** compare the two across production, then either drop
the column and have the client read/write `meta` (smallest change, matches the
server), or promote the column to authoritative and migrate the other three
values into columns alongside it. Do not leave both writable.

```sql
select count(*)                                                          as businesses,
       count(*) filter (where payment_setting is distinct from meta->>'paymentSetting') as disagree,
       payment_setting, meta->>'paymentSetting' as meta_payment_setting
from public.businesses
group by payment_setting, meta->>'paymentSetting'
order by 2 desc;
```

---

## Flat deposits guess dollars-vs-cents by magnitude

**Status:** FIXED 2026-08-16 — `meta.depositUnit` + migration `20260816120000_deposit_unit.sql`.
Kept here as the record of what the defect was and how the migration preserved
existing behaviour. The magnitude test is gone from `booking_engine.ts`.
**Found:** 2026-08-16, while adding per-package payment overrides

`booking_engine.ts` converts a flat deposit to cents with:

```ts
Math.round(cfg.deposit_val * (cfg.deposit_val < 1000 ? 100 : 1))
```

There is no stored unit for `meta.depositVal`, so the magnitude is used as a
proxy: under 1000 it is treated as dollars and multiplied by 100; at 1000 or
above it is treated as already being cents and passed through.

That breaks at exactly the point an owner is most likely to mean dollars. A
business setting a **$1,000 flat deposit** enters `1000`, the heuristic reads it
as 1000 cents, and the customer is charged **$10**. The same input at `999`
correctly charges $999. The cliff is invisible in the UI, which asks for a
number with no unit attached.

**Production exposure (checked 2026-08-16, 19 businesses visible):**

| | count |
|---|---|
| businesses with any deposit config | 10 |
| `depositType = 'flat'` | **1** (`depositVal = 20`) |
| `depositType = 'flat'` AND `depositVal >= 1000` | **0** |
| `depositType = 'pct'` | 9 (all `depositVal = 25`) |

So nobody is currently mischarged: the single flat-deposit business is at $20,
well under the cliff. The exposure is entirely prospective — the first owner to
type a four-figure flat deposit hits it.

**Why not fixed now:** any change reinterprets stored values, and for a row at
or above 1000 the two readings differ by 100x in what a real customer is
charged. It cannot be corrected without knowing what each owner meant.

**What would settle it:** store the unit. Add `meta.depositUnit` ('cents' |
'dollars') written by the UI, default existing rows to the heuristic's current
interpretation so nothing changes on migration, then drop the magnitude test
once every row carries a unit. Doing it while only one business has a flat
deposit — and it is nowhere near the cliff — is as cheap as this will ever get.

```sql
-- re-check exposure before changing anything
select meta->>'depositType' as deposit_type,
       meta->>'depositVal'  as deposit_val,
       count(*)             as businesses
from public.businesses
where meta ? 'depositVal'
group by 1, 2
order by 3 desc;
```

---

## Verification practice: diff error IDENTITY, never counts

**Status:** standing practice, adopted 2026-08-16 after it hid two real bugs

Two defects shipped this session behind a verification step that looked green.

**1 · Counting errors instead of diffing them.** Every Edge Function change was
checked as "N errors, N at baseline — unchanged". `deno check` on this codebase
has a stable set of pre-existing errors, so a NEW error of a different class can
appear while the total stays put. Commit e494e91 introduced `TS2559` at two
sites (`booking_engine.ts` createBooking and `marketplace/index.ts:596`) and
both hid behind an unchanged count. The consequence was not cosmetic: the
per-package payment override it added silently did nothing, because
`BookingServiceDto` has no `payment` field and the override always resolved to
the account default.

Do this instead — per file, signature not total:

```bash
git diff --name-only <base>..HEAD -- 'supabase/functions/**/*.ts' > /tmp/files.txt
while read -r f; do
  sig=$(deno check "$f" 2>&1 | grep -oE 'TS[0-9]+' | sort | uniq -c | tr '\n' ' ')
  printf "%-58s %s\n" "$f" "${sig:-clean}"
done < /tmp/files.txt
```

Run it at the baseline commit and at HEAD, then `diff` the two outputs. A new
`TS####` on any line is a regression even when the total is identical.

**2 · A check that silently checks nothing.** The first attempt at the audit
above built a space-joined file list and ran `deno check $FILES`. A trailing
space made Deno treat all sixteen paths as ONE module specifier; it emitted a
single `TS2307 Cannot find module 'file:///…%20…%20…'` and the script reported
"1 error, unchanged" — a clean bill of health from a command that had checked
nothing. It was caught only because the error TEXT looked wrong, not because
the count did.

A verification command that silently checks nothing and reports success is
worse than no check, because it converts an unknown into a false assurance.
Guard against it:

- Assert the checker saw what you think it saw — file count in, results out.
- Read at least one error message in full; never pattern-match on counts alone.
- Prefer a loop over one file at a time to a single command over a joined list.
- If a check reports "clean" for something known to be broken, distrust the
  check before trusting the result.

---

## What browser automation in this setup can and cannot prove

**Status:** standing note, written 2026-08-16 after two rounds of false verification

The MCP-driven Chrome tab is **not** the developer's browser window. Verifying
mobile behaviour through it has hard limits, and both of them produced
confident-looking results that were worthless.

**`resize_window` only works in a FRESH window.** Called on a tab in an existing
window it returns "Successfully resized" while `window.innerWidth` does not
change. The first mobile check this session reported success and measured
`innerWidth: 1710` — a desktop viewport — so the `≤900px` and `≤860px` rules
never engaged and the measurements said nothing about mobile. Always assert the
viewport after resizing:

```js
JSON.stringify({innerWidth, innerHeight, mq: matchMedia('(max-width:900px)').matches})
```

If `innerWidth` is not what you asked for, every measurement that follows is
about the wrong layout. The window can also collapse between calls — one
screenshot in this session came back 150px wide mid-sequence.

**Device emulation toggled in the developer's own DevTools does not reach it.**
The automation window is separate. Measured from inside it, after the developer
turned phone mode on:

```
userAgent : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36…"
touch     : false
```

Desktop UA, no touch events, no device pixel ratio emulation, and no mobile
browser chrome.

**So a browser check here CAN prove:**
- computed styles and geometry at a given CSS width (`getBoundingClientRect`,
  `getComputedStyle`), which is enough for media-query-driven rules
- whether an element is present, visible, or overlapping another
- DOM state, class toggles, and script-set values

**It CANNOT prove:**
- anything involving iOS/Android browser chrome — `dvh` vs `svh` vs `lvh`
  behaviour, toolbar show/hide, address-bar collapse
- `env(safe-area-inset-*)` values, which are 0 outside a notched device
- touch-only behaviour, momentum scrolling, or `:hover` absence
- real device pixel ratio rendering

Anything in the second list needs a real device. Say so explicitly in the
commit rather than implying the browser check covered it — a fix verified at a
narrow desktop width and described as "verified on mobile" is the same false
assurance as a check that silently checks nothing (see the entry above).
