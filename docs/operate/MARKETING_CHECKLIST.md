# Module 8 — 📣 Marketing

**Status:** Architecture done · Stage 1 OS in progress  
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
- [ ] Architecture doc approved ✅ (shipped)  
- [ ] `ownPixelView('v-marketing', 'jos-marketing-root')` ⏳  
- [ ] HublyDS chrome ⏳  
- [ ] Tabs ⏳  
- [ ] Responsive ⏳  

### Tabs
- [ ] Overview ⏳  
- [ ] Campaigns ⏳  
- [ ] Email ⏳  
- [ ] SMS ⏳  
- [ ] Social / Calendar ⏳  
- [ ] Ads (OS + Stage 2 placeholders) ⏳  
- [ ] Automations ⏳  
- [ ] Coupons ⏳  
- [ ] AI Studio ⏳  

### Ownership (Rule #15)
- [ ] `S.marketingOs` owns campaigns/templates/automations/coupons/calendar/ads ⏳  
- [ ] Audiences = segment keys over Customers/Leads (no copied CRM) ⏳  
- [ ] Service CTAs reference Storefront catalog ⏳  

### Actions (`mkt-*`)
- [ ] Create/edit campaign, schedule (OS), pause ⏳  
- [ ] Template CRUD (email/SMS/social) ⏳  
- [ ] Automation toggles ⏳  
- [ ] Coupon create ⏳  
- [ ] AI generate campaign/post/email/SMS ⏳  
- [ ] Stage 2: Meta/Twilio/Resend toasts ⏳  

### Rule #16
- [ ] Deep-link Storefront preview / customer profile where relevant ⏳  
- [ ] CMV locked modules incl. Storefront ⏳  

### QA / MAT / CMV
- [ ] Validator marketing gate ⏳  
- [ ] MAT ⏳  
- [ ] CMV PASS ⏳  

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
