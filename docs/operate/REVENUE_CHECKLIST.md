# Module 11 — 💰 Revenue

**Status:** Stage 1 OS · MAT ✅ · CMV PASS · awaiting approval  
**Branch:** `cursor/operate-revenue-2662`  
**Architecture (required):** [REVENUE_ARCHITECTURE.md](./REVENUE_ARCHITECTURE.md)  
**Events:** [EVENTS.md](./EVENTS.md) (Rules #17–18 · #20)  
**Ownership:** [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) (Rules #15 · #19)  
**Design System:** HublyDS (Rule #14)  
**MAT:** [REVENUE_MAT.md](./REVENUE_MAT.md) · runner `node scripts/mat-revenue.mjs` 

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

Revenue is the financial system of record. Correctness over cosmetics.

**Reads:** Customers · Jobs · Memberships · Services  
**Owns:** `S.revenueOs` — payments, invoices, deposits, refunds, taxes, payouts, Stripe sync status  
**Publishes:** `invoice.sent` · `deposit.paid` · `payment.received` · `invoice.paid` · `refund.issued` · `payout.completed`

---

## Gate

- [x] `REVENUE_ARCHITECTURE.md` written before Development ✅  

---

## Stage 1 — Operating System

### Core
- [x] `ownPixelView('v-money', 'jos-revenue-root')` ✅
- [x] HublyDS chrome ✅
- [x] Tabs ✅
- [x] Responsive ✅

### Tabs
- [x] Overview ✅
- [x] Invoices ✅
- [x] Payments ✅
- [x] Deposits ✅
- [x] Refunds ✅
- [x] Taxes ✅
- [x] Payouts ✅
- [x] Activity (append-only) ✅

### Ownership & Integrity
- [x] `S.revenueOs` owns ledger ✅
- [x] Lifecycle Draft → Sent → Deposit Paid → Paid → Refunded ✅
- [x] No silent overwrite / delete (Rule #20) ✅
- [x] Publishes HublyEvents ✅
- [x] No customer/job clones (Rules #15 · #19) ✅

### Actions (`rve-*`)
- [x] Create / send / void invoice ✅
- [x] Record deposit / payment ✅
- [x] Issue refund ✅
- [x] Record payout (OS) ✅
- [x] Open customer profile ✅
- [x] Stage 2 Stripe toast ✅

### QA / MAT / CMV
- [ ] Validator revenue gates ⏳  
- [ ] MAT ⏳  
- [ ] CMV incl. Memberships ⏳  

### Definition of Done
- [ ] OS · MAT ✅ · CMV PASS · merge → 🔒 OS ⏳  

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live Stripe payments / invoices | ⏸ |
| Live refunds | ⏸ |
| Live Connect payouts | ⏸ |
| Tax provider | ⏸ |
