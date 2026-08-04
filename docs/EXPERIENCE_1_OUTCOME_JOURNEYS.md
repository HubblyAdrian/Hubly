# Experience 1 — Outcome Journeys

Deliverable requested before any code: a list of every outcome Hubly can
currently help with, and for each, the minimum information needed, what can
start being built immediately, and the natural next step. Experience 1 gets
built around these journeys, not around features or onboarding.

Grounded in what's actually wired today — the Capability Registry
(`hubly_capability_registry.ts`, 3 capabilities), the Business Understanding
schema (`hubly_business_understanding.ts`), and the Capability Knowledge Base
(`hubly_capability_knowledge_base.ts`, describes the real product, not what
this conversation can invoke). Where an outcome depends on something that
doesn't exist yet, that's stated plainly rather than assumed.

## One verified fact first: the Lead Recovery precedent is real

You referenced "our current Lead Recovery system for incomplete bookings" as
a pattern to mirror for Business in Progress. Checked — it's real, in the
legacy product:

- `booking_requests` rows get written with `status = 'abandoned'` when a
  customer starts but doesn't finish.
- `complete_abandoned_booking()` is a narrow `SECURITY DEFINER` RPC — the
  *only* thing an anonymous caller can do to that row is flip their own
  (phone-matched) abandoned booking back to `pending`. Nothing broader is
  granted.
- The business side surfaces these via `isRecoveryLead()` in a Leads →
  Recovery tab — staff can see and follow up on unfinished starts.

The pattern (early row, narrow claim-back RPC keyed to something the visitor
provided, staff-facing recovery surface) is real and good. But it's legacy
plumbing on `booking_requests` — it does not mean V4 already has an
equivalent for an anonymous Experience 1 visitor. Business/Contact records
for a pre-signup conversation don't exist yet. Building that is new schema +
RLS + RPC work, not a config flip. Flagged below, not silently built.

## Outcome catalog

| Outcome | Minimum info to start | What can begin immediately | Natural next step |
|---|---|---|---|
| **Website** | Business name + industry + 1-2 services | Real: `website.analyze` (dashboard-allowed) reads an existing site if they have one. Conversational drafting of headline/about/services copy is honest value today (model reasoning, not a capability). **Gap:** nowhere in Business Understanding to persist drafted copy — schema has `website.status/url` only, no content field. No live visual render without a `businessId` (see Visual Preview flag below). | Booking (their site's obvious job is to get someone to book) |
| **Booking** | Services + rough availability pattern (schedule/hours) | Conversational: capture `scheduling.current_system` and service list into Business Understanding; explain what real-time booking will look like. **Not available:** `booking.getAvailability`/`booking.create` are real, but the allowlist restricts them to `customer` context only — a business owner in Experience 1 (`dashboard` context) can't invoke them, and shouldn't (nothing to book against yet — chicken-and-egg). This outcome is design/setup during Experience 1, not execution. | CRM (bookings need somewhere to land) |
| **Online presence** | Existing website/Facebook/Instagram/Google Business URLs, if any | Real: `website.analyze` (full read) and `online_presence.analyze_facebook/instagram/google_business` (honest link-recognition stopgaps only — always disclose no live read). | Website (this is usually *found via* wanting a better web presence, not a separate ask) |
| **CRM** | Nothing beyond what's already known from other outcomes | Conversational only — no registry action, `crm.current_system` is the only schema field. Position as "where your customers and bookings will live," not a thing to configure now. | Marketing (a CRM's value shows up once there's someone to follow up with) |
| **Storefront** | Service list + pricing + whether they take payment online | Conversational only — no registry action, no dedicated schema field (rides on `services` + `payments.current_system`). | Payments setup |
| **Marketing** | Goals (`goals[]`) + target audience described in conversation | Conversational drafting only (a campaign idea, a customer-winback message) — real per the KB (`marketing.studioCampaigns`) but not wired into this registry. | Reviews / Lead Recovery, once there's real customer volume |
| **Provider search** ("find someone to paint my house") | The job needed + rough location | Different persona entirely — this is the `customer` context (Marketplace side), not Experience 1. Real actions exist there (`marketplace.aiMatching` per KB) but that's a separate conversation surface, not something Experience 1 should try to also handle. | N/A — flag as out of Experience 1's scope, not a gap to close here |

Not listed as a top-level outcome because they're real but only make sense
*after* one of the above is underway, per the KB's own `dependsOn` graph:
Reviews (`online_presence.reviews`, depends on `crm.jobs`), Payments
(`payments.stripeConnect`), SEO (rides on Website), Analytics (depends on
`crm.jobs`+`crm.customers`, needs real usage history to mean anything).

## Two things this list surfaces that are real decisions, not implementation details

**1. Quiet Business/Contact persistence + "Business in Progress."**
The Lead Recovery precedent above is a good pattern to reuse
*architecturally* — but reusing it means designing new tables/RLS/a narrow
claim-back RPC for an anonymous pre-signup conversation, not flipping a
switch. This is genuinely new backend surface (when does a real row get
created, who can write to it before a real account exists, how is it claimed
back). Recommend scoping this as its own follow-up once the conversation
behavior below is live and tested — not bundled into "test tomorrow."

**2. Real visual website preview / three-agency-concepts.**
Already scoped last round: the 25-layout/23-theme renderer is real but
file-based, not a token-driven system an AI design spec can drive live. That
lift (primitives + a real token system + new guardrails) is unchanged by
this conversation and is not achievable overnight. Until it exists, a
"website" outcome in Experience 1 is honestly conversational (real drafted
copy, not a live rendered preview) — which should be stated to the user in
the product, not hidden behind confident-sounding language.

## What's actually achievable by tomorrow (prompt-only, no architecture change)

Everything below reuses what's already real — the `PRIORITY ORDER`
mechanism, the Business Understanding patch/merge, the Capability Knowledge
Base loader, the `website.analyze` and `online_presence.analyze_*` actions.
No new registry entries, no new schema, no new backend:

1. **Goal detection at turn one** — read the opening message as a requested
   outcome (map to the catalog above), not as a Business Understanding field
   to log.
2. **Goal-scoped questioning** — every question justified by "what does
   *this outcome* need" (the middle column above), not generic Business
   Understanding completeness.
3. **Create-while-talking** — already the live behavior via `PRIORITY
   ORDER`; extend the "what can begin immediately" column above into the
   prompt per-outcome instead of one generic rule.
4. **Refine in place** — already real via patch accumulation.
5. **Quiet field capture** — already how Business Understanding patches
   work; no new persistence needed for what's already schema-backed (name,
   industry, services, goals). Owner name/phone/email have no home yet — see
   flag 1, don't fabricate a save for those.
6. **Forward momentum** — after an outcome has real progress, recommend the
   next one using the "Natural next step" column above (which is just the
   KB's real `dependsOn` graph, read forward instead of backward).

What this can't honestly claim by tomorrow: a live visual site preview, an
agency-style three-concepts choice, or persistence/recovery for a visitor
who leaves mid-conversation. Those need the two flagged decisions made
first.
