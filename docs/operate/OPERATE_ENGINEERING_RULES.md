# Hubly Operate — Engineering Rules

Cursor reads this file for every Operate module PR.

## Stages

1. **Operating System (Stage 1)** — in-Hubly only; no live external APIs.  
2. **Live Integrations (Stage 2)** — separate PR; never claim “connected” until live.

## Process

Planning → Development (Stage 1 OS) → Self QA → **MAT** → **CMV** → PR → Approval → Merge → **Lock OS**

## Lock rules

- **🔒 OS** — Do not modify Stage 1 OS unless bug fix, Stage 2 additive work, or explicit reopen.  
- **🔒 Full** — Module complete; no further work unless reopen.

## Rule #14 — Reuse, don’t rebuild

If a UI pattern already exists in Hubly:

1. **DO NOT** rebuild it.  
2. Reuse `HublyDS` (`docs/operate/DESIGN_SYSTEM_V1.md`) or the golden customer profile.  
3. Only create a new component if the existing one cannot satisfy the use case.  
4. New modules consume Design System v1 from day one. Locked modules are not mass-refactored unless reopened.

## Rule #15 — Single Source of Truth

**Before building any feature: Who owns this data?**

Every type of data has **exactly one owner**. Other modules read it — they do not own or duplicate it.

See [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) (enforcement checklist).

| Data | Owner |
|------|--------|
| Services | 🌐 Storefront |
| Customers | ❤️ Customers |
| Leads | 🧲 Leads |
| Jobs | 📅 Jobs |
| Reviews | ⭐ Reviews |
| Campaigns / Templates / Automations / Coupons | 📣 Marketing |
| Membership Plans | 🔁 Memberships |
| Payments | 💰 Revenue |

PRs that introduce a second source of truth for an owned entity are rejected.

## Rule #16 — End-to-End User Journey

Every new module must be validated against the complete customer flow:

Visitor → Storefront → Book → Lead → Inbox → Quote → Pipeline → Job → Customer → Payment → Review → Marketing re-engage → Ask Hubly

If a module breaks that flow, it is not ready.

Marketing MAT / CMV must confirm locked modules still function. New modules deep-link to existing owners (golden customer profile, Storefront catalog, etc.) instead of inventing parallel surfaces.

## Rule #17 — Event-Driven Architecture

Modules publish and subscribe to business events. They do not call each other’s internals.

See [EVENTS.md](./EVENTS.md). Runtime: `window.HublyEvents` (`public/journey-os/hubly-events.js`).

Core events include: `lead.created`, `lead.qualified`, `quote.sent`, `quote.accepted`, `job.booked`, `job.started`, `job.completed`, `payment.received`, `invoice.sent`, `membership.started`, `membership.renewed`, `membership.cancelled`, `membership.paused`, `membership.visit_used`, `review.requested`, `review.received`, `review.responded`, `reputation.changed`, `campaign.sent`, `customer.created`.

New modules must publish events when mutating owned data. Locked modules are not mass-refactored unless reopened.

## Rule #18 — Business Events Are Immutable

Once a business event occurs, it is recorded as history and never rewritten.

- Append to HublyEvents history and module activity logs.  
- Correct mistakes with a **new** compensating event (e.g. cancel after start) — do not edit the original.  
- Visits, renewals, payments, and invoices are append-only ledgers.  
- See [EVENTS.md](./EVENTS.md) (Immutability section).

## Rule #19 — Modules Cannot Bypass Their Owners

If a module needs information, it must request it from the owning module or shared services — it must **not** store its own copy.

Examples:

- Marketing must not keep its own customer records.  
- Reports must not store payment totals.  
- Jobs must not redefine services (Storefront owns the catalog).  
- Ask Hubly must not maintain a separate customer database.  
- Memberships store `customerId` / `planId` / service refs only — never cloned Customers or Revenue rows.

Reinforces Rule #15. See [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md).

## Rule #20 — Financial Integrity

Financial records are **append-only**.

Payments, invoices (after send), refunds, deposits, and payouts must never be silently overwritten or deleted. Corrections are new events — refunds, adjustments, voids, credits — preserving a complete audit trail.

