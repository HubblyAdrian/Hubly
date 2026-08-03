# AI Concierge — Design Document

**Status:** Design only. No code changed. No UI built. No backend built. Per Rule 6, several items below require approval before any implementation begins.

**Scope of this document:** answers the six questions in the brief, grounded in a direct audit of the current codebase (not memory/assumption). Every "exists" / "missing" claim below was verified against actual files, migrations, and grep results on 2026-08-03.

---

## Executive summary — read this first

The brief frames AI Concierge as a clean new instance of the Hubly Conversation engine, pointed at customers instead of owners. The audit found a fact that changes that framing:

> **A real, live, production customer-facing AI chatbot already exists** — `supabase/functions/chatbot-message/index.ts`, wired to a floating chat bubble already on every business's storefront (`ensureWsChatWidget()` in `public/hubly.html`). It reads real services, hours, FAQ, and service area; it persists real conversations (`chatbot_conversations` / `chatbot_messages`); it rate-limits; it tier-gates lead capture; it hands off into the real booking flow.
>
> It is **not** built on the V4 Hubly Conversation architecture. It doesn't use the Capability Registry, the JSON action-schema, or Business Understanding. It's an older, separate, already-production system.

This means "AI Concierge" is not a greenfield build — it's a decision about which of two real things to build on. That decision is Item 1 in Section 6, and it's the one thing in this document I'm explicitly not resolving myself, per Rule 6. Everything else in this document is written to be true under either resolution, but the two "MISSING BACKEND" call-outs marked **[BLOCKS ALL OPTIONS]** are decision-independent — those need building either way.

> **Update:** Section 6, Item 1 is now decided — AI Concierge is not a separate system, it's Hubly Conversation given a second context (and a third, Marketplace, later). See `docs/HUBLY_CONVERSATION_MULTI_CONTEXT_MIGRATION.md` for the full migration plan from `chatbot-message`'s production features into that architecture. The rest of this document (Sections 1-5, and Section 6 Items 2-10) still holds — this update only supersedes Item 1's "which system wins" question.

---

## 1. What knowledge does the AI Concierge need?

