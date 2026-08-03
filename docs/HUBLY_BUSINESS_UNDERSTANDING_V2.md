# Business Understanding V2 — The Canonical Business Knowledge Model

**Status:** Design only. No code. Nothing here is implemented — this is the schema proposal to review before `hubly_business_understanding.ts`, the system prompt, the frontend panel, or the Capability Knowledge Base's field references change.

---

## 1. What this is, and how it fits what's already approved

Business Understanding stops being "what Hubly Conversation has learned about a business from its owner" and becomes **the canonical model of business knowledge every Hubly Conversation context reasons over** — Dashboard, AI Concierge, Marketplace alike. This isn't a new concept bolted onto `docs/HUBLY_CONVERSATION_CONTEXT_MODEL.md` — it's that document's Ground-Truth/Session-Understanding split, made concrete:

- **Dashboard** *builds* this model live, patch by patch, through conversation with the owner — the business isn't fully known yet, so understanding it and describing it are the same act (this is the special case the Context Model doc already named).
- **AI Concierge and Marketplace** *load* a snapshot of this same model as Ground Truth — the business is already fully known by the time a visitor or consumer shows up, so their Context Loaders populate it from real backend data (the Service Catalog, Stripe Connect status, Google Calendar connection, `review_submissions`), not from a conversation that's still happening.

One schema, two different relationships to it — never two different schemas for "the business" depending on who's asking. That's what makes it canonical.

---

## 2. Design principles

1. **Sections, not a flat field list.** Each section is its own namespace. A new field inside `reputation` never touches `operations`, and never requires renaming or reshaping anything else.
2. **Every field has exactly one home.** No field appears in two sections under different names.
3. **Every field documents how it gets populated**, because — critically — that answer differs by *context*, not just by field. The same field can be conversation-inferred in Dashboard and backend-loaded in Concierge; both are documented per field below, not assumed.
4. **This is the one restructuring.** The move from flat top-level keys to nested sections is the one-time shape change. Every field added after this point lives inside an existing section — no section ever needs to be re-carved.

---

## 3. The proposed schema

Eight sections. For each field: what it holds, how it's populated, and whether it exists today (in the current flat `BusinessUnderstandingPatch`) or is new.

### Business Identity
*Who this business is, at a glance.*

| Field | Holds | Populated by | Status |
|---|---|---|---|
| `name` | The business's name | User input (stated directly); AI inference from a connected website/profile | **Existing** (`business.name`) |
| `industry` | Their trade/category | AI inference from services/context described | **Existing** (top-level `industry`) |
| `description` | Plain-language what-they-do | AI inference from conversation | **New** (was explicitly excluded from structured data earlier this session — this schema reintroduces it as a real field, since richer Business Understanding is now the explicit goal) |
| `businessStage` | Established vs. just starting out | AI inference from conversation | **New** |
| `yearsInBusiness` | How long they've operated | User input; AI inference | **New** |
| `serviceArea` | Cities/region/travel radius served | User input; Ground Truth for Concierge/Marketplace via `businesses.service_area_cities`/`travel_radius_miles` (already real columns per the Capability Knowledge Base) | **New** as a Business Understanding field, though the underlying data already exists in real tables |
| `brand` | Brand colors, visual tone | Capability output (Website Analysis extracts real dominant colors); AI inference from conversation otherwise | **Existing** (`brand.colors`), extended with a tone/description slot |

### Services
*What they sell, and how confidently.*

| Field | Holds | Populated by | Status |
|---|---|---|---|
| `current` | List of services offered | User input; capability output (Website Analysis can extract service-like content); Ground Truth for Concierge/Marketplace via the real Service Catalog (`service_engine.ts`) | **Existing** (top-level `services`) |
| `pricingConfidence` | Whether their pricing is clear/consistent vs. unsure/ad hoc | AI inference from how they talk about pricing | **New** |
| `seasonality` | Whether demand swings seasonally | User input; AI inference | **New** |

### Online Presence
*Where they're findable, and what condition it's in.*

| Field | Holds | Populated by | Status |
|---|---|---|---|
| `website` | `{status, url}` | Capability output (Website Analysis) | **Existing** |
| `domain` | Whether they own a custom domain | User input; capability output (Domain Registration) | **New** |
| `socialProfiles` | Recognized Facebook/Instagram/Google Business links, per platform | Capability output (Social/Listing Link Recognition — link recognized, content not readable, per its own honesty limit) | **New**, though the underlying capability (and its honest limitation) already exists |

Note: no bare `seo` field, per the instruction not to add fields in isolation — SEO awareness stays folded into `website`'s real state (whether real SEO copy exists, per `businesses.gen_seo_title/description`) rather than becoming its own disconnected flag.

### Reputation
*How trusted they already are.*

