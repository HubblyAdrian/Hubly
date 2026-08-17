# Hubly Home — Specification

**Version:** 0.1.0
**Date:** 2026-08-17
**Status:** Draft. Phase 1 scope is constrained to verified capabilities.

> **This document is bounded by `AI_CAPABILITY_INVENTORY.md` (2026-08-17).**
> Everything in Phase 1 is backed by a capability that exists and is callable
> today. Everything in "Future" is **not scope** and must not be built, promised
> in copy, or offered by the AI until it appears in a re-verified inventory.
> If that inventory is stale, this spec is stale with it.

---

## The rule this document exists to enforce

**Every AI claim and every AI action must be backed by a real, callable
capability.**

If Hubly offers *"want me to send these?"* and the user says yes, the system has
to actually send them. An offer the system cannot honour is worse than no offer —
it is a chatbot impersonating an operator, and it costs trust that does not come
back.

This is why the chips and widget actions below are drawn from one list, and that
list is short.

## Product rules (apply to every phase)

1. **AI actions require the appropriate permission.** The AI acts within the
   authenticated user's authority, never beyond it.
2. **Actions affecting customers or business records require user approval**
   where the consequence is externally visible — anything a customer receives,
   anything that changes money, anything destructive.
3. **The AI explains what it is about to do before consequential actions**, in
   plain language, before doing it — not after.
4. **Every AI claim and action is backed by a real capability.** No offer the
   system cannot complete.

Rules 1–3 are **product requirements to be built**. The registry has no generic
approval gate today: draft edits are authorised by `draft_token`, store actions
by the owner-gated `commerce-api`. Do not assume approval exists because this
document requires it.

---

# Phase 1 — what Home ships with

Six capability groups, all verified LIVE. Nothing else appears in the interface.

## Chips

Chips are the entry points offered before the user types. Each maps to a
capability that can complete the whole action.

| Chip | Capability behind it |
|---|---|
| "Build my website" | `business.startDraft` → `business.updateDraft` → `business.setServices` |
| "Change something on my site" | `business.updateDraft` |
| "Set up what I sell" | `business.setServices` |
| "Take bookings" | `booking.getAvailability`, `booking.create` |
| "Set up my store" | `storefront.*` |
| "Look at my current website" | `website.analyze`, `online_presence.analyze_*` |

**Chip rules**

- A chip appears only if its capability is LIVE in the current inventory.
- Chip wording states an outcome the user wants, not a feature name.
- No chip offers something the AI would have to hand back to a UI button.

## Widget actions

Widgets are the surfaces Home renders after something exists. Their actions draw
from the same list.

| Widget | Actions offered |
|---|---|
| **Your site** | edit copy, change a section, regenerate, view live |
| **What you sell** | add/edit services, set prices |
| **Bookings** | check availability, take a booking |
| **Store** | add product, edit product, change visibility, configure store |
| **Your web presence** | analyse site / Facebook / Instagram / Google Business |

No widget offers an action outside this table.

## Behaviour

**Describing a business is a request to build.** *"I run a mobile dog grooming
business in Lehi"* is someone asking for a site. Build immediately; do not ask
for a business name first, and do not ask about design inspiration before
anything is on screen. Derive a name from what they said — never a generic
placeholder. Refinement comes once they are looking at something real.

**Never give website advice while no website exists.** Build it, then improve it
together.

**The screen follows the work.** Chat is full width until something real exists;
the preview appears when the site does. No empty panel apologising for itself.

---

# Future — NOT SCOPE

**Nothing below is scope.** None of it may appear in Home's chips, widgets, copy,
or in anything the AI offers, until it is verified LIVE in a re-run of the
capability inventory. This section exists so the ambition is recorded, not so it
can be built from.

## Blocked by a flag, not by missing work

**Hubly Document generation and patching.** `website.generateDocument` and
`website.patchDocument` are complete, deployed and correct, and
`HUBLY_DOCUMENT_GENERATION_ENABLED` is unset in production, so
`hubly-conversation` refuses to dispatch either. Turning them on is a secret,
not a build — but it is a real behaviour change for every new site, so it is
a decision, not a chore. Until it is taken, no chip, widget or AI reply may
depend on a Hubly Document existing.

## Near — built but not reachable by the AI

Deployed and working, callable only from a UI button. Promoting these is registry
wiring, not new backend, which makes them the natural Phase 2.

- Draft a customer message — `draft-customer-message`
- Send an owner-approved customer email — `send-customer-email`
- Analyse photos — `analyze-photos`
- Creative Director — `creative-director`

**Language check:** even when promoted, the honest phrasing is *"Hubly can draft
customer communications"* and, separately, *"Hubly can send emails you have
approved."* Never *"Hubly can send messages."*

## Further — no AI capability and no server API

The browser talks to Supabase directly under RLS, so there is nothing for a
server-side AI to call. Each needs an owner-gated API first — `commerce-api` is
the pattern — before any capability can exist.

- Leads: read, search, identify follow-ups, contact
- Jobs: read, create, reschedule, status
- Planner / calendar: availability, create and update events
- Customers: read, search, history, find inactive
- Reviews: read, request, respond
- Quick Quote: create, update, send
- Memberships
- Revenue and reporting

## Not possible today

- **SMS.** There is no Twilio integration to enable. Zero code calls Twilio's
  API; every "text" action in the product opens the user's own phone via an
  `sms:` link. This is a build, not a switch, and Home must not imply otherwise.

---

## Removed from earlier drafts, deliberately

- **"What Hubly AI Can Do For You"** as a list of promised capabilities — it
  described intent rather than function and would read as scope.
- **The in-product instructional tip** — if the interface needs instructions, the
  interface is the problem.
- **"Secure. Private. Under Your Control."** as marketing language. The
  underlying commitments survive as product rules 1–3 above, where they are
  testable instead of decorative.