Aligns with Rules #18 and #19. Required for Revenue, reporting, AI analysis, and future accounting integrations.

See [REVENUE_ARCHITECTURE.md](./REVENUE_ARCHITECTURE.md).

## Rule #21 — Reports Never Duplicate Data

Reports are a **presentation and analytics layer**.

They aggregate, summarize, forecast, and visualize data from owner modules. They **never** become a second source of truth for operational data.

- Own: dashboards, saved report definitions, layouts, scheduled reports, forecast **models** (config).  
- Do not own / store: customers, payments, jobs, leads, campaigns, reviews, memberships.  
- KPIs are computed at read-time from owning modules (`revenueOs`, `membershipsOs`, Jobs, etc.).  
- Reinforces Rules #15 and #19.

See [REPORTS_PLAN.md](./REPORTS_PLAN.md) · [PLATFORM_READINESS.md](./PLATFORM_READINESS.md).

## Rule #22 — AI Confirmation Policy

Before any AI action that **changes business data**, Ask Hubly must either:

1. **Ask for confirmation**, or  
2. Follow a **user-configured automation rule** that explicitly allows that action type.

**Requires confirmation (defaults):** delete customer · refund payment · change pricing · publish website · send marketing campaign · cancel membership · other mutating writes.

**Does not require confirmation:** generate a draft · explain a report · summarize a customer · suggest follow-ups · read-only Q&A.

Keeps Ask Hubly powerful but predictable. See [ASK_HUBLY_ARCHITECTURE.md](./ASK_HUBLY_ARCHITECTURE.md).

## Rule #23 — Settings Never Own Business Data

Settings configure the platform.

They **never** become the owner of Customers, Jobs, Revenue, Services, Reviews, or Marketing campaigns.

- Own: business profile, team/roles, platform billing stubs, integration OS status, notifications, branding tokens, AI defaults, security, permissions (`S.settingsOs`).  
- Do not own / store: customers, jobs, payment ledgers, service catalogs, reviews, campaigns.  
- Other modules **read** Settings configuration; Settings does not replace their sources of truth.  
- Reinforces Rules #15 and #19.

See [SETTINGS_ARCHITECTURE.md](./SETTINGS_ARCHITECTURE.md).

## Rule #24 — Dual Product Architecture

Hubly serves two different users. Neither flow should interfere with the other.

| Persona | User phrasing | Destination |
|---------|---------------|-------------|
| Business Owner | I want to grow my business | AI Business Builder → Operating System |
| Consumer | I need to hire someone | AI Marketplace Concierge → Booking |

The public landing page is an **intelligent router** (same chat, different destination).

**IMPORTANT:** Do not remove or replace the Marketplace. `/marketplace`, `/get-done`, and the provider app stay intact. The landing AI detects intent and routes — it does not collapse Hubly into one product.

See [AI_LANDING_ARCHITECTURE.md](../AI_LANDING_ARCHITECTURE.md).

## Cross-Module Verification (CMV)

Before approval of a new module PR, confirm previously **locked** modules still function (no modifications — confirmation only).

Runner: `node scripts/cmv-locked-modules.mjs`

Load order for runners: `design-system.js` → `hubly-events.js` → `journey.js`.

## Acceptance

**MAT** (`docs/operate/MAT.md`) is the merge gate — not informal smoke language.

Special modules require an architecture doc before Development:

- Marketing → [MARKETING_ARCHITECTURE.md](./MARKETING_ARCHITECTURE.md)  
- Revenue → [REVENUE_ARCHITECTURE.md](./REVENUE_ARCHITECTURE.md) (correctness gate + Rule #20)  
- Ask Hubly → [ASK_HUBLY_ARCHITECTURE.md](./ASK_HUBLY_ARCHITECTURE.md) (intelligence layer + Rule #22)  
- Settings → [SETTINGS_ARCHITECTURE.md](./SETTINGS_ARCHITECTURE.md) (control center + Rule #23)  
- AI Landing → [AI_LANDING_ARCHITECTURE.md](../AI_LANDING_ARCHITECTURE.md) (dual product router + Rule #24)
