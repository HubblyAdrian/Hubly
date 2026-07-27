# ⚙️ Settings — Architecture (required before Development)

**Module:** 14 — Settings  
**Stage in scope:** Stage 1 — Operating System  
**Mount:** `settings` → `#v-settings` / `#jos-settings-root`  
**Rules:** #14–23 (especially **#15 · #19 · #23**)  
**Status:** Required gate — do not start Settings Development without this doc

---

## Purpose

Settings is **not just a settings page**.

It is the **control center** for the entire Hubly Operate platform.

It configures how the business, team, billing, integrations, notifications, branding, AI, security, and permissions behave.

It must stay a **configuration owner** — never a second CRM, ledger, catalog, or campaign store (**Rule #23**).

---

## Rule #23 — Settings Never Own Business Data

Settings configure the platform.

They **never** become the owner of:

- Customers  
- Jobs  
- Revenue (customer payments / invoices / refunds)  
- Services  
- Reviews  
- Marketing campaigns  

Settings only store **configuration** that other modules read.

---

## What Settings owns

| Area | Owns (config only) |
|------|---------------------|
| **Business** | Business name, address, time zone, currency, tax defaults, logo URL, contact information |
| **Team** | Users, roles, invitations, team-level permission assignments |
| **Billing** | Hubly subscription, payment method (OS stub), plan, usage meters, **platform** invoices (not customer Revenue invoices) |
| **Integrations** | Stripe / Google / Meta / Twilio / Resend / Webhooks connection **status + OS config** (Stage 1 stubs; not live) |
| **Notifications** | Email, SMS, push, desktop, AI notification preferences |
| **Branding** | Logo, colors, fonts, favicon, website defaults (visual tokens other modules may read) |
| **AI Settings** | AI tone, AI permissions, auto-action defaults, memory defaults, automation defaults (global; Ask Hubly may hold session memory) |
| **Security** | MFA flags, sessions, API keys (OS), audit log, password policy |
| **Permissions** | Roles catalog, feature access, module access, custom permissions |

```
S.settingsOs = {
  tab: 'overview',
  business: { name, address, city, region, postal, country, timeZone, currency, taxDefault, logoUrl, contactEmail, contactPhone },
  team: { users: [], invitations: [] },
  billing: { plan, status, paymentMethod, usage: {}, invoices: [] },  // platform billing only
  integrations: { stripe, google, meta, twilio, resend, webhooks: [] },
  notifications: { email, sms, push, desktop, ai },
  branding: { logoUrl, primaryColor, accentColor, fontDisplay, fontBody, faviconUrl, websiteDefaults },
  ai: { tone, permissions, autoActionsDefault, memoryDefault, automationDefaults },
  security: { mfaRequired, sessions: [], apiKeys: [], auditLog: [], passwordPolicy },
  permissions: { roles: [], featureAccess: {}, moduleAccess: {}, custom: [] },
  activity: [],
  _seeded: false
}
```

**Forbidden inside `settingsOs`:** customer rows, job rows, payment/revenue ledgers, service catalog copies, review tables, marketing campaign stores.

---

## What Settings can READ

| Source | Purpose |
|--------|---------|
| `S.team` (legacy roster) | Seed / mirror team users for Jobs assignment compatibility |
| Ask Hubly prefs (optional) | Reflect AI confirmation defaults (Rule #22) |
| Storefront branding surfaces | Deep-link only — Storefront still owns website pages/services |
| Revenue Stripe connect status | Display OS integration status; Revenue remains financial owner |

Settings may **mirror** team roster into `S.team` when saving users so locked Jobs keep working — Settings remains the **writer** of that roster config.

---

## What Settings can WRITE

Only configuration in `S.settingsOs` (and the team roster mirror described above).

Examples:

- Save business profile  
- Invite / deactivate team user (OS)  
- Change Hubly plan stub  
- Toggle notification channels  
- Update brand colors  
- Set AI tone / auto-action defaults  
- Rotate API key (OS)  
- Append security audit log entries  

### Must NOT write

- Customer / Lead / Job entities  
- Revenue ledger entries or customer invoices  
- Service catalog or campaign content  
- Review records  

Live integration connect/disconnect APIs are **Stage 2**.

---

## Stage 1 vs Stage 2

| Stage 1 (OS) | Stage 2 (deferred) |
|--------------|-------------------|
| All areas editable in-Hubly | Live Stripe / Google / Meta / Twilio / Resend OAuth |
| Integration cards show Connected / Not connected (OS) | Real webhook delivery |
| Platform billing stubs + usage meters | Live subscription billing provider |
| Audit log append-only in OS | External SIEM / SSO |

Never claim an integration is “live connected” until Stage 2.

---

## Events (Rules #17–18)

| Event | When |
|-------|------|
| `settings.updated` | Any settings area saved |
| `settings.team.invited` | Invitation created |
| `settings.integration.toggled` | Integration OS status changed |
| `settings.security.audited` | Security-sensitive change logged |

Append-only — do not rewrite prior audit / activity rows (Rule #18).

---

## UI (Stage 1)

Tabs: Overview · Business · Team · Billing · Integrations · Notifications · Branding · AI · Security · Permissions  

Chrome: HublyDS · Hubly wordmark · act prefix `set-*` · `ownPixelView('v-settings', 'jos-settings-root')`

---

## Finish line

After Settings merges and locks, all **14** Operate modules have Stage 1 OS complete:

Home · Inbox · Jobs · Leads · Customers · Pipeline · Storefront · Marketing · Reviews · Memberships · Revenue · Reports · Ask Hubly · Settings
