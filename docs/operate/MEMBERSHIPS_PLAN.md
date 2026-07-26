# Memberships — Stage 1 Plan

**Module:** 🔁 Memberships  
**Stage:** 1 — Operating System  
**Rules:** #14–19  
**Architecture:** Business system (not just a screen) — connects to Revenue → Reports → Ask Hubly

---

## Owns

| Entity | Store |
|--------|--------|
| Plans | `S.membershipsOs.plans` |
| Subscribers | `S.membershipsOs.subscribers` (customerId + planId refs) |
| Billing rules | `S.membershipsOs.billingRules` |
| Included services | refs to Storefront catalog ids/names |
| Visit tracking | `S.membershipsOs.visits` (append-only) |
| Renewals | `S.membershipsOs.renewals` (append-only) |
| Activity | `S.membershipsOs.activity` (append-only · Rule #18) |

## Reads

Customers · Jobs · Revenue (no ownership of payments)

## Publishes (HublyEvents)

`membership.started` · `membership.renewed` · `membership.cancelled` · `membership.paused` · `membership.visit_used`

## Tabs

Overview · Plans · Subscribers · Visits · Billing · Activity

## Stage 2 ⏸

Live Stripe billing / renewals / payouts — deferred (placeholders only).
