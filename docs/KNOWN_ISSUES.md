# Known issues

Open defects that are understood, deliberately not fixed yet, and should not be
rediscovered from scratch. Each entry says what is wrong, why it was left, and
what would settle it.

---

## Placeholder marks are capped by document order, not by importance

**Status:** open, deliberate approximation — shipped 2026-08-21
**Where:** `wireHcEditingSurface` in `public/hubly.html` (the `data-hc-mark` cap)

A generated page can carry dozens of `data-hubly-guess` marks (a florist page had
**58**). Showing all of them turns the preview into a rash of dotted underlines
that reads as broken, so the builder caps the *visible* marks at 9 — the rest stay
fully editable, just unmarked.

The cap is **document order** (the first 9), not semantic importance. In practice
the first 9 are the top-of-page elements — headline, tagline, hero copy — which
are usually the ones that matter, so it approximates "mark the important ones."
But it's an approximation: a page whose first nine invented elements happen to be
minor (a sequence of small labels) would mark those and leave the headline
unmarked further down.

**The follow-up** (not built): rank marks by role — always the headline, tagline,
and an invented process; never the FAQ lines — and show the top N by rank rather
than by position. Left for later so we don't gold-plate before the ordering
heuristic proves insufficient in real use.

## The preview sized the iframe to content, so `vh` ran away (FIXED) — plus a latent image-miss swallow

**Status:** root cause FIXED 2026-08-21 (commit "Preview: the iframe is a browser
window…"). Two earlier wrong diagnoses are recorded below because the *way* they
were wrong is the lesson.
**Where:** `hcApplyPreviewFit` / `hcMountDocumentHtml` (preview sizing) +
`resolveImages` / `blankField` (the latent swallow).

### 1 · The real cause: `vh` resolved against a content-sized viewport

The freeform pages use `min-height:100vh` (and `92vh`) on their hero and section
blocks — correct, ordinary CSS. But the builder preview **sized the iframe to the
page's own content height** (it measured `documentElement.scrollHeight` in
`hcReportPreviewSize` and reported it up; the parent set the outer iframe to that
height so it could scale the whole thing into the pane). So `vh` resolved against
a viewport that was itself the content height: `100vh` meant "the whole page",
every section inflated, the document grew, the next height report inflated it
further. It is a feedback loop, and it was measured on the exact page:

| viewport height fed in | page's resulting height | hero height (`92vh`) |
|---|---|---|
| 800px (a real browser) | **3,712px** | 1,012px |
| 3,712px (fed back) | 6,115px | 3,415px |
| 6,115px (fed back) | 8,326px | 5,626px |

The old preview ran that loop ~17 times and converged near **39,000px** for a
restaurant one-pager that is really **3,712px**. That is why the hero read as a
giant dark rectangle (the container was thousands of px tall, not slow to paint)
and why the visitor arrived on empty space with content far below the fold.

**The fix:** the iframe is a **fixed, pane-sized viewport** and the page scrolls
inside it, exactly like a browser window. `100vh` is one screen again. No height
postMessage, no re-measure loop, no reveal-hold; scale is decided once, from
width. Verified live: `--hc-ph` is now `764px` (one pane-screen), not 38,946px,
and the hero renders one screen tall with the photo present. **The generated CSS
was NOT changed — `100vh` is right, the preview was wrong.**

### 1b · Two wrong diagnoses on the way here (the lesson)

- *"It's re-scaling"* — no; the scale is width-based and was stable.
- *"It's paint latency behind a dark container, and the photos are 1.4–3.4 MB"* —
  the dark container is real, but it was thousands of px tall because of the `vh`
  runaway, not because a heavy photo was mid-download. And the photos are **not**
  1.4–3.4 MB: that number came from `curl`-ing the **entity-encoded** `&amp;` URL,
  which Pexels reads as unknown `amp;h`/`amp;w` params and answers with the
  multi-MB **original**. A browser decodes `&amp;`→`&` and downloads the sized
  `landscape` rendition — **~61–63 KB each** (measured). The instrumentation
  (9,542→38,946px, "17 growth updates") already contained the proof and was
  attributed to images finishing; images finishing do not add 29,000px. **Read
  your own numbers before naming a cause.**

### 2 · The swallow-and-succeed (latent, did NOT fire in the reported builds)

`resolveImages(html, …)` returns `{ html, placed, blanks, decisions }` with **no
ok/fail flag**. A page where every image resolved and a page where the hero fell
through to a blank come back the same shape, and the freeform build stores either
as a success — the miss is counted (`blanks`) but never *raised*. A blank is
placed when there is no customer photo AND (the subject is a work-role we refuse
to fake with a stranger's stock photo, OR the stock fetch returned null), and
`pexelsFetcher` returns `null` **silently** on `!res.ok`, a JSON parse failure, an
empty result set, or an all-person result. `blankField` then renders a dark
gradient div with no visible text that preserves the container's dimensions — so
if it *ever* fires on a hero, it is a hero-sized dark void stored as a success.

It did not fire in the two builds above (0 blanks), so it is not the reported bug
— but it is a genuine gap: the free Pexels tier does rate-limit and return empty
under load, and the first time that lands on a hero, this path stores the void
silently. **What would settle it:** `resolveImages` should surface a signal the
caller can act on (e.g. "a hero-class field went blank") instead of folding it
into an untyped count, and a blank must never be allowed to own a large area —
retry with a simpler query, fall back to another source, or collapse the
container.

### PEXELS_API_KEY, proven by a live call (not by reading the variable)

The key was **rotated 2026-08-21 03:13 UTC**. Both builds above were generated by
the deployed function *after* that (Ironside 14:49, Ember & Oak 17:09) and the
deployed resolver placed **7 live `images.pexels.com` images** across them, all
returning `200 image/jpeg` now. That is the deployed key working right now,
demonstrated through the function that uses it — not `secrets list` showing the
name exists.

**Rendition weight (corrected, measured):** the resolver already picked the
`landscape` rendition (~61–63 KB in the browser), so page image weight was already
fine — the "1.4–3.4 MB" claim was the `&amp;` curl artifact above. Hardened anyway
2026-08-21: `pexelsFetcher` now prefers `landscape`/`large2x`/`large` and, if it
ever falls through to `original`, appends `auto=compress&w=1600` so a raw
multi-MB file can never be served; and `realImg` adds intrinsic `width`/`height`
from the rendition URL so the layout reserves the aspect ratio before decode.

## A stale draft can resume from residual state after the cookie is cleared

**Status:** open, observed 2026-08-21 during builder verification
**Found:** clearing the draft, reloading, and submitting a new build — and getting
someone else's draft back

Sequence: `DELETE /api/draft-session` (200) → clear the `hubly_*` localStorage
keys → reload → type a new business and submit. Expected a fresh draft;
`hcResumeDraft()` still resurfaced a *previous* draft (a stale "detailing-business"
from an earlier test), and the submit appeared to operate on that resumed draft
rather than starting a clean one. Clearing **all** `hubly_*` keys AND confirming
`/api/draft-session` returned no assertion before submitting was what finally gave
a clean start.

So a cookie DELETE plus a reload is **not** a reliable guarantee of a fresh
builder — resume can still fire from residual browser state, and a same-turn
submit can race it. Not chased now (it only bit automated back-to-back builds; a
real user clears far less aggressively), but worth a look: the resume path should
be idempotent against a just-cleared session, and a fresh submit should win over
an in-flight resume.

## The Supabase Management API SQL endpoint returns 403 (Cloudflare 1010) intermittently

**Status:** environmental, noted 2026-08-21 so it isn't rediscovered
**Found:** `POST https://api.supabase.com/v1/projects/<ref>/database/query`

The Management API's `database/query` endpoint worked for applying a migration,
then began returning `403 { "error code: 1010" }` (a Cloudflare block, not an auth
failure — the same token still deployed functions fine). It appears rate-limited
or WAF-throttled after a burst. **Workaround that worked:** verify via the public
PostgREST RPC with the publishable key instead of the Management API, or space the
Management calls out. Nothing to fix in our code; recorded so the next session
doesn't treat the 403 as a broken token.

---

## A public address now requires an owner — closed, but one path is unverified end-to-end

**Status:** shipped 2026-08-20 (migration `20260821070000_draft_reads_and_public_gate.sql`,
`resume-draft` function, `hubly.html` + `platform-home.html` handshake/resume).
The read-time gate and the server round-trips are verified by running them. One
client path — the *cold* cookie-only resume visual — could not be exercised in a
signed-in browser and is verified only at the data layer. Details below.

**What was wrong.** `get_public_business(slug)` and
`get_public_business_document(slug)` served ANY business by slug, claimed or not.
So an unclaimed draft's `{slug}.myhubly.app` was live to any stranger with the
link — an unfinished, unowned page public as fact, the read-time half of the
phishing exposure.

**The gate.** Both public RPCs now require `owner_id IS NOT NULL`. Two new
draft-scoped reads (`get_draft_business`, `get_draft_business_document`) take the
`draft_token` the builder already holds and return the SAME data for an
*unclaimed* business, so the builder still previews. The builder iframe
(`{slug}.myhubly.app?hcEdit=1`) asks its parent for the token via an
origin-checked postMessage — answered only for the draft it is showing, never in
a URL — and a public visitor, never in edit mode, never asks and falls straight
to "This page isn't live yet."

**Existing pages (checked before changing anything).** The 10 claimed businesses
are all on the classic renderer, `owner_id` set, 0 stored `business_documents` —
they never depended on `get_public_business_document` and keep serving. The ~30
unclaimed-with-page businesses are all test drafts; their URLs go dark to
strangers, which is the point.

**Resume.** The draft session was in-memory; closing the tab lost the way back.
There are now two layers: (1) a pre-existing `hubly_session_v1` in localStorage
already restores the whole session — conversation, memory, `businessId` — on the
**same device**; (2) new for cross-device / cleared-storage, `resume-draft` turns
the 7-day httpOnly claim cookie's assertion (minted by `/api/draft-session` on
Vercel, the only thing that can read that cookie) back into the draft, but only
while `owner_id` is null. On load `hcResumeDraft()` calls it and, if a draft
comes back, says "welcome back" with the page in the preview.

**Verified by running it (2026-08-20):**
- Stranger at `marlow-vance.myhubly.app` → "This page isn't live yet"; freeform
  page NOT rendered.
- `aquaspeed.myhubly.app` (a claimed business) still serves its full page.
- `resume-draft`, called live from the myhubly.app origin with the real cookie's
  assertion, returned the full unclaimed draft (`ashgrove-forge`, draft_token,
  `hasPage:true`) — and returns `ok` ONLY because it is unclaimed.
- (server, prior) draft RPCs: correct token returns the 32KB page, wrong token
  refused.

**NOT verified end-to-end, and why.** The cold "close tab → reopen anonymously →
welcome-back paints" visual could not be isolated: the only browser available is
a **signed-in owner** whose `businessId` persists through the auth session and
whose same-device `hubly_session_v1` resume already covers the warm case, so
`hcResumeDraft()`'s `if(hc.draftBusiness) return;` guard correctly short-circuits
before the cookie path runs. Exercising the cold path needs an anonymous profile
holding ONLY the draft cookie (a fresh draft in incognito), or signing the user
out — neither worth doing to the user's live session. The server half (the hard
half) is proven; the client paint is deployed and code-reviewed but not
eyes-on-verified in the cold case. **What would settle it:** create a draft in an
incognito window, close it, reopen `myhubly.app` in that same window, confirm the
welcome-back + preview.

**Not done this session (deliberately, per the stop rule):** the email-ask at
first-paint (item 3, report-only) and grouping placeholder marks under ten per
page (item 4). See the session report.

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

## `HUBLY_DOCUMENT_GENERATION_ENABLED` does not do what its name implies

**Status:** standing correction, written 2026-08-17
**Believed for months:** that it gates document generation, and that turning it
on would enable `designRationale` and produce varied site designs.

It does neither. `website.generateDocument` runs **regardless of the flag** —
the capability handler never reads it. The flag is consumed in exactly one
place, `hubly-conversation`'s system prompt, where it switches which *guidance*
the model receives:

```ts
const DOCUMENT_GENERATION_ENABLED = (Deno.env.get("HUBLY_DOCUMENT_GENERATION_ENABLED") || "").trim() === "true";
…
${DOCUMENT_GENERATION_ENABLED ? `There is no template or direction to pick anymore…` : ``}
${LEGACY_LAYOUT_DIRECTIONS}
```

On → the model is told not to propose layout directions. Off → it is given the
legacy list of 12 named directions. **It is a prompt switch, not a feature gate**,
and it adds no per-business design of any kind.

It is unset in production and has never run there.

**Why this mattered.** It was one of two proposed fixes for "every AI-built site
looks identical". Enabling it would have changed the model's instructions on the
path that builds every new site — untested, in production — while doing nothing
about the actual cause, which was that `start_business_in_progress` set no
visual identity and every business inherited the same column defaults.

