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

### MAT

**Module Acceptance Test** — formal acceptance before merge. See [MAT.md](./MAT.md).  
Do not use “functional smoke pass” as the merge gate.

### Cross-Module Verification (CMV)

Before approval of any new module PR, verify previously **locked** modules still function (no modifications — confirmation only):

- 🏠 Home still works  
- 📥 Inbox still works  
- 📅 Jobs still works  
- 🧲 Leads still works  
- ❤️ Customers still works  
- 🧭 Pipeline still works  
- 🌐 Storefront still works  
- 📣 Marketing still works  
- ⭐ Reviews still works  
- 🔁 Memberships still works  
- 💰 Revenue still works  
- 📊 Reports still works  
- ✨ Ask Hubly still works  
- ⚙️ Settings still works  
- (+ each newly locked module)

Runner: `node scripts/cmv-locked-modules.mjs` (extend as modules lock).  
**Note:** CMV evaluates `design-system.js` → `hubly-events.js` → `journey.js` (same load order as `hubly.html`).

---

## Platform readiness

See [PLATFORM_READINESS.md](./PLATFORM_READINESS.md) for cross-cutting platform health.

| Area | Status |
|------|--------|
| Navigation | ✅ |
| Design System | ✅ |
| Event Bus | ✅ |
| Data Ownership | ✅ |
| QA Process | ✅ |
| MAT | ✅ |
| CMV | ✅ |
| Financial Integrity | ✅ |
| AI Confirmation Policy | ✅ Rule #22 |
| Settings ownership | ✅ Rule #23 |
| Dual Product Architecture | ✅ Rule #24 · 🔒 Landing locked |
| Hubly Memory | ✅ Rule #25 |
| Business + Owner Profile / DNA | ✅ 🔒 Rule #26 · canonical for all Builder modules |
| Business Vision | ✅ Rule #27 |
| AI Business Builder | ⏳ M2 Dev · M3–M4 Architecture |
| Integrations | ⏸ Stage 2 |
| Performance | ⏳ |
| Accessibility | ⏳ |
| Security Review | ⏳ |

---

## Maturity board

| Module | OS | Integrations | AI | QA | MAT | Lock |
|--------|----|--------------|----|----|-----|------|
| 🏠 Home | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 Full |
| 📥 Inbox | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| 📅 Jobs & Calendar | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| 🧲 Leads | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| ❤️ Customers | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| 🧭 Pipeline | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| 🌐 Storefront | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| 📣 Marketing | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| ⭐ Reviews | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| 🔁 Memberships | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| 💰 Revenue | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| 📊 Reports | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| ✨ Ask Hubly | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| ⚙️ Settings | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |

---

## Module detail