| Field | Holds | Populated by | Status |
|---|---|---|---|
| `reviews` | `{status, volume, platforms}` — e.g. "few," a rough count, where they show up | AI inference from conversation in Dashboard; Ground Truth for Concierge/Marketplace via the real `review_submissions` table (this is the field that resolves the exact gap flagged last turn — "Reviews: Few" is now representable, and moreover has a real backend source once loaded as Ground Truth rather than only inferred) | **New** |

### Sales & Marketing
*How customers currently find them.*

| Field | Holds | Populated by | Status |
|---|---|---|---|
| `leadSources` | Where customers currently come from (referral, social, word of mouth, ads) | User input; AI inference | **New** |
| `marketingChannelsInUse` | What they're actively doing today (if anything) | User input; AI inference | **New** |

### Customer Experience
*How customers interact with the business day to day.*

| Field | Holds | Populated by | Status |
|---|---|---|---|
| `scheduling` | `{current_system}` — a tool they mentioned using, never a claim Hubly is connected to it | User input (a fact stated, per the existing honesty rule for this field) | **Existing** (`scheduling.current_system`) |
| `currentCustomers` | Rough description/count of their existing customer base | User input; AI inference | **New** |
| `customerCommunication` | How they currently talk to customers (text, email, DMs, phone) | User input; AI inference | **New** |

### Operations
*What's running the business behind the scenes.*

| Field | Holds | Populated by | Status |
|---|---|---|---|
| `crm` | `{current_system}` | User input | **Existing** (`crm.current_system`) |
| `payments` | `{current_system}` | User input (a stated tool/method, e.g. "cash"); Ground Truth for Concierge/Marketplace can instead reflect real Stripe Connect status once connected — a materially more confident signal than a conversational mention | **Existing** (`payments.current_system`) |
| `teamSize` | Solo vs. small team vs. larger | User input | **New** |
| `equipment` | Notable equipment owned (relevant to detailing, HVAC, landscaping, etc.) | User input | **New** |

### Growth
*Where they want to go, and what's stopping them.*

| Field | Holds | Populated by | Status |
|---|---|---|---|
| `goals` | Stated aspirations, free text | User input; AI inference | **Existing** (top-level `goals`) |
| `revenueGoals` | A specific revenue/volume target, when given | User input | **New** |
| `biggestBottleneck` | What's most limiting them right now, in their own words or AI-summarized | AI inference from conversation | **New** |

---

## 4. Merge semantics under the nested shape

The three existing rules don't change, they just apply one level deeper, since every field now lives inside a section instead of at the top level:

- A **section** merges shallowly onto what's known — sending `{reputation: {reviews: {status: "few"}}}` doesn't erase anything else already known under `reputation`.
- An **array field** (`services.current`, `growth.goals`, `salesAndMarketing.leadSources`, etc.) still replaces wholesale when included — the existing "always write the complete current list, not just what's new" rule carries over unchanged.
- A **scalar or nested-object field** still shallow-merges/replaces the same way it does today.

Nothing about *how* patches merge changes — only that there's one more level of nesting to walk.

---

## 5. What adopting this requires updating (not done here — named for the complexity estimate)

- `hubly_business_understanding.ts` — the type itself, and `mergeUnderstandingPatch()` to merge one level deeper.
- `hubly-conversation/index.ts` — the `UNDERSTANDING_SCHEMA` prompt block (currently a flat literal) and the merge-rule instructions in the system prompt.
- `public/platform-home.html` — `hcMergePatch()`, `hcFieldDisplay()`, `HC_CATEGORY_ORDER` all currently assume flat top-level keys; the "What I've Learned" panel needs to walk sections.
- `hubly_capability_knowledge_base.ts` — every `relevantWhenMissing`/`relevantWhenFieldMatches` entry currently references a flat key (e.g. `"payments"`, `"goals"`); these become nested paths (e.g. `operations.payments`, `growth.goals`).
- The Concierge Context Loader (`loadConciergeContext`) — currently returns its own separate `ConciergeGroundTruth` shape; worth deciding whether it should populate this same canonical model instead, now that one exists (a real simplification, but a decision, not assumed here).

This is real, multi-file migration work, not a field-by-field patch — naming it plainly rather than understating it.

---

## 6. Left open, not resolved here

- Whether fields with a real backend source (reviews, payments-via-Stripe-status, service area) should *prefer* that source even inside Dashboard once it exists, rather than relying on conversational inference — a policy question about trusting real data over a stated claim, not a schema question.
- Where `loadConciergeContext`'s existing Ground Truth shape ends up relative to this model (fold in vs. stay separate) — flagged in Section 5, not decided.
- Exact types for a few fields left intentionally loose above (`pricingConfidence`, `businessStage`, `teamSize`) — free text vs. a small enum — worth settling at implementation time, not in this proposal.