**The general rule:** a flag's name is a claim about behaviour, and claims get
verified. Read every site that consumes the variable before enabling or removing
it. "Never run in production" plus "we are not certain what it changes" is the
worst pair to act on, in either direction — and the temptation is to enable it,
because the name sounds like the thing you want.

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

---

## The Hubly Document path is shipped dark, and two documents said otherwise

**Found 2026-08-17.** `HUBLY_DOCUMENT_GENERATION_ENABLED` **is not set on the
production project.** Confirmed against `supabase secrets list`: 27 secrets,
that name is not among them. `DOCUMENT_GENERATION_ENABLED` is therefore `false`,
and `hubly-conversation` blocks `website.generateDocument` and
`website.patchDocument` at the dispatch gate — the third of three enforcement
points, and the only one that matters, since it runs regardless of what the
prompt advertised.

**There is exactly one entry point.** `generateAndValidateDocument` and
`buildDocumentSchemaPromptBlock` are called from `hubly_capability_registry.ts`
and nowhere else; no deployed function imports `hubly_document.ts` directly; the
flag is read in one file. So this is not "mostly off" — there is one switch and
it is down.

**It has run exactly once.** `business_documents` holds 8 rows, all belonging to
a single business (`c1981783…`), all created on 2026-08-10 within seven minutes:
one `ai` generation followed by seven `patch` versions. One test session, and
nothing since. (An earlier draft of this entry said "never rendered a page for a
real visitor". That was inference, and the row count disproves it — the
measured claim is one business, one day, zero since. Counting the rows took one
request and should have come before the sentence, not after it.)

**What actually builds every live site:** `business.startDraft` +
`updateDraft` + `setServices` write `businesses` columns, and
`public/hubly.html` renders them client-side. Proven by fetching three live
draft sites — each returns ~2.83 MB, which is the SPA shell, not server-rendered
document HTML.

### Two documents were wrong because of it

`AI_CAPABILITY_INVENTORY.md` listed `website.generateDocument` and
`website.patchDocument` as 🟢 LIVE, and `HUBLY_HOME_SPEC.md` built its
"Change something on my site" chip on `patchDocument`. Both were verified
against the registry and against the deployed function — and the registry is
the wrong authority for this question, because a capability can be present,
correct, deployed, and switched off by an environment variable one layer above
it. **The audit's own rule — implemented ≠ reachable — has a third term:
reachable ≠ enabled.** Enumerating `name:` declarations cannot see a feature
flag. Check the deployed secret list too.

### It also inverted a correction

Earlier the same day, `section_order` was found absent from
`renderHublyDocument` and the `leadWith` half of the palette work was reported
as doing nothing. That was true of the Document renderer and false of
production, which does not use the Document renderer. The correction was
right about the code and wrong about the users. `section_order` is read by
`hubly.html`, so `leadWith` was the half that already worked.

**The rule:** before reporting that a code path is or isn't doing something for
users, establish that the path runs for users at all. A flag, a gate, or a
second implementation can make a perfectly correct reading of the code a
perfectly wrong statement about production.

### Resolved 2026-08-17, and what it produced

The flag was set to `true` and `hubly-conversation` redeployed — the constant
is evaluated once at module load, so warm isolates keep the old value and the
redeploy is part of the change, not a formality.

Three trades were then rebuilt through the Document path from identical opening
messages. Top-level section ids:

| grooming | photography | detailing |
|---|---|---|
| hero | hero | hero |
| services | portfolio | mobile-convenience |
| how-mobile-grooming-works | services | what-to-expect |
| local-trust | experience | how-it-works |
| about | service-area | service-area |
| faq | faq | faq |
| contact | inquire | contact |

**27% section-id overlap between any two trades**, and the shared ids are the
ones that should be shared — hero, faq, contact. Against the classic renderer's
"What we offer / What customers say / Meet X" on every site regardless of trade.
Photography led with portfolio, which is `leadWith` arriving as prompt text.

**This is the fourth instance today of the same mistake** — code read correctly,
conclusion wrong, because nobody asked whether the path runs. The other three:
`api/notify.js` (caller was a `pg_trigger` row), `calcBookingMoney`'s classic
branch (114 combinations verified on a branch production never takes), and the
marketplace facade fix (made in `app-marketplace.js`, page drawn by
`journey.js`). See `AI_CAPABILITY_INVENTORY.md` for the table.

---

## An RLS sweep that probes with `select=*` hides column-restricted tables

**Found 2026-08-18, during the sweep it nearly invalidated.**

The sweep tests every table with the anon key and reports which return rows.
It probed with `select=*`, which is the natural choice and is wrong the moment
any table has column-level grants.

`businesses` had exactly that: Session 1 had granted anon SELECT on 51 columns
and withheld `draft_token`. A `select=*` therefore fails with 42501 for the
missing column, and the sweep recorded `businesses` as **returning nothing** —
a clean bill of health for a table that was in fact serving all 64 rows,
15 of them with email and phone, to anyone with the public key.

It was only found by re-testing with an explicit column list, on a hunch about
the fix rather than by the method.

**The rule: after ANY column-level grant, the sweep must be re-run with explicit
column lists, not `select=*`.** A table that reads "blocked" under `select=*`
may be fully readable one column-name away. There are no other column-restricted
tables today, which is exactly why this will be forgotten before it matters.

Related: the same sweep first reported 41 unconditional anon policies. The real
number was 10. `pg_policies.qual` is NULL for INSERT policies — the operative
clause is `with_check` — and coalescing NULL to "unconditional" turned 31
correctly-guarded policies into false alarms. Read `with_check` for INSERT and
`qual` for SELECT/UPDATE/DELETE, or the report cries wolf.


---

## This codebase swallows failure and continues

**Assume any path that reports success does not verify, until proven otherwise.**

Seven confirmed instances, all found the same way — by checking the result
rather than the return value:

| # | What reported success | What actually happened |
|---|---|---|
| 1 | logo upload | `logo_url` patched, the rendered header kept its monogram |
| 2 | `patchDocument` | a column written that the renderer never reads |
| 3 | "Done — the logo element was restyled" | no change to the page. Twice |
| 4 | slug-availability check | RLS returned `[]`, read as "slug is free" |
| 5 | `hostBrandImage` | three upload failures swallowed, a `data:` URI written |
| 6 | click-to-edit fast path | a real edit landed and NOTHING was said — `reply: ""` returned unconditionally, `humanPatchSummary` computed and discarded |
| 7 | `dedupeConversationMessages` | every message compared against itself, so the whole transcript was suppressed on any turn that invoked a capability |

The shape is always the same: an operation returns 200, or a function returns a
value, and the caller treats that as evidence of the outcome. It is not. A
column write is not a rendered page; a 200 is not a row; a non-null return is
not a successful upload.

**6 and 7 are the same failure wearing the other coat: silent SUCCESS.** From
the person's side there is no difference. You clicked something, the product
said nothing, and you cannot tell whether it worked, whether it is still
thinking, or whether you should try again. That ambiguity is what made "make
the logo bigger" so infuriating — not the failures, the silence around them.

So the rule has a second half. A path that reports to a person must not only
verify the outcome, it must **say the outcome**, including when the outcome is
"nothing changed". `CapabilityActionResult` now separates `summary` (what to
log — versions, URLs, whether the work was real) from `humanNote` (what to
say). Any action a person triggers DIRECTLY has no model turn to narrate it,
so an action that sets no `humanNote` is an action that happens in silence.

When touching any path that reports success to a person, verify against the
thing the person cares about — the rendered result, the row that came back, the
asset that actually serves bytes — and say so plainly when you cannot.


---

## Verification that measures the mechanism passes while the problem persists

Sibling to the swallow-failure note above, and the subtler of the two.

The builder-only placeholder rule was verified correct: on a live public page,
**0 placeholders and 0 empty islands survived the strip**. The filter provably
ran and provably worked. Meanwhile an empty reviews section held **414px** of
that same page, because the model narrated the absence in prose — "Reviews will
appear here once we connect them" — which is copy, not a marked placeholder, so
there was nothing for the strip to remove.

Every number in that check was true. The check was still worthless, because it
measured the FILTER rather than the PAGE.

**Assert that the page does not contain the thing. Never that the filter ran.**
"0 placeholders remain" is a statement about our code; "no section says reviews
are coming" is a statement about what a customer sees, and only the second is
the thing anyone cares about. The same trap applies to any cleanup step: a
sanitiser, a dedupe, a suppression rule, a validator. Measure the output, not
the machinery.


---

## The classic renderer is supported, not deprecated

**Decided 2026-08-18.** Existing customers' sites are rendered by the classic
path in `public/hubly.html` and they are never migrating to the Hubly Document
format. Classic is a live product surface with real businesses on it, not legacy
code awaiting removal.

Practically:

- Do not refactor it away, and do not delete parts of it that look unused —
  `api/notify.js` was deleted as dead once already because its caller was a row
  in `pg_trigger`.
- Changes to code BOTH renderers share — `businesses` columns, the storage
  buckets, RLS policies, the booking and Service Engine paths — must keep
  classic working. It is the easier one to break, because the Document work is
  where the attention is.
- "Document is the future" means new sites are built there. It does not mean
  classic is winding down.
---

## Features classic has that Document does not

**No longer a migration gate. Decided 2026-08-18: existing classic customers
never migrate. Document is for new sites only, and classic keeps working as-is.**

So nothing below is a risk to an existing customer. Each item is now a product
question about NEW businesses: does a business starting today on Document need
this, and if so it has to be built there. The urgency is gone; the questions are
not.

**Memberships is the one for the roadmap.** It has a real write path —
`booking_requests.is_membership_signup` — and a new business that wants
recurring plans simply cannot have them on Document. That is a capability gap in
the format we are selling to new customers, not a porting chore.

| Feature | Classic | Document | Confirmed |
|---|---|---|---|
| Site chatbot | `ws-chat-widget`, 17 refs in hubly.html | was **absent entirely** — **RESOLVED 2026-08-18**: `HublyChat` added to the schema, rendered by the shell, wired to the same deployed `chatbot-message` function classic uses | 2026-08-18 |
| Service-area map | `ws-area-map`, real component | was a dashed placeholder — **RESOLVED 2026-08-18**: `HublyMap` now renders the same Google embed classic does, built from the same city/service-area query, with an honest empty state only when there is no location on record | 2026-08-18 |
| Logos stored as `data:` URIs | renders fine | was **dropped** to a monogram — **RESOLVED 2026-08-18**: writer no longer falls back to a data URI, and both existing rows migrated to storage and verified rendering | 2026-08-18 |

### The data-URI logos, specifically

8 businesses have a `logo_url`. **2 of them hold a `data:` URI instead of a URL,
and both belong to claimed businesses** — real owners. Largest is 37,207 bytes of
base64 sitting in a text column.

The writer is `hostBrandImage` in `public/hubly.html`:

```js
for (let attempt = 0; attempt < 3 && !hosted; attempt++) {
  try { hosted = await uploadBrandAsset(kind, dataUrl); } catch (e) { hosted = null; }
}
return hosted || dataUrl;   // <-- silent fallback
```

Three upload attempts, and if all three fail it returns the raw data URL, which
is then written to `logo_url`. It is called from **13 sites** and is fully live.
So this is not a historical artefact: any owner whose upload fails today gets a
data URI, which works on classic and will vanish when they move to Document.

**Both fixed on 2026-08-18.** `hostBrandImage` now returns null on failure and
the one unguarded caller of thirteen warns instead of saving; and
`scripts/migrate-data-uri-logos.ts` moved both rows into storage, each verified
readable and then verified to render through the real Document renderer. Zero
`data:` URIs remain in the table.

### What Document lacks, enumerated 2026-08-18

Rather than wait to trip over the next one, every `ws-*` feature block in the
classic renderer was enumerated and checked against the Document schema. Four
have **no representation in the Document format at all**:

| Feature | Classic | Document | Confirmed how |
|---|---|---|---|
| Social links | 42 refs; `ig_handle`, `fb_url`, `tiktok_handle`, `google_url` are real columns on `businesses` | **0 refs.** The Document footer renders name and phone only | Confirmed — columns exist, classic renders them, schema never mentions them |
| Memberships | 58 refs, including a real signup writing `booking_requests.is_membership_signup` | **0 refs** | Confirmed absent from the schema; the signup path is classic-only |
| Promotions | 39 refs | **0 refs** | Grep-level, not yet traced end to end |
| Announcement ticker | 20 refs | **0 refs** | Grep-level, not yet traced end to end |

Social links and memberships are the two worth acting on: both have real columns
or real write paths, so a NEW business wanting either cannot have it on
Document. Social links are cheap — the columns exist and the chrome footer is
ours to extend. Memberships is a real build. Promotions and the ticker are
grep-level findings and need tracing before being treated as facts.

**The list above is almost certainly incomplete.** The data-URI logo case was
found by accident, while chasing an unrelated `HTTP 000` in a storage test.
Nobody went looking for it. Treat the table as a starting point rather than an
inventory when deciding what a new business needs.

