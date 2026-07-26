# Rule #17 — Event-Driven Architecture

Modules **publish** and **subscribe** to business events.  
They do not call each other’s internals.

Runtime: `public/journey-os/hubly-events.js` → `window.HublyEvents`

```js
HublyEvents.publish('job.completed', { jobId, customerId });
HublyEvents.on('review.requested', function (payload) { /* … */ });
```

---

## Why

Rules #14–16 established shared UI, single ownership, and the end-to-end journey.  
Events decouple the journey so Marketing, Reports, and Ask Hubly can react without knowing Reviews/Jobs internals.

---

## Core Hubly events

| Event | Typical publisher | Example consumers |
|-------|-------------------|-------------------|
| `lead.created` | Leads | Inbox, Pipeline, Ask Hubly |
| `lead.qualified` | Leads | Pipeline, Marketing |
| `quote.sent` | Leads / Quotes | Pipeline |
| `quote.accepted` | Leads / Quotes | Jobs, Pipeline |
| `job.booked` | Jobs | Pipeline, Customers |
| `job.started` | Jobs | — |
| `job.completed` | Jobs | Reviews, Marketing, Revenue, Reports |
| `payment.received` | Revenue | Reports, Customers |
| `membership.started` | Memberships | Customers, Pipeline |
| `membership.renewed` | Memberships | Revenue |
| `review.requested` | Reviews | Marketing, Ask Hubly |
| `review.received` | Reviews | Storefront (read), Marketing, Reports |
| `review.responded` | Reviews | Reputation analytics |
| `reputation.changed` | Reviews | Reports, Ask Hubly |
| `campaign.sent` | Marketing | Reports |
| `customer.created` | Customers | Marketing, Pipeline |

Payloads are plain objects with ids/references only (Rule #15) — never whole duplicated entities.

---

## Stage 1 rules

1. New modules **must** publish relevant events when mutating owned data.  
2. Cross-module side effects prefer `HublyEvents.on` over direct function calls into another module.  
3. Locked modules are **not** mass-refactored to events unless reopened; new publishers/subscribers are additive.  
4. Stage 1 may use in-process pub/sub only (no external bus).  
5. Never claim live Google/Facebook review sync until Stage 2.

---

## Reviews (Module 9) publishes

| Event | When |
|-------|------|
| `review.requested` | Owner sends a review request (OS) |
| `review.received` | New review recorded (manual/OS ingest) |
| `review.responded` | AI or owner reply saved |
| `reputation.changed` | Rating / response-rate KPIs recalculated |

Reviews **reads:** Customers, Jobs, Marketing (automation flags / segments).  
Reviews **owns:** review records, requests, replies, reputation analytics (`S.reviewsOs`).
