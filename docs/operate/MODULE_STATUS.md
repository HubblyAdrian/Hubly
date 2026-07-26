# Hubly Operate — Module Maturity Board

## Status keys

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete |
| ⏸ | Deferred / not started for this stage |
| ⏳ | Pending |
| 🔒 | Locked |
| 🔓 | Open (Stage 1 OS locked; Stage 2 may continue) |
| ❌ | Not started |

## Stages (every module)

1. **Operating System (Stage 1)** — Everything inside Hubly works. No external APIs required.  
2. **Live Integrations (Stage 2)** — Twilio, Meta, Resend, Realtime, OAuth, calendars, payments, etc.  
3. **Lock** — After Stage 1 merge (OS locked). Stage 2 is a separate PR when opened. Full lock when both stages (and AI/QA) are done, or when OS is locked and Stage 2 remains deferred by choice.

### Lock rules

Once **Stage 1 (Operating System)** is locked for a module, do not change that OS implementation unless:

- fixing a bug,
- implementing **Stage 2** integrations (additive),
- or the module is explicitly reopened.

Do not ship placeholder integrations that pretend to be live. Stage 2 items must be clearly tracked and CTAs must not claim “connected” unless they are.

---

## Maturity board

| Module | OS | Integrations | AI | QA | Locked |
|--------|----|--------------|----|----|--------|
| 🏠 Home | ✅ | ✅ | ✅ | ✅ | 🔒 |
| 📥 Inbox | ✅ | ⏸ | ✅ | ✅ | 🔓 |
| 📅 Jobs & Calendar | ⏳ | ⏳ | ⏳ | ⏳ | ❌ |
| 🧲 Leads | ⏳ | ⏳ | ⏳ | ⏳ | ❌ |
| 👥 Customers | ⏳ | ⏳ | ⏳ | ⏳ | ❌ |
| 🧭 Pipeline | ⏳ | ⏳ | ⏳ | ⏳ | ❌ |
| 🌐 Storefront | ⏳ | ⏳ | ⏳ | ⏳ | ❌ |
| 📣 Marketing | ⏳ | ⏳ | ⏳ | ⏳ | ❌ |
| ⭐ Reviews | ⏳ | ⏳ | ⏳ | ⏳ | ❌ |
| 🔁 Memberships | ⏳ | ⏳ | ⏳ | ⏳ | ❌ |
| 💰 Revenue | ⏳ | ⏳ | ⏳ | ⏳ | ❌ |
| 📊 Reports | ⏳ | ⏳ | ⏳ | ⏳ | ❌ |
| ✨ Ask Hubly | ⏳ | ⏳ | ⏳ | ⏳ | ❌ |
| ⚙️ Settings | ⏳ | ⏳ | ⏳ | ⏳ | ❌ |

---

## Module detail

| # | Module | Stage 1 (OS) | Stage 2 (Integrations) | PR | Notes |
|---|--------|--------------|------------------------|----|-------|
| 1 | 🏠 Home | ✅ COMPLETE · Locked | ✅ N/A / complete for Home scope | [#242](https://github.com/HubblyAdrian/Hubly/pull/242) | Full lock |
| 2 | 📥 Inbox | ✅ COMPLETE · Locked | ⏸ Deferred | [#244](https://github.com/HubblyAdrian/Hubly/pull/244) | OS locked; Stage 2 = Twilio / Meta / Resend / Realtime |
| 3 | 📅 Jobs & Calendar | ⏳ Planning | ⏳ | — | Next |
| 4 | 🧲 Leads | ⏳ | ⏳ | — | |
| 5 | 👥 Customers | ⏳ | ⏳ | — | |
| 6 | 🧭 Pipeline | ⏳ | ⏳ | — | |
| 7 | 🌐 Storefront | ⏳ | ⏳ | — | |
| 8 | 📣 Marketing | ⏳ | ⏳ | — | |
| 9 | ⭐ Reviews | ⏳ | ⏳ | — | |
| 10 | 🔁 Memberships | ⏳ | ⏳ | — | |
| 11 | 💰 Revenue | ⏳ | ⏳ | — | |
| 12 | 📊 Reports | ⏳ | ⏳ | — | |
| 13 | ✨ Ask Hubly | ⏳ | ⏳ | — | |
| 14 | ⚙️ Settings | ⏳ | ⏳ | — | |

## Workflow

Planning → Development (Stage 1 OS) → Self QA → PR → Approval → Merge → **Lock Stage 1 OS**  
Later: Stage 2 Integrations → PR → Approval → Merge → update maturity board

Checklists: see [README.md](./README.md)