---

## `price = 0` is the "no price" sentinel, so a free service is unrepresentable

**Found 2026-08-18**, while checking how many draft services actually had prices.

`set_business_draft_services` stores `0` when the model omits a price — which it
correctly does when the owner has not given one. So `0` means "unpriced", not
"free". Two consequences:

**1. `!= null` is the dominant test in this codebase and it treats `0` as real.**
Twelve call sites use `price != null`. `buildBusinessRecordBlock` deliberately
does not — it guards on `n > 0`, so the generator reads `0` as unpriced and
withholds the figure rather than printing `$0` on a customer's website. That is
the right behaviour for the website and it is *inconsistent with the rest of the
codebase*, which is worth knowing before someone "fixes" the inconsistency in
the wrong direction.

**2. A genuinely free service cannot be expressed.** "Free inspection", "no
call-out charge", a £0 add-on — all indistinguishable from "we never asked".
Nothing depends on this today because no business has one, which is exactly why
it will be discovered by a customer rather than by us.

The fix is a nullable price with `NULL` meaning unpriced and `0` meaning free,
which is a migration plus an audit of the twelve `!= null` sites. Not done.

**When it is resolved, the twelve call sites move to
`buildBusinessRecordBlock`'s behaviour — guard on `> 0` — not the other way
round.** The generator is the one that is right. Withholding a figure you are
unsure of is recoverable; publishing `$0` on a customer's live website is not.
Without this sentence someone will "simplify" the inconsistency in the
convenient direction and start printing free prices on real sites.

One nearby instance already renders it: `hubly_capability_registry.ts` prints a
membership price with `m.price != null ? "$" + m.price : ""`, so a £0 membership
reads as `$0` in a CRM summary. Not customer-facing, not urgent.


---

## Generated-site chrome is identical on every business's site

**The header is fixed. So are six other things nobody had counted.**

Chrome is drawn by the shell, so the generator cannot vary it — the right call
for sections, and the reason the first thing any visitor sees was byte-identical
on every Hubly site. Three real headers, pulled from stored `rendered_html` on
2026-08-18, differed only in two initials and the nav labels:

```
<header class="hd-chrome-header"><a class="hd-brand"…><span class="hd-monogram">PF</span>…
<header class="hd-chrome-header"><a class="hd-brand"…><span class="hd-monogram">TW</span>…
<header class="hd-chrome-header"><a class="hd-brand"…><span class="hd-monogram">LM</span>…
```

| Surface | Renderer | What varies today | Status |
|---|---|---|---|
| Header | `renderChromeHeader` | placement, mark shape, scale, solid/transparent, sticky, nav, CTA | **fixed 2026-08-18** — `selectChromeVariant` |
| Footer | `renderChromeFooter` | name and phone only | open — one layout, no links, hours or area |
| Booking CTA | `HublyBooking` | phone line only | open — always "Check availability" |
| Contact form | `HublyContactForm` | nothing | open — same four fields, labels and "Send enquiry" everywhere |
| Chat | `HublyChat` | nothing | open — always "Ask a question", always collapsed |
| Reviews placeholder | `HublyReviews` | nothing | open — identical two lines |
| Portal placeholder | `HublyCustomerPortal` | nothing | open — identical one line |
| Map | `HublyMap` | the query | open — identical frame, height and zoom |

The three worst remaining are the contact form, the chat launcher and the
booking CTA: they vary *not at all*, so they are the same words on every Hubly
site in existence.

**The fix that worked is a vocabulary, not freedom.** The shell still owns every
pixel; it owns more than one arrangement of them and picks between them from
facts about the business — logo aspect ratio measured from the asset's own
header bytes, navigable section count, whether the hero paints itself dark,
and the trade family. No randomness, no model preference, so the same business
always renders the same header — which is what makes "put the logo in the
middle" answerable at all. See `selectChromeVariant` for the rule and
`tests/chrome-variants.test.mjs` for what would catch it collapsing back.

**This also closed "the logo has no controls — locked square, no size, shape or
position."** Same root cause. `website.setChrome` maps those requests to
variants rather than trying to restyle an element, which is what made "make the
logo bigger" report success and change nothing.

### Two things the variant work turned up

- **`deriveNav` will print garbage.** Lehi Mobile Dog Grooming has a nav item
  reading **"Node"**, from a section the model gave `id="node"`. `navLabel`
  title-cases whatever it is handed; there is no allow-list.
- **A transparent header must never be sticky.** Styled for the hero it sits on
  — white type, white pill, no bar — it becomes white-on-white the moment you
  scroll past, with the CTA floating over the contact form. Observed on the yoga
  studio's page. The two are now mutually exclusive and deliberately not
  overridable.


---

## There is no `website_meta` column

`patch_business_in_progress` takes a **`p_website_meta` argument** and merges it
into `businesses.meta -> 'website'`. The argument name reads so exactly like a
column that a render-path change on 2026-08-18 selected `website_meta` in five
places at once. PostgREST rejects the unknown column with a 400, `selectOne`
returned null, and every generated header silently lost the business name, phone
number, logo and brand colour together:

```
<span class="hd-monogram">•</span><span class="hd-brand-name"></span>
```

It did not throw, did not log, and the header still rendered — with a bullet for
a monogram and an empty name. Nothing downstream treats a null row as an error.

Read it through `websiteMetaOf(bizRow)`, never `bizRow.website_meta`. The column
is also **text in some rows and jsonb in others**, so it needs parsing either
way.

**The general form:** a column name that does not exist fails as `null`, not as
an exception, anywhere `selectOne` is used. `curl` the PostgREST endpoint with
the exact select list when changing one — a 400 means a bad column, a 401 means
the list is fine and RLS stopped you.


---

## "Generation fails ~37% of the time" was a quota exhaustion, not a lost isolate

On 2026-08-18 three of eight real builds produced no document. The reasoning
went: generation runs in `EdgeRuntime.waitUntil` on the request isolate, the
runtime recycles a request isolate the moment it responds, therefore the work is
being dropped. Plausible, consistent with everything observable, and **wrong** —
or at best a small part of it.

The actual cause, found the next day by returning the upstream status instead of
swallowing it:

```
502 {"detail":"The OpenAI account has no quota left.","upstreamStatus":429}
```

`insufficient_quota`. The account had run out of credit, and had presumably been
running low during the very builds that "failed".

**Why it looked like an infrastructure problem.** The two are indistinguishable
from outside:

| | isolate recycled | OpenAI 429 |
|---|---|---|
| document written | no | no |
| error surfaced to the person | none | none |
| entry in any table | none | none |
| what the client showed | skeleton, then a timeout | skeleton, then a timeout |

`hubly_ai.ts` threw `HublyAIProviderError("openai", 429, "OpenAI is temporarily
unavailable.")` and the handler returned a flat 502 with the status discarded.
One string covered quota exhaustion, a rotated key, and a genuine outage — three
completely different problems, one of which is fixed by topping up an account
and none of which could be told apart without a deploy.

**Three lessons, all already paid for:**

1. **Never collapse an upstream status into a generic message.** The number
   costs nothing to keep and was the entire diagnosis.
2. **A plausible mechanism that explains the symptom is not the cause.** The
   `waitUntil` reasoning was sound and the fix was worth making on its own
   terms; it was still not what was happening. Ask what would DISTINGUISH the
   candidate causes before building for one of them.
3. **"Try again in a moment" is a lie when trying again cannot work.** A quota
   failure invites infinite retries and reads to the person as their fault.

### Verified 2026-08-19, after quota was restored

- 5 of 5 builds landed (same experiment shape as the 8 that gave 3 failures).
- A live job went `running -> succeeded`, attempts=1, document in ~62s.
- A logo uploaded **12 seconds into a build** now reaches the rendered header.
  Before the row re-read it was discarded, and "I uploaded my logo and nothing
  happened" was an accurate description of what occurred.
- 0 structural nav labels across 7 freshly generated sites.
- The stalled path stops the skeleton, says so in the chat, and offers Retry.

Two bugs the verification itself found, both since fixed:

- **Retry could restart a HEALTHY build.** The resume condition included any job
  that had not yet succeeded, so clicking Retry over a slow-but-fine build
  started a second one racing the first. Reachable without anyone doing anything
  wrong, because the client's four-minute ceiling can fire over a genuinely
  running build.
- **Stale interims arrived after the failure**, so the transcript read "the
  build stopped partway" and then "building the full page now". Anything on a
  timer has to be able to find out it is no longer true.

### Still not verified

Nobody has watched a build die for real and be recovered. `stalled` detection
was exercised by stubbing the status RPC's documented response to the client;
the SQL branch that produces `stalled` (status `running` past `expected_by`)
has not been hit by an actually-dead build.

### What was built anyway, and why it still matters

The failure was invisible, and that part was real regardless of cause:

- **`document_build_jobs`** — a row written before the build is dispatched, so a
  build that never arrives is one somebody recorded asking for. `running` past
  `expected_by` is provably stuck; `failed` carries a short reason code. Nothing
  could count these before, which is why 37% was a number from watching rather
  than from the system.
- **`hubly-document-build`** — the build moved out of `waitUntil` into its own
  function invocation, awaited in a fresh isolate. Still not a queue: if THAT
  isolate dies the work is lost. It removes one real risk and does not pretend
  to remove all of them.
- **Retry with backoff in `hubly_ai.ts`** — there was none. A single 429 ended
  the turn. Three attempts, exponential backoff, `retry-after` honoured, and
  `insufficient_quota` deliberately NOT retried because it is a billing state,
  not congestion.
- **An honest client** — the skeleton stops, says what happened, and offers
  Retry, rather than spinning for something that is not coming.


---

## Facts given in the brief reach the record only if the model volunteers them

There is no extraction step. A fact typed by the owner is persisted only if the
model happens to invoke a capability that has a field for it, on some turn. When
it goes straight `startDraft -> generateDocument -> setServices`, everything
except the name is gone.

Measured 2026-08-19. One message containing a name, phone, email, street
address, city, state, postcode, opening hours, three service-area towns and two
priced services produced this record:

```
name                 "Hollybrook Gutter Guards"
business_type        "windows"        <- and wrong about the trade
phone                null
email                null
city                 null
state                null
address              null
service_area_cities  []
travel_radius_miles  null
years_in_business    null
about                null
tagline              null
```

The rendered page contained none of it — no phone, no address, no towns, no
hours, and no prices, because `generateDocument` ran BEFORE `setServices` on
that turn. It is not deterministic: the same shape of message on other runs
produced a phone and a city, because the model called `updateDraft` those times.

### What each action can write

| Fact | Written by | Reaches the record? |
|---|---|---|
| name, business_type | `startDraft`, `updateDraft` | yes |
| palette, lead section | `startDraft` | yes |
| tagline, about, phone, email, city | `updateDraft` **only** | only if the model calls it |
| hero headline/subhead, SEO title, layout | `updateDraft` | same |
| services + prices | `setServices` | only if called, and only if called BEFORE the build |
| logo, photos | client upload | yes — a real UI, not a model decision |

### What the generator READS and nothing can write

`loadBusinessRecord` was built to feed the generator real data. Six of the
fields it reads have **no writer anywhere in the conversational path**:

| Field | Read by | Writers |
|---|---|---|
| `state` | `loadBusinessRecord`, `mapQueryFor` | none |
| `address` | (column exists, read nowhere) | none |
| `service_area_cities` | `loadBusinessRecord`, `mapQueryFor` | none |
| `travel_radius_miles` | `loadBusinessRecord` | none |
| `years_in_business` | `loadBusinessRecord` | none |
| `settings_business_hours` | `loadBusinessRecord` | none |
| `addons` | `loadBusinessRecord` | none |
| `gallery_items` (before/after) | `loadBusinessRecord` | none |

So the "hours" and "service area" blocks in the record prompt are permanently
empty for any business built through conversation, and the map query falls back
to city alone.

### A third failure in the same family

A phone saved AFTER the build never reaches the page. `updateDraft` does not
report a `recordChange`, so the Session 6 rebuild trigger does not fire, and
`rendered_html` keeps whatever it was born with. Verified: `updateDraft` wrote
`phone = "801-555-0611"` and the header kept its booking button.

**Three separate points where the same fact can be lost** — never captured,
captured after the build, or captured and never re-rendered.


---

## STANDING RULE: a change in `_shared` must be deployed to EVERY function that imports it

Moving generation into `hubly-document-build` created a SECOND deployment target
for the renderer. The first time the renderer changed afterwards, only
`hubly-conversation` was redeployed — so the conversation ran the new code while
every page was still being GENERATED by the old code.

Nothing failed. The pages were just wrong, in the specific way that looks like
the change did not work: a header CTA that unit tests proved was `call` rendered
as `book` on the live site, and the obvious conclusion — "the rule is broken" —
was wrong.

```
npm run deploy:generation     # both functions, always
```

The general form: **a shared module changed is every function that imports it
redeployed.** Check `grep -rl "_shared/<file>" supabase/functions/*/index.ts`
before assuming one deploy was enough.

