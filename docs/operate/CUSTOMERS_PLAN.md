# Module 5 — ❤️ Customers · Planning

**Branch:** `cursor/operate-customers-2662`  
**Stage:** 1 — Operating System  
**Locked modules (do not modify):** Home · Inbox · Jobs · Leads OS

## Design rule — Golden Profile

`openCustomerProfile` / `#jos-customer-profile` is the single customer profile used from Customers, Leads (after convert), Inbox, Jobs, Pipeline, Revenue, Reports, and Ask Hubly. Expand tabs/content there; do not invent a second profile screen.

## Implementation plan

1. Replace thin `renderCustomersPage` with full Customers OS (`ownPixelView('v-customers', 'jos-customers-root')`).
2. List + filters + add modal + tabs; click opens in-page profile panel that shares golden profile data/actions (or mounts the same profile shell).
3. Extend `renderProfileTab` / profile tabs to cover Overview, Timeline, Jobs, Payments, Photos, Messages, Membership, Reviews, Documents, Notes.
4. Sidebar: AI summary, health, quick actions, recent activity.
5. CSS `.jos-cust-*` only; enrich ceo-demo customers.
6. Validator gate + `mat-customers.mjs` + `cmv-locked-modules.mjs`.
7. PR → approval → merge → 🔒 OS.

## Expected files

| File | Change |
|------|--------|
| `docs/operate/CUSTOMERS_CHECKLIST.md` | Stage 1 items |
| `public/journey-os/journey.js` | `renderCustomers` + profile tabs (no Home/Inbox/Jobs/Leads OS edits) |
| `public/journey-os/operate-pixel.css` | Customers styles |
| `public/journey-os/ceo-demo.js` | Customer seed enrichment |
| `scripts/check-customer-journey-os.mjs` | Customers gate |
| `scripts/mat-customers.mjs` | MAT |
| `scripts/cmv-locked-modules.mjs` | Cross-module verification |
| `docs/operate/MODULE_STATUS.md` | Maturity |
