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

## Connected Apps + Event Bus (Hubly Core)

| Event | Typical publisher | Example consumers |
|-------|-------------------|-------------------|
| `project.created` | Photography Projects | CRM, Timeline |
| `project.booked` | Photography Projects | Calendar, Messaging |
| `project.editing_complete` | Photography Projects | Creative Engine (capability: creative) |
| `project.delivered` | Photography Projects | Creative · Publishing · Reviews · Messaging |
| `gallery.published` | Galleries | Website, Marketing |
| `gallery.delivered` | Galleries / Projects | Creative · Reviews · Messaging |
| `app.connected` | Apps Marketplace | Action Engine, Settings |
| `app.disconnected` | Apps Marketplace | Action Engine |
| `creative.asset_planned` | Creative Engine | Marketing (capability plan) |
| `creative.asset_created` | Creative Engine | Publishing / Scheduling |

**Capability subscriptions:** engines subscribe to events *and* required capabilities (`creative`, `publishing`, `reviews`, …). The Connected Apps registry picks a vendor — AI never hardcodes “Use Canva.”

Shared server contract: `supabase/functions/_shared/hubly_event_bus.ts` · Action Engine: `hubly_action_engine.ts` · Marketplace UI: `public/journey-os/app-marketplace.js`.

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

---

## Revenue (Module 11) publishes

| Event | When |
|-------|------|
| `invoice.sent` | Invoice Draft → Sent |
| `deposit.paid` | Deposit recorded |
| `payment.received` | Payment recorded |
| `invoice.paid` | Invoice reaches Paid |
| `refund.issued` | Refund / credit appended |
| `payout.completed` | Payout marked completed (OS) |
| `invoice.voided` | Invoice voided (compensating) |

Revenue **reads:** Customers, Jobs, Memberships, Services.  
Revenue **owns:** `S.revenueOs` (Rule #20 — financial integrity / append-only).  
See [REVENUE_ARCHITECTURE.md](./REVENUE_ARCHITECTURE.md).

---

## Ask Hubly (Module 13) publishes

| Event | When |
|-------|------|
| `ai.action.proposed` | Mutating / high-impact action queued for confirm |
| `ai.action.confirmed` | User confirmed |
| `ai.action.cancelled` | User cancelled |
| `ai.action.executed` | Action applied via owning module |
| `ai.draft.generated` | Safe draft created (no confirm) |

Ask Hubly **reads:** all owners (summaries + ids).  
Ask Hubly **owns:** `S.askHublyOs` — never operational entities.  
See [ASK_HUBLY_ARCHITECTURE.md](./ASK_HUBLY_ARCHITECTURE.md) · Rule #22.

---

## Settings (Module 14) publishes

| Event | When |
|-------|------|
| `settings.updated` | Any settings area saved |
| `settings.team.invited` | Team invitation created |
| `settings.integration.toggled` | Integration OS status changed |
| `settings.security.audited` | Security-sensitive change logged |

Settings **owns:** `S.settingsOs` — configuration only (Rule #23).  
Settings **must not own:** Customers · Jobs · Revenue · Services · Reviews · Campaigns.  
See [SETTINGS_ARCHITECTURE.md](./SETTINGS_ARCHITECTURE.md).