### The verification consequence

This failure is invisible in exactly the direction that matters: the deployed
code is OLDER than the code you are testing against, so a change appears not to
work and the natural conclusion — "the logic is wrong" — sends you to debug
something that is already correct. It cost a round here, and it would have cost
more if the unit test had not disagreed with the live page.

**Anything verified through a generated page since `hubly-document-build` was
created (2026-08-19) should be re-checked once.** In that window
`hubly-conversation` and `hubly-document-build` could hold different copies of
the renderer, and a page proves only what the BUILD function was running. The
header-variant and nav results in this file were re-confirmed after the fix; the
logo-during-build result was not, and is the one most worth repeating.

Where a claim rests on a generated page, say which function generated it.


---

## Facts now reach the record without the model choosing to send them

The report above stands as the diagnosis. The fix, 2026-08-19:

**Two tiers, both before the capability loop**, so anything captured is on the
record before `generateDocument` can even be chosen — a fact written afterwards
reaches a row the page was already built from.

- **Tier A, patterns** (`hubly_extract.ts`). Phone, email, postcode, state,
  priced services. No model, no token cost, and no failure mode where it
  declines to run. Deliberately conservative: a postcode only counts when
  something says it is one, because five digits is also a price and a year, and
  a wrong phone number on a real business's site is a customer calling a
  stranger.
- **Tier B, one pass with a REQUIRED schema.** City, state, street address,
  service-area towns, hours, years in business, travel radius. Every key
  required and nullable, so each field is *considered* rather than optionally
  mentioned — an optional schema would reproduce the original bug one layer
  down. Gated on facts: a draft exists, the message is ≥25 characters, and at
  least one target field is still blank. Once everything is known it stops
  running.

**Fills blanks only.** Extraction is a floor under the model, not an authority
over it. Re-reading an earlier message must never undo a later correction —
"I typed my new number and it went back to the old one" is a worse bug than the
one being fixed.

### The eight unwritable fields

Six got writers (`20260819010000_business_record_writers.sql` extends the
`patch_business_in_progress` whitelist and adds `set_business_hours_in_progress`
for the owner-scoped hours table, which a draft cannot otherwise write):
`state`, `address`, `service_area_cities`, `travel_radius_miles`,
`years_in_business`, `settings_business_hours`.

Two stopped being read: `addons` and `gallery_items`. Editor-era tables with no
conversational writer, and — unlike hours and service area — their empty state
carried no useful negative constraint.

**That distinction is worth keeping.** "OPENING HOURS: none on record. Do not
print hours, 'open 7 days' or same-day availability" is not filler; it is what
stops the model inventing them. The problem with a permanently empty block is
the *permanently*, not the empty. Give the field a writer where the constraint
is load-bearing; drop the read where it is not.

### `patch_business_in_progress` is a whitelist

It names every column it will set. A patch containing anything else is accepted,
returns `ok: true`, and changes nothing. That is how five columns had no writer
without anyone noticing, and it is worth checking the UPDATE statement before
assuming a new field can be saved.


---

## THE REPO IS NOT THE SOURCE OF TRUTH FOR THIS DATABASE

**Check `docs/live-schema.md` before writing any migration that references an
existing object. Then remember it only covers half the question.**

On 2026-08-19 a migration was built by copying a function body out of
`supabase/migrations/` — because the repo was all that could be read — and the
copy was two revisions behind what was live. It silently reverted a validation
block, introduced two type mismatches, and took down every draft write on
production for the better part of an hour. Three migrations to resolve.

### What the repo cannot tell you

- **RECONCILED 2026-08-19.** `migration list` showed 15 local migrations with an
  empty remote column while their effects were demonstrably live. Thirteen were
  marked applied with `migration repair --status applied` (which records without
  executing); the two that were purely `drop ... if exists` were left out and
  re-applied by `db push`, so nothing was asserted that had not been observed.
  `db push --dry-run` now reports `{"upToDate":true,"migrations":[]}` and
  141 migrations are tracked with zero local-only and zero remote-only.

  The idempotency check is what made that split possible, and it is worth
  repeating before any future repair: a migration whose statements are all
  `drop ... if exists` can be re-run safely, so let `push` do it. One containing
  a bare `create policy` cannot — **Postgres has no `IF NOT EXISTS` for
  policies** — so it must be marked applied instead.
- **Policies created in the dashboard are invisible to every check runnable from
  the code.** Six policies dropped during the RLS sweep of 2026-08-18 existed
  ONLY in the live database — `public can read services`, `public can read
  portfolio`, `public can read addons`, `Public can insert booking_requests`,
  `authenticated can upload site media`, `owner can upload assets`. None of
  their definitions are in this repo, so what they granted cannot be diffed
  against what replaced them. The sweep's intent was to remove over-permissive
  policies and public reads now go through SECURITY DEFINER RPCs, so nothing
  observably broke — but that is an observation, not a proof.
- **A `create or replace` reports "Success. No rows returned" even when the body
  can never execute**, because a plpgsql body is not planned until it is called.

### What to do instead

1. **`docs/live-schema.md`** — generated by `scripts/dump-live-schema.mjs` from
   PostgREST's own spec. Real column names and real types for 119 tables, plus
   callable RPC signatures. This is what would have prevented `postal_code` (no
   such column) and both COALESCE mismatches (`service_area_cities` is jsonb,
   `section_order` is `text[]`).

2. **`docs/schema.sql`** — the real `pg_dump`, taken 2026-08-19. 11,825 lines:
   **53 function bodies** and **200 RLS policies** across `public` and
   `storage`. THIS is the half `live-schema.md` cannot cover, and the half that
   caused the incident — the body that was two revisions stale is now readable
   without guessing which migration is latest.

   Regenerate with:

   ```
   PGPASSWORD=… pg_dump "host=aws-1-us-east-1.pooler.supabase.com port=5432 \
     user=postgres.rtwxxkxpkqdrhclkozma dbname=postgres sslmode=require" \
     --schema-only --schema=public --schema=storage --no-owner --no-privileges \
     -f docs/schema.sql
   ```

   Notes for whoever does it next: `supabase db dump` needs Docker. The direct
   host `db.<ref>.supabase.co` no longer resolves — connections go through the
   **`aws-1-`** pooler prefix, not `aws-0-`, and the wrong region answers
   "tenant/user not found" rather than failing to connect. A service-role key
   cannot authenticate to Postgres; this needs the database password.

3. **Never rebuild a `create or replace` from a migration found by name.** Find
   the latest first:

   ```
   grep -rln "create or replace function <name>" supabase/migrations/ | sort | tail -1
   ```

   and treat even that as possibly behind the database.

4. **Verify a function by CALLING it**, against a real row, reading the row
   before and after. Not by reading the SQL, and not by trusting "Success".


---

## API key migration: CHANGED is not VERIFIED

Thirty-six files moved onto `_shared/supabase_admin.ts` on 2026-08-19. Most were
exercised. **Five were changed and never run**, and each carries a banner at the
top of the file saying so. That distinction is the whole lesson of the week and
the migration must not bury it.

| File | Why the probe did not reach key resolution | What would prove it |
|---|---|---|
| `ai-advisorsuper-handlerai-advisor` | 502 from the AI provider — that error can be raised either side of the Supabase client | a 200 answer with a real `business_id` |
| `hubly-recurring-maintain` | 401; the auth compare and the key resolution are on the same line, so a failure proves nothing | POST with `HUBLY_CRON_SECRET`, expect a 200 summary |
| `stripe-webhook` | signature check runs BEFORE any client is built | replay a signed event with `stripe trigger` |
| `_shared/booking_notify_call.ts` | not directly invocable; its caller fires on a real confirmed booking | complete a real booking, confirm the owner notification |
| `_shared/hubly_brain_execution_log.ts` | `persistBrainExecution` swallows its own errors by design — broken and working look identical | run hubly-brain, confirm a NEW row in `hubly_brain_executions` |

### How the rest were proven, and what "proven" meant

Reaching business logic is NOT proof. Most functions bail on payload validation
long before they build a client, so a `400 business_id required` says only that
the function booted. The probe had to get PAST that:

- **`auth.getUser()` reached** → `createUserClient()` worked. A "Your session
  expired" answer to a non-session JWT is the user client functioning correctly.
  13 functions proven this way.
- **A real 200 with data** → admin client worked (`hubly-daily`, `ai-advisor`,
  `hubly-find-pro`, both OAuth callbacks rendering their HTML after a state
  lookup).
- **A DB-derived business answer** → e.g. "This business hasn't finished
  connecting Stripe yet" requires a real query first.
- **`chatbot-message` returning a `conversation_id`** is the strongest single
  proof: `chatbot_conversations` has no public RLS policy, so only the service
  role can have written that row.

### Two traps worth keeping

**A gateway 401 and a broken-credential 401 are indistinguishable from outside.**
`booking-confirmed` first answered `401 Invalid JWT` — that was the platform
rejecting a malformed Bearer before the handler ran, proving nothing. Always
probe with a REAL JWT so the request reaches the function.

**`deno check` reports FEWER errors on a syntactically broken file.** An import
insertion split a multi-line `import {` in ten files; `deno check` scored three
of them as *improved*, and only `supabase functions deploy` — which actually
bundles — caught it. A type check is not a parse check.

### Flagged for deletion, not migrated on merit

`hire-crm`, `mission-control` and `ai-advisorsuper-handlerai-advisor` have zero
references anywhere in `public/`, `api/` or `supabase/functions/`, and that last
name is a mangled artefact of a bad edit. They were swept with the rest so the
migration is uniform, but sweeping debris is how debris survives an audit. They
should be deleted.

Also unused in production, on the evidence of their own tables:
`google_calendar_connections` 0 rows, `google_calendar_events` 0 rows,
`commerce_orders` 0 rows. Eight Google Calendar functions and two commerce
functions have never been used by anyone. Migrated deliberately, because it is
not clear whether that is by design or a regression.

### What the step-0 check actually caught

The end-to-end build was run BEFORE any key was created, so a failure could only
be the refactor. It failed: `running -> stalled`, no document.

Cause: **`SUPABASE_SECRET_KEYS` was already populated with a real `sb_secret_`
key.** Inverting the precedence to new-key-first — correct, and required — made
the system start using it immediately. `adminHeaders()` then correctly omitted
`Authorization`, because a non-JWT key cannot be a Bearer token. But
`hubly-document-build` had `verify_jwt = true`, so the **gateway** answered
"Missing authorization header" before the function's own handler ran. The
dispatch never arrived, and the build stalled in exactly the silent way the job
table was built to expose.

`verify_jwt = false` on that function, with the in-function comparison as the
gate. That is not a weakening: the gateway only ever asked "is this a
well-formed JWT", while the handler asks "is this OUR key", on both the
Authorization and apikey headers. Re-verified: anon key 403, no auth 403.

**This is the single strongest argument for the ordering you insisted on.** Had
the code sweep and the key creation happened together, this would have surfaced
as "the new keys broke the build" and the obvious move — roll back the keys —
would have fixed nothing, because the keys were never the problem.

### Residual stall rate, measured 2026-08-19

`document_build_jobs` now makes this countable for the first time. Over 14
consecutive builds: **12 succeeded, 2 stalled** — and both stalls were the same
business, back to back, including through an explicit Retry that correctly
incremented `attempts` to 2 and refreshed `expected_by`. The job simply never
reached a terminal status and no document appeared.

That is the failure mode `hubly-document-build` was always documented as NOT
solving: if THAT isolate dies mid-build the work is lost. It is now *visible*
(the client says so and offers Retry) rather than silent, which was the goal —
but it is not fixed.

Two consecutive failures on one business while others succeed suggests it is
not purely random. The most likely cause is the generation exceeding the
function's wall-clock limit for briefs that produce longer documents, which
would kill the isolate before `finishDocumentBuildJob` runs. **Not confirmed** —
confirming it needs the Edge Function logs, which need a Supabase access token
nobody has supplied.

The real fix remains a worker outside the request path (pg_cron ->
`net.http_post`, or Supabase Queues) that can retry from the stored brief
without a person clicking anything.

### Diagnosed 2026-08-19: it is the wall-clock limit, and the numbers say so

Duration distribution across 17 successful builds:

```
min 60.0   p50 94.9   p90 138.8   max 143.2   mean 98.7
over 140s: 1     over 150s: 0
```

**Nothing above 150s.** That is not a tail, it is a cliff — the Edge Function
wall-clock limit on the free plan. Two builds in 19 stalled (10.5%), which is
almost exactly the fraction the successful distribution places within ten
seconds of that ceiling. The stalls are the right-hand tail being truncated.

It also explains why one business failed twice in a row: it is not random, that
business's generation genuinely needs more than 150s, so every attempt dies.

Corroborated from three independent signals, all of which match "isolate killed
mid-run" and none of which match "the dispatch never arrived":

| Signal | On a stall | A killed isolate |
|---|---|---|
| terminal job status | never written | never written |
| end-of-run log line | absent | absent |
| edge-log completion row | absent | absent (the row is written on COMPLETION) |
| thrown error anywhere | none | none |

