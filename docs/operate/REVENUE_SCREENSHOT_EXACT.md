# Revenue — screenshot exact

Operate **Revenue** matches the financial Mission Control mock: header chrome, eight ledger tabs, five KPI cards, dual-line overview, source donut, recent transactions, and Stripe Stage 2 connect card.

## Layout

1. **Header** — Revenue + subtitle · search · + New · Ask Hubly · bell badge 3 · Adrian's Lawn Service  
2. **Tabs** — Overview (active) · Invoices · Payments · Deposits · Refunds · Taxes · Payouts · Activity  
3. **Actions** — Create Invoice · Record Payment · Stripe Stage 2 ▾  
4. **KPIs** — Collected $12,540 ↑18.6% · Outstanding $2,340 ↑6.4% (orange) · Deposits $10,200 ↑12.1% · Refunds $320 ↑2.3% · Payouts $8,750 ↑9.8%  
5. **Left** — Revenue Overview (May 1–31 vs previous) · Recent Transactions (5 demo rows)  
6. **Right** — Revenue by Source donut ($12,540 Total) · Stripe Not connected + Connect Stripe  

Removed from Overview: CSV/PNG/PDF downloads, floating AI FAB, Stripe balance stats grid, Memberships/Gift Cards donut slices.

## Files

- `public/journey-os/journey.js` — `demoRevenueSeed`, `renderRevenuePageInner`, `renderRevenueMcOverview`  
- `public/journey-os/operate-pixel.css` — `#p-app.jos-pixel.jos-revenue-mode` screenshot styles  
- `scripts/screenshot-revenue.mjs` — visual capture  

Demo KPI totals and transaction rows apply only when `allowDemoSeed()`.
