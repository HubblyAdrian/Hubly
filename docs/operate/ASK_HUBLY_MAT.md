# Module Acceptance Test (MAT)

**Module:** ✨ Ask Hubly  
**Stage:** 1 — Operating System  
**Branch:** `cursor/operate-ask-hubly-2662`  
**Date:** 2026-07-27  
**Runner:** `node scripts/mat-ask-hubly.mjs`  
**Architecture:** [ASK_HUBLY_ARCHITECTURE.md](./ASK_HUBLY_ARCHITECTURE.md)  
**Rules:** #14–22 (especially #22)

---

## Checklist (final QA pass)

### Header / Ownership / Architecture
✅ Page renders
✅ askHublyOs created
✅ Seeded conversation
✅ ASK_HUBLY_ARCHITECTURE present
✅ Rule #22 in engineering rules

### Tabs
✅ chat
✅ actions
✅ memory
✅ automations
✅ context
✅ activity

### Rule #22 confirmation
✅ Draft executes without pending
✅ AI event constants
✅ Create job queued for confirm
✅ Confirmed creates job
✅ Publish website pending
✅ Cancel removes pending
✅ Automation skips pending
✅ Confirmation engine
✅ Refund requires confirm
✅ Allow-rule saved

### Events / Ownership guards
✅ HublyEvents loaded
✅ ai.draft.generated or executed
✅ ai.action.proposed published
✅ ai.action.confirmed published
✅ ai.action.executed published
✅ ai.action.cancelled published
✅ Purges customers copy
✅ Purges payments copy
✅ Memory note added

### CMV
✅ Locked modules incl. Reports

### Responsive
✅ Desktop
✅ Tablet
✅ Mobile

---

## Final QA Report

| Field | Result |
|-------|--------|
| Buttons Tested | 11 / 11 |
| Console Errors | 0 |
| Validator | PASS |
| CMV | PASS |
| Known Issues | None |
| Deferred | Live LLM · Live external tool calling · Live publish APIs |

---

## Module Acceptance Test (MAT)

**Module:** ✨ Ask Hubly

| Metric | Count |
|--------|-------|
| Checklist | 37 / 37 |
| Buttons | 11 / 11 |
| Tabs | 6 / 6 |
| Routes | 8 / 8 |
| Console Errors | 0 |
| Validator | PASS |
| CMV | PASS |
| Responsive | Desktop ✅ · Tablet ✅ · Mobile ✅ |

**Deferred:** Live LLM · Live external tool calling · Live publish APIs

### Result

✅ ACCEPTED

---

## Section detail

### Events (6/6)
- ✅ HublyEvents loaded
- ✅ ai.draft.generated or executed
- ✅ ai.action.proposed published
- ✅ ai.action.confirmed published
- ✅ ai.action.executed published
- ✅ ai.action.cancelled published

### Rule 22 (7/7)
- ✅ AI event constants
- ✅ Create job queued for confirm
- ✅ Confirmed creates job
- ✅ Publish website pending
- ✅ Cancel removes pending
- ✅ Automation skips pending
- ✅ Confirmation engine

### Header (1/1)
- ✅ Page renders

### Ownership (2/2)
- ✅ askHublyOs created
- ✅ Seeded conversation

### Architecture (2/2)
- ✅ ASK_HUBLY_ARCHITECTURE present
- ✅ Rule #22 in engineering rules

### Tabs (6/6)
- ✅ chat
- ✅ actions
- ✅ memory
- ✅ automations
- ✅ context
- ✅ activity

### Safe (1/1)
- ✅ Draft executes without pending

### Jobs (1/1)
- ✅ Job not created before confirm

### Automations (1/1)
- ✅ Allow-rule saved

### Quotes (1/1)
- ✅ Quote created via automation

### Memory (1/1)
- ✅ Memory note added

### Rule 19 (2/2)
- ✅ Purges customers copy
- ✅ Purges payments copy

### Hard guards (1/1)
- ✅ Refund requires confirm

### Rule 15 (1/1)
- ✅ Owns askHublyOs

### Brand (1/1)
- ✅ Hubly wordmark

### Design System (1/1)
- ✅ Uses HublyDS

### Routes (8/8)
- ✅ ah-confirm
- ✅ ah-cancel
- ✅ ah-propose-create-job
- ✅ ah-propose-generate-draft
- ✅ ah-memory-add
- ✅ ah-auto-add
- ✅ ah-go-money
- ✅ ah-go-reports

### Empty States (1/1)
- ✅ Empty helpers

### Error States (1/1)
- ✅ Retry markup

### Responsive CSS (1/1)
- ✅ Ask Hubly layout

### Mount (1/1)
- ✅ jos-ask-root in hubly.html

### Validator (1/1)
- ✅ check-customer-journey-os — PASS in 34ms

### CMV (1/1)
- ✅ Locked modules incl. Reports

### Console (1/1)
- ✅ Console errors = 0 — 0

### Responsive (3/3)
- ✅ Desktop
- ✅ Tablet
- ✅ Mobile
