# The TYPE model — on the offer, one reader

**Status:** built and checked, 2026-09-16. `npm run check:offer-type`
**Rule source:** Adrian, 2026-09-16 — "TYPE model on the OFFER, one reader, structural mapping …
untyped must not guess, editor includes type." Plus SETTLED 30.

## The model

Two axes, and they are **independent**:

| axis | values | means |
|---|---|---|
| `kind` | `service` · `membership` · `other` · `unknown` | **what it is** |
| `sale` | `bookable` · `quoted` · `unknown` | **how someone gets it** |

They are not two values of one field. A membership can be quoted; a one-off service can be
bookable. Collapsing them is how "quote" came to mean four different things in this codebase.

**Why it lives on the OFFER.** SETTLED 30, established from the column names rather than assumed:
`memberships` carries `customer_id`, `next_due_date`, `source_plan_ref` — the columns of an
*instance* pointing at an *offer*; `meta.membership_offers` sits beside `service_catalog.services`,
where a thing-you-sell belongs. So **OFFER : MEMBERSHIP :: SERVICE : JOB**, and the type belongs on
the thing you sell. A job does not need to be told it is bookable — it already happened.

## Precedence, and what "untyped must not guess" actually forbids

1. **The record's own declaration** (`offer.kind` / `offer.sale`) → `declared`.
2. **A declaration we cannot read** (`kind: 'subscription'`) → `unknown`. *Not* a fall-back to the
   structure: something has plainly told us this is recurring, and overruling it with the store it
   sits in would render it as a bookable one-off behind the owner's back. Same refusal the A/B/C
   rule makes when the owner moved an item himself and the letter is unreadable.
3. **The store it lives in** → `structure`. An entry in `service_catalog.services` is a service
   *because of where it is stored*. That is a structural fact, not an inference about intent, and
   refusing to read it would be the empty-reader defect — reporting our missing bookkeeping as his
   missing data.
4. **Nothing** → `unknown`, and the only correct behaviour is to **ask**.

`sale` gets the same treatment, with `pricing.mode === 'quote_required'` as its structural source —
which has been in `PricingMode` since the service engine was written, so this axis is a **name for
something the catalog already recorded**, not new storage.

`offerTypeAsk()` asks **one question at a time**. Its first version concatenated both questions into
one line; that is two requests in one message, the defect of 2026-08-26 wearing a type model's
clothes.

## Where it lives

| | |
|---|---|
| Canonical reader | `offerType(raw, home)` — `supabase/functions/_shared/service_engine.ts` |
| The questions, as data | `OFFER_TYPE_QUESTIONS` (server) / `WS_OFFER_TYPE_QUESTIONS` (client) |
| Client mirror | `wsOfferType` — `public/hubly.html`, seam `window.hublyOfferUI` |
| Stored as | `HublyService.offer = { kind?, sale? }`, preserved verbatim by `normalizeCanonicalService` |
| Round trip | `catalogItemToEditorSvc` → `syncEditorPackagesToServices` → `buildServiceCatalogFromEditor` |
| The part router | `WS_PE_PART_FIELD['svc-type'] → 'ws-pe-svc-type'` |

**"One reader" cannot be literally true**, and the honest response is not to claim it is. The
canonical reader is a Deno module; the editor runs in a browser that cannot import it. So the two
copies are made **provably equal**: `scripts/check-offer-type-one-reader.mjs` runs the same 17-case
table through `offerType` under Deno *and* through `wsOfferType` in a real browser on the served
page, and fails on any difference — including the question wording, character for character, because
copy is the half that drifts.

**Values are stored as declared and never validated by a normalizer.** A normalizer that quietly
dropped `kind: 'subscription'` would make "a declaration we cannot read" unreachable and turn that
offer into a plain service. `offerType` is the one place that judges.

## What the editor and the `+` now do

- **The editor includes the type** — one select, because the other axis is *already* the pricing
  control two rows down. A second way to say "they ask for a price" would be a second storage
  location for one fact.
