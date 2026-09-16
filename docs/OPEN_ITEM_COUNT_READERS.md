# Open, unbuilt — handlers that return collections where the reply states a count

**Opened 2026-09-16. Shape named; nothing started.**

## Why it is open

The record-claim audit deliberately **does not** compare counts against the evidence. A count asserts
*"there are N of these"*, and verifying it means **counting** the evidence, not searching it — a
reader that returns one order returns `{"orders":[{…}]}` with no digit `1` anywhere. String-searching
a count flags every correct count as unsupported, and an instrument whose loudest output is false
positives buries the real case.

Counts still make a reply a record claim, so *"you have 6 bookings"* on a turn where nothing was read
is still `no_reader` — the half predicted to matter most. What is missing is the *comparison*.

## The shape of the fix

**Handlers that will be counted should return the number, not only the list.** Then the audit
compares a figure to a figure.

That is a change to handler return shapes, not to an instrument, which is why it is not being
smuggled in behind one.

## What to measure when it is picked up

**Which handlers return a collection where the reply will state a count.** The candidates, from the
capability registry's readers — not yet verified, which is the first job:

- `get_business_customers` / `get_business_customer_count` — a count reader **already exists** here,
  which suggests the pattern is known and applied unevenly
- `get_business_tasks`
- `hcLoadJobs` / the jobs readers
- `get_business_events`
- the commerce readers (`commerce_orders`, order items)
- `get_public_business_services` and the two service stores

The existence of `get_business_customer_count` beside `get_business_customers` is the strongest hint
that this is a **known** shape with one instance built — the same "one composer per scar" pattern as
the truth composers.

## Not to be confused with

The **"on your page"** problem, which is separate and larger: 79 of 89 record claims are state
claims, and the commonest state is about the rendered page, which no reader answers today. That waits
on the one service reader and the two-store divergence.
