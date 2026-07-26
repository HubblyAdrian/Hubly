# Module 5 — ❤️ Customers

**Status:** 🔒 OS LOCKED (Stage 1) — merged #248  
**Branch:** `cursor/operate-customers-2662`  
**PR:** [#248](https://github.com/HubblyAdrian/Hubly/pull/248)  
**Stage in scope:** Stage 1 — Operating System  
**Golden profile:** Reuse `openCustomerProfile` / profile shell everywhere (Leads, Inbox, Jobs, Pipeline, Revenue, Reports, Ask Hubly)

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

The Customers module is the permanent record for every client. Stage 1 runs on Hubly data only — one unified profile for communication, jobs, payments, memberships, photos, documents, reviews, and AI insights.

---

## Stage 1 — Operating System

### Core Layout
- [x] Header ✅
- [x] Tabs ✅
- [x] Customer List ✅
- [x] Customer Profile (golden profile) ✅
- [x] Right Sidebar ✅
- [x] Responsive layout ✅

### Header
- [x] Search (name, phone, email, address, vehicle, property, membership, tags, notes) ✅
- [x] Filters drawer (Active, Inactive, Membership, Lifetime Value, Last Job, City, Assigned Employee, Service, Vehicle, Tags · Apply / Reset / Save) ✅
- [x] Add Customer modal (Cancel / Save) ✅

### Tabs
- [x] All Customers ✅
- [x] Memberships ✅
- [x] Vehicles / Properties ✅
- [x] Segments (VIP, High LTV, New, At Risk, Seasonal, Repeat) ✅
- [x] Favorites ✅

### Customer List
- [x] Cards: avatar, name, lifetime value, last job, membership badge, tags, AI score, unread, favorite ✅
- [x] Click → profile ✅ (`openCustomerProfile`)
- [x] Context menu: Call, SMS, Email, Book Job, Quote, Favorite, Archive ✅

### Profile (golden)
- [x] Overview ✅
- [x] Timeline ✅
- [x] Jobs (upcoming / completed / cancelled / recurring) ✅
- [x] Payments ✅
- [x] Photos ✅
- [x] Messages ✅
- [x] Membership ✅
- [x] Reviews ✅
- [x] Documents ✅
- [x] Notes ✅

### Sidebar
- [x] AI Summary ✅
- [x] Quick Actions ✅
- [x] Customer Health ✅
- [x] Recent Activity ✅

### AI
- [x] Customer Summary ✅
- [x] Churn Prediction ✅
- [x] Upsell Recommendations ✅
- [x] Membership Suggestions ✅
- [x] Revenue Forecast ✅
- [x] Next Best Action ✅
- [x] Review Prediction ✅

### Permissions UI
- [x] Owner / Manager / Office / Sales / Read Only matrix ✅

### Empty / Error / Mobile
- [x] Empty states ✅
- [x] Error states ✅
- [x] Responsive Desktop / Tablet / Mobile ✅

### QA / MAT / CMV
- [x] Buttons / navigation functional ✅
- [x] Console errors = 0 ✅
- [x] Validator PASS ✅
- [x] MAT formal acceptance ✅ (`docs/operate/CUSTOMERS_MAT.md`)
- [x] Cross-Module Verification (Home · Inbox · Jobs · Leads) ✅ (locked modules untouched)

### Stage 1 Definition of Done
- [x] Customers OS complete ✅
- [x] Golden profile reused (not a second profile UI) ✅
- [x] MAT ✅ ACCEPTED ✅
- [x] CMV ✅ PASS ✅ (locked modules)
- [x] Ready for merge → lock 🔒 OS after approval ✅

---

## Lock

**Customers Operating System is locked (🔒 OS).** Do not modify Stage 1 OS unless bug fix, Stage 2 integrations, or explicit reopen.

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live payment processor refunds / sync | ⏸ |
| Live Google / Facebook review sync | ⏸ |
| Live membership billing provider | ⏸ |
| Cloud document storage provider | ⏸ |
