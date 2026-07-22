# Hubly Launch Checklist

Not a technical checklist. A **customer checklist**.

For every item, answer one question:

> **Can a real business owner depend on Hubly for this today?**

If the answer is no, the milestone is not done.

Architecture is frozen. V1 is frozen. This checklist is frozen.
We ship customer milestones — not features.

---

## North Star

**Revenue generated through Hubly-powered businesses.**

Every sprint should remove the largest blocker preventing a business from earning money.

Before merging a PR ask:

> Could a real business owner make more money because of this change?

If no — keep building.

---

## How to use this file

1. Ask: **What is preventing a customer from trusting Hubly with their business / earning money?**
2. Fix that hire/revenue blocker as **one experience**.
3. Check the box only when the answer is honestly **yes**.
4. Ship. Repeat.

**v1 scope:** [`V1_RELEASE.md`](./V1_RELEASE.md)

**PR rule:** Every pull request must move a real hire/revenue outcome forward. No architecture PRs.

---

## Milestone 1 — Business Created ✅

**Outcome:** A brand-new owner describes their business and a real company now exists inside Hubly.

| Dependable today? | Customer proof |
|---|---|
| [x] | Owner can describe the business in conversation and Hubly creates it |
| [x] | Business Identity, logo path, brand colors, website, booking page, CRM foundation |
| [x] | SEO / schema / publish path foundations exist |
| [x] | No fake testimonials, fake reviews, or fake urgency |

---

## Milestone 2 — Business Launched ★ CURRENT PRIORITY

**Outcome:** A customer can successfully **hire** a business. The owner should not need to touch anything for the request to land.

**Hire journey (one experience):**

Open Hubly website → view services → choose package → select available time → pay or deposit (when Stripe connected) → confirmation → CRM updates → owner notified → calendar on accept → booking shows in Hubly.

| Dependable today? | Customer proof |
|---|---|
| [x] | Website publishes reliably to a live URL |
| [x] | **Hire path works** — request is saved, customer sees honest confirmation, owner is notified, booking appears in Hubly; Stripe never fakes success *(pay-later default; card pay requires Stripe connection; `{slug}.myhubly.app` Stripe return fixed; Accept → CRM + calendar)* |
| [ ] | Payments Connection end-to-end (success, failure, refund, receipt) when Stripe connected |
| [ ] | Calendar Connection keeps availability true through reschedule/delete/conflicts |
| [ ] | Email Connection dependable for reminders (request/confirm path wired; reminders still open) |
| [ ] | Contact forms create real leads |
| [ ] | Domain connection workflow exists (Domain Connector only) |
| [ ] | Connection status clear for Domain / Stripe / Calendar / Email |
| [ ] | Business Health + Timeline visible after launch |
| [ ] | A paying owner could realistically stop using another website platform |

**Milestone done when:** a paying customer could leave Squarespace/Wix/etc. and hire customers through Hubly without manual rescue.

---

## Milestone 3 — First Customer

**Outcome:** Hubly has successfully helped a business **earn revenue**.

Not just a conversation match — the first completed transaction.

| Dependable today? | Customer proof |
|---|---|
| [ ] | First completed hire / transaction |
| [ ] | First completed job |
| [ ] | First payment |
| [ ] | First CRM update from that hire |
| [ ] | First Timeline entry |
| [ ] | First Business Health update |
| [ ] | First review request |
| [ ] | Customer Runtime path: describe need → match → book → pay → notify (conversation only) |

**Milestone done when:** a real business earned money through Hubly.

---

## Milestone 4 — Business Running

Hubly Daily · CRM · Messaging · Jobs · Calendar · Business Health · Timeline — with minimal manual work.

| Dependable today? | Customer proof |
|---|---|
| [ ] | Hubly Daily is the owner homepage |
| [ ] | CRM / jobs / payments / calendar stay in sync automatically |
| [ ] | Messaging works for real customer communication |
| [ ] | Business Health updates from real activity |

---

## Milestone 5 — Business Growing

AI Coach · Marketing · Living Business · Living Marketplace · Weekly Learning

Only after businesses are launching and earning.

---

## Connector rule

Connectors stay generic. Runtime never contains vendor-specific registrar code.
Missing Connection → **Connection required** — never fake success.

---

## Success metrics (not vanity)

1. How many businesses successfully launched?  
2. How many customers booked?  
3. How many businesses earned revenue?  

Everything else is secondary.
