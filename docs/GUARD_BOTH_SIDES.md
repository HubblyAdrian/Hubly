# 0b — a guard on display is not a guard on the record

**Measured 2026-09-16. Reported; one fix shipped, the rest not touched.**

> The class question I asked was *"where else does a string become a bubble"* and it found two
> composers. The question I did not ask was *"where else does a string become a **stored**
> message."* — and that is the whole lesson.

## The two directions, for every value we filter in the shell

| guard | DISPLAY side | PERSIST side | symmetric? |
|---|---|---|---|
| `hcSayable` — our own wire envelope | `hcAppendMessage`, `hcRenderTranscript` | `hcPersist` | **closed 2026-09-16** (it was display-only; the envelope was silenced on screen and stored anyway — `business_conversations` seq 47) |
| `hcIsFallbackReply` | `:2997`, `:3420` | `:9360` | yes |
| `hcIsBuildFiller` | `:3362` | `:9361` | yes |
| `hcIsPreAccountMsg` | `:7833` (transcript), `:9296`, `:9300` (restore) | **absent** | **NO — display only** |

## The one still open: `hcIsPreAccountMsg`

Pre-account messages are **hidden from a claimed owner on every render** and **still written to the
record**. That is the envelope bug's mirror image: the display refuses what the record keeps.

It is milder than the envelope — the harm vector there was *showing* machine output — but it is not
nothing, and the reason is specific:

**The filter is re-applied at every read, forever, by every reader that remembers to apply it.** A
reader that does not is a reader that sees them. `hcRenderTranscript` and the restore loop both
remember. **The open question, not yet measured: does the history handed to the MODEL filter
them?** If it does not, Hubly can reason about — and refer to — messages the owner cannot see on
their own screen, which reads as the product knowing something it will not show.

**Not fixed.** The right fix is probably not another call site; it is deciding whether these rows
should exist after a claim at all, and that is a data decision, not a filter decision.

## The server side, and a different asymmetry

The grounding guards (`phoneGroundedWhy`, `priceGrounded`, `addressGrounded`, `serviceGrounded`,
`reconcileServices`) are **write-side only, by design** — they stop a value being *published* that
the owner did not state this turn.

**There is no matching read-side guard**: nothing programmatic stops the model *saying* an
ungrounded phone number or price in its reply. That is held today by prompt instruction alone
("never state what you weren't told"). The write side is enforced by code; the read side is
enforced by asking nicely.

That asymmetry is defensible — a spoken number is not a published one — but it should be a choice
we made rather than a gap nobody listed, so it is written down here. The cost of the read side
being wrong is an owner acting on a number Hubly invented in conversation; the cost of the write
side being wrong is a customer acting on one.

## The rule to apply next time

**For every value we guard, name both verbs before calling it guarded: what DISPLAYS it, and what
PERSISTS it.** Two of the four in this table were symmetric by luck of being written at the same
moment; one was not, and the one that was not shipped a defect that survived the fix, the check and
the deploy.

---

# RULING A — answered, fixed, and the data decision measured

## The question: does the history handed to the model filter them? **NO — it did not.**

`public/platform-home.html`, the restore:

```js
hc.messages = rows.map(function(m){ return { role: m.role, content: m.content }; });   // ← every row
…six lines later…
if(hc.draftClaimed && rows[i].role !== 'user' && hcIsPreAccountMsg(txt)) continue;      // ← display only
```

`hc.messages` is handed to the model verbatim as `messages:`. **So the model read them and the
owner could not see them.** Hubly could reason about, and answer from, messages the owner believes
are gone — and an owner cannot correct a fact they cannot see. The severe reading, confirmed.

## Fixed at the history reader, with one predicate

`hcHiddenFromOwner(role, txt)` is now consulted by **both** the history seed and the render, so they
cannot drift — which is exactly how this arose: one rule, written once, applied in one of the two
places that needed it. `scripts/check-model-sees-what-owner-sees.mjs`, 7 assertions.

**Red-proofed** — and the first attempt at leg 5 was a **no-op**: it searched 200 characters forward
from `hc.messages = rows` for `hcHiddenFromOwner`, and the *render's* call sits six lines below,
inside that window. Removing the filter from the seed left the leg green because it was matching a
different line. Tightened to the seed expression alone; now: seed unfiltered → FAIL 5, render given
its own inline copy → FAIL 6, 7.

## The data decision — READ-ONLY, nothing deleted, yours to make

**19 rows, on 19 claimed businesses — exactly one each. 3 of those businesses are `market`.**
Those businesses carry 12.4 conversation rows on average.

The three market rows, verbatim:

