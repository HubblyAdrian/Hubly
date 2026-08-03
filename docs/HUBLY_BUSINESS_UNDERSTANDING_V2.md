# Business Understanding V2 — The Canonical Business Knowledge Model

**Status:** Design only. No code. Approved in principle; this revision extends it with the Conversational Booking Principle and refines the section schema per direct feedback. Nothing here is implemented — this is still the proposal to review before `hubly_business_understanding.ts`, the system prompt, the frontend panel, or the Capability Knowledge Base's field references change.

---

## 1. What this is

Business Understanding is the canonical model of business knowledge every Hubly Conversation context reasons over — Dashboard, AI Concierge, Marketplace alike:

- **Dashboard** *builds* this model live, patch by patch, through conversation with the owner.
- **AI Concierge and Marketplace** *load* a snapshot of the same sections as Ground Truth from real backend data, once it exists.

One schema, two different relationships to it. This revision adds a second, equally central idea on top of that: **booking is not a separate experience Website and Marketplace each implement — it's one capability the same engine invokes, once it has enough understanding to do so.** The two ideas are connected, not parallel: Entry Intent (below) is how a conversation starts already partway toward that understanding, and the refined sections below are what "enough information" is measured against.

---

## 2. The Conversational Booking Principle

**Hubly no longer has separate booking experiences for Websites and Marketplace.** There is one conversational booking experience, powered by Hubly Conversation. The existing booking backend — calendar, availability, pricing, CRM creation, payments, confirmation, reminders — is unchanged. Only the customer experience changes: instead of filling out a booking form, a customer talks, and the conversation invokes Booking when it has what it needs.

This is not a new backend capability request — it's the natural conclusion of a gap already named twice in this project. `docs/AI_CONCIERGE_DESIGN.md` Section 6, Item 2 flagged that no Capability Registry entries exist yet for the real booking backend (`booking.getAvailability`, `booking.create`); `docs/HUBLY_CONVERSATION_MULTI_CONTEXT_MIGRATION.md` Part 2.4 already showed that `chatbot-message`'s `handoff.type === "book_service"` is just an `invoke` decision wearing different clothes. This principle is what that convergence is *for*.

### Entry Intent

A conversation doesn't always start from zero. Every conversation may begin with an **Entry Intent** — context the entry point already knows before the first message is exchanged: Homepage, Book Now, Service, Package, Membership, Quote, Marketplace Provider, Marketplace Service.

If a customer clicks "Premium Exterior Detail," the conversation already knows `selectedService`, `serviceId`, `pricing`, `duration`, `add-ons` — and the AI continues from there ("I see you're interested in our Premium Exterior Detail service...") instead of asking generic opening questions. It only asks for what's still unknown.

**Where this lives architecturally, not as a new layer:** Entry Intent is not a new section of Business Understanding — it's not a fact about the *business*, it's what this particular visitor already told us by clicking. It's the same Session Understanding patch mechanism the Context Model already defines (`docs/HUBLY_CONVERSATION_CONTEXT_MODEL.md` Section 2, item 6 — patch-based, schema-pluggable), just supplied once, by the UI, as patch zero, before turn one — rather than emitted by the model turn by turn. A service page passing `{selectedService, serviceId, pricing, duration, addOns}` is doing exactly what the model does when it emits a patch; it's just supplying it up front because the UI already knows it. No new mechanism, no new layer — the existing one, seeded early.

### Booking as a Capability

Booking is no longer a standalone flow — it's a conversational capability the AI invokes once it has enough information:

```
Conversation
  -> Customer Understanding
  -> Service Recommendation (if needed)
  -> Booking Capability
  -> Availability
  -> Customer Details
  -> Payment
  -> Confirmation
```

The existing booking backend is reused as-is — not redesigned, not replaced. What changes is that this progression is reached through natural conversation, sometimes skipping steps entirely because Entry Intent already supplied them (a customer arriving via "Book Now" on a specific package may go almost straight to Availability).

### Website and Marketplace must converge

Website Context and Marketplace Context provide the *same* customer experience. The only difference is how the conversation begins:

