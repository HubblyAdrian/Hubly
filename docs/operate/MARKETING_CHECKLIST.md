# Module 8 — 📣 Marketing

**Status:** Stage 1 OS complete · QA / MAT pending  
**Branch:** `cursor/operate-marketing-2662`  
**Architecture:** [MARKETING_ARCHITECTURE.md](./MARKETING_ARCHITECTURE.md) ✅  
**Design System:** HublyDS (Rule #14)  
**Ownership:** Campaigns / Templates / Automations / Coupons (Rule #15)  
**E2E:** Rule #16 journey must remain intact  

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

Marketing creates demand. Reads Customers, Leads, Services, Jobs, Reviews, Revenue. Owns campaigns, templates, automations, coupons, calendar, ad OS records.

---

## Stage 1 — Operating System

### Core
- [x] Architecture doc approved ✅ (shipped)  
- [x] `ownPixelView('v-marketing', 'jos-marketing-root')` ✅  
- [x] HublyDS chrome ✅  
- [x] Tabs ✅  
- [x] Responsive ✅  

### Tabs
- [x] Overview ✅  
- [x] Campaigns ✅  
- [x] Email ✅  
- [x] SMS ✅  
- [x] Social / Calendar ✅  
- [x] Ads (OS + Stage 2 placeholders) ✅  
- [x] Automations ✅  
- [x] Coupons ✅  
- [x] AI Studio ✅  

### Ownership (Rule #15)
- [x] `S.marketingOs` owns campaigns/templates/automations/coupons/calendar/ads ✅  
- [x] Audiences = segment keys over Customers/Leads (no copied CRM) ✅  
- [x] Service CTAs reference Storefront catalog ✅  

### Actions (`mkt-*`)
- [x] Create/edit campaign, schedule (OS), pause ✅  
- [x] Template CRUD (email/SMS/social) ✅  
- [x] Automation toggles ✅  
- [x] Coupon create ✅  
- [x] AI generate campaign/post/email/SMS ✅  
- [x] Stage 2: Meta/Twilio/Resend toasts ✅  

### Rule #16
- [x] Deep-link Storefront preview / customer profile where relevant ✅  
- [x] CMV locked modules incl. Storefront ✅  

### QA / MAT / CMV
- [x] Validator marketing gate ✅  
- [ ] MAT ⏳  
- [x] CMV PASS ✅  

### Definition of Done
- [ ] OS complete · MAT ✅ · CMV PASS · merge → 🔒 OS ⏳  

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Meta Ads / Lead Forms / publish | ⏸ |
| Twilio SMS send | ⏸ |
| Resend / email provider send | ⏸ |
| Live ad spend + attribution | ⏸ |