`dispatchDocumentBuild` logs `console.error` on a non-ok response and there are
zero such lines, and one completed request logged `200`, so dispatch works.

**Method note:** `function_edge_logs` records a request when it COMPLETES. A
request that never completes never produces a row — so absence there proves
nothing on its own, and the logs are sampled besides (143 rows in six hours).
The conclusion rests on the duration cliff, not on the log absence.

**Two corrections to earlier reasoning in this file.** The wall-clock theory was
called "weakened" on the strength of a single 91-second sample; the full
distribution says the opposite. And "two consecutive failures suggest it is not
random" was the right conclusion for the wrong reason — it is not random because
that business is over the limit, not because something is broken.

### The sweep (20260819040000)

`sweep_stalled_document_builds()`, every two minutes, pure SQL — no
`net.http_post`, no secret. A `running` job past `expected_by` becomes:

- **`succeeded`** if a document actually exists. The page is the outcome, the
  row is only the record; marking that `failed` would tell someone their site
  did not build while they are looking at it.
- **`failed`** with `error = 'timed_out_or_crashed'` otherwise.

It deliberately does NOT auto-retry. An identical retry of a genuine timeout
fails identically at full model cost, so retry stays explicit — the person
clicks it, having been told honestly — until generation is fast enough that a
retry means something.

**`finished_at` is set to `expected_by`, not `now()`.** The first version used
`now()` and recorded a build that "took" 11,577 seconds, which would have
silently poisoned every future duration query — including the one that produced
the diagnosis above. `expected_by` is the honest upper bound on when the job was
still alive.

### The 400s timeout is not available to us

Organisation `BRNNO team` is on `plan: "free"`, confirmed via the Management
API, and the function config exposes no timeout field — the limit is a plan
property. Raising it to 400s requires Supabase Pro, **$25/month per
organisation** plus usage.

Worth noting the ordering: a longer limit moves the cliff, it does not remove
it. The sweep is the durable half either way.


---

## Evidence from four abandoned signups, kept because it is worth more than the rows

Four drafts named **"Your Business"** were left in the database during the
2026-08-19 cleanup, deliberately. They are the only record of real people who
used this product and left with nothing.

| slug | date | what they gave |
|---|---|---|
| `your-business` | 04 Aug | photography, chose the "editorial" direction, a written hero subhead |
| `your-business-e8cb3` | 05 Aug | photography, "premium-dark" |
| `your-business-fc94b` | 05 Aug | detailing, 3 services — all priced **$0** |
| `your-business-a9ce5` | 16 Aug | photography, **8 services with real prices** — Family Portraits $360, Senior Portraits $275, Head Shots $180 … |

All four: **0 pages, 0 build attempts, and no phone, email or city captured.**

That last person typed out an entire price list — eight services, real numbers —
and ended up with a business called "Your Business", no contact details on
record, and no website. Every one of this week's fixes is visible in that single
row:

- the **placeholder-name** default (`startDraft` inventing "Your Business")
- **facts dropped** because nothing extracted them unless the model volunteered
  a capability call — hence no city, phone or email despite a full conversation
- **no build ever started**, so the skeleton was the last thing they saw

Nobody was ever told any of this. There was no job row, no error, no signal —
the failure that `document_build_jobs` now exists to make visible.

Keep these four. When someone asks whether the extraction work or the build-job
work was worth doing, this is the answer, and it is only legible because the
rows survived.

### Cleanup, 2026-08-19

111 businesses -> 20, 115 documents -> 11, after deleting 91 unclaimed drafts
created 17-19 August, all of them generated by testing during this week.

Filter, all conditions required: `owner_id is null`, `created_at >= 2026-08-17`,
no booking, no uploaded photos, name is not "Your Business". Verified before
running: 0 claimed businesses in the window, 0 rows with a booking slipping
through, and an explicit check that `bucket-mobile-detailing-09616` and all four
"Your Business" drafts were excluded.

`Ridge Paws` also survived, on the uploaded-photo rule — worth noting the rule
earned its keep on a draft nobody had flagged.

**Deliberately NOT used as protection signals: a logo, or having services.**
Testing this week uploaded logos to 17 drafts and set services on most of them,
so both signals were contaminated. A signal that your own testing produces is
not evidence of a person.

Backup at `backups/cleanup-*.json` — businesses, documents, services and build
jobs. **`backups/` is gitignored and `draft_token` is redacted in the file:**
that column is a permanent bearer credential for an unclaimed business, and an
export written for safety is exactly the kind of file that ends up committed.


## Three page formats now run in parallel, and `commerce_documents` is the gate

As of 2026-08-20 a business's public page can be built three different ways, and
each has its own storage, its own editor and its own idea of what "edit this"
means:

| Format | Stored in | `document` holds | Editing handle | Who is on it |
|---|---|---|---|---|
| **classic** | `businesses` columns + `meta->'website'` | — | hardcoded `#ws-*` selectors, `WS_PE_LABELS` | every real customer |
| **Document (AST)** | `business_documents`, `format='ast'` | a Hubly Document tree | `data-node`, patched through `applyPatchOps` | generated sites |
| **freeform** | `business_documents`, `format='html'` | the design brief + image list | `data-hc`, patched by string replace | new |

**Freeform editing applies to WEBSITES ONLY. Storefronts are unchanged and will
need their own answer.** Storefront ASTs live in `commerce_documents`, a
different table with a different RPC surface, so none of the `format` column, the
`data-hc` stamping pass, the freeform save path or the regeneration flow reaches
them. A storefront is still an AST, still re-rendered from its tree, and still
has no freeform option.

**That table is the migration gate.** Nothing is "migrated to freeform" until
`commerce_documents` has an answer, and there is currently no plan for one. Until
then, assume any statement of the form "pages are freeform now" is false for
storefronts, and check which table you are looking at before believing a claim
about how a page is edited.

### Related, and deliberately not built

- **There is no way to remove a section from a freeform page.** The click-to-edit
  handler is leaf-only (`if (target.children.length > 0) return`), which means it
  covers text and images and nothing else. Removing a section needs a different
  affordance — a hover control on the section, not a click on a leaf — and that
  is a change to the interaction, not an extension of it.
- **Nothing in the UI lets a customer go back to a previous version**, even
  though every version is stored and always has been (`business_documents` is
  append-only, `unique(business_id, tag, version)`). After a "new page" the old
  one is still sitting in the table, fully intact, permanently unreachable.
  `planFreeformRegeneration` warns about what will be lost precisely because
  there is no undo behind it.
- **Mixed-content elements are not editable, and that can strand a fact.** An
  `<a href="tel:…"><strong>Phone</strong><br />801-555-2200</a>` has an element
  child, so it is not a leaf, so it is never labelled. `applyFreeformEdit`
  compensates for VALUE roles by sweeping the whole page for the old value — but
  only for those roles. A non-contact fact written this way is uneditable and
  will silently go stale.

## An allow-list of action names is a silent failure waiting to happen

`hubly-conversation`'s `NEEDS_DRAFT_INJECTION` decides which capability actions
get the real `draftId`/`draftToken` injected, by naming them:

```ts
(capabilityName === "website" && (actionName === "generateDocument" || actionName === "patchDocument"))
```

A new action absent from that list reaches its handler with no credentials and
returns `missing_draft` — which is indistinguishable from "this conversation has
no draft business". `website.newPage` was added to the registry, was picked
correctly by the model on the very first attempt, and failed this way; the reply
to the owner was a confident, wrong "there isn't a draft business connected to
this conversation."

Same shape as `patch_business_in_progress`'s column whitelist, which returned
`ok: true` and wrote nothing for six columns for months. **When you add a
capability action that needs a draft, grep for `NEEDS_DRAFT_INJECTION` before you
test it**, or you will debug the handler for something the dispatcher did.

## A hardcoded list that silently drops unknown entries — six instances, one bug

This is not six bugs. It is one shape, six times, and it will happen again unless
the rule below is applied when the list is written rather than after it breaks.

**The shape.** A set of known names, an input that may contain an unknown one,
and an `if (known.has(x))` whose else-branch does nothing. Dropping is the
list's *normal* behaviour, so "not in the list" and "deliberately excluded" are
the same code path and produce the same silence. Nothing is ever observably
wrong; the feature simply does not happen.

| # | The list | What fell through | What it looked like from outside |
|---|---|---|---|
| 1 | `patch_business_in_progress`'s column whitelist | `state`, `address`, `service_area_cities`, `travel_radius_miles`, `years_in_business`, `settings_business_hours` | `ok: true`, nothing written, for months |
| 2 | The publishable-key script-tag guard | six pages | shipped blank; the guard matched its own comment |
| 3 | `NEEDS_DRAFT_INJECTION` | `website.newPage` | "there isn't a draft business connected to this conversation" — confident and wrong |
| 4 | `GATED_WEBSITE_ACTIONS` (3 call sites) | `website.newPage` | advertised and dispatchable with the feature flag off |
| 5 | `DRAFT_INJECTED_ACTIONS` | `website.setChrome` | found by the audit below, on the day it was written. **Still open** |
| 6 | `platform-home.html`'s canvas-refresh branches | `newPage` | a page built successfully and the builder showed a blank canvas |

**THE RULE: a list that silently drops unknown entries must log the drop.**

Not throw. Most of these lists are right most of the time, and failing hard on
an unknown name turns a small omission into an outage. Log it: name the list,
name what fell through, say what the consequence is, say where to fix it. The
entire cost of all six was that this line did not exist.

**Where the rule now lives:**

- `_shared/hubly_allowlist.ts` — `reportAllowlistDrops()`, the TypeScript form.
  Deduplicates per isolate so a hot path cannot flood the log.
- `hubly-conversation/index.ts` — `auditConversationAllowlists()` runs at module
  load and audits #3/#5 and #4 together. It detects "needs a draft" from the
  handler's own **source**, not its `argsSchema`: `setChrome` does not declare
  `draftId` as an argument but reads `args?.draftId` and refuses without it, so
  a schema-only check reports it as fine.
- `patch_business_in_progress` — returns `dropped_keys` in its result JSON *and*
  raises a warning. Returning it is what makes it verifiable by CALLING the
  function, which is the only verification a plpgsql body earns here.
- `tests/publishable-key-tag.test.mjs` — the durable form of #2. A build-time
  check has no log to write to, so the test's failure message *is* the line, and
  it names the offending page. It also asserts that the naive filename check
  would still be fooled, so the distinction cannot be refactored away.

#6 is **not** covered: it lives in `platform-home.html`, a browser file with no
log anyone reads and no test harness around the canvas branches. Recorded as
open rather than papered over.

## OPEN SECURITY ITEM: anyone can host arbitrary HTML on a *.myhubly.app subdomain

**Must be closed before the first real customer.**

Typing one sentence into the landing page creates a draft business and returns a
`draft_token`. That token is the only credential `create_business_document`
checks, and the function is granted to `anon`. So:

1. Type a sentence → get `draft_token` + a `{slug}.myhubly.app` subdomain.
2. `POST /rest/v1/rpc/create_business_document` with `p_format: 'html'` and any
   `p_rendered_html` at all.
3. `get_public_business_document` serves it to anyone, on a Hubly subdomain,
   over Hubly's TLS certificate.

**This predates freeform** — the same call has always accepted arbitrary
`rendered_html` — but freeform makes it *practical*, because the format's whole
premise is that stored HTML is served as the page rather than rendered from a
validated tree. A phishing page on `secure-login.myhubly.app` is now a two-step
API call, not a bug hunt.

Mitigating today, and none of it is a control: there are no real customers, the
domain has no reputation to trade on, and `hcNoIndex()` keeps unclaimed drafts
out of search results. All three stop being true the moment the product has
users.

Not fixed this session, deliberately. Options when it is: require a claimed
owner before a document can be stored, sanitise stored HTML on write, serve
unclaimed drafts from a separate throwaway domain, or rate-limit draft creation
per IP. The first is the only one that actually closes it.

## Freeform record-sync overwrote wording it should have left alone — FIXED

**Found in production 2026-08-20, reproduced on a fresh page, fixed and
re-verified the same day.**

`syncFreeformFacts` applied a value-role edit to every element carrying the
label, and when the element's text did not contain the old value it fell back to
replacing the whole body. On a real page, saving an EMAIL ADDRESS did this:

```
business.name  "CK"              -> "Copperwick Kilns"
contact.phone  "Start a Call"    -> "801-555-7420"
contact.phone  "Call Copperwick" -> "801-555-7420"
contact.phone  "Call Copperwick" -> "801-555-7420"
```

Three buttons reduced to printing a number the page already stated, a monogram
overwritten with the full name, and none of it requested — on the AUTOMATIC
path, the one operation that is supposed to be incapable of threatening what the
owner wrote.

**THE RULE, now enforced: a sync that cannot find what it is replacing changes
nothing.** A value role is only substituted where the old value is genuinely
present in the element; everything else is left alone and reported in
`FreeformEditResult.skipped`.

