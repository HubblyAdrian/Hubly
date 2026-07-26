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

## Cross-Module Verification (CMV)

Before approval of a new module PR, confirm previously **locked** modules still function (no modifications — confirmation only).

Runner: `node scripts/cmv-locked-modules.mjs`

## Acceptance

**MAT** (`docs/operate/MAT.md`) is the merge gate — not informal smoke language.

Special modules (e.g. Marketing) require an architecture doc before Development — see [MARKETING_ARCHITECTURE.md](./MARKETING_ARCHITECTURE.md).
