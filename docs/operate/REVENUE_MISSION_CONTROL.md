# Revenue Mission Control (💰 Stage 1 OS redesign)

This doc describes the Revenue “Mission Control” dashboard UI/UX layer (Stage 1 OS).
It sits on top of the existing Revenue ledger ownership:

- **Source of truth:** `S.revenueOs`
- **Core actions:** `rve-*` lifecycle (invoice draft → send → deposit/payment → paid → refunds → payout)
- **Stripe integration:** Stage 2 is still deferred; UI shows “Stripe Stage 2” entry points.

## Layout (desktop-first)

- Canvas wrapper: `#p-app` enters Revenue mode via `jos-revenue-mode`
- Content container: max-width **1440px**, centered, **32px** internal padding
- Background: **#F8F9FB**
- Cards: rounded corners (**16px**), `1px solid #ECECEC`, subtle shadow

## Screen sections

### Header (110px)

- Left:
  - Title: **Revenue**
  - Subtitle: **Track and manage your financial performance.**
- Right:
  - **Record Payment** (opens the OS payment modal: `rve-pay-open`)
  - **Create Invoice** (opens the invoice modal: `rve-inv-open`)
  - **Stripe Stage 2** dropdown/entry (action: `rve-stripe`)

### Navigation tabs (44px)

- **Overview / Invoices / Payments / Deposits / Refunds / Taxes / Payouts / Activity**
- Tabs update through **React-less state** in `journey.js` (single `data-jos-rve-tab` value)
- Filters/state are persisted on the root element dataset (Revenue mode local state)

### Overview grid

- KPI strip (Collected / Outstanding / Deposits / Refunds / Payouts)
- Revenue Overview chart card (interactive placeholder)
- Revenue by Source donut card (legend + percentage breakdown)
- Recent Transactions card (latest ledger items)
- Stripe Integration Status card (shows Stage 2 “Not connected” placeholder)
- Floating Revenue Assistant FAB (Stage 1 demo entry)

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

