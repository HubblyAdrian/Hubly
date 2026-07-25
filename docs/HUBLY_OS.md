# Hubly OS — Locked

**Status:** Stable · Locked  
**Audience:** every engineer, designer, and founder  
**Related:** [`HUBLY_CONSTITUTION.md`](./HUBLY_CONSTITUTION.md) · [`HUBLY_V3_BUSINESS_OS.md`](./HUBLY_V3_BUSINESS_OS.md)

This document locks the operating system.

Do not invent parallel products. Do not fork the OS by industry.

---

## The competitive story

Jobber, Housecall Pro, and GoHighLevel ship the **same product** to everyone. Owners mold their business around the software.

Hubly is the opposite:

> **One operating system. Completely reshaped around each business.**

A wedding photographer opens Hubly and feels like it was built for photographers.  
A lawn care company feels like it was built for lawn care.  
A fitness coach feels like it was built for coaching.

They are all on the **same platform**.

The OS is constant.  
The experience is personalized.  
That is the advantage.

---

## Product philosophy

Hubly is **not**:

> One website builder for everyone.

Hubly **is**:

> One operating system that completely reshapes itself around the business.

The customer should feel Hubly was designed specifically for them — even though they use the same underlying platform as every other customer.

---

## The locked OS (identical for every industry)

These surfaces stay consistent. Do not replace them with industry-specific apps.

| Area | Role |
|------|------|
| Dashboard | Operate Home |
| Leads | Pipeline |
| Jobs & Calendar | Work + schedule |
| Customers | CRM |
| Quick Quote | Pricing conversations |
| Revenue | Money |
| Chats | Messaging |
| Marketplace | Demand / get done |
| Website | Public presence (editor + runtime) |
| Stripe | Payments |
| Google Calendar | Schedule sync |
| CRM | Same Customers / leads chassis |
| Payments | Stripe + booking money paths |
| Messaging | Same Chats / notification paths |

### Forbidden

- Do **not** create different CRMs per industry  
- Do **not** create different software stacks per industry  
- Do **not** create industry-specific navigation  
- Do **not** ship “Hubly for Photographers” as a separate product shell  

**One operating system.**

---

## What AI personalizes (above the OS)

AI’s job is to adapt the experience — not replace the chassis.

| AI generates / adapts | Examples |
|----------------------|----------|
| Website | Structure, copy, sections |
| Theme | Colors, typography, mood |
| Components | Cards, proof, CTAs |
| Homepage layout | Hero, packages, gallery order |
| Booking flow | Steps, fields, deposits |
| Packages | Names, tiers, pricing shape |
| Services | Catalog + add-ons |
| Customer journey | What happens after book |
| Calls to action | Book / Inquire / Get quote |
| Brand voice | How Hubly and the site speak |
| AI recommendations | One clear next move |
| Dashboard widgets & default focus | What “today” emphasizes |
| Suggested automations | Follow-ups, reviews, reminders |

Every business should **feel** custom-built.  
The software underneath remains **identical**.

---

## Roles (locked)

| Layer | Job |
|-------|-----|
| **Hubly OS** | Run the business — same chassis for everyone |
| **AI** | Build and continuously reshape the experience around that business |

AI does not replace Dashboard, Jobs, Customers, Revenue, or Calendar.  
AI fills them with the right defaults, focus, website, booking, and recommendations.

---

## Engineer rules

Before building anything industry-specific, ask:

1. Does this change the **OS** (nav, modules, data model forks)? → **Refuse.** Personalize above the OS instead.  
2. Does this change the **experience** (theme, packages, booking copy, widgets, recommendations)? → **Allowed** — via Brain / Create / conversation.  
3. Would a photographer and a lawn care owner still share the same left nav and module set? → **Must be yes.**

### One-line test

> Same OS. Different experience. Never different software.

---

## Modes (unchanged)

See [`HUBLY_V3_BUSINESS_OS.md`](./HUBLY_V3_BUSINESS_OS.md):

1. **Create** — AI builds the business (conversation + live generation)  
2. **Operate** — Owner runs the locked OS; AI continues to improve above it  

---

## Version

| Field | Value |
|-------|-------|
| Document | Hubly OS Lock |
| Version | 1.0.0 |
| Effective | 2026-07-25 |
| Rule | OS surfaces listed above are stable; personalization is AI’s job only |
