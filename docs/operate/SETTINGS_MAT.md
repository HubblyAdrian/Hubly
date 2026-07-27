# Module Acceptance Test (MAT)

**Module:** ⚙️ Settings  
**Stage:** 1 — Operating System  
**Branch:** `cursor/operate-settings-2662`  
**Date:** 2026-07-27  
**Runner:** `node scripts/mat-settings.mjs`  
**Architecture:** [SETTINGS_ARCHITECTURE.md](./SETTINGS_ARCHITECTURE.md)  
**Rules:** #14–23 (especially #23)

---

## Checklist (final QA pass)

### Header / Ownership / Architecture
✅ Page renders
✅ settingsOs created
✅ Seeded team users
✅ SETTINGS_ARCHITECTURE present
✅ Rule #23 in engineering rules

### Tabs
✅ overview
✅ business
✅ team
✅ billing
✅ integrations
✅ notifications
✅ branding
✅ ai
✅ security
✅ permissions

### Areas
✅ Name saved
✅ Invitation created
✅ User added
✅ Mirrors S.team
✅ Plan saved
✅ Toggle OS status
✅ Webhook added
✅ SMS off saved
✅ Accent saved
✅ Tone saved
✅ MFA enabled
✅ API key created
✅ Custom permission added
✅ Module access saveable

### Rule #23 / Events
✅ Settings event constants
✅ Purges customers copy
✅ Purges payments copy
✅ Purges jobs copy
✅ Purges campaigns copy
✅ Config-only guard
✅ HublyEvents loaded
✅ settings.updated published
✅ settings.team.invited published
✅ settings.integration.toggled published
✅ settings.security.audited published

### CMV
✅ Locked modules incl. Ask Hubly

### Responsive
✅ Desktop
✅ Tablet
✅ Mobile

---

## Final QA Report

| Field | Result |
|-------|--------|
| Buttons Tested | 15 / 15 |
| Console Errors | 0 |
| Validator | PASS |
| CMV | PASS |
| Known Issues | None |
| Deferred | Live Stripe/Google/Meta/Twilio/Resend · Live webhooks · Live subscription billing |

---

## Module Acceptance Test (MAT)

**Module:** ⚙️ Settings

| Metric | Count |
|--------|-------|
| Checklist | 45 / 45 |
| Buttons | 15 / 15 |
| Tabs | 10 / 10 |
| Routes | 12 / 12 |
| Console Errors | 0 |
| Validator | PASS |
| CMV | PASS |
| Responsive | Desktop ✅ · Tablet ✅ · Mobile ✅ |

**Deferred:** Live Stripe/Google/Meta/Twilio/Resend · Live webhooks · Live subscription billing

### Result

✅ ACCEPTED

---

## Section detail

### Events (5/5)
- ✅ HublyEvents loaded
- ✅ settings.updated published
- ✅ settings.team.invited published
- ✅ settings.integration.toggled published
- ✅ settings.security.audited published

### Rule 23 (6/6)
- ✅ Settings event constants
- ✅ Purges customers copy
- ✅ Purges payments copy
- ✅ Purges jobs copy
- ✅ Purges campaigns copy
- ✅ Config-only guard

### Header (1/1)
- ✅ Page renders

### Ownership (2/2)
- ✅ settingsOs created
- ✅ Seeded team users

### Architecture (2/2)
- ✅ SETTINGS_ARCHITECTURE present
- ✅ Rule #23 in engineering rules

### Tabs (10/10)
- ✅ overview
- ✅ business
- ✅ team
- ✅ billing
- ✅ integrations
- ✅ notifications
- ✅ branding
- ✅ ai
- ✅ security
- ✅ permissions

### Business (1/1)
- ✅ Name saved

### Team (3/3)
- ✅ Invitation created
- ✅ User added
- ✅ Mirrors S.team

### Billing (1/1)
- ✅ Plan saved

### Integrations (2/2)
- ✅ Toggle OS status
- ✅ Webhook added

### Notifications (1/1)
- ✅ SMS off saved

### Branding (1/1)
- ✅ Accent saved

### AI (1/1)
- ✅ Tone saved

### Security (2/2)
- ✅ MFA enabled
- ✅ API key created

### Permissions (2/2)
- ✅ Custom permission added
- ✅ Module access saveable

### Rule 15 (1/1)
- ✅ Owns settingsOs

### Brand (1/1)
- ✅ Hubly wordmark

### Design System (1/1)
- ✅ Uses HublyDS

### Routes (12/12)
- ✅ set-business-save
- ✅ set-team-invite
- ✅ set-billing-save
- ✅ set-integration-toggle
- ✅ set-webhook-add
- ✅ set-notifications-save
- ✅ set-branding-save
- ✅ set-ai-save
- ✅ set-security-save
- ✅ set-api-create
- ✅ set-perm-custom-add
- ✅ set-go-ask

### Empty States (1/1)
- ✅ Empty helpers

### Error States (1/1)
- ✅ Retry markup

### Responsive CSS (1/1)
- ✅ Settings layout

### Mount (1/1)
- ✅ jos-settings-root in hubly.html

### Validator (1/1)
- ✅ check-customer-journey-os — PASS in 40ms

### CMV (1/1)
- ✅ Locked modules incl. Ask Hubly

### Console (1/1)
- ✅ Console errors = 0 — 0

### Responsive (3/3)
- ✅ Desktop
- ✅ Tablet
- ✅ Mobile
