# Module 14 — ⚙️ Settings

**Status:** Stage 1 OS complete · MAT ✅ ACCEPTED · CMV PASS · awaiting PR approval  
**Branch:** `cursor/operate-settings-2662`  
**Architecture (required):** [SETTINGS_ARCHITECTURE.md](./SETTINGS_ARCHITECTURE.md)  
**Plan:** [SETTINGS_PLAN.md](./SETTINGS_PLAN.md)  
**MAT:** [SETTINGS_MAT.md](./SETTINGS_MAT.md)  
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
- [ ] OS · MAT ✅ · CMV PASS · merge → 🔒 OS ⏳ (awaiting approval)  

---

## Stage 2 — Advanced AI / Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live Stripe / Google / Meta / Twilio / Resend | ⏸ |
| Live webhooks | ⏸ |
| Live subscription billing provider | ⏸ |
| External SSO / SIEM | ⏸ |
