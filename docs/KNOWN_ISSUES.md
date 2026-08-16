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

### Never click stale coordinates on a surface that re-renders

**Added 2026-08-16**, after verifying the canvas package-payment control on the
live Everlasting business and, in the process, writing three things nobody asked
for: a payment rule on Family Session, a whole new "Package 5", and a stray
override on Portrait Session.

`applyWsPeService()` ends with `renderSvcEditorList()` + `renderWebsitePreview()`.
The canvas re-lays out immediately, so the popover, the package cards and the
"+ Add service" tile all move under the cursor the moment a save lands. A
coordinate read off a screenshot is valid only until the next state change.
Clicking `(907, 650)` twice does not mean clicking the same button twice — the
second click hit "Add service" and then a second popover's Save.

**The rule:** on any surface that re-renders after an action, take a fresh
screenshot before every click, and never reuse a coordinate across a state
change. When the target is a specific element rather than a pixel, resolve it by
id/ref and act on that instead of guessing at a position.

**And:** verification that writes to a real business is not read-only. Before
touching one, record the exact prior state of everything the flow can reach — not
just the field under test — so the damage is repairable. Here the original state
(4 packages, all `payment: null`) happened to be recoverable from an early
readback; it easily might not have been.

Native `<select>` popups on macOS are a separate limitation: a CDP click opens
the OS-level menu, but synthesised key events do not reach it, and the menu does
not appear in screenshots. Dispatching `change` on the element exercises the same
handler a real pick fires, but say which one was used rather than implying the
option was clicked.

---

## Tests that assert implementation details, not behaviour

**Status:** standing note, written 2026-08-16 after two examples in one commit

Commit c209dbf broke one test and was silently blessed by another. Both were
written against HOW the page was built rather than WHAT it must do.

**The one that failed (correctly, but for the wrong reason).**
`booking-contrast-calendar.test.mjs` asserted `/padding-right:68px/`. The 68px
existed only to hold the action bar clear of a floating chat bubble. When the
fix hid the bubble instead, the reservation became actively harmful — it
narrowed "Confirm & book" for something no longer there — yet the test demanded
it stay. The requirement was never "68px"; it was "nothing floats over the
primary action". A test pinned to the number blocks every fix that does not use
that number.

**The one that passed while asserting nothing — worse.**
`booking-mobile-chat-scroll.test.mjs` had `test('booking keeps floating chat
bubble visible')` which kept PASSING after the bubble was hidden:

  * it asserted on `#ws-chat-bubble`, an id that is not the widget — the widget
    is `.ws-chat-widget`, so the "is it hidden?" check could never fire
  * its other assertion, `/body\.ws-booking-open \.ws-chat-widget\{/`, was
    satisfied by an unrelated rule elsewhere in the file

Its name claimed a behaviour, its assertions examined something else, and it
reported green either way. A failing test costs an hour; a test that passes
while checking the wrong subject costs the confidence you place in the whole
suite.

**What to prefer.** Assert the behaviour and let the implementation move:

```js
// brittle — pinned to a value and an id
assert.match(html, /padding-right:68px/);
assert.doesNotMatch(html, /#ws-chat-bubble[\s\S]{0,80}display:none/);

// durable — pinned to the requirement
assert.match(html, /body\.ws-booking-open \.ws-chat-widget,[\s\S]{0,200}?display:none!important/);
assert.doesNotMatch(html, /padding-right:68px/);
```

**Smell test before trusting any assertion:** does the string it matches still
exist in the source? A regex over an id, class or literal that has been renamed
away matches nothing and asserts nothing, and `assert.doesNotMatch` on a stale
selector passes forever. When touching a test, grep its subject in the source
first — if the count is 0, the test is decorative.

---

## Verification rule: grep the DEPLOYED artefact the user is actually looking at

**Status:** standing practice, adopted 2026-08-16 after it would have caught two
same-day failures in seconds

Before claiming a fix works, grep a string that exists **only** in the new code,
in the artefact the user's page actually loads, fetched from production. If the
count is 0, it did not ship — or it shipped to a file that page does not use.

```bash
curl -s https://myhubly.app/app                       | grep -c "uniqueNewString"
curl -s https://myhubly.app/journey-os/<file>.js      | grep -c "uniqueNewString"
```

Note the second line. The string must be grepped in the file that RENDERS the
thing, which is often not `hubly.html` — most of this app's surfaces live in
`public/journey-os/*.js`, each fetched separately.

**Two failures the same day that this catches instantly.**

*Integrations status.* A missing-facade fallback was changed in
`app-marketplace.js` and reported as fixed. The page the owner was looking at is
drawn by `journey.js`. The grep is unambiguous:

| string | deployed hubly.html | deployed app-marketplace.js |
|---|---|---|
| `Status unavailable` | 0 | 3 |
| `Resend` | 0 | 0 |
| `am-pill` | 0 | present |

`Resend` = 0 in the file supposedly rendering a Resend card proves it is the
wrong renderer, before any DOM inspection. The tell was in the bug report — the
user listed FIVE cards including Resend, against a four-app list — and was read
past.

*Booking totals.* A 114-combination comparison validated `calcBookingMoney`'s
classic branch. Production always takes the Smart Quote branch, because
`openBookingPage` calls `initForBooking` unconditionally and `resolveConfig`
never returns null. The comparison was rigorous and measured the wrong path.

**The common error in both:** establishing that *a* renderer/path exists and
stopping, instead of proving *this* one serves *these* users. Rigour downstream
of a wrong assumption produces confident wrong answers, which are worse than no
answer.

**Ask before verifying:** which file does the user's page load, and does my
change exist in the deployed copy of that file?
