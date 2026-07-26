# Module 5 — ❤️ Customers

**Status:** In Progress  
**Branch:** `cursor/operate-customers-2662`  
**Stage in scope:** Stage 1 — Operating System  
**Golden profile:** Reuse `openCustomerProfile` / profile shell everywhere (Leads, Inbox, Jobs, Pipeline, Revenue, Reports, Ask Hubly)

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

The Customers module is the permanent record for every client. Stage 1 runs on Hubly data only — one unified profile for communication, jobs, payments, memberships, photos, documents, reviews, and AI insights.

---

## Stage 1 — Operating System

### Core Layout
- [ ] Header
- [ ] Tabs
- [ ] Customer List
- [ ] Customer Profile (golden profile)
- [ ] Right Sidebar
- [ ] Responsive layout

### Header
- [ ] Search (name, phone, email, address, vehicle, property, membership, tags, notes)
- [ ] Filters drawer (Active, Inactive, Membership, Lifetime Value, Last Job, City, Assigned Employee, Service, Vehicle, Tags · Apply / Reset / Save)
- [ ] Add Customer modal (Cancel / Save)

### Tabs
- [ ] All Customers
- [ ] Memberships
- [ ] Vehicles / Properties
- [ ] Segments (VIP, High LTV, New, At Risk, Seasonal, Repeat)
- [ ] Favorites

### Customer List
- [ ] Cards: avatar, name, lifetime value, last job, membership badge, tags, AI score, unread, favorite
- [ ] Click → profile
- [ ] Context menu: Call, SMS, Email, Book Job, Quote, Favorite, Archive

### Profile (golden)
- [ ] Overview
- [ ] Timeline
- [ ] Jobs (upcoming / completed / cancelled / recurring)
- [ ] Payments
- [ ] Photos
- [ ] Messages
- [ ] Membership
- [ ] Reviews
- [ ] Documents
- [ ] Notes

### Sidebar
- [ ] AI Summary
- [ ] Quick Actions
- [ ] Customer Health
- [ ] Recent Activity

### AI
- [ ] Customer Summary
- [ ] Churn Prediction
- [ ] Upsell Recommendations
- [ ] Membership Suggestions
- [ ] Revenue Forecast
- [ ] Next Best Action
- [ ] Review Prediction

### Permissions UI
- [ ] Owner / Manager / Office / Sales / Read Only matrix

### Empty / Error / Mobile
- [ ] Empty states
- [ ] Error states
- [ ] Responsive Desktop / Tablet / Mobile

### QA / MAT / CMV
- [ ] Buttons / navigation functional
- [ ] Console errors = 0
- [ ] Validator PASS
- [ ] MAT formal acceptance
- [ ] Cross-Module Verification (Home · Inbox · Jobs · Leads)

### Stage 1 Definition of Done
- [ ] Customers OS complete
- [ ] Golden profile reused (not a second profile UI)
- [ ] MAT ✅ ACCEPTED
- [ ] CMV ✅ PASS
- [ ] Ready for merge → lock 🔒 OS

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live payment processor refunds / sync | ⏸ |
| Live Google / Facebook review sync | ⏸ |
| Live membership billing provider | ⏸ |
| Cloud document storage provider | ⏸ |
