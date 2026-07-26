# 💰 Revenue — Architecture (required before Development)

**Module:** 11 — Revenue  
**Stage in scope:** Stage 1 — Operating System  
**Nav / mount:** `money` → `#v-money` / `#jos-revenue-root`  
**Rules:** #14 HublyDS · #15 Single Source of Truth · #16 End-to-End Journey · #17 Events · #18 Immutable events · #19 No owner bypass · **#20 Financial Integrity**  
**Status:** Required gate — do not start Revenue Development without this doc

---

## Purpose

Revenue is different from every module before it.

It cannot merely “look right” — it has to be **correct**.

Revenue is the financial system of record for Hubly Operate:

- Invoices & deposits  
- Payments & refunds  
- Taxes (OS rates / line tax)  
- Payouts  
- Stripe sync **status** (live Stripe = Stage 2)

Reports aggregate Revenue. Ask Hubly reads it. No other module may invent a parallel ledger.

---

## Who owns this data? (Rules #15 · #19)

| Data | Owner | Revenue role |
|------|--------|--------------|
| Customers | ❤️ Customers | **Read** (`customerId`) |
| Jobs | 📅 Jobs | **Read** (`jobId`) |
| Memberships | 🔁 Memberships | **Read** (`subscriberId` / `planId`) |
| Services | 🌐 Storefront | **Read** (line-item catalog refs) |
| **Payments** | 💰 Revenue | **Own** |
| **Invoices** | 💰 Revenue | **Own** |
| **Deposits** | 💰 Revenue | **Own** |
| **Refunds** | 💰 Revenue | **Own** |
| **Taxes** (computed / recorded) | 💰 Revenue | **Own** |
| **Payouts** | 💰 Revenue | **Own** |
| **Stripe sync status** | 💰 Revenue | **Own** (live sync Stage 2) |

**Forbidden**

- Duplicating customer or job rows inside Revenue  
- Reports storing payment totals as source of truth  
- Silently editing/deleting paid invoice or payment rows  
- Claiming Stripe “connected” until Stage 2 live integration  

---

## Storage (Stage 1 OS)

```
S.revenueOs = {
  invoices: [],     // owned ledger headers
  payments: [],     // append-only payment records
  deposits: [],     // append-only deposit records
  refunds: [],      // append-only refund / credit records
  taxes: [],        // tax lines / period summaries (OS)
  payouts: [],      // append-only payout records
  stripe: {         // sync status only — never claim live until Stage 2
    status: 'not_connected', // not_connected | placeholder | live
    lastSyncAt: null,
    accountLabel: null
  },
  activity: [],     // append-only financial activity (Rule #18 · #20)
  _seeded: false
}
```

### Invoice shape (OS)

| Field | Notes |
|-------|--------|
| `id` | `rve_inv_*` |
| `number` | Display invoice # |
| `customerId` | **Ref** Customers |
| `jobId` | Optional **ref** Jobs |
| `membershipId` | Optional **ref** Memberships subscriber |
| `serviceId` / `serviceName` | Catalog **ref** / label |
| `subtotal` · `taxAmount` · `total` | Numbers (cents-safe in Stage 2; decimals OK in OS) |
| `depositRequired` | Optional amount |
| `status` | Lifecycle (below) |
| `issuedAt` · `sentAt` · `paidAt` · `voidedAt` | Timestamps |
| `lines` | `[{ id, serviceId?, description, qty, unitPrice, taxRate }]` |

### Payment / deposit / refund shape

| Field | Notes |
|-------|--------|
| `id` | `rve_pay_*` / `rve_dep_*` / `rve_ref_*` |
| `invoiceId` | **Ref** owned invoice |
| `customerId` | **Ref** |
| `amount` | Positive number |
| `method` | `cash` · `card` · `check` · `stripe` · `other` |
| `at` | ISO timestamp — immutable once written |
| `note` | Optional |

Payouts: `{ id, amount, status: 'pending'|'completed'|'failed', at, destinationLabel }` — Stage 2 Stripe Connect.

---

## State model (payment / invoice lifecycle)

Every invoice has a clear lifecycle. Every transition is **intentional** and **recorded** (activity + HublyEvents).

