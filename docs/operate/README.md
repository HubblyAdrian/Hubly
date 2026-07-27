# Operate module checklists

**Source of truth for every module.** Cursor reads these files — not chat history.

## Stages

| Stage | Name | Meaning |
|-------|------|---------|
| 1 | Operating System | Everything inside Hubly works. No external APIs required. |
| 2 | Live Integrations | Twilio, Meta, Resend, Realtime, OAuth, etc. Separate PR. |

After Stage 1 merges → **lock the OS**. Stage 2 is additive and tracked separately.

**Design System:** [DESIGN_SYSTEM_V1.md](./DESIGN_SYSTEM_V1.md) · `public/journey-os/design-system.js` → `window.HublyDS`  
**Engineering rules:** [OPERATE_ENGINEERING_RULES.md](./OPERATE_ENGINEERING_RULES.md) (Rules #14–22 · [EVENTS.md](./EVENTS.md) · [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md))  
**Platform readiness:** [PLATFORM_READINESS.md](./PLATFORM_READINESS.md)

**Acceptance gate:** [Module Acceptance Test (MAT)](./MAT.md) — not informal smoke language.

## Maturity board

See [MODULE_STATUS.md](./MODULE_STATUS.md) (OS · Integrations · AI · QA · **MAT** · Lock).

## Checklists

| Module | File | OS | Integrations | MAT | Locked |
|--------|------|----|--------------|-----|--------|
| Home | [HOME_CHECKLIST.md](./HOME_CHECKLIST.md) | ✅ | ✅ | ✅ | 🔒 Full |
| Inbox | [INBOX_CHECKLIST.md](./INBOX_CHECKLIST.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Jobs & Calendar | [JOBS_CHECKLIST.md](./JOBS_CHECKLIST.md) · [JOBS_MAT.md](./JOBS_MAT.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Leads | [LEADS_CHECKLIST.md](./LEADS_CHECKLIST.md) · [LEADS_MAT.md](./LEADS_MAT.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Customers | [CUSTOMERS_CHECKLIST.md](./CUSTOMERS_CHECKLIST.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Pipeline | [PIPELINE_CHECKLIST.md](./PIPELINE_CHECKLIST.md) · [PIPELINE_MAT.md](./PIPELINE_MAT.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Storefront | [STOREFRONT_CHECKLIST.md](./STOREFRONT_CHECKLIST.md) · [STOREFRONT_MAT.md](./STOREFRONT_MAT.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Marketing | [MARKETING_CHECKLIST.md](./MARKETING_CHECKLIST.md) · [MARKETING_MAT.md](./MARKETING_MAT.md) · [MARKETING_ARCHITECTURE.md](./MARKETING_ARCHITECTURE.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Reviews | [REVIEWS_CHECKLIST.md](./REVIEWS_CHECKLIST.md) · [REVIEWS_MAT.md](./REVIEWS_MAT.md) · [REVIEWS_PLAN.md](./REVIEWS_PLAN.md) · [EVENTS.md](./EVENTS.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Memberships | [MEMBERSHIPS_CHECKLIST.md](./MEMBERSHIPS_CHECKLIST.md) · [MEMBERSHIPS_MAT.md](./MEMBERSHIPS_MAT.md) · [MEMBERSHIPS_PLAN.md](./MEMBERSHIPS_PLAN.md) · [EVENTS.md](./EVENTS.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Revenue | [REVENUE_CHECKLIST.md](./REVENUE_CHECKLIST.md) · [REVENUE_MAT.md](./REVENUE_MAT.md) · [REVENUE_ARCHITECTURE.md](./REVENUE_ARCHITECTURE.md) · [REVENUE_PLAN.md](./REVENUE_PLAN.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Reports | [REPORTS_CHECKLIST.md](./REPORTS_CHECKLIST.md) · [REPORTS_MAT.md](./REPORTS_MAT.md) · [REPORTS_PLAN.md](./REPORTS_PLAN.md) · [PLATFORM_READINESS.md](./PLATFORM_READINESS.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Ask Hubly | [ASK_HUBLY_CHECKLIST.md](./ASK_HUBLY_CHECKLIST.md) · [ASK_HUBLY_ARCHITECTURE.md](./ASK_HUBLY_ARCHITECTURE.md) · [ASK_HUBLY_PLAN.md](./ASK_HUBLY_PLAN.md) · [ASK_HUBLY_MAT.md](./ASK_HUBLY_MAT.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Settings | [SETTINGS_CHECKLIST.md](./SETTINGS_CHECKLIST.md) · [SETTINGS_ARCHITECTURE.md](./SETTINGS_ARCHITECTURE.md) · [SETTINGS_PLAN.md](./SETTINGS_PLAN.md) | ⏳ | ⏸ | ⏳ | ❌ |
