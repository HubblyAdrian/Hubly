# Owner home — design rulings, 2026-09-06

An image with no ruling attached is just a picture. Every file here carries a verdict, or says
plainly that it has none.

| file | verdict |
| --- | --- |
| `owner-home-2026-09-06-flow.png` | **Approved in part** — screens 1, 2, and the top half of 3 |
| `owner-home-2026-09-06-advice-cards-rejected.png` | **Rejected.** The counter-example |
| `owner-home-2026-09-06-early-single-card-unreviewed.png` | **No verdict.** Kept as history |

---

## APPROVED — `owner-home-2026-09-06-flow.png`, screens 1, 2, and the top half of 3

**The home screen is a conversation plus what it produces, not a dashboard laid out in advance.**
That is the direction. Everything below is a consequence of it.

### Screen 1 — the booking card is the standard

Every field on it is something we actually hold: name, date, package, price, address, vehicle, and
the customer's own note. Nothing is inferred, averaged, benchmarked or estimated. Both buttons —
**View Job** and **Message Customer** — act on a real record.

> **Use this card as the test for any future card.** If a field on a proposed card cannot be traced
> to a row we hold, it does not go on the card.

### Screen 2 — a generated view, rendered inside the conversation, offered

The owner asks for their schedule; Hubly renders it inline and asks *"Want me to keep this as a tab
in your sidebar?"* with **Yes, add it** / **No, not now**. The view is produced by the conversation
and only becomes furniture if the owner says so. Nothing appears in navigation because we guessed
they would want it.

### Screen 3, top half — how EVERY capability change gets announced

> *"Got it! I've added Schedule to your sidebar. You can always ask me to remove it or add more
> tabs later."*

This is the model, and it does three things at once:

1. **It announces.** Prohibition 4 — the interface may not change shape silently. A new place in
   navigation is exactly that kind of change.
2. **It is reversible, and says so.** The owner is told how to undo it in the same breath.
3. **It teaches the mechanic without a tooltip.** "You can ask me to add more tabs later" is the
   entire feature explained in one clause, in the conversation, at the moment it is relevant.

Any capability that lands in the sidebar is announced this way.

---

## NOT APPROVED — and this is the part that gets built by accident otherwise

### The bottom half of screen 3 (in the otherwise-approved flow)

Three claims in the "ideas" list that we cannot support:

| the copy | why it is not allowed |
| --- | --- |
| "Many detailers in Bakersfield see a bump in October." | **We have no data on Bakersfield detailers.** None. This is a market statistic invented to make a suggestion sound grounded. |
| "Your last post was 10 days ago." | Requires a social connection we **do not have**. |
| "Your $60/month plan is a great offer." | A **judgement with nothing behind it** — we have no comparison to call it good. |

### `owner-home-2026-09-06-advice-cards-rejected.png` — the counter-example

The six-card Sunset Detailing home. **Four of its six cards assert data we do not have, and one of
those is financial advice.** Verbatim from the image:

- **"Your average ticket has dropped 8%"** — *"Your average ticket this month is $162 (down from
  $176). I'd recommend raising your Basic Detail from $149 to $169."* We cannot compute an average
  ticket trend, and this is a **recommendation to change a price**, unprompted, on a made-up trend.
- **"Consider adjusting pet hair removal"** — *"You're currently charging $35... Based on similar
  businesses and your recent jobs, I'd recommend $45."* **"Similar businesses" is a competitor
  benchmark we do not possess.**
- **"Your before/after photos can be even better"** — *"Your last 10 job photos are great, but your
  before/after shots aren't consistent."* We have not assessed anyone's last ten photos.
- **"Haven't posted this week"** — *"You haven't posted on Instagram this week."* No social
  connection exists.

Two of those are **unsolicited pricing advice**, which is the most expensive version of the
mistake: `CLAUDE.md` already requires that anything Hubly says about what to charge is
what-was-found-with-sources, never what-to-do, because *"if he raises to $55 on our say-so and
loses his regulars, that is on us."* These cards are the opposite — what-to-do, with an invented
finding attached.

### THE RULE, stated so it is checkable

> **Hubly may suggest. Hubly may not manufacture a fact to support a suggestion.**

*"Want to try a fall promotion?"* is fine — it is an offer, and it claims nothing.
*"Many detailers in Bakersfield see a bump in October"* is not — it is a statistic we invented to
make the offer land.

**The check:** for every sentence in a suggestion, name the row it came from. If you cannot, delete
the sentence — not the suggestion. The suggestion usually survives without it, and is more honest
for the loss.

This is **Hedge Trimming in a helpful voice** — the same family as `OPEN_FINDINGS` #22 (a renderer
composing "Someone in {city} just booked a {service} moments ago" from a city and a service name,
consulting no booking), #25, and #45 (a confident, specific, entirely fictional explanation built
on an unchecked premise). The voice being helpful is what makes it hard to see.

### Two smaller things, both in the mockups

- **The notification bell with an unread badge is the old model persisting.** If the assistant tells
  you what happened, the badge is counting something the conversation has already handled. Two
  systems claiming to be the record of what happened is one too many — and it is the "two of
  everything" pattern this codebase keeps paying for.
- **"Hubly is your AI business partner — here to help you get more customers and grow"** is
  marketing copy sitting inside the product. The owner has already bought it. Footer space in a
  working tool should carry something true and useful, or nothing.

---

## NO VERDICT — `owner-home-2026-09-06-early-single-card-unreviewed.png`

An earlier, simpler version: Sunset Detailing, one card — *"Your website is live and ready to go!"*
— with a **Go to Website** button and a site preview.

**Neither Adrian nor I has ruled on this.** It is filed as history so the progression is visible,
and it must not be read as rejected. Notably it does **not** contain the advice cards above; it is a
different and much quieter design.

---

## A note on how this file was assembled

The rejected ruling was originally described to me for a file whose contents did not match the
description — the pricing-advice cards were **not** in the image I had been pointed at. The
description had been written from an image pasted into chat, not from a filename, and the two had
drifted apart.

I declined to attach a damning ruling to a file whose contents contradicted it, and asked instead.
That is the same discipline as the two-timestamps rule in `STATE.md`: **do not let a description
travel further than the thing it described.** A ruling attached to the wrong artifact is worse than
no ruling, because the next person reads the file, sees no pricing cards, and concludes the ruling
is noise.

---

## In flight

**The Store capability decision (`OPEN_FINDINGS` #36, #46) is screen 3.** It is the first real
instance of the tab mechanic — an owner asking for a capability, Hubly adding it to the sidebar and
announcing it — and it arrives with a paying customer attached. The `capabilities.storefront`
chicken-and-egg in #46 (the flag is only earned by using the Store UI, which is only reachable with
the flag) is precisely the question screen 2 answers: **the owner asks, and Hubly adds it.**
