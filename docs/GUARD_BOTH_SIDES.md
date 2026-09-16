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
