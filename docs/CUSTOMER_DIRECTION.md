# The customer side — direction, not a project

Recorded 2026-09-08. Written as a north star, deliberately not as a roadmap.
Nothing in this document is scheduled. Section 5 says what must **not** be built yet.

---

## 1. The agreed destination

Hubly should become the conversational front door to a service business.

A customer describes what they need in their own words, gets an appropriate
recommendation, books it — and on a later visit, the business recognises its
relationship with them.

The customer rarely knows the catalogue. They don't arrive thinking
"I need Paint Correction." They arrive thinking "my truck has water spots
and the paint looks dull." A grid of service tiles handles that badly.
A conversation handles it well, and for services this fits better than it
does for products: there is no size chart to fall back on, and the honest
answer genuinely depends on the customer's situation.

This mirrors the owner side, which is already built this way:

| | owner side | customer side |
|---|---|---|
| understands | Home tells you what matters | Conversation understands what you need |
| answers | Chat lets you ask anything | Hubly recommends what to do |
| acts | Workspace lets you do the work | Hubly helps you book it |
| remembers | the event stream | *the relationship — not yet earned* |

**External validation.** Swap Commerce sells an "agentic storefront" on the same
premise — conversation replaces browse — across 1,000+ brands, and pairs it with
first-party intent capture. Their published performance figures are vendor-reported
marketing claims and are not assumptions for Hubly. What is transferable is the
premise and the intent-capture idea. What is not: sizing, virtual try-on,
cross-border duties, returns-to-exchanges, Shopify integration.

**We already hold two pieces of this.**

- A cold anonymous visitor asked a question on a business site and came out the
  other side as a scheduled $85 job, entirely through conversation, with no
  catalogue. Measured 2026-09-08.
- Visitor conversations are now stored, and a conversation that ends without a
  booking surfaces to the owner as a lead. Before 2026-09-08 that was discarded.

---

## 2. Why identity is the gate

The word doing all the work in section 1 is **remembers**.

"Welcome back, Sarah" requires knowing it is Sarah. On a public site with no
login, that is cookies or a magic link — neither of which exists today.

What exists today:

- The customer resolver matches on **phone, then email, then nothing**.
  Name is deliberately never a match key, because two people called
  "John Smith" are not one customer.
- Chat leads frequently carry **neither**. The lead card has to say, truthfully,
  *"They didn't leave a phone or email, so there's no way to reach them from here."*

So recognition is not a rendering problem. It is an identity problem, and it is
unsolved.

**The rule this implies, and it is not negotiable:**

> Hubly must never claim to recognise someone whose identity it cannot establish.

Being confidently wrong to a customer costs far more than being confidently wrong
to an owner. An owner shrugs at a bad number; a customer greeted as the wrong
person leaves, and tells the business owner why.

---

## 3. The first experiment: returning-customer recognition

One experiment, narrow, and it tests the whole thesis.

Today a repeat customer of a Hubly business is a stranger every single time.
They book, the job completes, and the next visit starts from zero.

The experiment:

> A returning customer is recognised by a verified identity, and the conversation
> opens from what actually happened last time.
>
> *"Welcome back, Sarah. Last time we did a Full Detail on the F-150 —
> same again?"*
> → *"Yes, but add the interior shampoo."*
> → straight into booking.

Why this is the right first move:

- It **forces identity to be solved properly**, because nothing works without it.
- It uses **only verified historical rows** — a real job, a real service, a real
  vehicle. No inference, no profile, no preferences model.
- It is **falsifiable**. Either returning customers engage with it or they don't,
  and we find out at a fraction of the cost of a relationship layer.
- It fails safe. No identity → no greeting → the ordinary first-visit
  conversation, which already converts.

---

## 4. What must be true before expanding beyond the experiment

1. **Identity is reliable.** A returning customer is recognised correctly, and an
   unrecognised one is never guessed at. Proved by clicking, on a real return
   journey, not by reading the resolver.
2. **Everything the greeting says is read from rows.** Same rule as the owner
   greeting: no shape drawn for a number we don't have, no claim we haven't
   established. If it says "last time we did a Full Detail," a Full Detail row exists.
3. **The capabilities it would lean on are verified individually.** Store,
   memberships and commerce are currently assumptions, not findings — the Store
   was accidentally open to all 177 businesses until a screenshot proved it, and
   the memberships on at least one live site are text the owner typed. A code
   trace is a hypothesis; a click is a finding.
4. **The owner-side honesty work has held** under real use for long enough to
   trust it. A relationship layer built on a surface that invents things
   remembers things that were never true.

---

## 5. What we are explicitly NOT building yet

Not now, and not incrementally-by-accident:

- customer accounts or logins
- a customer portal or dashboard
- saved items, preference centres, wish lists
- loyalty or rewards mechanics
- customer-facing order history or messaging inboxes
- a named initiative that implies all of the above exists

**On the portal specifically.** If this is ever built, the conversation *is* the
portal. A returning customer should meet a sentence, not a navigation menu:

> *"Welcome back, Sarah. Your next detail is Thursday at 2:00.
> Want to add anything to it?"*

not a screen of tabs labelled Appointments · Invoices · Messages · Membership ·
Profile · Settings. That is software. The point of Hubly is that it isn't.

**And no umbrella name yet.** Naming this creates quiet pressure to build all of
it. The name comes after one piece is real.

---

## The one-line version

The destination is agreed and it is not scheduled. Identity is the gate.
Returning-customer recognition is the single experiment that tests the idea and
forces the gate to be opened honestly. Until it is, the correct behaviour is the
one already shipped everywhere else in the product: say only what can be
established, and say nothing rather than something plausible.
