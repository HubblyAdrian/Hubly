# Can the right column be real today? — measured 2026-09-15

Adrian's question, exactly as asked: *"CAN THE RIGHT COLUMN BE REAL TODAY for any business we
have? Give me the honest number of businesses whose timeline would render with more than their
jobs on it."*

## The honest number: **2 of 41 claimed businesses. Both are test businesses. Zero are market.**

| business | timed jobs | blocks | calendar events | timed tasks | recurrences | timeline beyond jobs? |
|---|---|---|---|---|---|---|
| `hubly-classic-fixture` (test) | 1 | 1 | 0 | 1 | 0 | **yes (2)** — and I created both, on 2026-09-14/15 |
| `canyon-ridge-tree-care` (test) | 1 | 1 | 0 | 0 | 0 | **yes (1)** |
| `graefs-autocare` (**market**) | 2 | 0 | 0 | 0 | 0 | **no** |
| every other claimed business | 0–1 | 0 | 0 | 0 | 0 | **no** |

**You suspected zero. It is two, and both are ours.** For every real business the right column
would render their jobs and nothing else — which on Graef's day means two completed jobs from
August and an empty today.

## Why: every door into the timeline is shut

| source of a timed item | rows in the entire database |
|---|---|
| `google_calendar_events` | **0** |
| `google_calendar_connections` | **0** |
| `recurring_schedules` | **0** |
| `memberships` | **0** |
| `customers.recurring_cadence` | **0** |
| `tasks` (all, across 197 businesses) | **1** — the one I created testing the add row |
| `jobs.is_recurring` / `recurring_schedule_id` | **0** / **0** |

## And the code for all of it is BUILT

**Google Calendar — live code, not a stub.** Seven edge functions, none trivial:
`oauth-start` (130 lines), `oauth-callback` (250), `connection` (219), `sync` (77),
`push-job` (104), `inbound-sync` (85), `webhook` (77). The connect control exists in
`public/hubly.html` — *"Connect Google Calendar"*. **Zero businesses have ever connected one.**

**Recurrence — a real engine with a real scheduler.** `recurring_schedules` carries
`frequency`, `custom_interval_days`, `status`, `start_date`, `end_date`,
`next_occurrence_date`, `preferred_time`, `amount`, `assigned_to`. `hubly-recurring-maintain`
**does generate rows** — it claims a due schedule with a conditional UPDATE and advances
`next_occurrence_date`, which is the correct concurrency-safe shape — and a cron runs it every
30 minutes. `recurring_schedule_engine.ts` and `hubly_booking_execution.ts` both use it.
**Zero schedules exist.** The cron has been running against an empty table.

So the cadence is not "only ever displayed" — **the engine acts on it. Nothing has ever created
one.**

## This is the sixth instance of the same shape

Zero tasks across 197 businesses meant no way in existed. This is that, three more times over:
a calendar integration nobody can be seen to have connected, a recurrence engine with no creator,
and a tasks table with one row. **The code is not the gap. The door is.**

## What it changes about the ranking

**The doors into the timeline come before the timeline's polish.** A beautiful empty right column
would be the seventh instance, and it would be the most visible one — it is half the screen.

Ordering that follows from the measurement:

1. **The three bands always render** (floor 2a) — the centre works with tasks alone, and tasks
   have a door already (the add row).
2. **The paste/screenshot door** (floor 2b) — the only door that fills a real owner's day from
   what he already has, and it reuses `business.addJob`'s path.
3. **Recurrence** — the engine exists; what is missing is a creator and both doors. This is what
   puts *Team meeting*, *Lunch* and *Gym* on a real timeline, and without it the right column is
   nearly empty on a real day.
4. **Calendar import** — measure again before building: the integration is live code with zero
   connections, so the first question is not "does it work" but **"why has nobody connected
   one"**, and that is a door question too.

## What I have not established

- **Whether the Google integration actually works end to end.** Zero connections means it has
  never been exercised against a real account, by anyone. Live code with no use is not the same
  as working code, and I am not calling it either.
- **Why nobody connected one.** The control exists in `hubly.html`. Whether it is reachable, whether
  it errors, and whether any owner has ever been shown it are three separate unmeasured questions.
