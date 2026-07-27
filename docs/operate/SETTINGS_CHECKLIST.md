# Module 14 — ⚙️ Settings

**Status:** Architecture approved · Stage 1 OS in progress  
**Branch:** `cursor/operate-settings-2662`  
**Architecture (required):** [SETTINGS_ARCHITECTURE.md](./SETTINGS_ARCHITECTURE.md)  
**Plan:** [SETTINGS_PLAN.md](./SETTINGS_PLAN.md)  
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
- [ ] `ownPixelView('v-settings', 'jos-settings-root')` ⏳
- [ ] HublyDS + wordmark chrome ⏳
- [ ] Tabs ⏳
- [ ] Responsive ⏳
- [ ] Rule #23 purge of forbidden entity copies ⏳

### Tabs
- [ ] Overview ⏳
- [ ] Business ⏳
- [ ] Team ⏳
- [ ] Billing ⏳
- [ ] Integrations ⏳
- [ ] Notifications ⏳
- [ ] Branding ⏳
- [ ] AI ⏳
- [ ] Security ⏳
- [ ] Permissions ⏳

### QA / MAT / CMV
- [ ] Validator settings gates ⏳  
- [ ] MAT ⏳  
- [ ] CMV incl. Ask Hubly ⏳  

### Definition of Done
- [ ] OS · MAT ✅ · CMV PASS · merge → 🔒 OS ⏳  

---

## Stage 2 — Advanced AI / Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live Stripe / Google / Meta / Twilio / Resend | ⏸ |
| Live webhooks | ⏸ |
| Live subscription billing provider | ⏸ |
| External SSO / SIEM | ⏸ |
