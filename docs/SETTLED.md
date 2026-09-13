# Settled

**Facts established, closed, and never to be re-asked.** Each is dated and attributed. If a
line here is wrong, correct it with evidence and re-date it — but do not re-open it with a
question. `npm run brief` prints this file FIRST, before anything else, because prose in a doc
nobody opens is how the `supabase db push` ban survived three weeks while a deploy script ran it.

---

**1. HUBLY IS THREE PATHS FROM THE LANDING PAGE, NOT ONE — AND THEY SHARE ONE PAGE.**

1. **Website + backend** — a service business: bookings, jobs, customers, planner.
2. **Storefront** — someone selling things: products, training videos, digital goods.
   **A storefront IS a website.** Same model call, same freeform generation. **No separate
   generator, no separate product architecture.**
3. **Marketplace** — someone who needs help and wants to hire a Hubly user. The demand side.

**The difference between 1 and 2 is the button and what is behind it.** A service card's
action is **Book Now** and opens the booking panel. A product card's action is **Buy** and
opens a checkout panel. **Same card, same block mechanism, different action, different panel.**

Consequences that bind every piece of work:
- `docs/BLOCK_SPEC.md` is **the block spec**, not the services spec — image tile,
  name, price, action button. A service and a product are one card with a different action.
- Flow step 9, "add services creates blocks", **generalises to products with no new
  mechanism**: the freeform insert path already clones a donor entry.
- **Whatever we build for the booking panel must not assume booking.** Checkout is the same
  slot.
*(Adrian, 2026-09-13 — correcting a day of work that assumed one path)*

**2. Every row in the database is ours.** Not only the pages and the stock photos — the
bookings, the jobs, the customers, the conversations. `graefs-autocare` is the only live
business, and even its **11 `booking_requests` are test bookings we made**; its 2 jobs are the
owner and a relative. **A row count is never usage.** Any claim about usage names its origin or
is not made. *(Adrian, 2026-09-13)*

**3. Manual job entry is a legitimate feature, not a defect.** An owner takes a call and types
the job in. It stays. A job with no `booking_request_id` is that feature working.
*(Adrian, 2026-09-13)*

**4. Jobs and Customers already have design and backend.** Never re-establish whether they are
real features. The open question is only ever which implementation survives.
*(Adrian, 2026-09-13)*

**5. `evergreen-yard-care` is the reference design.** Read it; never re-derive it. Its services
block is transcribed in `docs/BLOCK_SPEC.md`. *(Adrian, 2026-09-13)*

**6. The claimed rail is Home, Website, Settings.** Planner, Jobs and Customers appear only
when earned via `business_places`. *(Adrian, 2026-09-13)*

**7. Every tab is its own conversation.** Home holds everything; a tab holds only what was said
in that tab. *(Adrian, 2026-09-13)*

**8. Booking is a panel on the business's own page, never a separate page.**
*(Adrian, 2026-09-13)*

**9. `hubly-paging-fixture` is a test fixture, not a business.** 250 customers, 250 jobs, 250
booking_requests, owned by evergreen's owner so the existing session can reach it. It exists
because the only live business is smaller than every page limit we ship. **Exclude it from
every corpus count, or say that you did not.** Details and its three first-run findings:
`docs/PAGING_FIXTURE.md`. *(built 2026-09-13)*

**10. THE TAB IS CALLED MY DAY, NEVER PLANNER, in anything user-facing.** The code may still
say `planner` — the rail label, the greeting, the docs and every sentence Hubly speaks say
**My Day**. *(Adrian, 2026-09-13)*

**11. THE PRODUCT CONCEPT, and it settles every future "where does this go" argument:**

> **Home tells you what matters. My Day tells you what you need to do. Chat lets you ask
> anything. Workspace lets you do the work.**

*(Adrian, 2026-09-13)*

**12. THE LAYERING — Home is the entry/context layer; detailed views live in tabs/workspaces.**

A job or lead arrives → it appears on **Home** → the **right side of Home** shows more → a
button there opens the **full tab/workspace**.

**The existence of underlying rows/data does not automatically mean a new navigation tab should
appear.** The tab/capability becomes visible when the owner actually has a reason to use it, or
has entered that workflow. **Do not use the existence of rows, or the `business_places` earning
rule, as the sole reason to paint a tab on the navigation rail.**

Home is where the owner discovers and understands what needs attention; My Day, Jobs, Calendar,
Website and Store are where the owner goes to work in detail. *(Adrian, 2026-09-13)*
