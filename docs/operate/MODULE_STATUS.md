# Hubly Operate — Module Maturity Board

## Status keys

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete |
| ⏸ | Deferred / not in this stage |
| ⏳ | Pending / in progress |
| 🔒 Full | Nothing left to build for this module |
| 🔒 OS | Stage 1 OS frozen; only Stage 2 integration work allowed |
| ❌ | Not started |

## Stages

1. **Operating System (Stage 1)** — Everything inside Hubly works. No external APIs required.  
2. **Live Integrations (Stage 2)** — Separate PR. Do not claim “connected” until live.

### Lock rules

- **🔒 OS** — Do not modify Stage 1 OS unless bug fix, Stage 2 additive work, or explicit reopen.  
- **🔒 Full** — Module complete; no further work unless reopen.

---

## Maturity board

| Module | OS | Integrations | AI | QA | Lock |
|--------|----|--------------|----|----|------|
| 🏠 Home | ✅ | ✅ | ✅ | ✅ | 🔒 Full |
| 📥 Inbox | ✅ | ⏸ | ✅ | ✅ | 🔒 OS |
| 📅 Jobs & Calendar | ✅ | ⏸ | ✅ | ✅ | ❌ |
| 🧲 Leads | ⏳ | ⏸ | ⏳ | ⏳ | ❌ |
| 👥 Customers | ⏳ | ⏸ | ⏳ | ⏳ | ❌ |
| 🧭 Pipeline | ⏳ | ⏸ | ⏳ | ⏳ | ❌ |
| 🌐 Storefront | ⏳ | ⏸ | ⏳ | ⏳ | ❌ |
| 📣 Marketing | ⏳ | ⏸ | ⏳ | ⏳ | ❌ |
| ⭐ Reviews | ⏳ | ⏸ | ⏳ | ⏳ | ❌ |
| 🔁 Memberships | ⏳ | ⏸ | ⏳ | ⏳ | ❌ |
| 💰 Revenue | ⏳ | ⏸ | ⏳ | ⏳ | ❌ |
| 📊 Reports | ⏳ | ⏸ | ⏳ | ⏳ | ❌ |
| ✨ Ask Hubly | ⏳ | ⏸ | ⏳ | ⏳ | ❌ |
| ⚙️ Settings | ⏳ | ⏸ | ⏳ | ⏳ | ❌ |

---

## Module detail

| # | Module | Stage 1 (OS) | Stage 2 | PR | Notes |
|---|--------|--------------|---------|----|-------|
| 1 | 🏠 Home | ✅ Locked | ✅ | [#242](https://github.com/HubblyAdrian/Hubly/pull/242) | 🔒 Full |
| 2 | 📥 Inbox | ✅ Locked | ⏸ | [#244](https://github.com/HubblyAdrian/Hubly/pull/244) | 🔒 OS |
| 3 | 📅 Jobs & Calendar | ✅ QA | ⏸ | [#246](https://github.com/HubblyAdrian/Hubly/pull/246) | lock 🔒 OS after merge |
| 4–14 | Remaining | ⏳ | ⏸ | — | |

## Workflow

Planning → Development (Stage 1 OS) → Self QA → PR → Approval → Merge → **Lock OS**  
Later: Stage 2 Integrations → separate PR
