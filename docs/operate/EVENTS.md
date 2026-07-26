# Rule #17 — Event-Driven Architecture  
# Rule #18 — Business Events Are Immutable

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

**Rule #18:** Once a business event occurs, it is recorded as history and never rewritten.  
Append to the activity / event log — do not edit past events in place.

Benefits: audit trail · reporting · AI context · debugging.

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
| `deposit.paid` | Revenue | Reports, Customers |
| `invoice.sent` | Revenue | Customers, Reports |
| `invoice.paid` | Revenue | Reports, Customers, Memberships |
| `refund.issued` | Revenue | Reports, Customers |
| `payout.completed` | Revenue | Reports |
| `invoice.voided` | Revenue | Reports |
| `membership.started` | Memberships | Customers, Pipeline, Revenue |
| `membership.renewed` | Memberships | Revenue, Reports |
| `membership.cancelled` | Memberships | Revenue, Reports |
| `membership.paused` | Memberships | Reports |
| `membership.visit_used` | Memberships | Jobs (read), Reports |
| `review.requested` | Reviews | Marketing, Ask Hubly |
| `review.received` | Reviews | Storefront (read), Marketing, Reports |
| `review.responded` | Reviews | Reputation analytics |
| `reputation.changed` | Reviews | Reports, Ask Hubly |
| `campaign.sent` | Marketing | Reports |
| `customer.created` | Customers | Marketing, Pipeline |

Payloads are plain objects with ids/references only (Rule #15 / #19) — never whole duplicated entities.

---

## Immutability (Rule #18)

1. `HublyEvents.publish` **appends** a frozen history entry. Do not mutate `recent()` entries.  
2. Module activity logs (e.g. `S.membershipsOs.activity`, visits, renewals) are **append-only**.  
3. Correcting a mistake = publish a **new** compensating event (cancel, renew, pause) — never rewrite the original.  
4. `clearHistory` is **test-only** and must not be used by product modules.  
5. Locked modules are not mass-refactored unless reopened.

---

## Stage 1 rules

1. New modules **must** publish relevant events when mutating owned data.  
2. Cross-module side effects prefer `HublyEvents.on` over direct function calls into another module.  
3. Locked modules are **not** mass-refactored to events unless reopened; new publishers/subscribers are additive.  
4. Stage 1 may use in-process pub/sub only (no external bus).  
5. Never claim live Stripe / Google / Facebook sync until Stage 2.

---

## Reviews (Module 9) publishes

| Event | When |
|-------|------|
| `review.requested` | Owner sends a review request (OS) |
| `review.received` | New review recorded (manual/OS ingest) |
| `review.responded` | AI or owner reply saved |
| `reputation.changed` | Rating / response-rate KPIs recalculated |

Reviews **reads:** Customers, Jobs, Marketing.  
Reviews **owns:** `S.reviewsOs`.

---

## Memberships (Module 10) publishes

| Event | When |
|-------|------|
| `membership.started` | Subscriber enrolled on a plan |
| `membership.renewed` | Period renewed (OS) |
| `membership.paused` | Membership paused |
| `membership.cancelled` | Membership cancelled |
| `membership.visit_used` | Included visit consumed |

Memberships **reads:** Customers, Jobs, Revenue (refs only).  
Memberships **owns:** `S.membershipsOs` (plans, subscribers, billing rules, included-service refs, visits, renewals, activity).