- **`quoted` became reachable.** `buildServiceCatalogFromEditor` has mapped `pricingType:'quote'` to
  `mode:'quote_required'` since it was written, but the editor's only options were flat and
  variable — so an owner whose price depends on the job **had no way to say so and had to type a
  number he had not been asked for.** A missing door on a built capability, which the standing rules
  say to check for first. Choosing it removes the price field and says why in a line, rather than
  letting a control vanish in silence.
- **`if(!vehicleOn) ptype='flat'`** became `if(!vehicleOn && ptype==='variable')`. The old line
  silently turned "they ask for a price" back into a flat rate for every trade that is not a
  detailer.
- **The `+` asks the kind first and writes nothing until he answers.** It used to create a record on
  the spot: a nameless offer with **`defaultPrice: 99`**. Two defects in one line — the offer was
  typed by assumption, and 99 is a price nobody stated on an object one typed word away from a live
  page. A new offer now has **no price at all** and shows none until he sets one.

## The membership half: Adrian's premise was wrong, and it was a missing door

His instruction was "membership half gets button/behaviour but **NO record written**", resting on a
premise we had recorded — memberships have no home yet. **They do.** The membership *offer* half is
fully built and shipping: `ensureMembershipOffers`, `defaultMembershipPlan`, `addMembershipPlan`,
`renderMembershipEditorList`, `editMembershipFromPreview`, a website section and a profile tab — and
the website preview's own `add-membership` marker has been routing to them all along. The `+` in the
services editor was the **only** surface that could not reach it.

So the `+` routes to the store that already exists. Writing a membership into the *services* catalog
to make the button feel finished would put the record in the wrong store and teach the reader a lie.

### And that door was publishing a price nobody stated — verified by use

Driven in a real browser on the served page: `addMembershipPlan()` produced a plan with
**`price: 99`, `enabled: true`**, and `.ws-membership-amount` **on the website card**
(`wsMembershipCardHtml`, not the editor) rendered **`$99/mo`** with a Join button under it. Also
invented: the name, the description ("Keep your vehicle showroom ready, every month.") and three
inclusions.

**What would make this wrong, stated before the claim:** `document.body.textContent` includes
`<script>` text, so a page-text search for "$99" is not evidence — it matches this file's own
comments. The load-bearing evidence is the element: `.ws-membership-amount` read `"$99"` before and
reads **`null`** after.

Fixed, narrowly:

- `defaultMembershipPlan` → `price: null`. `defs.price` survives as the input **placeholder** — a
  suggestion he accepts by typing, which is the difference between offering a number and publishing
  one.
- `membershipHasPrice(m)` — one predicate, so the website card, the editor summary and the customer
  chip cannot disagree about whether a plan has a price. `''`, `null`, `0` and `NaN` are all "he has
  not priced it", and none may render as a number.
- The popover write no longer does `parseFloat(...)||0` — empty means **unpriced**, not free.
- `scrubMembershipTradeLeaks` no longer re-injects a price while fixing prose. Re-pricing his plan
  because his wording mentioned the wrong trade is a different act, and one he would never see.

**LEFT ALONE, FOR ADRIAN'S CALL:** the seeded **description** and **includes** are a deliberate
per-trade onboarding system (`membershipDefaultsForTrade`, `scrubMembershipTradeLeaks`,
`isDetailingMembershipCopy`). They are still facts the owner did not state, and they still publish —
but unlike a price they are not a commitment a customer can act on, and rewriting someone's
onboarding design unilaterally is not a bug fix. Reported, not changed.

## The check

`scripts/check-offer-type-one-reader.mjs` — **11 legs, declared `[RULE]` at write time.** Served over
HTTP via the new shared `scripts/lib/serve-public.mjs`, because `hubly.html` links ten stylesheets
root-absolutely and under `file://` none of them load (the rig refuses that outright now — it is why
this check failed to start on its first run).

**Seen red in three separate directions:**

| break | what went red |
|---|---|
| client defaults an undeclared kind to `service` (the guess) | leg 1 — 4 disagreements |
| client's `'flat' → 'fixed'` translation removed (vocabulary drift) | leg 1 — 1 disagreement |
| one question reworded on the client only | legs 1, 6b, 7, 10 |