Two supporting distinctions had to exist for that rule to be safe:

- **`prevText`** — click-to-edit now sends the clicked element's previous text.
  "The owner typed these words on THIS element" and "this value changed
  everywhere" used to arrive identically, so the conservative rule alone would
  have silently dropped legitimate wording edits.
- **`canonicalNew === null` means "not a value change".** Retitling a button
  from "Start the conversation" to "Ring the bindery" yields no phone number, so
  there is nothing to substitute anywhere and only the clicked element changes.
  Without this, editing one button's WORDS pushed those words into the element
  that was correctly displaying the number — a bug introduced by the first
  version of this very fix, and caught by a test rather than by reading.

Verified before and after on real pages through the real path, not by unit test
alone: the same seeded HTML, the same trigger (saving an email), pre-fix
destroys the monogram and all three CTAs, post-fix leaves all four alone while
still updating the bare number and every `tel:` href to the record's value.

**One page was corrupted before the fix:** `ashgrove-forge` (`business.name`
"A" -> "Ashgrove Forge", `contact.phone` "Call the Forge" -> "801-555-3100").
`copperwick-kilns` was corrupted deliberately to reproduce it and has been
repaired by appending the pre-damage HTML as a new version. No other freeform
page was affected; `hearth-iron` was checked and is intact.

## The label vocabulary cannot say "displays this value" vs "links to it" vs "decorative"

Both corruptions above were possible because one label carries three different
relationships to the same fact:

| element | label today | what it really is |
|---|---|---|
| `<strong>801-555-7420</strong>` | `contact.phone` | **displays** the value |
| `<a href="tel:…">Call Copperwick</a>` | `contact.phone` | **links to** it, displays words |
| `<span class="mark">CK</span>` | `business.name` | **decorative** — initials, not the name |

The fix above compensates at edit time by checking whether the value is present
in the text. That is the right safety net, but it is inference at the point of
use rather than knowledge captured once at labelling time.

**Proposal — small, deterministic, NOT built this session.** Two new role
tokens, both decidable by the existing stamping pass with no model involvement:

- `…​.cta` — an element carrying a value role whose `href` points at the value
  (`tel:`/`mailto:`) but whose own text does NOT contain it.
  So `contact.phone.cta` for "Call Copperwick".
- `…​.mark` — an element carrying a value role whose text is 1–4 characters and
  matches the initials of the value it names. So `business.name.mark` for "CK".

Both are strict subsets of an existing role, so nothing that reads
`contact.phone` today breaks; the editor keeps offering all three; and the
automatic sync gets to skip `.cta` and `.mark` by NAME rather than by inferring
from the text each time. It also makes the `href`-sync rule exact: a
`contact.phone.cta` should have its `href` updated and its text never touched.

Cost is two tokens in `HC_ROLE_TOKENS` and roughly fifteen lines in
`valueRoleFor`. Deliberately not done in the same session as the fix, so the
safety net lands and is verified on its own.

## Freeform pages are only reachable when the AST build FAILS

`website.newPage` refuses when the latest document is an AST:

> "That page is a Hubly Document, not a freeform page. Converting between the
> two formats is not something this action does."

That guard is deliberate — swapping a validated tree for opaque HTML is a format
migration, not a conversational edit. But the FIRST thing any new draft does is
dispatch an AST build, so a freeform page can only be created in the window
where that build has failed or has not yet landed.

Every freeform page in existence got there that way: two were created after the
AST build hit the 150s wall-clock cliff and failed, one was created before the
build landed and was later overwritten by it (below), one was seeded directly
for testing.

So freeform is not a path a customer can choose. It is a path they fall into
when generation fails. Worth deciding about deliberately rather than leaving as
an emergent property of a timeout.

## A resumed AST build silently overwrote a freeform page

`saltmarsh-bindery`: v1 and v2 were `format='html'`; a later turn resumed the
stalled AST build from the first turn, which completed and wrote v3 as
`format='ast'`. The business's page changed format, renderer and content because
a build from several minutes earlier finally finished.

Nothing is wrong with resuming a stalled build. What is wrong is that it takes
no account of what has happened since — including a page the owner explicitly
asked to replace it with. `resumeDocumentBuild` should refuse when the latest
document is newer than the job it is resuming, or when the format changed
underneath it.

## Freeform is now the default, and this is everything it is missing

As of 2026-08-20 a new draft generates a freeform page. The AST generator is
untouched and still serves every page already built on it, but nothing new is
built as an AST. This is the gap list, measured against a real AST page
(`thornfield-cyclery`) and the three freeform pages built to verify the switch.

**Nothing here is fixed. This is the roadmap.**

| Missing | AST page has | Why it matters |
|---|---|---|
| **Reserved Hubly elements** | 4 | The booking widget, the enquiry form and the reviews block are `data-hubly-element` nodes. A freeform page has none, so **a visitor cannot book or send an enquiry.** This is the largest gap by a distance. |
| **Booking flow** | 13 markers | `wireHublyDocumentReserved()` binds availability, slot selection and `createWebsiteBookingJob`. Freeform pages have nothing to bind. |
| **Contact / enquiry form** | 2 `<form>` | A freeform page's only conversion path is a `tel:` link. No form, no email capture, no lead row. |
| **Service-area map** | 2 | `businessMapQuery` renders a real map. Freeform pages describe the area in words. |
| **Photographs** | 0 in this sample, but supported | `banner_url`, hero image and gallery nodes all exist on the AST path. Freeform generation is told to design a page that needs no photos, so it does — every one of the three pages has **zero `<img>`**. The Image Engine was the original reason for this whole line of work and it is still absent. |
| **Logo in the header** | chrome-driven | `selectChromeVariant` places a real logo by measured aspect ratio. A freeform page writes its own header and draws a monogram from initials; a logo upload does not appear on it. `setChrome` says so honestly rather than pretending. |
| **Chrome variants / `setChrome`** | 3 marker classes | Header layout is not a setting on a freeform page — the model wrote the header as part of the page. |
| **Owner placeholders** | 2 | `data-hd-placeholder` scaffolding shows the owner what to fill in and is stripped for the public. Freeform has no equivalent, which is partly why the pages *say* what is missing in prose instead. |
| **Node-level structural editing** | 132 anchors | `move_node`, `remove_node`, `add_node`, `replace_node` all work on an AST. Freeform editing is text and images only — there is still no way to remove a section. |
| **Utility class vocabulary** | 41 uses | The colour/font pickers in click-to-edit write `text-brand-600` / `font-serif`. On a freeform page those controls are hidden because the page wrote its own CSS. **Styling is not editable at all on freeform.** |
| **Design rationale** | persisted | `design_rationale` records why the model made its structural choices. The freeform path stores the brief instead and captures no rationale. |
| **Vocabulary rejection tracking** | recorded | `document_vocabulary_rejections` measured where the model hit the format's ceiling. Freeform has no ceiling to hit, so the signal is gone — and with it the evidence for what to add next. |

### Structural, and worse than the list above

**Anything the shell injects cannot reach inside a freeform page.** A freeform
page renders in a same-origin `srcdoc` iframe (it is a whole document whose CSS
targets `body`). Everything `hubly.html` wires binds to `#hc-doc-root` in the
PARENT document and does not cross the frame boundary — confirmed live:
`reservedInParent: 0, reservedInsideIframe: 0`. So even once a freeform page
starts emitting `data-hubly-element` nodes, `wireHublyDocumentReserved()` will
not see them. Booking will need the wiring to move inside the frame, or a
postMessage bridge, or freeform pages to stop being iframed.

What DOES still work, verified rather than assumed: the parent's `noindex,
nofollow` for unclaimed drafts, `document.title`, and the language toggle (all
live in the parent chrome, outside the frame).

### Two facts that did not survive the switch

- **The bakery's prices never reached the record.** "Country loaf 9 dollars,
  olive fougasse 11, cinnamon morning bun 5" produced `recordFacts` + `startDraft`
  + `generateDocument` and **no `setServices`** — 0 rows in `services`. The page
  then correctly said no menu was available. The page is honest; the extraction
  is wrong. The photographer's three priced services extracted fine, so this is
  intermittent, not absent.
- **`years_in_business` reached the roofer and nothing else**, which is correct
  (only the roofer's sentence stated one) — noted only because it is the one
  numeric claim on that page and it is real.

## booking-notify has never worked on the pay-in-person path, and cannot

**Settled 2026-08-20 by completing a real booking end to end.** Previously
recorded as "reasoned, not demonstrated" — it is now demonstrated, and the
answer is that it fails every time.

`booking-notify` authenticates by comparing the caller's credential against the
**secret** key:

```ts
const expected = requireSecretKey().key;
if (bearer !== expected && apikey !== expected) return 403 forbidden;
```

The only caller on the pay-in-person path is the **browser**
(`public/hubly.html:42396`, `dbClient.functions.invoke('booking-notify', …)`),
which can only ever send the publishable key. Called with the real record from a
real completed booking, it returns:

```
{"ok":false,"error":"forbidden"}   HTTP 403
```

And the call site is fire-and-forget —
`.catch(e => console.warn('booking-notify failed', …))` — so **a completed
booking has never notified the business owner, and nothing has ever said so.**
The comment above that call explains it exists because a database trigger
previously covered this "badly"; the replacement has covered it not at all.

Not fixed here — it needs a decision, not a patch. Either the browser stops
being the notifier (a DB trigger or a server-side call after insert, which is
what `_shared/booking_notify_call.ts` already does for the Stripe path), or
`booking-notify` gets an auth model a public client can satisfy. The first is
correct; the second re-opens the hole the secret-key check was added to close.

## The chatbot cannot see the business's services

On all three verified freeform pages — and the classic page checked alongside
them — the assistant answers pricing and availability questions with "I don't
have configured pricing / packages / product list", **while the page beside it
lists those exact services with prices** and the `services` table has the rows.

```
Calder & Vane Roofing   3 services   page shows $150/$220/$480
  chat: "I don't have configured pricing for roof inspections"
Neve Ashford            3 services   page shows $340/$1400/$2600
  chat: "I don't have any configured wedding packages, pricing"
Thistledown Bakehouse   3 services   page shows the loaf list
  chat: "I don't have Thistledown Bakehouse's current product list"
