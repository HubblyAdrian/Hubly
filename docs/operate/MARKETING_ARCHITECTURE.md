# 📣 Marketing — Architecture (required before Development)

**Module:** 8 — Marketing  
**Stage in scope:** Stage 1 — Operating System  
**Rules:** #14 HublyDS · #15 Single Source of Truth · #16 End-to-End User Journey  
**Status:** Approved for Stage 1 OS implementation after this doc

---

## Purpose

Marketing creates **demand**. Reviews create **trust**. They complement each other:

- Marketing brings in new customers (and re-engages existing ones).  
- Reviews improve conversion by building credibility on Storefront and in outreach.

Marketing **never** owns Customers, Leads, Services, Jobs, Payments, or Reviews.

---

## Who owns this data? (Rule #15 gate)

Answer before every Marketing feature:

| Data | Owner | Marketing role |
|------|--------|----------------|
| Services | 🌐 Storefront | **Read** (catalog for campaign CTAs) |
| Customers | ❤️ Customers | **Read** (segments / audiences) |
| Leads | 🧲 Leads | **Read** (warm audiences, CPL context) |
| Jobs | 📅 Jobs | **Read** (activity for win-back timing) |
| Reviews | ⭐ Reviews | **Read** (social proof in drafts) |
| Payments / revenue | 💰 Revenue | **Read** (attribution OS/demo) |
| Membership plans | 🔁 Memberships | **Read** (upsell campaigns) |
| **Campaigns** | 📣 Marketing | **Own** |
| **Templates** (email/SMS/social) | 📣 Marketing | **Own** |
| **Automations** | 📣 Marketing | **Own** |
| **Coupons** | 📣 Marketing | **Own** |
| **Content calendar items** | 📣 Marketing | **Own** |
| **Ad campaign OS records** | 📣 Marketing | **Own** (live Meta = Stage 2) |

**No duplicate sources of truth.** Audience = filters over Customers/Leads, not a copied CRM.

---

## Campaigns

### Storage (Stage 1 OS)

```
S.marketingOs = {
  campaigns: [],      // owned
  templates: [],      // owned
  automations: [],    // owned
  coupons: [],        // owned
  calendar: [],       // owned
  ads: [],            // owned OS records; live Meta Stage 2
  score: number,
  toggles: {}
}
```

Campaign shape (OS):

| Field | Notes |
|-------|--------|
| `id` | `mkt_camp_*` |
| `name` | Display name |
| `channel` | `email` · `sms` · `social` · `meta` · `multi` |
| `status` | `draft` · `scheduled` · `active` · `paused` · `done` |
| `audience` | `{ type: 'segment', key }` — **references** Customers segments, never copies rows |
| `serviceId` | Optional **reference** to Storefront catalog id |
| `templateId` | Reference to owned template |
| `couponId` | Optional owned coupon |
| `body` / `subject` | Copy |
| `scheduledAt` | ISO / display |
| `stats` | OS/demo opens, clicks, sends, cpl, attributedRevenue |

### Audience selection

Audiences are **segment keys**, resolved at send-time from owning modules:

| Segment key | Source |
|-------------|--------|
| `all_customers` | `S.customers` (Customers) |
| `vip` / `members` / `favorites` | Customer tags / membership / favorite (Customers) |
| `new_customers` | Customers created recently |
| `at_risk` / `win_back` | Customers with stale last job (Jobs **read** + Customers) |
| `open_leads` | Leads pipeline.manual (Leads) |
| `ai_qualified_leads` | Leads with `aiQualified` |

No `S.marketingCustomers` array.

---

## Social

| Capability | Stage 1 OS | Stage 2 |
|------------|------------|---------|
| Facebook / Instagram post drafts | ✅ templates + calendar | Live Meta publish |
| Scheduler / Content Calendar | ✅ OS calendar board | Live Meta/IG scheduling |
| Media library | Placeholder | Cloud upload |

---

## Email

| Capability | Stage 1 OS | Stage 2 |
|------------|------------|---------|
| Templates | ✅ owned | — |
| Campaigns | ✅ create / edit / schedule (OS) | Resend / provider send |
| Automations | ✅ toggle OS rules | Live triggers |

---

## SMS

| Capability | Stage 1 OS | Stage 2 |
|------------|------------|---------|
| Templates | ✅ owned | — |
| Broadcasts | ✅ OS draft / “queue” toast | Twilio send |
| Reminders | ✅ automation toggles | Live Twilio |

---

## Meta Ads

| Capability | Stage 1 OS | Stage 2 |
|------------|------------|---------|
| Campaign performance cards | ✅ demo/OS stats | Live Meta Ads API |
| Lead Forms | Placeholder “Stage 2 · not connected” | Meta Lead Ads |
| Cost Per Lead | ✅ computed from OS stats | Live |
| Revenue Attribution | ✅ demo from Jobs/Revenue **read** | Live attribution |

Never claim Meta “connected” in Stage 1.

---

## AI (in-app)

| Feature | Behavior |
|---------|----------|
| Campaign Generator | Draft campaign into owned `campaigns` |
| Post Generator | Social template / calendar item |
| Email Writer | Email template body |
| SMS Writer | SMS template body |
| Budget Suggestions | OS tip from score + CPL demo |

Uses Ask Hubly / local generators — no external ad AI required for Stage 1.

---

## Data ownership summary

**Marketing reads:** Customers · Leads · Services (Storefront) · Jobs · Reviews · Revenue  
**Marketing owns:** Campaigns · Templates · Automations · Coupons · Calendar · Ad OS records

---

## Rule #16 — End-to-End User Journey

Marketing must not break this flow:

1. Visitor lands on **Storefront**  
2. Books a service (catalog owned by Storefront)  
3. **Lead** created (Leads)  
4. Appears in **Inbox**  
5. Quote sent  
6. Moves through **Pipeline**  
7. **Job** scheduled  
8. **Customer** profile created/updated  
9. Payment recorded (**Revenue**)  
10. **Review** request sent  
11. **Marketing** can re-engage the customer (owned campaigns; audience from Customers)  
12. **Ask Hubly** can answer questions about the journey  

CMV + Marketing MAT must confirm locked modules still render. Marketing UI must deep-link to golden customer profile / Storefront preview where relevant — never invent a second CRM or catalog.

---

## Stage 1 UI surface (implementation contract)

Mount: `ownPixelView('v-marketing', 'jos-marketing-root')`  
Acts: `mkt-*`  
HublyDS for chrome, cards, badges, AI insight, empty states.

Suggested tabs:

1. Overview (score, KPIs, today’s actions)  
2. Campaigns  
3. Email  
4. SMS  
5. Social / Calendar  
6. Ads (OS + Stage 2 placeholders)  
7. Automations  
8. Coupons  
9. AI Studio  

---

## Out of scope (Stage 1)

- Live Meta / Instagram / Facebook publish  
- Live Twilio / Resend send  
- Live ad spend sync  
- Owning or copying customer/lead/service rows  
