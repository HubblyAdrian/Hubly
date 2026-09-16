# A job's time is grounded in what he said — measured first, then built

`supabase/functions/_shared/hubly_grounding.ts` · `scripts/check-time-grounded.mjs` ·
deployed 2026-09-16 (`hubly-conversation`, `hubly-document-build`)

---

## THE MEASUREMENT, BEFORE THE GUARD

Adrian asked two questions before anything was written. The first cannot be answered, and saying so
is the answer.

### "How many were set by a model turn vs. by hand?" — NOT RECORDED. Not measurable.

`jobs` has **no `updated_at`**, no `created_by`, and no source column. The columns that speak to
origin are `from_booking`, `booking_request_id`, `google_event_id` and `sync_origin` — all about the
booking wizard and the calendar, none about a model turn versus the by-hand editor, which write the
**same column through the same RPC** (`update_business_job`). So the split cannot be produced from
the rows, retrospectively or otherwise.

What *can* be measured is **creation**, because `jobs.created_at` exists: a job created within a
short window of an owner message can be attributed to that turn. A later *change* to the time leaves
no trace at all — no-trace instance #4 in `OPEN_FINDINGS.md`.

### "Of the model-set ones, how many have a time NOT in the owner's message?" — ZERO. Every row printed.

**259 jobs. 9 have a `scheduled_time` at all.** Small enough to print all nine rather than summarise.
Verdicts are from the shipping `timeGroundedWhy`, executed against each row's real preceding turns.

| business | job | time | attributable | verdict |
|---|---|---|---|---|
| `graefs-autocare` (**market**) | Full Detail | 10:00 | no — `from_booking` | — |
| `graefs-autocare` (**market**) | Premium Detail | 11:00 | no — `from_booking` | — |
| `adrians-lawn-service` | Lawn Mowing | 13:00 | no — no preceding owner message | — |
| `canyon-ridge-tree-care` | dentist appointment | 12:00 | yes, 7s | **GROUNDED** — *"Tomorrow I have a dentsist apoointment at 12 Pm add that"* |
| `canyon-ridge-tree-care` | window cleaning | 14:00 | yes, 6s | **GROUNDED** — see the split below |
| `crestview-window-cleaning` | Interior + exterior | 09:30 | no — nearest message is 2.1 days earlier | — |
| `hubly-classic-fixture` | driveway | 17:00 | *hand-edited after the walk* | **excluded** — see below |
| `hubly-classic-fixture` | doctor's appointment | 07:00 | yes, 7s | **GROUNDED** — *"…tomorrow at 7 AM"* |
| `hubly-classic-fixture` | window washing | 20:00 | yes, 5s | **GROUNDED** — *"i meant 8"*, after Hubly offered 8:00 PM or 2:00 PM |

**Zero rows hold a time the owner never stated.** The guard ships as a **guard, not a repair.**

**The driveway row is excluded and it is not a near-miss.** Its `17:00` is Adrian's own hand edit
made after the walk. Its **creation** value was `14:00` — recorded independently in
`scripts/check-day-is-reachable.mjs` on 2026-09-15 — from *"Thursday at 2 to do the driveway"*. That
write was correct. **The guard would nevertheless have turned it into a question**, because a bare
"2" is 02:00 or 14:00 and nothing in that message settles it. That is the guard working: one extra
turn, in the safe direction. It is stated here rather than buried, because it is the cost.

### THE THING THE MEASUREMENT CHANGED — Hubly splits the statement itself

`canyon-ridge-tree-care`, seq 18–20:

```
owner   "add a job for tomorrow at 2:00 PM"
Hubly   "What's the job for?"
owner   "window cleaning"          <- the job is written here, at 14:00
```

A strict *"the time must be in THIS message"* rule refuses a time the owner plainly gave, because
**our own question pushed the service name into a separate message.** Reading only the first design
would have shipped a guard that punished him for our follow-up. This was found by reading the turns
around the row instead of the row alone.

---

## THE GUARD

**Unambiguous or nothing.** "2 PM" states 14:00. A bare "2" does not — it is 02:00 or 14:00 and the
difference is twelve hours. Reading a bare hour as the convenient one is the direction that says
"this is fine" and is silent when wrong, so it **refuses and asks**.

**The source set, and its boundary:**

| source | when it counts |
|---|---|
| this message | always |
| the owner's **previous** message | **only** when Hubly's turn in between was a **question** — the one case where the split is ours |
| times **Hubly itself named** in that question | only to settle a bare hour ("i meant 8" → 20:00 when we offered 8:00 PM or 2:00 PM), and only when exactly one offered time has that hour |

Nothing reaches a third turn back, which is where a different job's time lives.

**Twelve is handled explicitly** — 12 AM is 00:00, 12 PM is 12:00, the one place "add 12 for PM" is
wrong twice.

**A value Postgres would throw on is refused before it gets there.** `'4 pm'::time` raises 22007;
that used to reach the database and blow up the call rather than be refused, so a malformed time was
an exception instead of a question.

**A refused time is not written and is asked about.** On a time-only `updateJob` turn the handler
returns `time_ungrounded` rather than letting the RPC report `no_change` — "they did not actually
change anything" would be false and unanswerable. When the hour was the ambiguous part, the refusal
names it so the ask can be specific.

### The limit, named rather than hidden

This checks that the **value came from him**. It cannot check that the model attached it to the right
job or the right field — *"move the 3pm to 4pm"* names two times and no grounding rule can say which
is the new one. That is the matcher's job and the reply's read-back. What this makes impossible is a
time nobody said.

---

## RED FIRST

Per Lesson 89 the direction that says "this is fine" is red-proofed hardest, and per Adrian's
instruction the red was produced before any green count.

**Guard removed (the pre-2026-09-16 pass-through) — 13 assertions fail**, every one a refusal leg:
no time in the message; a bare "2" grounding 14:00; a bare "2" grounding 02:00; "2 PM" grounding
02:00; 12 PM reading as midnight; 12 AM reading as noon; a time from a message we did not interrupt;
a bare hour borrowing a different offered hour; two offered times sharing an hour; an unreadable
value reaching the cast.

**Two targeted red-proofs on the parts that are mine, each landing on its own leg:**

| broken | fails |
|---|---|
| `looksLikeQuestion` always true (the widening loses its boundary) | 4, 5c |
| `pm ? h12 + 12 : h12` (the naive twelve-hour conversion) | 3, 3b |

**Restored: 20 assertions green.** Legs 8/8b/8c assert the writers actually *call* it — a guard
nothing calls is a comment.
