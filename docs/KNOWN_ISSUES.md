# Known issues

Open defects that are understood, deliberately not fixed yet, and should not be
rediscovered from scratch. Each entry says what is wrong, why it was left, and
what would settle it.

---

## The booking wizard's current step has two sources of truth

**Status:** open, latent — no product code desyncs them today
**Found:** 2026-08-16, by desyncing them from the console during verification

Which step the customer is *on* is stored twice, and the two are only ever
written together by `goToStep()`:

1. **`S.bkStep`** — a number. Drives the progress stepper: `applyShellChrome()`
   in `smart-quote/booking.js:748` renders the pills from `currentBkStep()`
   (`:820`), which reads `S.bkStep` and falls back to `1`.
2. **The `.active` class on `#bk-step-N`** — drives which panel is visible.

Nothing reconciles them. Write one without the other and the wizard shows one
step while the stepper, and anything else reading `S.bkStep`, believes another.

Forcing `.active` onto `#bk-step-3` without touching `S.bkStep` produced exactly
that: the stepper highlighted "1 · Package — Choose a package" while the footer
read "Step 3 of 4" and the form was "Your info". It looked like a stepper bug. It
was two variables disagreeing, and the stepper was the one telling the truth.

No shipping code does this — every transition goes through `goToStep()`. It is
recorded because the failure is *silent and plausible*: the UI stays fully
functional and simply lies about where the customer is, which is the kind of
thing that gets reported as a rendering glitch and chased in the wrong file. Note
also that `S.bkStep` is what `submitBooking` and the abandoned-lead capture reason
about, so a desync is not merely cosmetic.

**What would settle it:** derive one from the other rather than storing both —
read the active step from `S.bkStep` at render time, or drop `S.bkStep` and query
the `.active` element. Failing that, make `goToStep()` the only thing permitted
to touch either, and have `applyShellChrome()` assert they agree.

---

## Saving a package re-lays out the canvas under the owner's cursor

**Status:** open, not fixed
**Found:** 2026-08-16, while verifying the canvas package-payment control

`applyWsPeService()` ends with `renderSvcEditorList()` + `renderWebsitePreview()`.
Both redraw the whole packages section, so the moment a save lands, every package
card, the popover, and the `+ Add service` tile move. The page can also scroll,
because the section's height changes when a card's content does.

The owner does not get a warning, and nothing about the interaction suggests the
target moved. Clicking twice in the same spot hits two different things.

**This is not hypothetical.** Verifying the payment control on a live business
produced three writes nobody asked for — a `pay_in_full` override on a package
that was never opened, a stray override on another, and an entirely new blank
package created by a second click landing on `+ Add service`. It was noticed only
because the resulting catalog was inspected field-by-field afterwards. An owner
doing the same thing sees a package list that looks roughly right and has no
reason to audit it, so the wrong payment terms sit there until a customer is
charged under them.

Severity is higher than a normal layout-jump annoyance because the surface is
dense with destructive and money-affecting controls sitting close together:
`Save`, `Cancel`, `Delete package`, `+ Add service`, and now the payment rule.

**What would settle it:** keep the card geometry stable across a save — update
the edited card in place rather than re-rendering the section (the same fix shape
as `applyPayModeSelection` in `journey.js`, which replaced a full
`renderSettings()` for exactly this reason). Failing that, at minimum do not
re-render while a popover is open, and never let the popover's own buttons change
position as its contents grow or shrink — the deposit block appearing already
moves `Save` by ~21px.

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

## "This changes nothing" is a claim, and it needs testing like any other

**Status:** standing practice, adopted 2026-08-16 after it broke every card payment
**Cost:** all card checkout, from the f13c751 deploy until it was found

`createDestinationCheckout` relied on dynamic payment methods, which a Checkout
Session gets from the *absence* of `payment_method_types`. Behaviour depending on
a missing field is genuinely fragile — someone "fixing" it by adding the field
would silently drop Apple Pay, Google Pay and Link. So f13c751 made the default
explicit:

```ts
"automatic_payment_methods[enabled]": true,   // "no behaviour change —
                                              //  it states the current default"
```

`automatic_payment_methods` is a **PaymentIntent** parameter. It is not valid on
a Checkout Session, and Stripe rejected every request:

```
{"error":"Received unknown parameter: automatic_payment_methods"}
```

Website bookings (`create-booking-checkout`) and store orders
(`create-store-checkout`) both build their session here, so no customer could pay
by card from that deploy onward. The commit message said no behaviour change, and
the change was never exercised against Stripe, because "no-op" reads as "nothing
to test".