```

The behaviour is *safe* — it declines rather than inventing, which is right —
but it makes the assistant close to useless for the single most common visitor
question. `loadConciergeContext` in `chatbot-message` is where to look; this is
not caused by the freeform switch, since classic shows it too.

## The injected chat widget is a second chat implementation

`hubly_page_runtime.ts` contains a small chat UI that posts to
`chatbot-message` directly. `hubly.html` contains another one
(`.ws-chat-panel`, `ccStartGeneric`, the hero inline input, the nudge/teaser
logic). They now both exist, and only the hubly.html one has the lead-capture
behaviour, the courtesy message cap (`CHATBOT_MAX_MESSAGES_CLIENT`), the
handoff-to-booking hook (`S._chatbotHandoffConversationId`) and the
`mark_resulted_in_booking` call.

The duplication was the deliberate cost of getting chat inside the iframe at
all, but it is a fork and it will drift. The injected widget should either grow
those behaviours or the two should converge on one implementation that both
surfaces load.

## Owner booking notifications: fixed, and how it is wired now

**Before:** no booking made through a Hubly site had ever reached its owner.
`booking-notify` authenticates against the SECRET key; the only caller on the
pay-in-person path was the browser, which can only send the publishable key;
403 every time, into a `console.warn`.

**Now:** a trigger on `booking_requests` fires when `status` BECOMES `'pending'`
and calls `booking-notify` via `net.http_post`, presenting `hubly_cron_secret`
from Vault. See `20260821010000_notify_owner_on_booking_completion.sql`.

**Why a trigger again, when one was deleted for exactly this.** The old
`booking_request_notify` had two faults and only one was about triggers:

- *The event.* It fired `AFTER INSERT` with no status filter, and the row is
  inserted at step 3 as an `'abandoned'` LEAD. Owners were emailed before any
  payment, and for every visitor who reached step 3 and left. The new trigger
  fires on the transition INTO `'pending'`, which happens once, at completion.
- *The invisible caller.* Still partly true and not waved away: a `pg_trigger`
  row is not greppable from application code. Mitigated by the migration being
  committed and heavily commented, by `public/hubly.html`'s former call site now
  carrying a pointer to it, and by this entry. **If you are looking for who
  sends the owner email, it is that migration.**

**Why not put the call inside `complete_abandoned_booking`.** That RPC is only
the primary path; when it fails the browser falls back to a direct INSERT with
`status='pending'`. Notifying on one path and not the other is how this broke the
first time. The trigger covers both.

**Why the cron secret and not the service key.** `booking-notify` now also
accepts `x-hubly-cron-secret`, the same credential `hubly-recurring-maintain` is
already called with. It is server-only and never ships to a browser, so the
property the secret-key check protects — an unauthenticated or publicly-keyed
caller cannot make this function email a business owner — is unchanged. Copying
the service key into the database was the alternative and is worse.

### What is proven, and what is not

Proven by doing it: a real booking through a generated site fired the trigger and
`booking-notify` answered **HTTP 200 with ok:true** — recorded in
`net._http_response`, where the same call previously returned 403.

**NOT proven: that the email was delivered.** `sendEmail` swallows Resend
failures (it only console.errors) and the handler returns ok:true regardless, so
a 200 means "the notify path ran", not "the mail went out". The Supabase
log-query API was returning backend errors during this session, so the Resend
response could not be read either.

**That is a real gap in its own right:** the one thing the owner cares about is
the only step with no success signal. `booking-notify` should return a
per-recipient send result, or record one, so "did the owner get told" is
answerable without reading a mailbox.

## The chatbot could not see the services, on every Hubly site

`loadConciergeContext` then `toAiSummary` then `listServices` then `getCatalog`
reads `meta.service_catalog`. **Not one real business has that key** — checked
across freeform and classic sites — while all of them have rows in the
`services` table. So the assistant answered "I don't have configured pricing"
while the page it sat on listed those exact services with prices.

Fixed by falling back to the `services` table when the catalog is empty. The
never-invent rule is untouched: this hands the model rows that already existed,
it does not give it licence to guess. A business with no services still yields an
empty list and the assistant still declines.

`price = 0` is this codebase's "no price set" sentinel, not free, so it maps to
`quote_required: true` rather than a zero — reporting a zero would be inventing a
price downward, which is the same sin as inventing one upward. Verified live: a
classic customer whose services have no price now answers that bathroom tiling
is quote required and there is no set price listed.

**This was never a freeform problem.** It affected every Hubly site.

## A failure that cannot fail loudly must still be RECORDED where someone can query it

This is one disease with many hosts, and it is the single most expensive pattern
in this codebase. It has now been found in enough places to name:

| Where | Shape | Cost |
|---|---|---|
| Browser → `booking-notify` | `.catch(e => console.warn(...))` | 403 on **every booking ever made**; no owner was told, for months |
| `sendEmail` in booking-notify | `if (!res.ok) console.error(...)` then `ok: true` | a bounced owner email was indistinguishable from a delivered one |
| `patch_business_in_progress` | unknown keys silently ignored, `ok: true` | six columns unwritten for months |
| `/api/notify-signup` | returns **HTTP 200** `{ok:false, reason:'not_configured'}` | Hubly's own signup alert has never sent (below) |
| the ten-plus "reported success while doing nothing" entries above | same | same |

**The rule.** Fire-and-forget is often correct — an email problem must not roll
back a completed booking, and a missing env var must not stop a business
launching. What is never correct is the *absence of a record*. So:

> If a failure is deliberately made non-fatal, it must be written somewhere
> queryable. A `console.warn` is not a record. A log line in a system whose log
> API returns backend errors is not a record. A row is a record.

`notification_deliveries` is the first application of it: one row per recipient
per attempt, `sent` / `failed` / `skipped`, with the provider's own receipt or
its own error text. Proven by booking twice — once to a good address, once to a
malformed one — and getting `sent` with a Resend id and `failed` with
`resend 422: Invalid \`to\` field` respectively, while the handler returned
`ok: true` both times. **That is the point: the handler's 200 was never the
answer to "did the owner get told".**

### The size of the remaining problem

Swept on 2026-08-21 across `supabase/functions`, `public`, `api`, `scripts`:

```
1267  empty catch  ( } catch(e){} )
  85  catch -> a console line, then continue
   3  .catch(e => console.warn(...))  fire-and-forget
```

The raw 1267 **overstates it**: most are `try{ el.style.x=1 }catch(e){}` around
DOM pokes where nothing depends on the result. Narrowing to catches whose `try`
body performs a network call or a write — where the swallowed thing is a side
effect someone relies on — gives the real number:

```
41 swallowed side-effecting calls
   30  public/hubly.html
    3  public/platform-home.html
    5  supabase/functions/** (google-calendar x3, adobe_oauth, calendar_sync)
    3  other public/ modules
```

None of the 41 are silent on the server side; all log something. **Not fixed
this session** — the list is the deliverable, not the repair.

## ACTIVELY BROKEN: Hubly's own new-signup notification has never sent

Found by the sweep above, verified by calling it, **not fixed** (stop rule).

```
POST https://myhubly.app/api/notify-signup   ->   HTTP 200
{"ok":false,"reason":"not_configured"}
```

`api/notify-signup.js` returns 200 with `ok:false` when `RESEND_API_KEY` or
`OWNER_EMAIL` is unset, and one of them is unset in production. The caller is
fire-and-forget with `.catch(e => console.warn(...))` — and because the response
is a **200**, that catch never even runs. So every business that has ever
completed onboarding did so without anyone at Hubly being told.

It is the same disease as `booking-notify`, one layer up: a non-fatal failure
with no record. Fix is to set the env vars and give it a delivery row like
bookings now have.

## meta.service_catalog is NOT dead — I was wrong

An earlier entry said "not one real business has that key". **That was a
generalisation from a four-business sample and it is false.** Across all 42
businesses:

```
has service_catalog key ........ 9
catalog containing services .... 6   (all 6 are CLAIMED businesses)
has rows in `services` ......... 24
```

Both sources are live. They are split by WHICH PATH created the services:

- **`meta.service_catalog`** — written by the owner editor
  (`buildServiceCatalogFromEditor` → `buildBizMeta`), by `service_engine.ts`
  (`writeCatalog`), and by `marketplace/index.ts`. Every business that has it is
  claimed, i.e. an owner sat in the editor and saved.
- **`services` table** — written by the AI path (`business.setServices`) on
  drafts.

Two businesses have BOTH and they disagree on count (`everlasting` 6 vs 9,
`adrians-lawn-service` 5 vs 9).

So the instruction "if nothing writes it, delete it" does not apply — deleting it
would destroy the service data of six claimed businesses. **Converging the two
is a data migration, not a fix**, and is deliberately not started here. The
context-loader fallback added yesterday (catalog first, `services` table when the
catalog is empty) is the right *reader-side* behaviour in the meantime, but it
does not resolve the split.

## Only notifications.myhubly.app is verified in Resend — five senders used the bare domain

The bare `myhubly.app` is not registered in Resend at all. Anything sending from
it is rejected at the provider. Five senders did:

```
signups@myhubly.app    api/notify-signup.js      proven failing
waitlist@myhubly.app   api/notify-readiness.js   never tested
chat@myhubly.app       api/support-chat.js       never tested
bookings@myhubly.app   api/notify.js  (x2)       one built by string concatenation,
                                                 so a search for a quoted
                                                 from-address did not find it
```

All now send from `notifications.myhubly.app`. Verified by POSTing to the live
endpoints: `notify-signup` returns a real Resend id, `notify-readiness` and
`support-chat` return `ok:true` (both forward provider errors, so a 200 there
means accepted).

### Reply-to, because a send-only address bounces replies

Nothing receives mail at any of these from-addresses. Every one now sets a
reply-to at a real person:

| endpoint | reply-to |
|---|---|
| `notify-signup` | `PLATFORM_OWNER_EMAIL` — platform notification |
| `notify-readiness` | the waitlist signer (already present) |
| `support-chat` | the person who wrote in (already present) |
| `notify.js` owner mail | the customer |
| `notify.js` customer mail | the business |

**Not verified: that the header survives to the inbox.** The production Resend
key is send-only — `GET /emails/{id}` answers `"API key is invalid"` while POST
works — so the message cannot be read back. Confirming the header needs the
recipient's mailbox.

## ACTIVELY BROKEN: api/notify.js cannot load at all

```
POST https://myhubly.app/api/notify  ->  HTTP 500  FUNCTION_INVOCATION_FAILED
```

`node --check api/notify.js` fails at line 62: `'You're booked!'` — an unescaped
apostrophe inside a single-quoted string. It is a **syntax error**, so the module
has never parsed and the endpoint has never run, despite being routed in
`vercel.json`. Present before this session's changes (checked against `HEAD~1`).

**Deliberately not fixed.** It is a one-character repair, and that is exactly
why it needs a decision rather than a reflex: `api/notify.js` is a THIRD
implementation of the owner booking email, alongside `booking-notify` (working,
with a delivery ledger) and the deleted `booking_request_notify` trigger. Making
it parse would switch on a duplicate notifier that has never been exercised.
Delete it or wire it deliberately; do not just fix the quote.

Its sender addresses were corrected with the others, which changes nothing while
the file cannot load.

## notification_deliveries cannot reach the Vercel endpoints — credentials, not shape

The table's shape fits fine: `subject_type` is deliberately loose and a signup or
waitlist notification maps onto it cleanly.

The blocker is credentials. `vercel env ls production` shows the complete set:

```
HUBLY_DRAFT_SECRET  ADOBE_CLIENT_ID  ADOBE_CLIENT_SECRET
PLATFORM_OWNER_EMAIL  RESEND_API_KEY
```

**No Supabase credentials at all.** `notification_deliveries` has RLS on and is
revoked from `anon` and `authenticated`, so `api/notify-signup.js` and
`api/notify-readiness.js` have no way to write a row. Two ways out, neither taken
here:

1. Put the Supabase secret key in Vercel — copies the most privileged credential
   we have onto a second platform. Rejected on the same grounds as putting it in
   the database.
2. Move these notifications to an Edge Function, where the credential already
   exists and `booking-notify`'s ledger code can be reused. **Recommended**, and
   it also collapses two mail implementations into one.

