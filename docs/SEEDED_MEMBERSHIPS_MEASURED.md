# What we published that the owner never set — measured

**Measured 2026-09-16** against the live database and the **live rendered pages**, not inferred.
Re-run: `supabase db query --linked -f scripts/sql/export-membership-offers.sql`, then
`HUBLY_MEMBERSHIP_OFFERS=<export> node scripts/measure-seeded-memberships.mjs`.

## The answer

> **No market business has a membership PRICE on a live page that the owner never set. Zero.**
> **This is a cleanup of a live hazard, not an apology.**
>
> But **seeded deliverables are live on a market page right now**: Graef's Bi-Weekly plan publishes
> all three seeded includes — *Monthly wash · Interior refresh · Priority scheduling* — under a
> **Join Membership** button, and he never said any of them.

## A correction I owe, before the numbers

**My first pass searched for `$99` and would have reported "no seeded price is live anywhere."**
That would have been wrong. The seed is **per trade**, read out of `membershipDefaultsForTrade`:

| trade | seeded price |
|---|---|
| detailing | **$99** |
| windows | $89 |
| cleaning | $149 |
| **landscaping** | **$119** |
| hvac | $129 |
| spa | $89 |
| pressure_washing | $99 |
| *(fallback)* | $99 |

`adrians-lawn-service` publishes **exactly $119**. Searching for one trade's number is how a
per-trade default hides in plain sight — which is why the measurer now **parses the seed table out of
`public/hubly.html` at run time** instead of comparing against a transcribed constant.

## What would make this wrong, stated before the numbers

- It reads `meta.website.membershipOffers`. A plan **baked into a freeform page's HTML** would not
  appear. Neither business here has a freeform key in `meta`, so both render from `meta` — but a
  freeform business with a baked plan would be invisible to this measurement.
- **Equality with a seed is evidence, not proof.** An owner who types the exact seeded sentence has
  stated it, and this counts him as seeded. The error runs toward **over**-reporting, which is the
  safe direction for a "we published something he didn't say" number.
- A plan with `enabled:false` is not on the page. Counted separately, never folded in.
- `account_kind` splits market from test. A test figure is about **us**, not about owners.

## The universe

**202 businesses. 10 hold a membership key. 8 of those hold an empty array `[]`.**
**2 hold plans. 4 plans total, all enabled.**

The eight empties are `cotter-aviation`, `my-auto-detailing` (internal); `aquaspeed`,
`bucket-mobile-detailing`, `devdetailing661` (market); `evergreen-yard-care`, `my-photography`,
`star-windows` (test). Nothing published, nothing to clean up.

## Every row, per field

Read from the DB **and confirmed by loading each live page in a browser and reading the DOM a
customer sees** — `.ws-membership-card` amounts, descriptions, includes and CTA. `$99` appears in the
page source (the seed table ships inside `hubly.html`) and **nowhere in `document.body.innerText`** on
either page, which is why the source grep was not the measurement.

### graefs-autocare — **market**, detailing, has an owner, `claimed_at` null

| plan | price | name | description | includes |
|---|---|---|---|---|
| **Monthly Membership** | **$60/mo — his** | seeded | **seeded** | **his** — "Full Interior", "Full Exterior" |
| **Bi-Weekly Membership** | **$50/2wk — his** | his | **seeded (cadence variant)** | **SEEDED — all three** |

Both live, both with a **Join Membership** button. He set both prices. He set the includes on the
monthly plan and left ours on the bi-weekly one.

> **This is the finding.** "Monthly wash · Interior refresh · Priority scheduling" is not marketing
> copy — it is a **list of deliverables a customer can hold him to**, on a market business's
> customer-facing page, with a join button under it. We wrote it; he never said it.

### adrians-lawn-service — **test**, landscaping

| plan | price | name | description | includes |
|---|---|---|---|---|
| **Lawn Care Plan** | **$119 — SEEDED** | seeded | seeded | **SEEDED — all three** |
| Lawn Club | $100 — his | his | his | his — "Lawn Mowed", "Trim", "Grass Pick up" |

The first plan is **100% seeded in every field** and live. It is a test account, so it does not
change the market answer — but it is the proof that a fully-seeded plan does ship when nobody edits
it, and it is what a market owner would have had.

## Was the owner's hand ever on it? The conversational record says no

`business_conversations` across both businesses holds **one** turn mentioning a membership, and it is
an **assistant** turn about bookings ("Austin has two pending bi-weekly memberships with no date").
There is no turn in which either owner sets up a plan. Every plan here was set through the editor —
or seeded and partly edited.

Which means the only available evidence of a human's hand is **the data itself**: a value that
differs from the seed. That is what the per-field table above is.

## Adrian's ruling, and what it would take

> *"A suggested description IN THE EDITOR is helpful. A suggestion PUBLISHED ON A LIVE PAGE is a
> claim. So seeded description/includes stay as a starting point the owner SEES AND EDITS, and do not
> appear on a customer-facing page before he has looked at them."*

The ruling is right and the evidence is stronger than either of us assumed — the **includes** are the
sharp end, not the description.

**What it would take.** Three changes and one migration decision:

1. **`defaultMembershipPlan` stops writing seeded values into the record.** It becomes
   `description: ''`, `includes: []`, `name: ''`, alongside the `price: null` already shipped. The
   trade defaults survive as **editor placeholders** — the same treatment the price already got.
2. **The editor shows the suggestion as a suggestion he can accept.** A placeholder is invisible on
   the page but only half the ruling: he must be able to take it in one gesture. A single "use this"
   affordance per field, which writes the value **as his** once he presses it. Without that the
   ruling costs him the seed entirely, and the seed is genuinely useful.
3. **`scrubMembershipTradeLeaks` stops writing prose.** Its `descLeak = !m.description || …` treats an
   **empty** description as a leak and fills it with the trade default — so change 1 is defeated by
   change 3 unless both land together. This is the mechanism that would have quietly undone the fix.
4. **The card omits what is not set.** `membershipHasPrice` already does this for the price;
   `description` and `includes` need the same treatment (`wsMembershipCardHtml` renders
   `<p>${m.description||''}</p>` and an empty `<ul>` today, which is harmless, and an unpriced plan
   already renders with no price line).

**And the existing rows are a separate decision, which is yours.** Two candidates:

- `graefs-autocare` **Bi-Weekly** — three seeded includes and a seeded description, **market, live**.
- `adrians-lawn-service` **Lawn Care Plan** — every field seeded, **test**.

**Nothing is touched until you say so.** Graef may have read those three lines and been happy to
deliver them for two months; removing them from under him is its own harm, and it is not a decision
a measurement gets to make. The honest options are (a) leave them and fix the writer so no new ones
appear, (b) ask him, which is the only way to find out whether they are true, or (c) strip them.
`graefs-autocare` is **read-only** to this session regardless.