**The diagnosis is not "be careful with Stripe params".** It is that *no-op* was
treated as a category exempt from verification. A claim that a change is inert is
one of the strongest claims you can make about code — it asserts something about
every input, including the ones you did not think of — and it is the one most
often accepted without evidence, precisely because it sounds humble.

**Rules:**

- **A no-op change ships with the same proof as any other.** "States the existing
  default", "pure refactor", "comment-only + one line", "makes implicit explicit"
  — each needs one execution showing the behaviour is unchanged. If the change is
  truly inert, that proof is cheap; if it is expensive, the change is not inert.
- **Making an implicit default explicit is a REAL change.** The old code sent no
  field; the new code sent one. Those are different requests. "The default is X"
  and "the API accepts a parameter that sets X" are separate facts, and the second
  needs checking in the API reference for *that resource* — parameters are not
  portable between resources that look related (PaymentIntent vs Checkout
  Session).
- **When behaviour depends on an absence, record it in a comment, not in code.**
  A comment cannot be rejected by an API. That is what the file does now, with an
  explicit DO-NOT for both `payment_method_types` and `automatic_payment_methods`.
- **Watch for the shape:** a defensive comment paired with a defensive line of
  code. The comment was right and worth keeping; making it executable is what
  broke production.

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

**2 · A check that silently checked nothing.** The first attempt at the audit
above matched zero of what it claimed to match and reported success. That failure
recurred three more times the same day and now has its own entry — see
*Checks that silently check nothing* below.

---

## Checks that silently check nothing — or report a success that is not the whole story

**Status:** standing practice, adopted 2026-08-16 after SIX occurrences in one
day

The most dangerous verification result is not a failure. It is a success
produced by a command that examined nothing, because it converts an unknown into
a false assurance — and every later decision is then made on the strength of a
check that never ran.

Five instances, one day, five different mechanisms:

| # | The check | What went wrong | What it reported |
|---|---|---|---|
| 1 | `deno check $FILES` over sixteen Edge Functions | a **trailing space** made Deno read all sixteen paths as ONE module specifier | "1 error, unchanged" — clean |
| 2 | grep for `renderSettings()` to confirm a call site was gone | the surviving match was **inside a comment**, not code | "still present" — wrong both ways |
| 3 | grep of `app-marketplace.js` for the Integrations fix | right string, **wrong file** — the page is drawn by `journey.js` | "fix is present" |
| 4 | `grep "^not ok"` to diff test-failure identity before/after | node's runner emits `✖`, **not TAP `not ok`** — 0 lines both sides | "IDENTICAL — no new failures" |
| 5 | `className.includes('on')` to find the active stepper pill | **`'done'.includes('on')` is true** — a substring match on a class name | "two pills active" — a bug that did not exist |

The first four are the same error: **the check's own scope was never verified,
so an empty result was read as a clean result.** A zero/unchanged count was
accepted as evidence, when zero was actually the signature of the check not
running.

Number 4 is the clearest form of that. Diffing two empty files always succeeds.
The comparison was real, the diff was real, and it proved nothing — and it was
covering the *error-identity* practice adopted specifically to stop this class of
mistake, which is how thin the protection is when the tool itself isn't checked.

### Number 5 is the other direction: a FALSE POSITIVE

The first four produced false *clean*. Number 5 produced a false *alarm*, and it
was one step away from being reported to the user as a defect in the stepper —
inventing work to fix code that was correct.

`p.classList.contains('on')` and `p.className.includes('on')` look equivalent and
are not. Class names are a *set of tokens*; `includes()` is a *substring search*
over the joined string. Every one of these is a true substring match and a wrong
answer:

    'done'.includes('on')        // true  — the exact case that fired
    'button'.includes('on')      // true
    'disabled'.includes('able')  // true
    'icon-off'.includes('on')    // true

So a false positive is just as available as a false negative, and it is *worse*
in one respect: an empty result at least looks suspicious, while a plausible
non-empty result reads as a finding and gets acted on.

**Rules that follow:**

- **Match tokens with token APIs.** `classList.contains(x)` for classes,
  `=== x` or a word-boundary regex (`\bon\b`) for identifiers. Reserve
  `includes()` for genuine substring questions.
- **Watch for short needles.** Two- and three-character terms (`on`, `id`,
  `ok`, `all`) are substrings of ordinary words. The shorter the needle, the more
  a substring match is the wrong tool.
- **Sanity-check a positive as hard as a negative.** Before reporting a finding,
  re-derive it a second way. Here, re-running with `classList.contains` turned
  "two pills active" into the correct "one `done`, one `on`" immediately.
