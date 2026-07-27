# Revenue Mission Control (💰 Stage 1 OS redesign)

This doc describes the Revenue “Mission Control” dashboard UI/UX layer (Stage 1 OS).
It sits on top of the existing Revenue ledger ownership:

- **Source of truth:** `S.revenueOs`
- **Core actions:** `rve-*` lifecycle (invoice draft → send → deposit/payment → paid → refunds → payout)
- **Stripe integration:** Stage 2 is still deferred; UI shows “Stripe Stage 2” entry points.

See also: [REVENUE_SCREENSHOT_EXACT.md](./REVENUE_SCREENSHOT_EXACT.md) for the locked visual layout.

## Layout (desktop-first)

- Canvas wrapper: `#p-app` enters Revenue mode via `jos-revenue-mode`
- Content container: max-width **1600px**, centered, **40px** horizontal padding
- Background: **#F5F6FA**
- Cards: rounded corners (**16px**), `1px solid #E8EAF0`, subtle shadow

## Screen sections

### Header chrome

- Left: **Revenue** + **Track and manage your financial performance.**
- Right: search · **+ New** · **Ask Hubly** · notifications (badge 3 in demo) · business profile

### Navigation tabs

- **Overview / Invoices / Payments / Deposits / Refunds / Taxes / Payouts / Activity**
- Right actions on the tab row: **Create Invoice** · **Record Payment** · **Stripe Stage 2 ▾**

### Overview grid

- KPI strip (Collected / Outstanding / Deposits / Refunds / Payouts) with vs-last-30-days deltas
- Left: Revenue Overview dual-line chart · Recent Transactions
- Right: Revenue by Source donut · Stripe Integration Status (Not connected)
- No CSV/PNG/PDF downloads, no floating FAB, no Stripe balance stats on Overview

## Interaction model

- **No full page reloads:** all actions re-render the Revenue root using `renderRevenue()`
- **Keyboard:** `ESC` closes modals/drawers (existing Revenue OS behavior)
- **KPI drill-down:** KPI cards route to the most relevant tab via `rve-kpi-open` (demo routing)
- **Stage 2 constraints:** Stripe UI buttons show entry points but do not claim live integration

## Ownership / integrity guarantees (Rule #20)

Revenue ledger is append-only for ledger events and preserves HublyEvents history:

- Payments are not deleted on refund
- Activity log is frozen append-only
- Lifecycle updates are performed on `S.revenueOs` objects and publish the correct HublyEvents
- Demo KPI/transaction filler applies only when `allowDemoSeed()` / `_ceoDemo`