```
Draft
  ↓  (send / finalize)
Invoice Sent          ← status: sent   · event: invoice.sent
  ↓  (optional)
Deposit Paid          ← status: deposit_paid · event: deposit.paid
  ↓
Paid                  ← status: paid   · events: invoice.paid + payment.received
  ↓  (if applicable)
Refunded              ← status: refunded · event: refund.issued
```

Also allowed (compensating / terminal):

| Transition | Result status | Event |
|------------|---------------|--------|
| Void draft/sent (error) | `void` | `invoice.voided` (OS) |
| Partial refund after paid | stay `paid` or `partially_refunded` | `refund.issued` |
| Payout recorded | payout row `completed` | `payout.completed` |

**Rules for transitions**

1. No silent status overwrite without an activity entry.  
2. Amounts on finalized (`sent`+) invoices are not freely edited — issue adjustment / credit / void + new invoice.  
3. Refunds never delete the original payment — they append a refund record.  
4. Aligns with Stripe mental model (`draft` → `open`/`sent` → `paid` → refund/void) without requiring live Stripe in Stage 1.

---

## Event publishing (Rule #17)

Revenue **publishes**; it does **not** directly mutate Reports / Customers / Memberships / Ask Hubly.

| Event | When |
|-------|------|
| `invoice.sent` | Invoice moved Draft → Sent |
| `deposit.paid` | Deposit recorded against invoice |
| `payment.received` | Payment recorded |
| `invoice.paid` | Invoice reaches Paid |
| `refund.issued` | Refund / credit appended |
| `payout.completed` | Payout marked completed (OS) |

Consumers (future / listeners): Reports · Customers · Memberships · Ask Hubly.

Payloads: ids + amounts + timestamps only (Rules #15 · #19).

---

## Rule #20 — Financial Integrity

Financial records are **append-only**.

- Payments, invoices (after send), refunds, deposits, and payouts must not be silently overwritten or deleted.  
- Corrections = new events: refunds, adjustments, voids, credits.  
- Preserves audit trail for reporting, AI, and future accounting integrations.  
- Reinforces Rules #18 and #19.

Stage 1 enforcement:

- `S.revenueOs.activity` / payments / deposits / refunds / payouts are pushed, never spliced for “fixes”.  
- HublyEvents history remains frozen (Rule #18).  
- UI “Edit” on a sent invoice opens **adjust / void / credit** flows — not mutate-in-place of ledger amounts.

---

## UI (Stage 1)

| Tab | Purpose |
|-----|---------|
| Overview | KPIs: collected, outstanding, deposits, refunds |
| Invoices | Lifecycle list + create / send / void |
| Payments | Record payment · ledger |
| Deposits | Record deposit |
| Refunds | Issue refund (compensating) |
| Taxes | OS tax summary from invoice lines |
| Payouts | OS payout records · Stripe Stage 2 toast |
| Activity | Append-only financial activity + recent HublyEvents |

Acts prefix: `rve-*` (avoid clash with Reviews `rev-*`).

Deep links (Rule #16): golden customer profile · Jobs · Memberships.

---

## Legacy bridge

Existing `#v-money` / `renderMoneyView()` treated jobs as invoices (`job.paid`).  

Stage 1 Journey OS **owns** the pixel via `#jos-revenue-root` and seeds `revenueOs` from completed/paid jobs as **referenced** invoices — Jobs remain the job owner; payment truth moves to Revenue.

Do not expand the legacy job-as-invoice model in new code.

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live Stripe Checkout / PaymentIntents | ⏸ |
| Live Stripe Invoicing sync | ⏸ |
| Live refunds via Stripe | ⏸ |
| Live Connect payouts | ⏸ |
| Tax provider integrations | ⏸ |

Never show “Connected” until live.

---

## Definition of Done (Stage 1)

1. This architecture doc merged / present on the branch before Development.  
2. `S.revenueOs` owns the ledger; lifecycle transitions intentional + recorded.  
3. Publishes HublyEvents listed above.  
4. Rules #14–20 honored.  
5. MAT ✅ · CMV PASS (incl. Memberships) · Approval → Merge → 🔒 OS.