- **A result that contradicts the code you just read is a claim about your
  check.** The renderer assigns `on` to exactly one pill
  (`n === step ? ' on' : n < step ? ' done' : ''`). Two actives was impossible by
  construction — which was the tell, and it is always the tell.

Number 4 is the clearest form. Diffing two empty files always succeeds. The
comparison was real, the diff was real, and it proved nothing — and it was
covering the *error-identity* practice adopted specifically to stop this class of
mistake, which is how thin the protection is when the tool itself isn't checked.

**The rule: prove the check has non-empty scope before trusting what it says.**

- **Assert the denominator.** Print how many files/lines/cases the check
  examined. `before: 0 after: 0` must fail loudly, never read as agreement. If a
  comparison can pass on two empty inputs, it is not yet a comparison.
- **Calibrate on a known positive.** Run the check against something that MUST
  match. If `grep -c` for a string you can see with your own eyes returns 0, the
  grep is wrong, not the file.
- **Read one full result, not just the count.** Numbers 1 and 2 were caught by
  looking at the actual text; the counts alone looked fine in both.
- **Match tokens with token APIs, not substring search** — see number 5 above.
- **Match the tool's real output format**, confirmed by eye — not the format it
  ought to have. (`✖` vs `not ok`.)
- **Grep code, not comments** — check the match's context before concluding.
- **Prefer a loop over one item at a time** to one command over a joined list.
- **A "clean" result for something known to be broken indicts the check first.**

Corollary for reporting: never say "verified" on the strength of an empty
result. Say what was examined and how many — *"82 failure lines, identical before
and after"* is a claim that can be wrong, and therefore worth something.
*"No differences"* is not.

### Number 6: the failure was LOUD, the consequence was silent

**2026-08-16.** The same class, arrived at from the opposite side. The first five
were checks that reported success while examining nothing. This was a command
that reported failure — clearly, in red — and the work still went out wrong,
because nothing downstream was looking at what the failure had actually cost.

```bash
git rm -q api/notify.js                              # stages the deletion
git add public/hubly.html vercel.json docs/… api/notify.js
#   fatal: pathspec 'api/notify.js' did not match any files
git commit -q -F - <<'MSG' … MSG                     # succeeds
git push -q origin main && echo "pushed $(git rev-parse --short HEAD)"
#   pushed 3692f88                                    ← looks like success
```

`git rm` had already staged and removed the file, so by the time `git add` named
it the path no longer existed. **`git add` is all-or-nothing on a pathspec
error**: it aborted having staged *none* of the three files that did exist. The
commit then ran against the index as `git rm` left it and shipped only the
deletion. Push succeeded. The reported sha was real. The commit contained a
quarter of the change, and its message described work that was not in it — so
the git log was actively wrong, which is worse than incomplete.

The `fatal:` was right there in the output. It scrolled past because attention
was on the last line, which said what was expected.

**The rule: verify what a commit CONTAINS, never trust the push output.**

```bash
git show --stat --oneline HEAD      # the files that actually landed
git status --porcelain              # what was left behind
```

Both, every time, before reporting a commit as done. `git status` is the half
that catches this one: three modified files still sitting there after a
"successful" push is unambiguous.

Specific traps worth naming:

- **Never pass a `git rm`'d path to a later `git add`.** It is guaranteed to
  fail, and it takes the whole `add` down with it. Use `git add -A <dir>` or
  stage the deletion and the edits in one `git add -A`.
- **`&&` does not protect you across separate commands.** The failing `add` and
  the succeeding `commit` were two statements; chaining only guards the one it
  joins.
- **A commit message is a claim about content, not a description of intent.**
  When a commit lands partial, the message becomes a lie in the permanent record.
  Fixing it means a follow-up commit that says so — as `0eebb79` does for
  `3692f88` — not quietly moving on.

The generalisation, which is the reason this sits next to the other five:
**a visible error and a visible success in the same output are not equally
visible.** The eye goes to the last line. Anything that reports success must be
made to report *what* succeeded, or it will be read as reporting everything.

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

### HARD RULE: browser automation never writes to production business data

**Adopted 2026-08-16.** Not a guideline. There is no verification goal that
outranks it.

Browser automation may **read and click through** production. It must **never
commit a write** — no `Save`, no `Publish`, no `Delete`, no form submit, no
action that persists to a real business's rows.

If verifying something genuinely requires a write:

1. **Ask.** The user performs it and reports what happened.
2. Or use a business created for testing, never a live one.

Never decide on your own that a write is "small enough", "on the user's own
business", or "reversible". The reversibility is the point being tested and it
cannot be assumed in advance — on 2026-08-16 a verification write created a
package and two payment overrides on a live business, and was recoverable only
because an early readback happened to have captured the prior state. Nothing
guaranteed that. The next one may not be caught at all, because the failure mode
is silent: the data looks plausible afterwards.