| Knowledge | Exists today? | Where | Verdict |
|---|---|---|---|
| Services / Pricing / Packages / Add-ons | **Yes** | `businesses.meta.service_catalog`, canonical logic in `_shared/service_engine.ts` ("one business → one catalog"). Already has an AI-ready summarizer: `toAiSummary()`. | Production Ready (JSON column, not relational, but genuinely canonical — every consumer reads through this one module) |
| Business hours | **Yes** | `businesses.meta.hours`, per-weekday | Production Ready. (A parallel `settings_business_hours` table exists but has zero readers/writers anywhere — dead schema, ignore it.) |
| Service area | **Yes** | `businesses.service_area_cities`, `businesses.travel_radius_miles` | Production Ready |
| Availability | **Yes** | `_shared/marketplace_availability.ts` (`getAvailability`, `listAppointmentSlots`) — computed live from `jobs` + `google_calendar_events` + `meta.hours` | Production Ready for Hubly jobs + Google Calendar. Outlook is a declared-but-unbuilt stub source (enum value only, no provider code). |
| Reviews | **Yes** | `review_submissions` (real table, RLS-enforced request→collect→approve flow) + owner-curated subset in `businesses.meta.website.manualReviews` (what's actually shown publicly) | Production Ready |
| Website content (headline, about, why-choose, SEO copy) | **Yes** | `businesses.gen_hero_headline`, `gen_about`, `gen_why_choose`, `gen_seo_title/description` | Production Ready |
| FAQs | **Yes, but inconsistent** | AI-generated into `businesses.gen_faq` (by `generate-site`); the one live consumer that matters here, `chatbot-message`, actually reads a *different* location, `businesses.meta.website.faq`. No code found that reconciles the two. | Partial — real data, but two divergent sources of truth |
| Team / Staff | **No, effectively** | A real table (`settings_team_members`) exists but has zero readers/writers anywhere. Actual "team" data is client-side-only state in `journey.js`, invisible to any backend. | Stub-only-fake — nothing usable to reuse |
| Policies (cancellation, deposit, guarantees) | **No** | Not found anywhere — no column, no table, no concept | Missing |

**Net:** 6 of 9 categories are Production Ready and directly reusable. FAQs are real but split across two locations that need reconciling before the Concierge can trust them. Team and Policies are genuine gaps (Section 6).

**One structural note that matters for design:** none of this is unified into a single "business knowledge" object today. `chatbot-message` currently hand-assembles it turn-by-turn from five-plus scattered locations (top-level columns, two different `meta.*` paths, and the separate service-catalog module). Whichever option is chosen in Section 6, this should become one shared Context Loader — used by both Hubly Conversation's future needs and AI Concierge — not hand-rolled a third time.

---

## 2. What actions can it perform?

**Important framing before the table:** the Hubly Capability Registry (`_shared/hubly_capability_registry.ts`) today has exactly two capabilities — `website.analyze` (real) and `online_presence.analyze_{facebook,instagram,google_business}` (honest fake stopgaps). Neither is relevant to a customer on a storefront. **None of the real backend logic below is currently wrapped as a Registry action** — it's called directly inside `chatbot-message` / `marketplace`, bypassing the Registry pattern entirely. So "backed by a real capability" below means *real backend logic exists and is live in production* — wiring any of it into the Registry is itself new, if small, work (Section 6, Item 2).

| Action | Real backend today? | Where | Registry-wired today? |
|---|---|---|---|
| Recommend a service | **Yes** | Service catalog + `toAiSummary()` / `toMatchDto()` give real, structured pricing/package data to reason over | No |
| Answer a question | **Yes**, for hours / service area / reviews / website content. **Partial** for FAQ (see dual-location issue above) | See Section 1 | No |
| Start a booking | **Yes** | `marketplace/index.ts`: `booking_slots` (read real availability) → `booking_create` (real write to `marketplace_bookings`/`jobs`, triggers Google Calendar sync + confirmation email) | No |
| Modify a booking | **No** | The only booking-mutation actions (`booking_accept`, `booking_decline`, `booking_complete`, `booking_start`, `booking_abandon`) are owner/job-status-side transitions, not a customer-initiated reschedule/cancel of their own booking | — (gap, Section 6) |
| Request a quote | **No** | No `quotes` table anywhere. `_shared/hubly_brain_skills.ts` explicitly marks `generateQuote: executable: false` | — (gap, Section 6) |
| Connect to CRM (conversation → real Lead/Customer) | **Partial** | `customers` is a real table, but nothing writes to it from any AI-driven flow. `createCustomer` is `executable: false`. `chatbot-message` only captures contact info onto its own `chatbot_conversations` row, which the owner has to pull via a dashboard RPC — it never becomes a real Lead/Customer record | — (gap, Section 6) |
| Escalate to the business | **Partial** | `chatbot-message` can classify a `redirect_contact` handoff and tell the *visitor* to call/email — passive. No mechanism found that proactively notifies the owner in real time | — (gap, Section 6) |

**Net:** Recommend-a-service, answer-a-question, and start-a-booking are the three actions Concierge can be honestly built on today, once wrapped as Registry entries (or their equivalent, if Section 6 Item 1 resolves toward extending `chatbot-message`). Modify-a-booking, request-a-quote, connect-to-CRM, and escalate-to-business range from small gaps (escalate, CRM) to a structural one (quotes) — none should be promised in a first version without the corresponding Section 6 item being approved and built.

---

## 3. Conversation goals

- **Help visitors solve problems.** Reachable today for "which service fits me" and "when are you free" — grounded in real catalog and real availability. Not yet reachable for "what's your cancellation policy" — there's no data source for that (Section 1).
- **Reduce friction.** The single biggest lever already exists in the backend: `booking_slots` → `booking_create` removes "call to book" entirely, once wired as a Concierge action.
- **Increase bookings / conversions.** Pair the real booking path with the same honesty norm already locked for Hubly Conversation ("never imply analysis happened unless it actually happened... trust matters more than sounding capable"). A Concierge that never bluffs on policy or quotes it can't back up converts better over time than one that improvises — this principle carries over directly and should govern Concierge's system prompt too.
- **Never feel like a generic chatbot.** Differentiation comes from grounded specificity — real prices, real open slots, real reviews — not from personality. This is worth naming because `chatbot-message` already does a version of this reasonably well today (its teaser references a business's actual top "popular" services, plus a presence-cue nudge) — that product feel is worth preserving, regardless of which plumbing it ends up sitting on.

---

## 4. Session model — one conversation, two entry points

**Requirement:** whichever entry point (Hero AI bar or floating chat bubble) a visitor starts in, and however they later use the other one, they see the same accumulated history and the AI remembers everything already said.

**Current state of the two entry points:**
- **Floating chat bubble** — exists today, live, wired to `chatbot-message` (`ensureWsChatWidget()`, `wsChatToggle()`, `wsChatSend()` in `public/hubly.html`).
- **Hero AI bar** — does **not** exist on any business storefront today. The only prior art for an "AI bar" pattern in this codebase is on Hubly's own marketing landing page (`public/platform-home.html`), which is a different product for a different audience (prospective Hubly customers, not a business's own customers). This isn't a backend gap — it's a UI surface that hasn't been built (and per this brief, isn't being built now). Noted here only because the session model below assumes it will exist.

