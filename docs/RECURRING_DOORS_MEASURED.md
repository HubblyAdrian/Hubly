# The recurring engine has ONE live door, and it explains the empty table

**Measured 2026-09-16, before building anything.** Adrian's instruction was *"open the two creation
doors on recurring_schedules and hubly-recurring-maintain, the engine that already exists on a
30-minute cron against an empty table. DO NOT BUILD A SECOND ENGINE."* The measurement changes what
the work is, so it is reported before the work.

---

## The engine is whole, and one creation path is already LIVE

`recurring_schedules` — **0 rows**. 19 columns: `frequency`, `custom_interval_days`,
`next_occurrence_date`, `preferred_time`, `service_id`, `status`, `start_date`, `end_date`, and the
customer/service/amount/address fields a generated job needs.

**The creation path exists and is reachable** — `_shared/hubly_booking_execution.ts:319`. When a
booking arrives carrying a valid `frequency`, it looks for an existing active schedule for that
customer+service, and if there is none it **inserts one**, computing `next_occurrence_date` as the
date *after* this first job so the cron does not immediately generate a duplicate for the same day.

**And a capability already passes it.** `createBooking` in the registry takes
`frequency: weekly | biweekly | monthly | quarterly`, with instructions that are exactly right:

> *"Only set frequency when the customer explicitly said they want this to repeat (e.g. 'every
> month') — never infer or default it; omitting it creates a normal one-time booking."*

**So the table is not empty because the engine is doorless. It is empty because the only live door
is a CUSTOMER volunteering "every month" while talking to the booking assistant** — and no customer
ever has. That is a door nobody has walked through, which is a different problem from a door that
does not exist, and it needs a different fix.

---

## The two doors that genuinely do not exist

### 1. The booking wizard never asks

`public/hubly.html`'s four-step wizard collects no cadence at all — grep for `frequency` across its
step markup and payload returns nothing. A customer booking through the **form** (which is what the
507 `?book=1` links reach) cannot say "every month" even if they want to. Only a customer who
*types it in chat* can.

### 2. The OWNER cannot make a job recurring

There is no owner-side capability that sets a frequency on a job, and no control that does it by
hand. `createBooking` is the **customer** path. So the sentence Adrian wants — *"make this
recurring"*, said by the owner about his own job — has nowhere to land.

This is the one that matters for My Day: the owner is the person with the standing weekly mow, and
he is the person who cannot say so.

---

## What this means for the build

**Do not build a second engine — there is nothing to duplicate.** Both missing doors are inputs to
the engine that exists:

1. **the wizard** — one question, and it passes `frequency` into the path that already handles it.
2. **the owner's words** — a capability that writes a `recurring_schedules` row for an existing job,
   reusing `computeNextOccurrenceDate` and the same duplicate-schedule check
   (`existingScheduleConflict`) rather than a second copy of either.

**And the grounding rule binds both**, the same way it binds a time: a cadence the owner did not
state is a cadence nobody said. `createBooking`'s instruction already says it in words — *"never
infer or default it"* — and the owner-side writer must enforce it with the same mechanism, not a
second one.

**Not built in this round.** The measurement is the deliverable, because "the engine is doorless"
was the premise and it is wrong.