"It was caught and reverted" is not evidence the practice is safe. It is one
sample of a practice whose failures are invisible by construction.

Stating the limitation is always available: *"the control renders and the click
path works; the save path needs a write, which I have not performed."* That is a
complete and honest verification result. Manufacturing the write to avoid an
incomplete-sounding report is how a live business gets edited.

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

## A dependency can be invisible to a search for the thing itself

**Status:** standing rule, written 2026-08-17 after it produced two wrong
conclusions in one session — one of which caused an outage

Twice in one evening a grep was run correctly, returned an accurate result, and
the conclusion drawn from it was wrong. Both times the reasoning was "nothing
references this, so nothing depends on it."

**Case 1 — `api/notify.js`.** Searched the repo for `api/notify`, found only the
vercel.json route, deleted the endpoint as dead. Its caller was a row in
`pg_trigger` calling an Edge Function — not code, not searchable. It had sent a
live owner email 25 minutes earlier. Owner booking emails were dead for ~40
minutes.

**Case 2 — `draftBusiness.draftToken`.** Searched the client for `draftToken`,
found nothing, concluded the field could be removed from the API response.
`platform-home.html` depends on it completely — but **never names it**:

```js
hc.draftBusiness = data.draftBusiness;                    // stores the whole object
body: JSON.stringify({ …, draftBusiness: hc.draftBusiness })   // sends it all back
```

The server then reads `draftBusiness.draftToken` to authorise every draft edit —
logo upload, updateDraft, hero image, document patch. Removing it would have
broken the entire iterative build flow. Caught before shipping, by checking one
level further rather than by any search.

### Why the searches could not have found it

- **Case 1:** the caller was not in the codebase at all.
- **Case 2:** the caller was in the codebase and referenced the field only
  through an object it passed through whole. `grep draftToken` cannot see
  `draftBusiness` being forwarded, because the field name never appears.

Pass-through is the general shape: `{...obj}`, `JSON.stringify(obj)`,
`Object.assign({}, obj)`, a whole row handed to a template, `select('*')`. Any of
them carries every field without naming one.

### The rule

**A negative grep bounds where a name appears. It does not bound where a value
is used.** Before removing anything from a payload, a response, a row or a
public path, establish the dependency positively rather than inferring it from
absence:

- **Ask who receives the container**, not who names the field. Trace the object,
  not the identifier.
- **Probe the live thing.** A deployed endpoint answers; a field in a response
  can be observed. For case 1 a single production POST would have settled it —
  and it was eventually run, after the deletion, to confirm the deletion had
  worked.
- **Check the non-code callers**: `pg_trigger`, `cron.job`, webhooks, other
  people's systems. See "The repo does not describe production".
- **Prefer deprecate to delete.** Stop writing a field, watch for a while, then
  remove it. Nothing tonight needed the removal to be immediate.

The honest framing: both searches were sound. The error was treating "I looked
and found nothing" as equivalent to "there is nothing" — and the confidence came
from the search having been done carefully, which is exactly backwards.

---

## `supabase functions download` is a WRITE, and it clobbers `_shared`

**Status:** standing warning, written 2026-08-17 after it silently deleted ~1,900
lines of that evening's work

The command reads like an inspection. It is not. Downloading a function also
rewrites every `_shared` module that function depends on, to whatever version it
was **last deployed with** — which for an old function is old code.

Downloading five orphaned functions left this sitting in the working tree,
uncommitted and unannounced:

```
stripe.ts                  -161 lines   (that evening's Stripe account branding
                                          and on_behalf_of support, gone)
hubly_brain_memory.ts      -962 lines
hubly_ai.ts               1136 changed
hubly_brain_dna.ts         -264
… 7 more files
                          ~1,900 deletions total
```

Nothing failed. Nothing warned. `deno check` passed, because the older code is
perfectly valid code. It surfaced only because `git status` was read after an
unrelated commit and showed eleven modified files nobody had touched.

Had any function been deployed from that tree, it would have shipped the older
`_shared` and quietly reverted the evening's work in production — and the commit
that did it would have looked unrelated.

**The rule: after ANY `supabase functions download`, run `git status` and
`git diff` before doing anything else.** Treat it as a destructive operation on
`_shared`, because it is one.

```bash
supabase functions download <fn> --use-api
git status --porcelain          # expect ONLY the new function directory
git diff --stat supabase/functions/_shared/   # expect EMPTY
git checkout -- supabase/functions/_shared/   # if not: restore, then re-add
                                              # deliberately what you wanted
```

