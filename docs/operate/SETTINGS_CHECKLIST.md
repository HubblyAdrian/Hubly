# Module 14 — ⚙️ Settings

**Status:** 🔓 Explicit reopen (Mission Control dashboard) · Stage 1 OS ✅ COMPLETE  
**Branch:** merged via [#257](https://github.com/HubblyAdrian/Hubly/pull/257)  
**Architecture (required):** [SETTINGS_ARCHITECTURE.md](./SETTINGS_ARCHITECTURE.md)  
**Plan:** [SETTINGS_PLAN.md](./SETTINGS_PLAN.md)  
**MAT:** [SETTINGS_MAT.md](./SETTINGS_MAT.md) · runner `node scripts/mat-settings.mjs`  
**Design:** [SETTINGS_MISSION_CONTROL.md](./SETTINGS_MISSION_CONTROL.md)  
**Rules:** #14–23 (especially **#23**)  
**Design System:** HublyDS (Rule #14) · Hubly wordmark  

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

Settings is the control center for Operate — configuration only (Rule #23).

**Owns:** Business · Team · Billing (platform) · Integrations OS · Notifications · Branding · AI defaults · Security · Permissions  
**Does not own:** Customers · Jobs · Revenue · Services · Reviews · Campaigns

---

## Gate

- [x] `SETTINGS_ARCHITECTURE.md` written before Development ✅  

---

## Stage 1 — Operating System

### Core
- [x] `ownPixelView('v-settings', 'jos-settings-root')` ✅
- [x] HublyDS + wordmark chrome ✅
- [x] Tabs ✅
- [x] Responsive ✅
- [x] Rule #23 purge of forbidden entity copies ✅

### Tabs
- [x] Overview ✅
- [x] Business ✅
- [x] Team ✅
- [x] Billing ✅
- [x] Integrations ✅
- [x] Notifications ✅
- [x] Branding ✅
- [x] AI ✅
- [x] Security ✅
- [x] Permissions ✅

### QA / MAT / CMV
- [x] Validator settings gates ✅  
- [x] MAT ✅ ACCEPTED — [SETTINGS_MAT.md](./SETTINGS_MAT.md)  
- [x] CMV incl. Ask Hubly ✅  

### Definition of Done
- [x] OS · MAT ✅ · CMV PASS · merge → 🔒 OS ✅  

---

## Mission Control reopen (`cursor/operate-settings-mission-control-2662`)

Design: [SETTINGS_MISSION_CONTROL.md](./SETTINGS_MISSION_CONTROL.md)

- [x] Control-center hero + floating art ✅
- [x] Status KPI strip (6 cards → tabs) ✅
- [x] Platform Checklist + Recommended Next Steps ✅
- [x] Ask Hubly help banner ✅
- [x] Rule #23 ownership + purge preserved ✅
- [x] Stage 2 `settings_*` schema migration ✅
- [x] MAT ✅ ACCEPTED · CMV PASS ✅
- [ ] Visual QA vs mockup (desktop / laptop / tablet / mobile)

**Do not modify Settings unless:** bug fix · Stage 2 integrations · explicit module reopen.

---

## Stage 2 — External Integrations & Advanced Configuration ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live Stripe / Google / Meta / Twilio / Resend | ⏸ |
| Live webhooks | ⏸ |
| Live subscription billing provider | ⏸ |
| External SSO / SIEM | ⏸ |