Until then "did the signup notification send?" is answerable from the endpoint's
HTTP response (which now forwards Resend's status, id and error) but not from a
query. That is better than it was and worse than bookings.

## Businesses that completed onboarding while signup notification was dark

`api/notify-signup.js` was added **2026-07-13**. It has never successfully sent —
first because a required env var was unset, then because of the sender domain
above. Every business claimed since then launched without anyone at Hubly being
told.

```
2026-07-29  my-auto-detailing-shop    asmayorga@outlook.com
2026-07-25  my-auto-detailing         jjake486@gmail.com
2026-07-25  cotter-aviation           cotterjp@gmail.com
2026-07-24  my-photography            test@mail.com
2026-07-20  bucket-mobile-detailing   bucketmobiledetailing@outlook.com
2026-07-20  my-business               tom@mgai.com
2026-07-18  star-windows              test@gmail.com
2026-07-17  everlasting               jacquelynsmithee@gmail.com
2026-07-17  adrians-lawn-service      adriansmithee@gmail.com
2026-07-13  devdetailing661           fdevin180@gmail.com
--- feature did not exist before this line ---
2026-07-11  graefs-autocare           austinjgraef@gmail.com
2026-07-11  aquaspeed                 aquaspeed723@gmail.com
```

**Caveat on the dates:** `businesses` has no claim/publish/launch timestamp —
`created_at` is the row's creation, which approximates when onboarding STARTED,
not when it completed. The ordering is right; the exact moment is not.

## FIXED: the *.myhubly.app phishing-host hole

The open security item is closed. Three layers, all verified by running the
attack, not by reading:

1. **create_business_document revoked from anon/authenticated.** A direct RPC
   call with a valid draft token and arbitrary `p_rendered_html` — which
   returned `{ok:true}` and stored a fake bank-login page immediately before the
   fix — now returns `42501 permission denied`. Every legitimate caller is
   service_role and unaffected; generation, inline edit and the public-URL
   update were all re-run end to end after the revoke.

2. **The stamping pass strips the harvesting mechanics** (forms unwrapped,
   fields/submit-buttons/foreign-scripts/cross-origin-iframes removed, same-origin
   kept), deterministically, recording each removal in `StampResult.removed`. A
   fake bank login fed through it comes out with the copy intact and every
   mechanism gone. Strips rather than refuses, because refusing means
   regenerating (a full model call).

3. **Draft creation rate-limited** to 10/IP/hour inside
   `start_business_in_progress`, keyed on `cf-connecting-ip` (the edge sets it; a
   spoofed x-forwarded-for cannot override it). The 11th call from one connection
   returns `rate_limited`.

Still open, deliberately out of scope: verified-account gating of the public
subdomain, and Public Suffix List submission for myhubly.app.

## account_kind: "how many customers" is now one query

`businesses.account_kind` is `real` | `internal` | `test`, defaulting to `real`
so an untagged account over-counts rather than hides. Tagged on 2026-08-21:

```
select count(*) from businesses where account_kind='real';   -- the customer count
```

Current: **8 real, 2 internal, 33 test.** The 8 "real" are the claimed accounts
with outside emails that could not be attributed to a founder or a test — they
are left as real on purpose; only their owner knows which are genuine customers.
The 2 internal are adriansmithee@ and jacquelynsmithee@. Everything unclaimed
(session generations, `your-business*`/`trigger-test`/`joyride` scaffolds) plus
the `test@` emails are test.

## Two accounts flagged for deletion have TEST data attached — not deleted

`my-auto-detailing-shop` (asmayorga@outlook.com) and `my-business`
(tom@mgai.com) were flagged for removal. Both have child rows that a first pass
(documents/bookings/services) missed:

```
my-business:  2 marketplace_bookings, 2 jobs, 2 marketplace_customers,
              2 marketplace_conversations, 1 marketplace_provider, 11 brain_executions
my-auto...:   1 customers row, marketplace provider/conversation scaffolding
```

On inspection the attached data is **synthetic** — the customers are
`Test Validation <test-validation@example.com>`, `Smoke Test`, and a
`PWTest_...` Playwright row; the jobs are those same test names. So the accounts
are almost certainly safe to remove. But per the stop rule ("if anything
unexpected is attached, stop") the deletion was NOT performed — it is the
owner's call now that the cascade is visible. Both are currently tagged `real`
and probably should be `test` regardless of the delete decision.

## Photographs on freeform pages: the image resolver

Every freeform page used to have zero `<img>`. The cause was one prompt line —
"design a page that does not need photos" — plus never telling the model the
logo or the customer's photos existed. Both reach generation via
`loadBusinessRecord`; they were simply not used.

Now: the model marks WHERE images go and WHAT FOR (`<img src="#hubly-image"
data-role="hero" data-subject="...">`, and `#hubly-logo`), exactly like the
booking sentinel — zero extra model calls, purpose emitted inline. A
deterministic pass (`hubly_image_resolver.ts`, run before stamping) fills each
marker:

1. **The customer's own photos first**, always. Work-role markers (gallery,
   portfolio, work, results, before-after) get first claim on the photo pool, so
   a business's real photos land in its "our work" section rather than being
   spent on the hero.
2. **Pexels** for atmosphere gaps only.
3. **A brand-coloured field** — a diagonal wash of the business's own brand
   colour with the art-direction phrase as a faint watermark. Never a grey box,
   never a broken frame. This is the "deliberate nothing".

Two rules, enforced in code not prompt:
- **Stock is never the business's own work.** A work-role marker is filled from
  customer photos or a colour field — never stock. Verified: the roofer's work
  section contains only its own photo, zero stock.
- **No people in stock.** Every Pexels query carries "no people", and a
  candidate whose own description names a person is rejected. Honest limit: a
  photo with a person and a sparse description can still slip; documented.

Provenance for every placed image is in `placed_images` (provider, asset id,
photographer, source url, licence, business id, slot) so a takedown is a query.

VERIFIED on three real served pages:
- **redhill-roofing** (seeded with an uploaded logo + one photo): the logo is in
  the header — no monogram — and the photo is in the work section. 3 real
  `<img>`, 0 stock, provenance recorded (customer:logo, customer:gallery).
- **wynne-castellan / fernwick-bakehouse** (no uploads): every image marker
  became a colour field, 0 unresolved markers, nothing miscounted in the ledger.
  The three pages look genuinely different (dark utility / cream editorial /
  warm monogram).

### NOT verified: the live stock fetch

`PEXELS_API_KEY` is not set (a Pexels key needs an account created at
pexels.com/api, which I cannot do). So the Pexels path is code-complete and
unit-tested with an injected fetcher, but **no real stock image has been fetched
and placed on a live page**. Every atmosphere gap currently resolves to a colour
field instead. To turn stock on: create a free Pexels API key and set
`PEXELS_API_KEY` in the Supabase function secrets — no code change needed, the
resolver already reads it and `pexelsFetcher` is wired.

The measure the brief set — "how many pages need no stock" — is met for any
business with its own photos: the roofer needed none. The hero of a photo-less
business is where stock would help most, and that is exactly what the key
unlocks.

## STANDING RULE: no validation or cleanup pass may cause a second generation

The Content Value Rule on the AST path cost a full extra model call on every
build — 60–86 seconds and roughly half the token spend — to delete one section
the model shouldn't have written. Rejecting the model's output and asking again
is the most expensive possible way to fix anything, and it is never necessary.

**Anything that needs correcting after the model writes gets corrected
deterministically in a pass, or told to the model up front. Never by rejecting
and regenerating.**

Every correction in the freeform pipeline already obeys this and must continue
to:

- **labelling** (`data-hc`) — a deterministic stamping pass, never a re-ask
- **content safety** (strip forms/scripts) — a pass
- **image resolution** — a pass (customer photo → stock → colour field)
- **the CTA cap** (≤3 booking links) — a pass that removes surplus sentinels,
  plus an up-front model instruction; NOT a regeneration when the model emits 7
- **the empty-state colour field** — a pass

If you find yourself about to re-run generation to fix a defect in the output,
stop: the fix belongs in a pass or in the prompt. A regeneration is only ever
the OWNER explicitly asking for a different page.

## Freeform images: live-verified, plus two bugs the live page found

Stock images now land on real pages. `PEXELS_API_KEY` was set; confirmed present
at runtime and valid (a throwaway probe returned 200 with a real roof photo).

Two businesses with no uploads (thornbury-landscapes, kestrel-plumbing),
verified on the served pages:
- Real Pexels photographs visible (3 and 2), zero colour fields, full
  provenance in `placed_images` (photographer + Pexels licence each).
- Both rules held on a live fetch: zero stock in a work-role slot, no
  person-words in any placed alt.
- ≤3 booking CTAs each, no art-direction text visible, no floating language
  toggle.
- Build time 64.7s / 64.8s — within the prior freeform range, unchanged by image
  resolution.

Two defects the live page surfaced (a function returning a URL would not have):

1. **`loading="lazy"` does not work inside a srcdoc iframe.** With it, all three
   images — the in-view hero included — stayed unloaded and the hero showed a
   white box; forcing `eager` loaded all three. A freeform page renders in a
   srcdoc iframe with no reliable lazy-load intersection root, so `realImg` no
   longer emits `loading="lazy"` (and drops any the model wrote). 2–3 images per
   page means eager costs nothing.
2. **The language toggle re-showed after being hidden.** The document-render
   branch hid it once, but `showP()` re-set it to `flex` on every call because
   `p-hubly-document` was not in its hide-list. Hidden authoritatively in
   `showP` now.

## Placeholders: mark what Hubly guessed, strip what it must never invent

A generated page contains content the model invented because it had nothing to
work from — a photographer's "01 Book · 02 Set the tone · 03 Receive direction"
process she never described. Useful proposals, but published as fact.

- **The model marks its own guesses** inline: `data-hubly-guess="a suggested
  tagline"`. It knows what it invented. No extra model call, no regeneration.
- **A deterministic pass (`hubly_placeholders.ts`) strips the never-invent
  credentials**, grounding each against the record: star ratings, review/customer
  counts, and licence/insurance/certification/guarantee/award claims (no record
  source → always stripped); a price that matches no recorded service price; a
  "N years" that isn't `yearsInBusiness`. Stripped, NOT marked — an unnoticed
  fake credential that ships is real damage.
- **A backstop** marks a narrow forgotten class (a numbered process block). It
  does not attempt to detect arbitrary invented prose — that is inherently the
  model's job, which is why the model marks its own. Honest limit: a paragraph
  the model neither marked nor credential-shaped is not caught.
- **The mark is OWNER-ONLY.** The dotted-underline + "Hubly's suggestion" styling
  is injected inside `wireHcEditingSurface`, which runs only under `?hcEdit=1`.
  A public visitor sees an ordinary page; the owner sees which words are Hubly's.
- **Editing clears the mark.** `applyFreeformEdit` drops `data-hubly-guess` when
  it replaces an element's text.
- **Count is queryable**: `countPlaceholders(html)`, or over stored pages via the
  `data-hubly-guess` attribute.

Verified on two served pages (marlow-vance 25, brightleaf-cleaning 38 marks),
zero credentials on either, grounded prices kept ($120/$260), build time
unchanged (55–63s), and an edit dropping a mark (25→24). Marking granularity is
generous — a rich page carries 25–38 marks, not "six" — which is the safe
direction (over-mark, never under-mark); grouping a section's marks into one is a
possible refinement, not a defect.

## Draft lifecycle: what happens between a sentence and a kept site (report)

Investigated 2026-08-21. Read-only; nothing changed.

**1. A draft does NOT survive a tab-close into the builder.** `hc.draftBusiness`
(the id + draft_token) is held in memory and echoed back each turn; there is no
`localStorage`, no restore-on-load. Reopening myhubly.app is a fresh
conversation with no draft. What DOES survive: the PAGE itself (stored in
`business_documents`, served at `{slug}.myhubly.app` — permanently, until
deleted) and a 7-day httpOnly claim cookie (businessId only, set right after
draft creation). The `draft_token` is a permanent column on `businesses`,
server-side, never expiring until the row is claimed; it never reaches the
browser except in-memory. So: the published page is durable; the *editing
session* is not. Resuming the builder tomorrow would need the cookie's businessId
to hand back the draft_token — essentially the claim flow — so it is more than a
wire-up.

**2. Claiming.** A "Keep this site" button (bottom-right) appears once a draft
exists (`hcEnsureClaimUi`, called at platform-home:1616). It opens a modal:
enter email → `claim-draft-business` records the binding → the client calls
`supabase.auth.signInWithOtp` → the magic link, opened on any device, finishes
the claim and sets `businesses.owner_id`. So the earlier "no signup button after
a build" is no longer true — the button exists. (Note, not verified in-browser
this session: the button sits bottom-right at z-index 9998, the same corner as
the freeform chat FAB inside the iframe — a possible visual collision.)

**3. Email capture** happens ONLY at claim, in that modal. Before claim, no
personal email is captured; the `businesses.email` from the sentence is the
*business's* contact email, not an account.

**4. The numbers** (queried, not estimated):
```
drafts ever created ............ 48   (40 test, 6 internal, 2 real)
...that produced a page ........ 30   (ALL test — no real/founder freeform page)
...ever claimed (owner_id set) . 10   (6 internal, 2 real, 2 test)
...came back on a 2nd day ...... 0
```
"Came back on a 2nd day" = a business whose stored page has document versions on
two different calendar days. Zero. Caveat: this measures EDITING across days, not
viewing; and all 48 are our own testing done in single sessions, so this is a
statement about test behaviour, not customer behaviour — there are no freeform
customers yet.

**5. Public vs draft — the gate.** `get_public_business_document(slug)` serves
`rendered_html` for ANY business with that slug, claimed or not. So **an
unclaimed draft's `{slug}.myhubly.app` is live to anyone with the link** —
confirmed: marlow-vance (unclaimed) serves 32,679 bytes to an anonymous caller.
Unclaimed drafts are `noindex, nofollow` (`hcNoIndex`), so they won't appear in
search, but a direct link works. This is the same public-serving path that made
the phishing exposure possible (now mitigated at write-time by the
`create_business_document` revoke + rate limit).

**What it would take to hold the public address back until claimed + email
verified:** `get_public_business_document` would gate on `owner_id IS NOT NULL`.
The obstacle is that the BUILDER previews the draft through this SAME public RPC
(`{slug}.myhubly.app?hcEdit=1`, iframed in platform-home). So gating public
serving would break the owner's own preview unless the preview moves to an
authenticated path (the builder already holds the draft_token and could fetch
through a draft-scoped route). Concretely: (a) add `owner_id is not null` to the
public RPC; (b) give the builder a `get_draft_business_document(slug,
draft_token)` it can call to preview an unclaimed page; (c) optionally require
`email_confirmed_at` on the owner before serving, for verified-email gating. That
gate is what makes placeholders safe to publish AND closes the phishing exposure
at read-time — the same gate, both problems.

## The file-upload account gate is PROMPT-ONLY — the claim and the code disagree

**Status:** open, 2026-08-23. Not a bug fix — a decision we have to make.

**What we tell people vs. what the code does.** Hubly tells every new person that
photos and a logo need an account (`hubly-conversation/index.ts:520`, `:509` — model
narrative only). But the backend accepts an upload from **any unclaimed draft holding a
draft token**: `uploadDraftLogo`/`uploadDraftPhoto`/`uploadDraftHeroImage`
(`hubly_capability_registry.ts:2021-2023`, `:2154-2156`, `:2186-2188`) gate on
`draftId && draftToken` only — no owner/claim/account check — and the client blocks only
on `!hc.draftBusiness` ("no draft yet"), not on "not claimed"
(`platform-home.html` photo/logo drop). An unclaimed draft has a token, so the upload
succeeds. The account requirement is a thing the model is *told to say*, not a thing the
code enforces.

**We must pick one — this is a decision, not a defect:**
- **Make the gate real** (Adrian's instinct, and mine): require a claimed owner before a
  file is *kept* (logo/photo/hero → storage). Photos-for-an-account is a fair exchange and
  the main concrete reason anyone signs up.
- **Or stop claiming it:** if uploads are free, don't tell people they need an account for
  them.

Related and deliberately NOT gated: reading a **price-list screenshot** to extract
services is data entry, not a stored photo (`import-offers`, read-and-discard), and that
ask ships free — see the services-capture work. Whichever way the *kept-file* gate goes,
the screenshot-extraction path is a separate, ungated case.