Never deploy from a tree that has had a download in it without checking this
first. The blast radius is every function sharing those modules, not the one
downloaded.

### The pattern, which is the part worth remembering

**The fix for one invisibility problem created another.**

Five Edge Functions existed in production and in no repository — invisible. The
correct response was to download them so the repo described reality. That
download then silently deleted current work, and *that* deletion was invisible
too: no error, no warning, valid code, passing typecheck.

This is not bad luck. A remediation is a change, and changes need the same
scepticism as the thing they are fixing — more, because they are performed with
the confidence of someone who has just understood the problem. The same evening
produced two other instances: deleting `api/notify.js` to remove a
marker-leaking duplicate took down live owner emails, and a migration written
specifically to distinguish "never asked" from "declined" shipped five rows
recording a decline that never happened.

**Verify the remediation as hard as you verified the diagnosis.** The moment
after you fix something is when you are least likely to look.

---

## The repo does not describe production

**Status:** standing note, written 2026-08-17 after it caused a live outage
**Cost:** owner booking emails were dead for ~40 minutes

Five Edge Functions were deployed and ACTIVE with **no file in this repository**:
`booking-notify` (v33), `ai-advisor` (v31),
`ai-advisorsuper-handlerai-advisor` (v26), `hire-crm` (v17),
`mission-control` (v16) — plus three `_shared` modules, one of them 1,671 lines.
They were imported verbatim in `ddbdc1d`.

And the thing that called the most important of them was invisible to every
codebase search, because it is not code:

```sql
CREATE TRIGGER booking_request_notify
  AFTER INSERT ON public.booking_requests FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://…/functions/v1/booking-notify', 'POST', …)
```

A row in `pg_trigger`. `grep` cannot see it. Neither can reading every file in
the project.

### What it cost

`api/notify.js` was deleted as dead on a search showing zero callers. It had sent
an owner booking email **25 minutes earlier**. The search was calibrated — a
known-present string returned three files, proving the tool worked — and that
calibration was then over-read as proof the negative was meaningful. Calibration
shows the search functions; it cannot show that the caller resembles the thing
being searched for.

The check that would have settled it took one command: POST to the endpoint in
production and see whether it answers. That check WAS run — after the deletion,
to confirm the deletion had worked, reading the resulting `200 text/html`
(the SPA catch-all) as "gone". Run first, it would have shown a live JSON
endpoint.

### The rules

- **Read the deployed artefact. If you cannot read it, the check is
  UNAVAILABLE** — say so. Never substitute repo source and report it as a
  verification. Twice on 2026-08-16 a deployed Edge Function bundle failed to
  download and the local file was grepped instead; both times the result looked
  like a clean check. That is the exact habit that let five functions hide.
- **Absence of a caller in the repo is not absence of a caller.** Callers live in
  `pg_trigger`, `cron.job`, external webhooks, and other people's systems.
  Before deleting any endpoint, ask what is deployed and what is scheduled:

  ```bash
  supabase functions list --project-ref <ref>          # deployed, incl. orphans
  ```
  ```sql
  select c.relname, t.tgname, pg_get_triggerdef(t.oid)   -- DB → Edge Function
    from pg_trigger t join pg_class c on c.oid=t.tgrelid
   where not t.tgisinternal and pg_get_triggerdef(t.oid) ilike '%http_request%';
  select jobname, schedule, command from cron.job;       -- scheduled callers
  ```
- **Probe before deleting, not after.** A live endpoint answers. The probe that
  confirms a deletion worked is the same probe that would have prevented it.
- **`supabase functions list` is the source of truth for what exists.** The
  filesystem is a subset, and nothing warns you which parts are missing.

### The wider consequence

Three separate implementations of the owner booking email existed
simultaneously — `booking-notify` (live), `_shared/booking_notifications.ts`,
and `api/notify.js` — and the contradictory evidence (a subject from one, a
header from another, a footer from neither) was the only reason the drift was
found at all. Anything reasoned about Edge Function behaviour from repo source
alone was, strictly, a claim about the repo.

**Current inventory** (2026-08-17): one trigger calling an Edge Function
(`booking_request_notify` → `booking-notify`), one cron
(`hubly-recurring-maintain-30min`). Note there is NO cron for
`google-calendar-maintain`, whose own header says it needs one every 15-30
minutes — which is why Calendar sync has been dead since 2026-07-24.

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

Grepping the wrong file is also one of the four cases in *Checks that silently
check nothing* above — the `Resend` count of 0 was the check reporting its own
scope was wrong, and it was read as a fact about the code.
