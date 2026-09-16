# The abandoned-booking trace — what it would record, BEFORE it records anything

**Not built, not applied.** Adrian: *"The trace has to exist before the feature can. Build the trace
first, separately, and tell me what it records before it records anything."* This is that telling.

---

## The collision, stated first

**The booking path is instance one on the no-trace list.** An abandoned booking leaves **nothing**
today — no row, no event, no counter.

**So: how many abandoned bookings have already happened is NOT ZERO. It is NOT RECORDED.** There is
no number to report and there will not be one for anything that happened before this ships. Any
figure anyone produces for the past is a fabrication.

---

## What it would record — the whole list, nothing else

One row per abandoned booking attempt, written by the booking wizard (`public/hubly.html`), never by
a model:

| column | what it holds | why |
|---|---|---|
| `id` | uuid | |
| `business_id` | whose booking form | the only routing key |
| `started_at` | when the visitor opened the wizard | defines the window |
| `last_seen_at` | the last completed step | what "abandoned" is measured from |
| `furthest_step` | 1–4 (Package / When & where / Your info / Review) | "here is what they got as far as", in the owner's language |
| `name` | text, **verbatim** | |
| `phone` | text, **verbatim** | |
| `email` | text, **verbatim** | |
| `service_name` | what they had selected | the thing to call about |
| `scheduled_date`, `scheduled_time` | the slot they were choosing | |
| `visitor_key` | an opaque per-browser id | **dedupe only** — see below |
| `resolved_booking_id` | set when they come back and finish | so it stops being a lead |
| `became_lead` | boolean | whether it passed the reachable gate |

**It does NOT record:** anything about who the visitor is beyond what they typed, any IP, any
device or browser string, any page-view history. A notification may not report a fact the system
never captured, and the same rule binds the record itself.

---

## Four decisions, each with its reasoning

### 1. THE GATE — reachable, and Adrian's call

Adrian said *"name, phone or email"*. **My recommendation is REACHABLE = phone or email, with name
as enrichment.** A lead with only a name is not actionable: he cannot call "Mike."

**Implement reachable-only; make the other trivially switchable** (one predicate, one constant), and
flag it. If a name-only signal is worth surfacing it surfaces as a **signal**, not as a row in the
leads list where it looks followable.

### 2. WHAT COUNTS AS "PROVIDED" — completed and moved past

**A field the visitor completed and then LEFT — not keystrokes in a field they cleared.** The line is
drawn at the step boundary: values are captured when the visitor **advances past the step that
contains them**, read from the form's own state at that moment. A field typed and then emptied is
empty at the boundary and is not captured; a field typed and left full is.

**How it would be tested:** drive the wizard, type a phone, clear it, advance — assert no phone is
stored. Type a phone, advance, go back, clear it, advance again — assert the stored phone is
removed, not kept. Both legs red-proofed against a keystroke-capture implementation, which passes
the first and fails the second.

### 3. WHEN IN-PROGRESS BECOMES ABANDONED — 30 minutes, and the reason

Not picked for roundness. The booking wizard has **four steps**, and the slowest real path through it
involves the visitor checking their own calendar. **30 minutes** is long enough that a person who
walks away and comes back inside one sitting is still the same attempt (so it does not manufacture
two leads), and short enough that an owner is called while the visitor still remembers doing it.

**It is a floor, not a promise:** the row exists from the first captured field, and `became_lead` is
what flips at the boundary. Nothing is deleted if they return.

### 4. DEDUPE AND RESOLVE

- **One visitor abandoning three times is ONE lead** — keyed on `visitor_key`, then on a matching
  phone/email for the same business. Same disease as apollo-weeds renaming three times in 108
  seconds: **a burst is one intention, not three events.**
- **If they come back and complete, the lead RESOLVES INTO the booking** — `resolved_booking_id` is
  set and it leaves the leads list. It does not sit there as a ghost he keeps chasing.

---

## Labelled as what it is

**A half-finished booking must never render looking like a confirmed job.** In the owner's language,
never ours:

> **Started booking, didn't finish.** Mike · 801-555-0134 · was choosing Full Detail, Thursday 2:00 PM · got as far as their details.

If he calls someone who never actually booked, that is our fault and it is an embarrassing phone
call. The label is part of the row, not a badge that a later renderer can drop.

---

## The line for the visitor — RULED 2026-09-16

**Adrian chose option 1. This is the line:**

> **"If you don't finish, whatever you've filled in goes to {business} so they can follow up."**

### The two that were rejected, and the reasoning, so they are not re-proposed

**Option 3 — *"{business} can see what you started, so they can help if you get stuck."* — REJECTED
PERMANENTLY.** Adrian: *"'so they can help if you get stuck' describes lead capture as customer
support. A euphemism in the one sentence whose entire job is honesty is the wrong instinct."*

That is the rule, not just the verdict: **this sentence exists to be honest about what we do with
what they typed.** Softening it into a story about helping them is worse than saying nothing,
because it spends the credibility that the disclosure was supposed to earn.

**Option 2 — *"Leave your name and number and {business} can pick this up with you if you don't
finish."* — REJECTED.** It is an **ask, not a disclosure**, and it says nothing about what they have
*already typed* — which is the whole fact being disclosed.

## Grounding does not apply here, and that is deliberate

These values come from the **visitor's own keystrokes**, not from a model reading a message.
`timeGrounded` / `phoneGrounded` / `addressGrounded` exist to stop a MODEL writing a value nobody
said; there is no model in this path.

**Store what they typed, verbatim. The model never touches these values** — not to normalise, not to
complete, not to "clean". A phone that looks wrong is shown **as the visitor typed it**, flagged,
never corrected. A corrected phone number is a number nobody gave us.

---

## Carry-forward — answered once for this and for A2

Measured: `jobs.customer_id` is set on **3 of 259 rows (1.2%)**. So the link from a customer record
to a job is almost never made today. Whether carry-forward ever existed in the old SaaS is **not yet
established** — it needs the same git-history pass that found `ead44be`, and it is not in this round.
