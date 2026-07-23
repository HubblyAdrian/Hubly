# Hubly v1.0 — First 100 Customers

One question only:

> **What must be true before we can charge our first 100 customers?**

Not 1,000. Not enterprise. The first 100 local service businesses who trust Hubly to run their business.

Source of progress: [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md)  
Architecture is frozen. Do not expand scope past this document for v1.

---

## v1.0 is complete when

A new owner can:

1. Describe their business  
2. Get a live website + booking  
3. Connect calendar + payments (+ domain workflow when ready)  
4. Receive real customers  
5. See Hubly Daily every morning  

…and stop using another website platform.

A homeowner can:

1. Describe a job  
2. Get booked and pay  
3. The business is notified  

That is the product. Everything else waits.

---

## Required for v1 (charge the first 100)

| Area | Must be dependable |
|---|---|
| **AI onboarding** | Owner describes business → company is created |
| **Website publishing** | Publish → site is live, no manual rescue |
| **Booking** | Availability → select time → confirm → owner notified |
| **Payments** | Stripe end-to-end: success, failure, refund, receipt |
| **CRM** | Customers and jobs from bookings/leads without re-entry |
| **Calendar** | Google Calendar sync: create, update, reschedule, delete, conflicts |
| **Email** | Booking confirmations, reminders, lead + owner notifications |
| **Domain workflow** | Business Launch knows Domain connection is required (connector only) |
| **Hubly Daily** | Owner homepage: today, health, one auto action, one owner action |

Cross-check: every row above must be checked in [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md) under Business Created / Business Launched / First Customer / Business Running (Daily).

---

## Not required for v1

Do **not** block the first 100 on these:

- AI Marketing automation  
- Autonomous Growth  
- Google Ads / Meta Ads publishing  
- Multi-location management  
- Advanced analytics dashboards  
- Accounting integrations  
- Weekly Learning / DNA evolution polish  
- Living Marketplace sophistication  
- Multiple domain registrars  

These are Milestone 5 / post-v1. Build them only after v1 rows are dependable.

---

## What “charge” means

We can ask for money when:

1. A beta owner can operate a week without another website tool  
2. At least one real customer has booked and paid through Hubly  
3. Failures return honest Connection / error states — never fake success  
4. Support can answer “where did you get stuck?” from real usage, not guesses  

Until then: finish Business Launched checklist items in order.

---

## Engineering contract for every PR

1. Move **one** [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md) item from incomplete → complete  
2. Do not create new systems unless that item requires it  
3. Do not skip ahead in the Business Launched order  
4. Success = checklist boxes checked, not PR count  

Sprint question:

> What is preventing a customer from trusting Hubly with their business?

Fix that. Repeat.

---

## After v1

Stop asking Cursor what to build next.

Ask customers:

> Where did you get stuck?

That becomes the roadmap.
