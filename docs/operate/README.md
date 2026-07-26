# Operate module checklists

**Source of truth for every module.** Cursor reads these files — not chat history.

## Stages

| Stage | Name | Meaning |
|-------|------|---------|
| 1 | Operating System | Everything inside Hubly works. No external APIs required. |
| 2 | Live Integrations | Twilio, Meta, Resend, Realtime, OAuth, etc. Separate PR. |

After Stage 1 merges → **lock the OS**. Stage 2 is additive and tracked separately.

**Acceptance gate:** [Module Acceptance Test (MAT)](./MAT.md) — not informal smoke language.

## Maturity board

See [MODULE_STATUS.md](./MODULE_STATUS.md) (OS · Integrations · AI · QA · **MAT** · Lock).

## Checklists

| Module | File | OS | Integrations | MAT | Locked |
|--------|------|----|--------------|-----|--------|
| Home | [HOME_CHECKLIST.md](./HOME_CHECKLIST.md) | ✅ | ✅ | ✅ | 🔒 Full |
| Inbox | [INBOX_CHECKLIST.md](./INBOX_CHECKLIST.md) | ✅ | ⏸ | ✅ | 🔒 OS |
| Jobs & Calendar | [JOBS_CHECKLIST.md](./JOBS_CHECKLIST.md) · [JOBS_MAT.md](./JOBS_MAT.md) | ✅ | ⏸ | ✅ | ❌ (🔒 OS after merge) |
| Leads | [LEADS_CHECKLIST.md](./LEADS_CHECKLIST.md) | ⏳ | ⏳ | ❌ |
| Customers | [CUSTOMERS_CHECKLIST.md](./CUSTOMERS_CHECKLIST.md) | ⏳ | ⏳ | ❌ |
| Pipeline | [PIPELINE_CHECKLIST.md](./PIPELINE_CHECKLIST.md) | ⏳ | ⏳ | ❌ |
| Storefront | [STOREFRONT_CHECKLIST.md](./STOREFRONT_CHECKLIST.md) | ⏳ | ⏳ | ❌ |
| Marketing | [MARKETING_CHECKLIST.md](./MARKETING_CHECKLIST.md) | ⏳ | ⏳ | ❌ |
| Reviews | [REVIEWS_CHECKLIST.md](./REVIEWS_CHECKLIST.md) | ⏳ | ⏳ | ❌ |
| Memberships | [MEMBERSHIPS_CHECKLIST.md](./MEMBERSHIPS_CHECKLIST.md) | ⏳ | ⏳ | ❌ |
| Revenue | [REVENUE_CHECKLIST.md](./REVENUE_CHECKLIST.md) | ⏳ | ⏳ | ❌ |
| Reports | [REPORTS_CHECKLIST.md](./REPORTS_CHECKLIST.md) | ⏳ | ⏳ | ❌ |
| Ask Hubly | [ASK_HUBLY_CHECKLIST.md](./ASK_HUBLY_CHECKLIST.md) | ⏳ | ⏳ | ❌ |
| Settings | [SETTINGS_CHECKLIST.md](./SETTINGS_CHECKLIST.md) | ⏳ | ⏳ | ❌ |
