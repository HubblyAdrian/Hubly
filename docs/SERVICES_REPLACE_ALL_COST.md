# The silently short list — costing the two options, and the one I recommend

**The defect.** `set_business_draft_services` is replace-all. `reconcileServices` walks only the
list the model hands it, so a service that exists on the record and is missing from that list is
not dropped as a lift and not preserved — it is simply absent from the write, and it is gone.
The only thing standing between an owner's services and that is a sentence in the action's
description: *"Pass the COMPLETE current list every time."*

**Why it is worse than the delete asymmetry it resembles.** Nobody invoked a delete. The owner
says *"add ceramic coating"*, the model returns a list missing three, and three services are gone
from a live page. He finds out when a customer asks for one. `deleteBlock` at least has an
owner who asked and a reply that names what went.

---

## Option 1 — REFUSE THE WRITE when the list is short

If the model's list omits an existing service, write nothing and say so.

| | |
|---|---|
| **Safety** | total. Nothing is ever lost. |
| **Cost to the owner** | the add he asked for does not happen, because of a defect of ours. He hears "I couldn't" for something we could have done. |
| **Cost to the product** | **removal becomes impossible through this path.** An owner saying *"drop the ceramic coating"* produces exactly the same shape — a list one shorter — so the refusal fires on the legitimate case too. Making removal work again needs a new op, a schema change, and model instruction. |
| **Frequency** | unknown and unmeasured: we do not record how often the model's list is short. |

## Option 2 — PERFORM IT, NAME EVERY REMOVAL in the reply

Keep replace-all. The reply says what went and how to undo it.

| | |
|---|---|
| **Safety** | none at write time. The services are already gone; recovery depends on the owner reading a sentence in a chat reply and acting on it. |
| **Cost to the owner** | on the accidental case he reads *"I also removed Gutter Clearing, Window Washing and Pressure Washing"* about services he never mentioned — a receipt for a mistake, not a confirmation. |
| **Cost to the product** | it breaks the standing rule directly: **a default that destroys work is never acceptable, even when the alternative is ambiguous.** A good message about a destructive default is still a destructive default. |
| **Upside** | cheapest to build; removal keeps working exactly as it does now. |

## RECOMMENDED — Option 3: refuse the REMOVAL, not the write

Preserve every existing service the message does not name. Remove only what the owner actually
named. Say both halves.

- **It is the refusal before the ability**, applied to existence rather than to price. The
  reconciler already does exactly this one field over: an ungrounded PRICE cannot overwrite the
  record's price. An ungrounded ABSENCE should not overwrite the record's existence. Same rule,
  same machinery, one more dimension.
- **It does not block the add.** The owner's ceramic coating lands; the three the model forgot
  stay. Nothing the owner asked for is refused.
- **Removal still works.** *"Drop the ceramic coating"* puts the name in the message, so that
  removal is grounded, performed, and named in the reply.
- **The one case it costs a turn:** *"get rid of everything except mowing"* names no removals
  individually, so they are preserved and Hubly says so and asks which to remove. One extra
  turn, in the direction that keeps the work — which is the tie-break this codebase already
  rules on.
- **What it cannot do:** tell an accidental omission from a deliberate one when the owner names
  the service for a different reason in the same message. That is the same limit `serviceGrounded`
  already has, and it fails toward keeping.

**Cost to build:** the reconciler returns two more lists (`removed`, `keptBack`), both call sites
pass the preserved set through, and the truth composer names removals and preservations. Roughly
fifty lines and one check leg, red-proofed on a list that is SILENTLY SHORT — a model list of two
against a record of five — because an empty list is the case everything already handles.