**Design (data/session model only, no UI or backend implementation here):**
- A single conversation identity must be established once per visitor session on a business's storefront — before the visitor has necessarily touched either entry point — and both the bar and the bubble read/write against that same identity.
- **Reuse candidate:** `chatbot_conversations` / `chatbot_messages` already model exactly this shape — a conversation scoped to one business + one visitor session, with turn-by-turn messages persisted server-side. This is real, live infrastructure that a shared two-entry-point session should sit on, rather than reinventing persistence. (This reuse is only straightforward if Section 6 Item 1 resolves toward extending `chatbot-message`; if it resolves toward the Hubly Conversation path instead, equivalent persistence has to be built there first, since Hubly Conversation persists nothing today — see Section 5.)
- Practically: a conversation id gets generated once per visitor session (e.g. on first paint of the storefront), stored client-side scoped to that business's site, and sent by *both* entry points on every turn. Which entry point is currently open/focused is purely presentational state — it must never be conflated with conversation identity, or opening the bubble after typing in the bar would start a second, disconnected thread.

---

## 5. Relationship to Hubly Conversation

**What can be shared, mechanically, if Concierge is built on (or converges toward) the Hubly Conversation code path:**
- `_shared/hubly_ai.ts` — the one LLM gateway (now fixed to send `max_completion_tokens`).
- The JSON action-schema response contract (`{"action":"reply"|"invoke", ...}`).
- The honesty rule ("never imply analysis happened unless it actually happened").
- The Capability Registry dispatch pattern (`findAction` → invoke → report exactly what happened).
- The Business Understanding *pattern* — patch-based, evolving, never fabricated.

**What must stay different:**
- **Audience and system prompt.** Hubly Conversation helps the business owner run and describe their own business. Concierge helps a stranger decide whether to book. These are different jobs, not variations of the same job.
- **Which capabilities are exposed.** Hubly Conversation exposes owner-facing analysis (`website.analyze`, `online_presence.analyze_*`). Concierge would expose storefront-facing actions (services, availability, booking) and must never expose owner-side tools to a visitor.
- **What "Business Understanding" even means.** Hubly Conversation's `BusinessUnderstandingPatch` accumulates what Hubly has learned about the business *from its owner*, while the business itself is still being defined. Concierge always operates inside exactly one, already-fully-known business — there's nothing to "learn" about the business itself. If an equivalent patch-based structure is useful for Concierge, it would be a *different* schema entirely, capturing what's been learned about the *visitor* (what they're looking for, what they asked about) — not a reuse of `BusinessUnderstandingPatch` as-is. Calling this "the same Business Understanding," literally, would be inaccurate; "the same *pattern*, applied to a different subject" is accurate.

**What context changes:** Hubly Conversation's system prompt is built to help figure out and describe a business that's still being understood. Concierge's system prompt would instead hand the model that business's real, already-known data (Section 1) as ground truth to reason over — closer to a grounded-retrieval prompt than an information-gathering one.

**How both would use the same architecture, concretely:** the same shape of code — `buildSystemPrompt(context) → HublyAI.chat(...) → parse decision → dispatch via Capability Registry → return {reply, actions, interimMessages}` — parameterized by a different system prompt, a different capability subset, and a different context object. Same engine, different configuration — that part of the brief's framing holds up.

**What doesn't hold up without new work:** persistence, rate limiting, and tier-gating exist in `chatbot-message` today and exist **nowhere** in Hubly Conversation (it's explicitly stateless — "this function persists nothing today," per its own header comment). If Concierge is "the same engine," those three things have to be added somewhere before it can safely sit on a public storefront — a public-facing AI surface with no rate limit is a real cost and abuse exposure, not a hypothetical one. This is Section 6, Item 1's core stakes.

---

## 6. Missing backend — stop-and-report (Rule 6)

Per the standing rule: **nothing below gets built without approval.** Each item has why it matters, Core vs. Industry Workspace, a rough complexity estimate, and — where I have one — a recommendation, clearly marked as a recommendation, not a decision.