- **Website** — the business is already known; the conversation starts grounded in one business's Ground Truth.
- **Marketplace** — no business is known yet; the conversation starts in a matching phase (the real, already-audited `marketplace_intake.ts` / `marketplace_match.ts` — see `docs/AI_CONCIERGE_DESIGN.md` Part 1's comparison table) until a provider is selected.

**Once a provider is selected, both experiences become identical** — the same Booking capability, the same progression, the same backend. This means Marketplace context isn't a second booking implementation with its own logic; it's a matching *prelude* that hands off into the same conversational booking capability Website Concierge uses directly from turn one. There is one conversational booking capability, not two experiences that happen to look similar.

---

## 3. The refined schema

Eight sections, refined per direct feedback on the prior draft. For every field: what it holds, how it's populated, whether real backend already grounds it, and existing-vs-new status. Where no real capability grounds a field yet, that's stated plainly — a field existing in this schema doesn't mean the thing it describes is real yet (same honesty discipline as the Capability Knowledge Base).

### Business Identity

| Field | Holds | Populated by | Status |
|---|---|---|---|
| Business | Name | User input; AI inference from a connected website | **Existing** (`business.name`) |
| Industry | Trade/category | AI inference | **Existing** |
| Description | Plain-language what-they-do | AI inference | **New** |
| Business Stage | Established vs. starting out | AI inference | **New** |
| Years in Business | How long they've operated | User input | **New** |
| Team Size | Solo / small team / larger | User input | **New** |
| Service Area | Cities/region/radius | User input; Ground Truth for Concierge/Marketplace via real `service_area_cities`/`travel_radius_miles` columns | **New** as a schema field, real data already exists |
| Brand | Colors, visual tone | Capability output (Website Analysis extracts real dominant colors) | **Existing** (`brand.colors`), extended |

### Services

| Field | Holds | Populated by | Status |
|---|---|---|---|
| Services | List of services offered | User input; capability output (Website Analysis); Ground Truth via the real Service Catalog (`service_engine.ts`) | **Existing** |
| Packages | Bundled offerings | User input; Ground Truth via Service Catalog (packages are already part of that real, canonical structure) | **New** as a schema field, real data already exists |
| Pricing Confidence | Clear/consistent vs. unsure/ad hoc | AI inference | **New** |
| Add-ons | Optional extras | User input; Ground Truth via Service Catalog | **New** as a schema field, real data already exists |
| Seasonality | Demand swings by season | User input; AI inference | **New** |

### Online Presence — represented as *discoverability*, not just "the website"

Per direct correction: SEO is not part of Website. This section is reframed around how findable the business is across every real surface, not just its own site.

| Field | Holds | Populated by | Status |
|---|---|---|---|
| Website | `{status, url}` | Capability output (Website Analysis) | **Existing** |
| SEO Health | Rough assessment of on-site SEO quality | AI inference from what Website Analysis already extracts (title/description/headings) — **no dedicated SEO-scoring capability exists today**; this field's population is inference-only until one does | **New**, ungrounded by any real capability yet |
| Google Business Profile | Presence/status | Capability output — the existing honest link-recognition stopgap (`online_presence.analyze_google_business`) recognizes a link, cannot read its content | **New** as a schema field, capability already exists (limited) |
| Facebook | Presence/status | Same as above (`online_presence.analyze_facebook`) | **New** as a schema field, capability already exists (limited) |
| Instagram | Presence/status | Same as above (`online_presence.analyze_instagram`) | **New** as a schema field, capability already exists (limited) |
| TikTok | Presence/status | User input only — **no capability of any kind exists for TikTok** (confirmed catalog-only/"coming soon" in the Integrations audit) | **New**, ungrounded |
| Directory Listings | Presence on listing sites | User input only — no capability exists | **New**, ungrounded |
| Advertising | Active ad campaigns, if any | User input only — no capability exists | **New**, ungrounded |

### Reputation — expanded beyond reviews

| Field | Holds | Populated by | Status |
|---|---|---|---|
| Google Reviews | Presence/status on Google specifically | User input; AI inference | **New** |
| Average Rating | Numeric rating | **No capability computes this today** — `review_submissions` stores individual reviews but nothing rolls them up into an average anywhere in the audited backend | **New**, ungrounded until a rollup exists |
| Review Count | How many reviews exist | Same caveat as Average Rating — computable from real data, not currently computed by anything | **New**, ungrounded until computed |
| Testimonials | Curated quotes | Capability output — this one's real: `businesses.meta.website.manualReviews` is exactly the owner-curated subset already flowing from `review_submissions` to the storefront | **New** as a schema field, real mechanism already exists |
| Before & After Gallery | Curated before/after pairs | Capability output — AI Photo Analysis (`analyze-photos`) already detects before/after pairs | **New** as a schema field, real capability already exists |

### Sales & Marketing

| Field | Holds | Populated by | Status |
|---|---|---|---|
| Lead Sources | Where customers currently come from | User input; AI inference | **New** |
| Marketing Channels | What they're actively doing today | User input; AI inference | **New** |
| Promotions | Active offers | User input; loosely capability-adjacent — Studio Campaign Engine can generate a promotion, but nothing tracks "is one currently active" as a fact | **New**, partially grounded |
| Referral Program | Whether one exists | User input only — **confirmed Missing entirely** in the Capability Knowledge Base (no tracking, codes, or reward ledger exist anywhere) | **New**, describes something not yet real; can only ever record a stated aspiration until Referrals is built |

### Customer Experience — reframed around the conversational booking capability

| Field | Holds | Populated by | Status |
|---|---|---|---|
| Booking | Current booking experience/system state | Capability output — Availability Engine, Google Calendar Sync, Booking Creation & Confirmation are all real | **New** as a schema field, real capability already exists |
| CRM | `{current_system}` — also absorbs what was previously a separate "current customers" notion; a business's CRM state and their customer base are one fact, not two | User input | **Existing** (`crm.current_system`), scope widened |
| Communication | How they currently talk to customers | User input; AI inference | **New** |
| Follow-up | Whether/how they follow up after service | User input; loosely capability-adjacent — Owner-Approved Customer Email and the review-request flow are real, but no unified "follow-up status" is tracked as a fact | **New**, partially grounded |
| Automations | Automated workflows in use | User input only — **confirmed Partial/Missing**: Hubly's own Automations planning is real but has no execution engine (Capability Knowledge Base, Part 3); this field can only describe what a business does *outside* Hubly, or what's been planned-but-not-executed inside it | **New**, explicitly not backed by Hubly execution yet |

### Operations

| Field | Holds | Populated by | Status |
|---|---|---|---|
| Payments | `{current_system}` — a stated tool/method; Ground Truth for Concierge/Marketplace can instead reflect real Stripe Connect status once connected, a stronger signal than a conversational mention | User input; capability/integration status | **Existing** (`payments.current_system`) |
| Scheduling | `{current_system}` | User input | **Existing** (`scheduling.current_system`), relocated here from the prior draft's Customer Experience placement |
| Team | Operational staffing detail — distinct from Business Identity's Team Size (a scale fact); this is about how staffing actually runs | User input | **New** |
| Equipment | Notable equipment owned | User input | **New** |
| Inventory | Stock/inventory tracking | User input generally; capability output if the business uses the Product Store (`commerce_inventory_logs` is real, but scoped to Commerce, not general service-business inventory) | **New**, grounded only for Commerce users |

### Growth — expanded

| Field | Holds | Populated by | Status |
|---|---|---|---|
| Goals | Stated aspirations, free text — also absorbs what was a separate "revenue goals" field; a revenue target is just a goal with a number in it, not a different concept | User input; AI inference | **Existing** (top-level `goals`), scope widened |
| Biggest Bottleneck | What's most limiting them right now | AI inference | **New** |
| Biggest Opportunity | What the AI judges as the highest-leverage next move | AI synthesis — this is a different *kind* of field from the rest of this table: not a fact reported by the business, but a conclusion the AI reaches by reasoning over the other sections | **New** |
| Current Priority | What matters most right now | AI synthesis, same as above | **New** |
| Business Health | A holistic rollup judgment of the business overall | AI synthesis over every other section — this is the one full-business rollup, distinct from the per-section Health State below (which scores each section individually, not the business as a whole) | **New** |

**What changed from the prior draft, named explicitly rather than silently dropped:** "current customers" folded into CRM; "revenue goals" folded into Goals; "domain" folded into Website; the generic "social profiles" bag replaced by named per-platform fields.

---

## 4. Health State — a future evolution, not fully specified here

Business Understanding should eventually expose not just *what* a business has, but *how healthy* each area is — a state like Healthy, Connected, Missing, Needs Improvement, or Learning, per section (Business Identity healthy, Online Presence needs improvement, Reputation missing, etc.).

This is named as a direction, not specified field-by-field in this pass — per the instruction, the schema above is the deliverable; Health State computation rules are a follow-up design question, not decided here. Two things worth setting down now so the direction stays coherent when that follow-up happens:

- Health State is a **derived view over a section**, not a stored fact — it's computed from what's present, missing, or capability-confirmed within a section, the same way `HublyPlan`'s `PlanItemStatus` (`already_exists` / `external_tool_in_use` / `recommend`) is already a derived judgment over Business Understanding today, not something the model writes directly. This would extend that existing pattern per-section rather than invent a new one.
- It's distinct from Growth's "Business Health" field above — that's one holistic judgment about the whole business; per-section Health State is many small, section-scoped signals.

---

## 5. Merge semantics

Unchanged in principle from the prior draft: a section merges shallowly onto what's known, array fields (Services, Goals, Lead Sources, etc.) replace wholesale when included, scalar/object fields shallow-merge or replace the same way they do today. Entry Intent doesn't need a new merge rule — it's just patch zero, applied through the same mechanism before turn one.

---

## 6. What adopting this requires (named, not done here)

Everything from the prior draft's Section 5 still applies (the merge function, the system prompt's schema block, the frontend panel, the Capability Knowledge Base's field references all need updating to the new section shape). This revision adds:

- **Capability Registry entries for Booking** (`booking.getAvailability`, `booking.create`, and now explicitly a customer-facing modify/cancel action per `docs/AI_CONCIERGE_DESIGN.md` Section 6, Item 3) — the Conversational Booking Principle depends on these existing; they don't yet.
- **Entry Intent as a new input to the conversation contract** — today's `hubly-conversation` request shape accepts `{messages, businessId?, understanding?}`; Entry Intent needs a place to arrive (most likely as an initial Session Understanding patch supplied alongside the first request, per Section 2 above) — a contract change, not implemented here.
- **Marketplace context's design narrows**, per the convergence principle — it no longer needs its own booking logic, only the matching prelude up to provider selection. This changes (simplifies) what `docs/HUBLY_CONVERSATION_MULTI_CONTEXT_MIGRATION.md` Part 4, Step 7 was scoping as "Marketplace's later migration" — worth revisiting that step's estimate once this is approved, not done here.
- **Several new fields are honestly ungrounded** (SEO Health, TikTok, Directory Listings, Advertising, Referral Program, Automations) — adopting the schema doesn't make these real; it gives Hubly Conversation a place to honestly say "not tracked yet" instead of having no concept of them at all.

---

## 7. Open questions, not resolved here

- Exact Health State computation rules per section (Section 4) — direction only.
- Whether Entry Intent needs a typed schema per entry-intent-type (Homepage vs. Service vs. Package vs. Marketplace Provider each shaped differently) or one generic bag — a real implementation decision, not made here.
- Whether fields with a real backend source (Reviews, Payments-via-Stripe, Service Area) should *prefer* that source even inside Dashboard once it exists, rather than relying on conversational inference — carried over from the prior draft, still open.
- Whether `loadConciergeContext`'s existing Ground Truth shape should be folded into this canonical model now that one exists, or stay separate — carried over, still open.
