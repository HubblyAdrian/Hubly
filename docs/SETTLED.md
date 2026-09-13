# Settled

**Facts established, closed, and never to be re-asked.** Each is dated and attributed. If a
line here is wrong, correct it with evidence and re-date it — but do not re-open it with a
question. `npm run brief` prints this file FIRST, before anything else, because prose in a doc
nobody opens is how the `supabase db push` ban survived three weeks while a deploy script ran it.

---

**1. Every row in the database is ours.** Not only the pages and the stock photos — the
bookings, the jobs, the customers, the conversations. `graefs-autocare` is the only live
business, and even its **11 `booking_requests` are test bookings we made**; its 2 jobs are the
owner and a relative. **A row count is never usage.** Any claim about usage names its origin or
is not made. *(Adrian, 2026-09-13)*

**2. Manual job entry is a legitimate feature, not a defect.** An owner takes a call and types
the job in. It stays. A job with no `booking_request_id` is that feature working.
*(Adrian, 2026-09-13)*

**3. Jobs and Customers already have design and backend.** Never re-establish whether they are
real features. The open question is only ever which implementation survives.
*(Adrian, 2026-09-13)*

**4. `evergreen-yard-care` is the reference design.** Read it; never re-derive it. Its services
block is transcribed in `docs/SERVICES_BLOCK_SPEC.md`. *(Adrian, 2026-09-13)*

**5. The claimed rail is Home, Website, Settings.** Planner, Jobs and Customers appear only
when earned via `business_places`. *(Adrian, 2026-09-13)*

**6. Every tab is its own conversation.** Home holds everything; a tab holds only what was said
in that tab. *(Adrian, 2026-09-13)*

**7. Booking is a panel on the business's own page, never a separate page.**
*(Adrian, 2026-09-13)*

**8. `hubly-paging-fixture` is a test fixture, not a business.** 250 customers, 250 jobs, 250
booking_requests, owned by evergreen's owner so the existing session can reach it. It exists
because the only live business is smaller than every page limit we ship. **Exclude it from
every corpus count, or say that you did not.** Details and its three first-run findings:
`docs/PAGING_FIXTURE.md`. *(built 2026-09-13)*