| business | seq | content |
|---|---|---|
| `detailing-chemicals-equipment-courses` | 3 | *"That's your site. The address …myhubly.app is reserved for you — it goes live the moment you make an account."* |
| `mobile-auto-detailing-in-los-angeles` | 3 | *"That's your site. The address …myhubly.app is reserved for you — it goes live the moment you make an account."* |
| `window-washing` | 10 | *"You can edit by just telling me what to change here — text, prices, services, contact info, or which photo should be swapped. If you want to click directly on the page and edit it yourself, **that takes an account**, and I can open that for you now."* |

### The third one is a false positive, and it changes the decision

**`window-washing` seq 10 is not a pre-account offer.** It is a genuinely useful message explaining
how to edit, which happens to contain the phrase *"that takes an account"*. The matcher is
content-based, so **it hides a real message** — from the owner's screen today, and now from the
model as well, because I made the two agree.

Making them agree was still right: a reader that sees what the owner cannot is the worse defect.
But it means the fix propagated an existing over-match rather than introducing one, and **1 of 3
market instances is a wrong hide** — a 33% false-positive rate on the market set, off a sample of 3.

### What breaks: filter vs delete

| | filter (today) | delete |
|---|---|---|
| the two genuine offers | invisible to owner and model — correct | gone; same outcome, less machinery |
| **`window-washing` seq 10** | **wrongly hidden, recoverably** — a better matcher restores it | **wrongly destroyed, irrecoverably** |
| the conversation's `seq` continuity | untouched | gaps, and `_append_conversation_rows` allocates `max(seq)+1`, so gaps are survivable but the record no longer shows what was said |
| audit / support | the row is still there to read | nothing to read |

**My reading, for what it is worth:** deleting is the destructive option and the tie does not go to
it — the standing rule. And the false positive is the argument: a filter that is wrong once in three
is a filter to *improve*, not a delete to *run*. A content matcher that decides what is destroyed is
the wrong mechanism; if these rows should not survive a claim, the right marker is one stamped at
write time (as `data-hc-msg="preaccount"` already is on the live path), not a regex applied years
later.

**Nothing deleted. Nothing reclassified. Awaiting your ruling.**

---

# Does a claim date exist? **NO — and none can be derived reliably.**

Measured read-only, 2026-09-16, before proposing anything.

| candidate | verdict |
|---|---|
| **`draft_claims.claimed_at`** | the column exists. **The table holds 0 rows** against 41 claimed businesses. The live claim RPC — `claim_draft_business`, read from `pg_proc` — does `update public.businesses … owner_id = v_uid` and **never touches `draft_claims`**. The table belongs to a superseded path (the `claim-draft-business` edge function). A dated claim we never recorded. |
| **`hubly_owner_profile.created_at`** | covers **17 of 41** claimed businesses (10 profiles, 29 distinct owners). And it is **per-owner, not per-business**: 4 owners hold 2 businesses and 2 hold 5, so one date cannot date two claims made months apart. |
| **a claim event in `business_events`** | none exists — zero rows matching claim/signup/account. |
| **`businesses.updated_at`** | moves on every later update, so it dates the most recent edit, not the claim. |

**So the branch is the second one: say so plainly.** There is no fact to derive from today.

## But it is one column away, and that is cheaper than a per-row marker

The write-time marker is the fallback you named, and it works. **I think there is a better version
of the same idea**, and it is strictly less machinery:

**`businesses.claimed_at`, written by `claim_draft_business` at the moment it sets `owner_id`.**

Then hidden-from-owner becomes `row.created_at < business.claimed_at` — **a timestamp comparison,
derived from a fact we hold, exactly as ruled.** The regex goes.

| | per-message marker | `businesses.claimed_at` |
|---|---|---|
| storage | one column on every conversation row, forever | one column, once per business |
| written by | every writer of a message, correctly, every time | one RPC, at the one moment the fact becomes true |
| can be wrong | yes — a writer that forgets | no — if the claim happened, the timestamp is the claim |
| fixes the 19 existing rows | no | no |

Neither fixes the existing 19: a business claimed before the column existed has no date. **That
backfill is a separate decision and it is yours.** A defensible backfill exists — the claim
necessarily happened at or before the first *post*-claim behaviour on the record — but it is an
inference, and an inference deciding what an owner can see is the thing we are trying to stop.

**Nothing built. Nothing written. Recommending `businesses.claimed_at`; awaiting the ruling.**

## The window-washing row, tracked so it is returned

Until a claim date exists, `window-washing` seq 10 stays wrongly hidden — from the owner and now
from the model. It is one of the few places we teach the three doors:

> *"You can edit by just telling me what to change here — text, prices, services, contact info, or
> which photo should be swapped. If you want to click directly on the page and edit it yourself,
> that takes an account, and I can open that for you now."*

**When the derivation lands, this row must become visible again, and the report will say so
explicitly** — the mechanism changing is not the same as the message being returned.