### 1. [Major, decision-blocking] Two real "AI talks to a customer" systems would exist unless one is chosen
**Why it matters:** `chatbot-message` is a live, production, non-V4 system with real value the V4 stack currently lacks (persistence, rate limiting, tier-gated lead capture, real booking handoff). Building Concierge as a clean new Hubly-Conversation instance, as the brief describes, creates the exact duplicate-implementation situation the "one canonical implementation" rule exists to prevent — unless it's an explicit *replacement*, not an addition.
**Options:**
- **(A) Concierge replaces `chatbot-message`.** Build it on the Hubly Conversation architecture; port `chatbot-message`'s production-hardening (rate limiting, persistence, tier gating, booking handoff) into that path; retire `chatbot-message` once at parity.
- **(B) Concierge extends `chatbot-message`.** Keep its persistence/rate-limiting/tiering as the foundation; bring in the action-schema/Capability-Registry/honesty-rule pattern from Hubly Conversation instead of standing up a parallel service.
**Core, not Industry Workspace** — every business needs this.
**Complexity:** Large, either direction.
**Recommendation (not a decision):** (A) — it keeps "one canonical conversation engine" literally true, and the three production-hardening pieces are each self-contained enough to port over deliberately rather than inherited as-is from an architecture this brief isn't extending. But this is the single highest-leverage decision in this whole document, and I'm stopping here rather than picking for you.

### 2. [Medium, blocks all options] No Capability Registry entries exist for any real Concierge action
**Why it matters:** Services, availability, booking-creation, hours, service area, and reviews all have real backend logic (Section 1/2), but none of it is wrapped as a `HUBLY_CAPABILITY_REGISTRY` entry — every real consumer calls it directly, bypassing the Registry. Concierge can't use "the same Capability Registry" until entries exist to use.
**What's needed:** new registry capabilities (e.g. `storefront.getServices`, `booking.getAvailability`, `booking.create`) that each wrap an already-real function (`service_engine.ts`, `marketplace_availability.ts`, `marketplace`'s `booking_create`) — genuinely wrapping what's real, not new business logic.
**Core.** **Complexity:** Small-Medium per action; several actions needed. **Applies under either Section-6-Item-1 option.**

### 3. [Small-Medium] "Modify a booking" (customer reschedule/cancel) has no real backend action
**Why it matters:** the only existing booking mutations are owner/job-status-side. A visitor can't reschedule or cancel their own booking through any real path today.
**Needed:** a new, customer-safe action, scoped so a visitor can only touch their own booking (the authorization boundary is the real design work here, not the mutation itself).
**Core.** **Complexity:** Small-Medium.

### 4. [Large] "Request a quote" has no real backend at all
**Why it matters:** no `quotes` table, `generateQuote` explicitly marked non-executable. This would be new Core capability built from scratch, not a wrap of something existing.
**Complexity:** Large.
**Recommendation:** exclude "request a quote" from Concierge's first version — consistent with "build on demand," this isn't proven-needed yet.

### 5. [Small] "Connect to CRM" doesn't turn a conversation into a real Lead/Customer
**Why it matters:** `customers` is real; nothing writes to it from any AI-driven flow today. Concierge-captured contact info currently has nowhere real to land except a chatbot-only inbox the owner has to remember to check.
**Needed:** one narrow write path from Concierge-captured contact info to a real `customers` row, plus a decision on the authorization boundary (should an unauthenticated visitor conversation write directly to a business's `customers` table, or go through a moderation/service-role boundary the way `chatbot-message` already does it?).
**Complexity:** Small.

### 6. [Small] "Escalate to business" is passive today, not active
**Why it matters:** Concierge can tell a visitor to contact the business; nothing tells the *owner* in real time that a visitor needs a human. Real one-off email sending exists (Resend) and could plausibly be repointed at the owner instead of the customer, but nothing does this today.
**Complexity:** Small.

### 7. [Small, hygiene] FAQ has two inconsistent storage locations
**Why it matters:** `businesses.gen_faq` (written by `generate-site`) vs. `businesses.meta.website.faq` (read by `chatbot-message`) — no reconciliation logic found. Concierge risks answering from stale or wrong content if this isn't resolved first.
**Complexity:** Small — pick one as authoritative, migrate or alias the other.

### 8. [Note, not urgent] Team/staff data is real schema but fully unwired
Not needed for anything in Sections 1-4 today. Flagging only so a later "ask for a specific team member" feature isn't assumed to already work — it doesn't.

### 9. [Policy note] No "policies" data exists anywhere
If Concierge needs to answer cancellation/deposit/guarantee questions, this is new business-profile data that doesn't exist yet — a real gap, not a fix to propose here.

### 10. [Note, not a backend gap] The Hero AI bar entry point doesn't exist on a business storefront yet
Only the floating bubble exists there today. Flagged for completeness against Section 4's session model — no UI is being built under this brief, so no approval is being requested for this one, just noting the current state.

---

## What this document is not
It is not an implementation plan, not a schema migration, not a Capability Registry PR. Per the brief, nothing here gets built until Section 6, Item 1 is decided and the rest of Section 6 is approved.
