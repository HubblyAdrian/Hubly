# The paging fixture — `hubly-paging-fixture` (2026-09-13)

**Why it exists.** The only live business has 4 customers, 2 jobs and 11 bookings — under
**every** page limit we ship. Graef hides every paging and empty-state bug we can write, and
he would have hidden them on every screen in the Jobs/Customers merge. The fixture is the
instrument that makes the merge measurable (Lesson 59).

**Sized by the largest limit, not by a round number.** Established from `pg_proc` and the
client on 2026-09-13: `get_business_customers` **8** · `get_business_events` **30** ·
`get_business_notifications` **8** · client reads of `booking_requests`/`jobs` **200** · an
internal cap of **100** inside `get_business_events`. Largest is 200, so: **250 rows per table.**

| | |
|---|---|
| slug | `hubly-paging-fixture` |
| `account_kind` | **test** |
| owner | evergreen's owner, so the existing signed-in session reaches it through the multi-business picker — **no new credentials, nothing to sign into** |
| rows | 250 customers · 250 jobs · 250 booking_requests |
| earned places | website, planner, jobs, customers — earned by the product's OWN predicate (migration `20260909120000` applied scoped to this business), not by a hand-written list |
| removal | `delete from businesses where slug='hubly-paging-fixture'` |

## Safety established BEFORE writing a single row

- **`booking_request_completed_notify` fires on INSERT when `status='pending'` and calls
  `net.http_post`.** 250 pending rows would have been **250 real notifications**. The fixture
  seeds **accepted/abandoned only**; the trigger returns early for those. Verified after the
  write: **0 rows in `notification_deliveries` for this business.**
  **Consequence: the fixture does NOT cover the pending-booking path.** That must be tested
  another way, one row at a time, knowingly.
- **`ensure_marketplace_provider_for_business` fires on INSERT** and creates a provider row.
  It is not customer-visible: `marketplace_status` defaults to `'draft'`, `marketplace_enabled`
  and `featured` default false, and public listings filter on `verified`.
- **`notify_platform_owner_on_claim` fires only on UPDATE** where `owner_id` goes null → not
  null. Inserting with the owner already set does not fire it.

## Three findings on its first run

Exercised through the shared readers, which is the only reason these are visible at all:

| reader | returned | of |
|---|---|---|
| `get_business_customers` (default) | **8** | 250 |
| `get_business_customers` `p_limit: 200` — what the client passes today | **200** | 250 |
| `get_business_customer_count` (server-side) | **250** | 250 ✓ |
| `get_business_events` (default) | **30** | ~500 |
| `get_business_events` `p_limit: 1000` | **100** | ~500 |

1. **The client's `p_limit: 200` is already short at 250 customers**, with no indication in the
   UI. This is D-024's argument made concrete on its first day: a bigger limit is a guess that
   becomes wrong at a size nobody predicted.
2. **`get_business_events` has an INTERNAL CAP of 100** —
   `limit greatest(1, least(coalesce(p_limit, 30), 100))`. No caller can ever read past it. An
   owner with more than 100 events cannot see the rest, and Home's feed truncates silently.
   **This is the surface the entire rail-coverage ruling rests on** (D-019, `RAIL_COVERAGE.md`):
   the claim "Leads are covered because the event feed shows them" holds only for the first 100.
3. **`get_business_customer_count` is correct at 250**, which is why it is the only aggregate
   the Customers merge is allowed to render (D-024).

## The cost of having it

Every corpus count taken from now on includes 250 customers, 250 jobs and 250 booking_requests
that are fixture rows. Before the fixture: jobs 5, customers 17, booking_requests 31.
**Exclude `hubly-paging-fixture` from any corpus measurement, or say that you did not.**
