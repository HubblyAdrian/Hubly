# The market denominator — audited, nothing reclassified

Measured 2026-09-15. **Nothing was changed.** A denominator we quietly correct is a denominator
nobody can audit.

## The headline

**10 businesses are currently counted as `market`. Four have a confirmed owner. Three are
provably a founder's. Three are unconfirmed in either direction.**

Every ratio anyone has quoted with a market denominator this month used **10**.

## The population, with the evidence for each

| slug | owner | `owner_identified` | bookings | jobs | verdict |
|---|---|---|---|---|---|
| `aquaspeed` | Andres Moros | **true** | 6 | 0 | confirmed market |
| `graefs-autocare` | Austin Graef | **true** | 11 | 2 | confirmed market |
| `devdetailing661` | Devin F | **true** | 0 | 0 | confirmed market |
| `bucket-mobile-detailing` | *(no name)* | **true** | 1 | 0 | confirmed market |
| `site-aa7537` | Skylar Thomas | false | 0 | 0 | **FOUNDER** — Adrian confirmed 2026-09-15 |
| `lugnuts-regulators` | skylar thomas | false | 1 | 0 | **FOUNDER** — same person; his other business `lugnutz` is classified `internal` |
| `modern-landscaping-business` | Johnathan Jake | false | 0 | 0 | **INTERNAL OWNER** — same owner holds `my-auto-detailing`, classified `internal` |
| `detailing-chemicals-equipment-courses` | Andres Mayorga | false | 0 | 0 | unconfirmed |
| `mobile-auto-detailing-in-los-angeles` | Andres Mayorga | false | 0 | 0 | unconfirmed |
| `window-washing` | Braxton Romans | false | 0 | 0 | unconfirmed |

## Why three are "provably" a founder's

Not inferred from how the rows read — that is the mistake this file exists to avoid. Each has a
hard signal:

- **`site-aa7537`** — Adrian stated it directly: *"Skylar Thomas is a founder testing."* Its only
  service was `"watch adrian smithe and make sure he is doing his work"` (deleted 2026-09-15 on
  his instruction), and the business has no name at all.
- **`lugnuts-regulators`** — same owner as `lugnutz`, which **we already classified `internal`**.
  One person, two businesses, and we have called one of them internal and the other market.
- **`modern-landscaping-business`** — same owner as `my-auto-detailing`, also already
  `internal`. Same contradiction.

**Two owners in the whole database hold businesses of more than one `account_kind`, and both of
them are on this list.** That is the cheapest possible query for this defect and it had never
been run.

## What the true numbers are

| | today | corrected |
|---|---|---|
| market businesses | **10** | **7** at most, and only **4** are confirmed |
| market businesses with any booking | 3 of 10 (30%) | 3 of 7 (43%) — or 3 of 4 confirmed (75%) |
| market businesses with a job | 1 of 10 (10%) | 1 of 7 (14%) |
| market businesses with stored conversation history | 7 of 10 | 4 of 7 |

**Every one of those ratios moves, and one of them nearly doubles.** "One in ten of our market
businesses is a founder testing" is the floor, not the estimate: it is three in ten.

## The structural cause, which CLAUDE.md already predicted

`owner_identified` is **false on 6 of the 10**. The rule in CLAUDE.md is explicit:

> `account_kind` defaulted to 'real' and cost a week; the claim trigger then silently promoted
> unrecognized signups to 'market' — the same bug one level up. The honest value is the default;
> confirmation is the manual action, not the reverse.

So the mechanism is exactly the one already written down: **a signup nobody confirmed becomes
`market` on claim.** Four businesses were confirmed and six were promoted. The audit did not find
a new defect; it found the predicted one, still running, three of its cases now provable.

## What I am NOT doing

- **Nothing reclassified.** Not the three provable ones either.
- **No number re-quoted.** Anything already published with a denominator of 10 stands until
  Adrian rules; silently restating them would be the same offence as silently fixing them.

## Two things worth deciding at the same time

1. **`account_kind` should not be settable by the claim trigger for an unconfirmed owner.** If
   `owner_identified` is false, the honest value is not `market`. That is a one-line change to
   the trigger and a re-run of this audit, and it stops the denominator drifting again.
2. **Six market owners are not in `docs/BUSINESS.md`.** Andres Moros, Devin F, Andres Mayorga,
   Braxton Romans, Johnathan Jake and Skylar Thomas appear nowhere in it. The working agreement
   says a customer's name goes in that file the moment it is stated — *"a fact that only exists
   in a chat is a fact that will be lost."* Six of them only exist in the database.
