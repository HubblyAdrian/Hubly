# Module 4 — 🧲 Leads

**Status:** 🔒 OS LOCKED (Stage 1) — merged #247  
**Branch:** `cursor/operate-leads-2662`  
**PR:** [#247](https://github.com/HubblyAdrian/Hubly/pull/247)  
**MAT:** [LEADS_MAT.md](./LEADS_MAT.md) · `node scripts/mat-leads.mjs`  
**Stage in scope:** Stage 1 — Operating System

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

Leads is the inbound interest OS — capture, qualify, quote, and convert. Stage 1 runs entirely on Hubly data (pipeline.manual + abandoned). No live Meta / Twilio / Google Forms sync.

---

## Stage 1 — Operating System

### Core Layout
- [x] Build Leads page ✅
- [x] Header (search, filter drawer, add lead) ✅
- [x] Tabs ✅
- [x] Lead List ✅
- [x] Lead Workspace ✅
- [x] Right Sidebar ✅
- [x] Responsive layout ✅

### Search
- [x] Real-time filter: name, phone, email, vehicle, property, service, source, notes, conversation text ✅
- [x] ESC clears search ✅

### Filters (drawer)
- [x] Status ✅
- [x] Source ✅
- [x] Assigned Employee ✅
- [x] Service ✅
- [x] Vehicle ✅
- [x] Property ✅
- [x] AI Score ✅
- [x] Tags ✅
- [x] Date Created ✅
- [x] Last Contacted ✅
- [x] Pipeline Stage ✅
- [x] Quote Status ✅
- [x] Estimated Value ✅
- [x] Apply / Reset / Save Filter ✅

### Add Lead modal
- [x] Name, Phone, Email, Address, Vehicle/Property, Service, Source, Assigned User, Notes, Tags ✅
- [x] Cancel / Save Lead / Save & Quote ✅

### Tabs
- [x] New Leads (stage=new) ✅
- [x] Quotes (quote_sent / viewed / expired) ✅
- [x] Waiting (customer / payment / photos / approval) ✅
- [x] Lost (lost / archived / spam / duplicate) ✅
- [x] AI Qualified (aiQualified, sort by score) ✅

### Lead list cards
- [x] Avatar, name, source, last message, last activity, unread, AI score, status, assigned, time ✅
- [x] Click → workspace ✅
- [x] Double-click → profile toast/open ✅
- [x] Context menu: call / sms / email / convert / archive / delete / assign / copy ✅

### Workspace tabs
- [x] Overview ✅
- [x] Conversation ✅
- [x] Quote ✅
- [x] Estimate ✅
- [x] Tasks ✅
- [x] Notes ✅
- [x] Files ✅
- [x] Print / share / email send as OS placeholders ✅

### Right sidebar
- [x] Notes ✅
- [x] Recent Activity ✅
- [x] Lead Score (+ recalculate) ✅
- [x] Attachments ✅

### Lead actions
- [x] Convert to Customer ✅
- [x] Convert to Job ✅
- [x] Create Quote ✅
- [x] Schedule Follow-up ✅
- [x] Request Photos ✅
- [x] Send Payment Link ✅
- [x] Send Review Request ✅
- [x] Archive ✅
- [x] Delete ✅
- [x] Duplicate ✅

### AI Features (in-app)
- [x] Lead score ✅
- [x] Buying intent ✅
- [x] Recommended follow-up ✅
- [x] Auto summary ✅
- [x] Conversation summary ✅
- [x] Suggested quote ✅
- [x] Suggested membership ✅
- [x] Follow-up reminder ✅
- [x] Duplicate detection ✅
- [x] Spam detection ✅

### Permissions UI
- [x] Role matrix (Owner / Manager / Office / Sales / Read Only) — OS display ✅

### Loading / Empty / Error
- [x] Loading state ✅
- [x] Empty list ✅
- [x] Empty workspace ✅
- [x] Error + Retry ✅

### Integrations CTAs (no “connected” claims)
- [x] Meta Lead Ads CTA (deferred) ✅
- [x] Messenger / IG CTA (deferred) ✅
- [x] Google Forms CTA (deferred) ✅

### Stage 1 Definition of Done
- [x] Tabs / buttons / workspace functional ✅
- [x] `ownPixelView('v-leads', 'jos-leads-root')` ✅
- [x] `renderLeads` + `handleLeadsAct` + `renderLeadsList` alias ✅
- [x] Validator leads gate passes ✅
- [x] No fake “connected” integration claims ✅
- [x] MAT formal acceptance ✅ · [LEADS_MAT.md](./LEADS_MAT.md)

---

## Stage 2 — Live Integrations ⏸ DEFERRED

Separate PR when opened. Do not pretend these are live in Stage 1 UI.

| Item | Status |
|------|--------|
| Meta Lead Ads live sync | ⏸ |
| Messenger / Instagram lead capture sync | ⏸ |
| Google Forms live sync | ⏸ |
| Twilio lead SMS automation | ⏸ |
|


## Lock

**Leads Operating System is locked (🔒 OS).** Do not modify Stage 1 OS unless bug fix, Stage 2 integrations, or explicit reopen.
