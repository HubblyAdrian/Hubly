# Module 13 — ✨ Ask Hubly

**Status:** Stage 1 OS complete · MAT ✅ ACCEPTED · CMV PASS · awaiting PR approval
**Branch:** `cursor/operate-ask-hubly-2662`  
**Architecture (required):** [ASK_HUBLY_ARCHITECTURE.md](./ASK_HUBLY_ARCHITECTURE.md)  
**Plan:** [ASK_HUBLY_PLAN.md](./ASK_HUBLY_PLAN.md)  
**Rules:** #14–22 (especially **#22**)  
**Design System:** HublyDS (Rule #14) · Hubly wordmark  

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

Ask Hubly is the intelligence layer on top of Operate — not just another page.

**Reads:** Customers · Leads · Jobs · Revenue · Reports · Marketing · Reviews · Memberships · Services · Settings  
**Owns:** `S.askHublyOs` — conversations, memory, actions, pending confirmations, automation allow-rules  
**Writes:** Only via approved action catalog + Rule #22 confirmation

---

## Gate

- [x] `ASK_HUBLY_ARCHITECTURE.md` written before Development ✅  

---

## Stage 1 — Operating System

### Core
- [x] `ownPixelView('v-ask', 'jos-ask-root')` ✅
- [x] HublyDS + wordmark chrome ✅
- [x] Tabs ✅
- [x] Responsive ✅

### Tabs
- [x] Chat ✅
- [x] Actions (pending + log) ✅
- [x] Memory ✅
- [x] Automations ✅
- [x] Context (read map) ✅
- [x] Activity ✅

### Confirmation (Rule #22)
- [x] High-impact actions → pending confirm ✅
- [x] Safe drafts / summarize / explain → no confirm ✅
- [x] Automation allow-rules can auto-confirm listed types only ✅
- [x] Hard guards: no silent finance/delete/pricing/publish ✅

### Actions (`ah-*`)
- [x] Propose / confirm / cancel actions ✅
- [x] Create job / quote (confirm) ✅
- [x] Draft campaign (safe) / send campaign (confirm) ✅
- [x] Update / publish website (confirm) ✅
- [x] Generate report / summarize / suggest (safe) ✅

### QA / MAT / CMV
- [x] Validator ask-hubly gates ✅  
- [x] MAT ✅ ACCEPTED — [ASK_HUBLY_MAT.md](./ASK_HUBLY_MAT.md)  
- [x] CMV incl. Reports ✅  

### Definition of Done
- [ ] OS · MAT ✅ · CMV PASS · merge → 🔒 OS ⏳ (awaiting approval)  

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live LLM provider | ⏸ |
| Live external tool calling | ⏸ |
| Live publish APIs | ⏸ |
