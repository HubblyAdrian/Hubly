# Hubly Launch Checklist

Not a technical checklist. A **customer checklist**.

For every item:

> **Could a real business earn money with this today?**

Architecture, V1, and this checklist are frozen.
We optimize **complete business transactions** — not isolated capabilities.

Do not think in Booking / Payments / Calendar / Email.
Think: **A customer hired a business.**

---

## North Star

**Revenue generated through Hubly-powered businesses.**

### Three success questions

1. Can a business launch?  
2. Can a customer pay?  
3. Can the owner run their business every day without leaving Hubly?  

When all three are **yes**, deeper AI becomes a force multiplier — not a prerequisite.

---

## How to use this file

Every sprint should end with something measurable:

- A customer successfully booked  
- A payment completed  
- A review was requested  
- A repeat customer returned  

Before merge: *Could a real business owner make more money because of this?*

---

## Milestone 1 — Business Created ✅

Owner describes business → company exists in Hubly.

---

## Milestone 2 — Business Launched

Publishing + hire path foundations (site → request → notify → Hubly).

| Dependable today? | Customer proof |
|---|---|
| [x] | Website publishes reliably |
| [x] | Hire path works (request, honest Stripe, notify, CRM on accept, calendar push) |
| [ ] | Full Business Launched (payments E2E, calendar conflicts, reminders, domain workflow, leave other platforms) |

---

## Milestone 3 — First Customer ★ CURRENT PRIORITY

**Definition of Done:** A homeowner can discover a business, book, pay, receive confirmation, and the owner can complete the job **without leaving Hubly**.

### One production workflow (customer)

Discover → view services → select package → choose time → pay deposit/full → confirmation → reminders → completion follow-up → leave review

### One production workflow (owner)

Notification → accept → calendar updates → CRM updates → job created → timeline/feed updates → payment tracked → completion → review request → Business Health updated

### Revenue loop Hubly must own

Lead → Booking → Payment → Job → Completion → Review → Repeat customer → Membership/recurring (where applicable) → Referral

| Dependable today? | Customer proof |
|---|---|
| [x] | **Owner Feed** shows chronological Hubly activity from real hires (bookings, payments, calendar, CRM, reminders, reviews) — proof Hubly works while the owner is away |
| [x] | Hubly Daily is advice-first (schedule, leads, payments waiting, follow-ups, health, one recommendation, one automatic action) |
| [x] | Reminders send before the job (today/tomorrow sweep when the owner opens Hubly) |
| [x] | Completion follow-up + review request without leaving Hubly (auto-email on complete; SMS draft if phone-only) |
| [x] | Business Health tracks leads, booking rate, payment success, completion, reviews, repeat rate, revenue, response time |
| [x] | Customer can pay deposit/full — webhook marks paid/failed/refunded; receipt + CRM + job payment + Health/Feed update (no manual Mark paid required) |
| [ ] | **★ Production payment proof** — live hire: success / fail / expire / refund / receipt / CRM / Feed / Health ([`PRODUCTION_PAYMENT_PROOF.md`](./PRODUCTION_PAYMENT_PROOF.md)) |
| [x] | Calendar conflict detection via `get_busy_windows` at book / accept / reschedule; cancel + Google pending flush |
| [ ] | Full First Customer loop closed with a real paid job in production (blocker #1) |
| [ ] | Calendar timezone + sync reliability fully proven in production (blocker #2 remainder) |

**Milestone done when:** Hubly has helped a business earn revenue through this uninterrupted flow.

---

## Milestone 4 — Business Running

Owner operates the company from Hubly every day.

| Dependable today? | Customer proof |
|---|---|
| [ ] | Daily + Feed + Jobs + CRM + Money cover the day without other tools |
| [ ] | Messaging works for real customers |
| [ ] | Calendar stays synchronized (reschedule/delete/conflicts) |

---

## Milestone 5 — Business Growing

AI Coach · Marketing · Living Business · Living Marketplace · Weekly Learning  

Only after launch + first revenue + daily operation.

---

## Owner Feed (permanent surface)

Not a dashboard. Not analytics.

A chronological feed of everything Hubly is doing — like a GitHub activity feed for the business.

Owners should immediately see that Hubly worked while they were away.

---

## Business Health (target metrics)

Leads created · Booking rate · Payment success · Job completion · Review rate · Repeat rate · Revenue · Response time  

Every AI Coach recommendation should improve one of these.

---

## Connector rule

Missing Connection → **Connection required**. Never fake success.
Runtime never contains vendor-specific registrar code.
