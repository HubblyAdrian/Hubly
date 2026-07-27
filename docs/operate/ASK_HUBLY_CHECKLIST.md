# Module 13 — ✨ Ask Hubly

**Status:** Architecture approved · Stage 1 OS pending  
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
- [ ] `ownPixelView('v-ask', 'jos-ask-root')` ⏳  
- [ ] HublyDS + wordmark chrome ⏳  
- [ ] Tabs ⏳  
- [ ] Responsive ⏳  

### Tabs
- [ ] Chat ⏳  
- [ ] Actions (pending + log) ⏳  
- [ ] Memory ⏳  
- [ ] Automations ⏳  
- [ ] Context (read map) ⏳  
- [ ] Activity ⏳  

### Confirmation (Rule #22)
- [ ] High-impact actions → pending confirm ⏳  
- [ ] Safe drafts / summarize / explain → no confirm ⏳  
- [ ] Automation allow-rules can auto-confirm listed types only ⏳  
- [ ] Hard guards: no silent finance/delete/pricing/publish ⏳  

### Actions (`ah-*`)
- [ ] Propose / confirm / cancel actions ⏳  
- [ ] Create job / quote (confirm) ⏳  
- [ ] Draft campaign (safe) / send campaign (confirm) ⏳  
- [ ] Update / publish website (confirm) ⏳  
- [ ] Generate report / summarize / suggest (safe) ⏳  

### QA / MAT / CMV
- [ ] Validator ask-hubly gates ⏳  
- [ ] MAT ⏳  
- [ ] CMV incl. Reports ⏳  

### Definition of Done
- [ ] OS · MAT ✅ · CMV PASS · merge → 🔒 OS ⏳  

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live LLM provider | ⏸ |
| Live external tool calling | ⏸ |
| Live publish APIs | ⏸ |
