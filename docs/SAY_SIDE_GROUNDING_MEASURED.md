# Ruling B — does prompt instruction alone hold the say side?

**Read-only sweep of the stored assistant turns, 2026-09-16. Nothing built.**

The write side is enforced by code (`phoneGroundedWhy`, `priceGrounded`, `reconcileServices`).
The say side is held by prompt instruction alone. The question was whether that is holding, answered
with evidence we already have rather than an argument.

## Hand-checked first, the crudest way, before trusting any query

Three assistant rows containing `$`, printed whole and read by eye:

> *"Driveway is now set for September 17 at 3:00 — 14 Maple St, $180."*
> *"You've got $180 in job sales on record, and it hasn't been marked paid yet…"*
> *"Yes — it's on your schedule for tomorrow at 7:00 as "doctor's appointment." You also have the driveway job Thursday at 2:00 for $180."*

Then checked `$180` against the record directly: `jobs.amount = 180`. **Grounded.** The hand-check
also taught the detector two things it would otherwise have got wrong: `services.price` is null for
that business, and `meta->service_catalog` is an **object** holding `price_cents: 1500`, not an
array of `price` — so a naive scan of `price` fields would have produced false alarms.

*(And it surfaced item J verbatim: "September 17 at 3:00", no AM/PM.)*

## The numbers

**Prices: 84 mentions across 9 businesses. 1 ungrounded. Rate 1.2%.**
**Phones: 2 mentions across 1 business. 0 ungrounded.**

"Grounded" was defined generously on purpose — `jobs.amount`, `services.price`, anything anywhere in
`meta`, **or anything the owner themselves typed on that business**. So the ungrounded count is a
**floor**, not a ceiling. Over-stating here is the Lesson 85 failure.

## The one hit — and I nearly dismissed it as my own false positive

My first reading was that `$24.99` was my regex capturing `24` from a real `$24.99` order I had
failed to include in the known set. **That was wrong, and checking it rather than assuming is the
only reason this is in the report.** 24.99 exists nowhere for that business: not in
`commerce_orders`, not in `commerce_order_items`, not in `meta`, not in anything the owner typed.

The sentence, verbatim (`evergreen-yard-care`, seq 38, `account_kind = test`):

> *"No real bookings, jobs, or leads are on record right now. There is one paid store order showing,
> but it's marked as a test row: **Store Walk, $24.99, pickup, paid Sep 6, 2026**."*

What the record actually holds:

| | said | record |
|---|---|---|
| count | "one … order" | **two** orders |
| customer | "Store Walk" | `[TEST] Pin Check`, `[TEST] Mode Filter` |
| amount | "$24.99" | $12.34 and $9.99 |
| status | "paid" | both `pending` |
| method | "pickup" | pickup ✓ |
| date | "Sep 6, 2026" | Sep 6, 2026 ✓ |

**Four of six fields are fabricated.** Only the fulfilment method and the date are right.

## What this changes about the question

**For prices specifically, the prompt is holding: 1 in 84, and that one is on a test business, so no
market owner saw it.** By the letter of the ruling, that is "near zero — say so, with the number,
and revisit when the corpus grows."

**But the one failure it caught is a window onto a class the price detector cannot see.** The price
was the *least* wrong thing in that sentence. A customer name, a payment status and a count were all
invented in the same breath, and **nothing in the grounding family covers any of them** — grounding
guards phone, email, address, price and service, because those are the facts that get *published*.
This sentence published nothing; it merely *told the owner something false about his own records*.

So the honest answer is in two parts:

1. **A say-side price guard is not justified by this data.** 1 in 84, on a test row. Not built, per
   the ruling.
2. **A different gap is now evidenced**, and it is the one Lesson 86 is about: a reply summarising
   records is composed by the model from what it was handed, and nothing checks the summary against
   the rows. `servicesTruth` is the pattern that already solves this for one capability — the reply
   composed from what actually happened — and it exists for exactly one path.

**I am not proposing a mechanism for (2) here.** It needs its own measurement: how many assistant
replies summarise records at all, and how many of those can be checked against the rows they claim
to describe. That is a bigger question than Ruling B asked.

## What would make these numbers wrong

- **`$`-anchored extraction undercounts.** CLAUDE.md's own scar: prices render without the symbol.
  A reply saying "the driveway is 180" is invisible to this sweep. The true price-mention count is
  **higher than 84** and the ungrounded count could be higher too.
- **The phone number is 2 mentions.** That is too small a sample to conclude anything at all, and it
  is stated as such rather than reported as a reassuring 0%.
- **"Anything the owner typed" is generous**, and deliberately so — a number he said once, months
  ago, counts as grounded here, where the write-side rule would require it in *this* message.
