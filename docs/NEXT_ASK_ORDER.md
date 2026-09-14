# Which outstanding thing does Hubly ask for next? — proposal, 2026-09-13

**Stated before it is written, at Adrian's instruction: the ordering is a product decision.**
`get_my_site_gaps` stays exactly as it is — the discipline in *which* items are known was
hard-won and is not being touched. What changes is the telling.

## The principle

**Order by what the absence costs the CUSTOMER of the business, not by what is most incomplete
and not by what is easiest for us.** A gap matters in proportion to how close it sits to
somebody deciding to hire this owner.

That produces four tiers:

| tier | question it answers | gaps | why here |
|---|---|---|---|
| **1. Can a customer ACT?** | "I want this — how do I get it?" | `has_phone` | Without it the page is a dead end at the exact moment it worked. Everything else is upstream of this |
| **2. Can a customer DECIDE?** | "Is this for me, now, at this price?" | `has_hours`, `has_priced_services` | The customer has to ask before they can choose, and most will not ask |
| **3. Can a customer TRUST?** | "Is this a real business that does good work?" | `own_photos` | The biggest single upgrade to a page, and the one that costs the owner the most effort |
| **4. Can a customer UNDERSTAND?** | "What exactly is in this one?" | `services_no_desc` | A priced service with no description still sells. Real, and last |

**Tie-break inside a tier: the one that takes the fewest words from the owner.** A phone number
is one message. Photos are a trip to the van.

**Note the deliberate demotion.** `own_photos` currently leads the list with the strongest copy
("your real work is the biggest upgrade"), and it moves to tier 3 — not because it matters less,
but because it is the highest-effort ask and putting it first spends the owner's willingness on
the thing most likely to be deferred. Tier 1 and 2 are each one sentence long.

**And one promotion:** `has_priced_services` is returned by the RPC and has never been asked
for. A priceless service on a live page is the defect this whole session has been about.

## How it is told

- **One ask, in Hubly's own sentence.** No bullets, no "A few things would make your page
  stronger", no stack of buttons, no count. The owner should not be able to tell there is a list.
- **One at a time**, and it waits if a question is already on the floor (the standing one-ask rule).
- **It does not re-ask for something already held.** `get_my_site_gaps` is re-read after every
  turn that could have supplied a fact, so something given in passing removes the ask rather than
  being asked for again — the worst version of not listening.
- **Silence is a valid output.** No gaps → say nothing. And never reach for a weaker item just to
  have something to say; the tier list ends at four and does not wrap around.
- **It asks, it does not announce.** Measured (2026-08-23): a fact is captured ~40% of the time
  when merely mentioned in passing, ~80% when Hubly asked the question first. The ask is the
  mechanism, not decoration — which is also why the ask is not done until the capture is confirmed.

## What stays exactly as it is

`get_my_site_gaps`, and the rule its comments encode: **a suggestion is a promise — only ask for
something whose action actually reaches the page.** "Set your hours" was pulled on 2026-09-08
when clicking it produced *"I can't add opening hours as a real business field yet"*, and came
back only when `setHours` shipped. That discipline governs which items may be asked for, and it
is unchanged. This document governs the order and the register.

## Open question for Adrian

**When does the ask fire?** Today the list is composed in the arrival render, so it greets the
owner. An ask that arrives as a greeting is still a ritual, just a shorter one. The alternatives
are (a) once per session, after the owner's first message rather than before it, or (b) when it
is contextually relevant — the owner mentions a service, Hubly notices that service has no price.
**(b) is the version that reads as listening**, and it is more work. Not chosen here.

---

## Built 2026-09-13 — and the open question is answered

**Ruled (a): once per session, after the owner's first message.** Adrian's reasons, recorded:

> An ask that arrives as a greeting is still a ritual — and the owner has not yet told us
> anything, so we are asking before we have listened. **(b) is better in principle and worse in
> practice: "contextually relevant" has no definition here, and an undefined trigger fails
> quiet. A thing that never fires looks exactly like a thing that works.**

**(b) is the intended end state, deferred with its condition written next to it.** For (b) to be
judgeable, two things must exist that do not today:

1. **A checkable definition of "relevant"** — which turn kinds count, and how a gap is matched
   to what was said. "The owner mentioned a service" is not yet a predicate.
2. **A counter for how often it fires** — a row, like `rebuild_outcome_events`. An undefined
   trigger fails quiet, so a contextual ask that never fires is indistinguishable from one that
   works. Build (b) when the MISS is countable, which is the same condition every other silent
   path in this codebase has had to meet.

### Where it lives

- `hcPickNextGap(g)` — tier order, `HC_GAP_ASKS`, returns `null` when nothing is outstanding.
- `hcMaybeAskNextGap()` — re-reads `get_my_site_gaps` first, then says **one** sentence.
- Fired from the reply handler on the **same floor predicate as the account offer**: Hubly said
  something, it was not a question, no capture ask or re-ask is on the floor — and not if the
  account offer already spoke this turn. Two composers in one beat is the 2026-08-26 failure,
  and "one ask at a time" gets no exception for a good ask.
- The greeting composes nothing. `hcRenderArrival`'s checklist block is deleted.

### Asserted, not just intended

`scripts/check-one-ask-not-a-list.mjs` (`npm run check:one-ask`), three legs, each red-proofed:

1. **no bullets** — no `hcAppendMessage` composes a `'• '` line;
2. **one ask** — `hcMaybeAskNextGap` contains exactly one `hcAppendMessage`;
3. **no fallback** — every `return` after `hcPickNextGap`'s loop is `null`.

Leg 3 is the one Adrian named as most likely to be violated quietly, and it is the reason the
check exists rather than a comment: when the list comes back empty the temptation is to reach
for a weaker item so there is something to say, and the failure reads like helpfulness.