| # | Module | Stage 1 (OS) | Stage 2 | PR | Notes |
|---|--------|--------------|---------|----|-------|
| 1 | 🏠 Home | ✅ Locked | ✅ | [#242](https://github.com/HubblyAdrian/Hubly/pull/242) | 🔒 Full · MAT ✅ |
| 2 | 📥 Inbox | ✅ Locked | ⏸ | [#244](https://github.com/HubblyAdrian/Hubly/pull/244) | 🔒 OS · MAT ✅ |
| 3 | 📅 Jobs & Calendar | ✅ Locked | ⏸ | [#246](https://github.com/HubblyAdrian/Hubly/pull/246) | 🔒 OS · MAT ✅ · merged |
| 4 | 🧲 Leads | ✅ Locked | ⏸ | [#247](https://github.com/HubblyAdrian/Hubly/pull/247) | 🔒 OS · MAT ✅ · merged |
| 5 | ❤️ Customers | ✅ Locked | ⏸ | [#248](https://github.com/HubblyAdrian/Hubly/pull/248) | 🔒 OS · golden profile · MAT ✅ · CMV PASS |
| 6 | 🧭 Pipeline | ✅ Locked | ⏸ | [#249](https://github.com/HubblyAdrian/Hubly/pull/249) | 🔒 OS · MAT ✅ · HublyDS v1 · merged |
| 7 | 🌐 Storefront | ✅ Locked | ⏸ | [#250](https://github.com/HubblyAdrian/Hubly/pull/250) | 🔒 OS · MAT ✅ · Service Catalog owner · merged |
| 8 | 📣 Marketing | ✅ Locked | ⏸ | [#251](https://github.com/HubblyAdrian/Hubly/pull/251) | 🔒 OS · MAT ✅ · Rules #14–16 · merged |
| 9 | ⭐ Reviews | ✅ Locked | ⏸ | [#252](https://github.com/HubblyAdrian/Hubly/pull/252) | 🔒 OS · MAT ✅ · Rule #17 · merged |
| 10 | 🔁 Memberships | ✅ Locked | ⏸ | [#253](https://github.com/HubblyAdrian/Hubly/pull/253) | 🔒 OS · MAT ✅ · Rules #18–19 · merged |
| 11 | 💰 Revenue | ✅ Locked | ⏸ | [#254](https://github.com/HubblyAdrian/Hubly/pull/254) | 🔒 OS · MAT ✅ · Rule #20 · merged |
| 12 | 📊 Reports | ✅ Locked | ⏸ | [#255](https://github.com/HubblyAdrian/Hubly/pull/255) | 🔒 OS · MAT ✅ · Rule #21 · merged |
| 13 | ✨ Ask Hubly | ✅ Locked | ⏸ | [#256](https://github.com/HubblyAdrian/Hubly/pull/256) | 🔒 OS · MAT ✅ · Rule #22 · merged |
| 14 | ⚙️ Settings | ✅ Locked | ⏸ | [#257](https://github.com/HubblyAdrian/Hubly/pull/257) | 🔒 OS · MAT ✅ · Rule #23 · merged |

### Finish line

All **14** Operate modules have Stage 1 OS complete and locked:

🏠 Home · 📥 Inbox · 📅 Jobs · 🧲 Leads · ❤️ Customers · 🧭 Pipeline · 🌐 Storefront · 📣 Marketing · ⭐ Reviews · 🔁 Memberships · 💰 Revenue · 📊 Reports · ✨ Ask Hubly · ⚙️ Settings

### ⚙️ Settings lock

**Stage 1 — Operating System:** ✅ COMPLETE  
**Stage 2 — External Integrations & Advanced Configuration:** ⏸ Deferred  

**Do not modify Settings unless:** bug fix · Stage 2 integrations · explicit module reopen.

### 🤖 Ask Hubly lock

**Stage 1 — Operating System:** ✅ COMPLETE  
**Stage 2 — Advanced AI / Integrations:** ⏸ Deferred  

**Do not modify Ask Hubly unless:** bug fix · Stage 2 AI capabilities · explicit module reopen.

### 📊 Reports lock

**Stage 1 — Operating System:** ✅ COMPLETE  
**Stage 2 — Integrations:** ⏸ Deferred  

**Do not modify Reports unless:** bug fix · Stage 2 integrations · explicit module reopen.

### 💰 Revenue lock

**Stage 1 — Operating System:** ✅ COMPLETE  
**Stage 2 — Integrations:** ⏸ Deferred  

**Do not modify Revenue unless:** bug fix · Stage 2 integrations · explicit module reopen.

### 🔁 Memberships lock

**Stage 1 — Operating System:** ✅ COMPLETE  
**Stage 2 — Integrations:** ⏸ Deferred  

**Do not modify Memberships unless:** bug fix · Stage 2 integrations · explicit module reopen.

### ⭐ Reviews lock

**Stage 1 — Operating System:** ✅ COMPLETE  
**Stage 2 — Integrations:** ⏸ Deferred  

**Do not modify Reviews unless:** bug fix · Stage 2 integrations · explicit module reopen.

---

## Hubly AI Business Builder (separate milestone)

Operate Stage 1 is complete. The next product milestone is **Hubly AI Business Builder** — see [builder/README.md](../builder/README.md).

| # | Module | Status |
|---|--------|--------|
| 1 | 🌎 AI Landing Experience | 🔒 Locked (#259) |
| 2 | 🤖 AI Discovery | 🔒 Architecture locked · Rule #26 · Dev may begin |
| 3 | 🔍 AI Research Engine | ⏳ Architecture · Research Profile canonical |
| 4 | 🎨 AI Creative Director | ⏳ Architecture ([CREATIVE_DIRECTOR_ARCHITECTURE.md](../builder/CREATIVE_DIRECTOR_ARCHITECTURE.md)) |

**Hubly Memory** (Rule #25): [HUBLY_MEMORY.md](../HUBLY_MEMORY.md)  
**Rule #26 🔒:** Business Profile · Owner Profile · Business DNA — canonical for all Builder modules  
**Rule #27:** Business Vision — [BUSINESS_VISION.md](../builder/BUSINESS_VISION.md)  
**Canonical objects:** Business Profile · Owner Profile · Business DNA · Research Profile · Business Vision

## Workflow

Planning → Development (Stage 1 OS) → Self QA → **MAT** → **CMV** → PR → Approval → Merge → **Lock OS**  
Later: Stage 2 Integrations → separate PR

**Special gates:** Marketing / Revenue / Ask Hubly / Settings / **AI Landing** / **AI Discovery** / **AI Research** / **Creative Director** / **Business Vision** architecture docs before Development.  
**Engineering rules:** #14–27 ([OPERATE_ENGINEERING_RULES.md](./OPERATE_ENGINEERING_RULES.md) · [HUBLY_MEMORY.md](../HUBLY_MEMORY.md) · [EVENTS.md](./EVENTS.md) · [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) · [PLATFORM_READINESS.md](./PLATFORM_READINESS.md))
