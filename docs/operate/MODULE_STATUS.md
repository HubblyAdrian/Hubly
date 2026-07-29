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
| Business + Owner Profile / DNA | ✅ 🔒 Rule #26 |
| Business Vision | ✅ 🔒 Rule #27 |
| Creative Review | ✅ 🔒 Rule #28 |
| AI Business Agency | ✅ 🔒 Rule #29 · Activation locked · Launch Coach arch |
| AI Business Agency modules | ⏳ M2/M4 Dev · M3/M7 Architecture |
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
| 🧭 Pipeline | ✅ | ⏸ | ✅ | ⏳ | ⏳ | 🔓 Reopen |
| 🌐 Storefront | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| 📣 Marketing | — | — | — | — | — | 🔄 Replaced by Studio |
| 🎨 Studio | ✅ | ⏸ | ✅ | ⏳ | ⏳ | 🔓 Replaces Marketing · [HUBLY_STUDIO_IMPLEMENTATION_SPEC.md](../HUBLY_STUDIO_IMPLEMENTATION_SPEC.md) |
| ⭐ Reviews | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| 🔁 Memberships | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔓 Reopen |
| 💰 Revenue | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| 📊 Reports | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔒 OS |
| ✨ Ask Hubly | ✅ | ⏸ | ✅ | ✅ | ✅ | 🔓 Reopen |
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
| 8 | 🎨 Studio | 🔓 Replaces Marketing | ⏸ | Studio OS | [HUBLY_STUDIO_IMPLEMENTATION_SPEC.md](../HUBLY_STUDIO_IMPLEMENTATION_SPEC.md) · prior Marketing [#251](https://github.com/HubblyAdrian/Hubly/pull/251) |
| 9 | ⭐ Reviews | ✅ Locked | ⏸ | [#252](https://github.com/HubblyAdrian/Hubly/pull/252) | 🔒 OS · MAT ✅ · Rule #17 · merged |
| 10 | 🔁 Memberships | 🔓 Reopen | ⏸ | [#253](https://github.com/HubblyAdrian/Hubly/pull/253) | Mission Control · [MEMBERSHIPS_MISSION_CONTROL.md](./MEMBERSHIPS_MISSION_CONTROL.md) |
| 11 | 💰 Revenue | ✅ Locked | ⏸ | [#254](https://github.com/HubblyAdrian/Hubly/pull/254) | 🔒 OS · MAT ✅ · Rule #20 · merged |
| 12 | 📊 Reports | ✅ Locked | ⏸ | [#255](https://github.com/HubblyAdrian/Hubly/pull/255) | 🔒 OS · MAT ✅ · Rule #21 · merged |
| 13 | ✨ Ask Hubly | ✅ Locked | ⏸ | [#256](https://github.com/HubblyAdrian/Hubly/pull/256) | 🔓 Reopen · MAT ✅ · Rule #22 · merged |
| 14 | ⚙️ Settings | ✅ Locked | ⏸ | [#257](https://github.com/HubblyAdrian/Hubly/pull/257) | 🔒 OS · MAT ✅ · Rule #23 · merged |

### Finish line

All **14** Operate modules have Stage 1 OS complete and locked:

🏠 Home · 📥 Inbox · 📅 Jobs · 🧲 Leads · ❤️ Customers · 🧭 Pipeline · 🌐 Storefront · 📣 Marketing · ⭐ Reviews · 🔁 Memberships · 💰 Revenue · 📊 Reports · ✨ Ask Hubly · ⚙️ Settings

### ⚙️ Settings lock

**Stage 1 — Operating System:** ✅ COMPLETE  
**Stage 2 — External Integrations & Advanced Configuration:** ⏸ Deferred  
**Reopen:** Mission Control dashboard (`cursor/operate-settings-mission-control-2662`) — hero, status KPIs, platform checklist, next steps, Ask Hubly banner. Design: [SETTINGS_MISSION_CONTROL.md](./SETTINGS_MISSION_CONTROL.md).

**Do not modify Settings unless:** bug fix · Stage 2 integrations · explicit module reopen.

### 🤖 Ask Hubly lock

**Stage 1 — Operating System:** ✅ COMPLETE  
**Stage 2 — Advanced AI / Integrations:** ⏸ Deferred  
**Reopen:** Mission Control dashboard (`cursor/operate-ask-hubly-mission-control-2662`) — hero, KPIs, conversation + activity, insight, popular actions, calendar tip. Design: [ASK_HUBLY_MISSION_CONTROL.md](./ASK_HUBLY_MISSION_CONTROL.md).

**Do not modify Ask Hubly unless:** bug fix · Stage 2 AI capabilities · explicit module reopen.

### 📊 Reports lock

**Stage 1 — Operating System:** ✅ COMPLETE  
**Stage 2 — Integrations:** ⏸ Deferred  

**Do not modify Reports unless:** bug fix · Stage 2 integrations · explicit module reopen.

### 💰 Revenue lock

**Stage 1 — Operating System:** ✅ COMPLETE  
**Stage 2 — Integrations:** ⏸ Deferred  

**Do not modify Revenue unless:** bug fix · Stage 2 integrations · explicit module reopen.

### 🔁 Memberships reopen

**Stage 1 — Operating System:** ✅ COMPLETE  
**Mission Control redesign:** 🔓 In progress — [MEMBERSHIPS_MISSION_CONTROL.md](./MEMBERSHIPS_MISSION_CONTROL.md)  
**Stage 2 — Integrations:** ⏸ Deferred  

**Do not modify Memberships unless:** bug fix · Mission Control redesign · Stage 2 integrations · explicit module reopen.

### ⭐ Reviews reopen

**Stage 1 — Operating System:** ✅ COMPLETE  
**Mission Control redesign:** 🔓 In progress — [REVIEWS_MISSION_CONTROL.md](./REVIEWS_MISSION_CONTROL.md)  
**Stage 2 — Integrations:** ⏸ Deferred  

**Do not modify Reviews unless:** bug fix · Mission Control redesign · Stage 2 integrations · explicit module reopen.

---

## Hubly AI Business Agency (separate milestone) · Rule #29 🔒

Operate Stage 1 is complete. Canonical Builder experience: **Hubly AI Business Agency** — see [builder/README.md](../builder/README.md).

| # | Module | Status |
|---|--------|--------|
| 1 | 🌎 AI Landing Experience | 🔒 Locked (#259) |
| 2 | 🤖 AI Discovery | 🔒 Architecture · Dev may begin |
| 3 | 🔍 AI Research Engine | ⏳ Architecture |
| 4 | 🎨 AI Creative Director | 🔒 Architecture · **Dev may begin** |
| 5 | ✨ Business Reveal | 🔒 Architecture · design completion |
| 6 | 🚀 Business Activation | 🔒 Architecture · canonical activation |
| 7 | 🎓 AI Launch Coach | ⏳ Architecture ([LAUNCH_COACH_ARCHITECTURE.md](../builder/LAUNCH_COACH_ARCHITECTURE.md)) |

Builder **ends** at Launch → Operate Home.  
**No module may bypass** Agency pipeline without reopen.  
**Rules #26–#29 🔒** · Save My Business = first account point.

## Workflow

Planning → Development (Stage 1 OS) → Self QA → **MAT** → **CMV** → PR → Approval → Merge → **Lock OS**  
Later: Stage 2 Integrations → separate PR

**Special gates:** Marketing / Revenue / Ask Hubly / Settings / **AI Landing** / **AI Discovery** / **AI Research** / **Creative Director** / **Creative Review** / **Business Reveal** / **Business Activation** / **AI Launch Coach** / **Business Vision** architecture docs before Development.  
**Engineering rules:** #14–29 ([OPERATE_ENGINEERING_RULES.md](./OPERATE_ENGINEERING_RULES.md) · [HUBLY_MEMORY.md](../HUBLY_MEMORY.md) · [EVENTS.md](./EVENTS.md) · [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) · [PLATFORM_READINESS.md](./PLATFORM_READINESS.md))
