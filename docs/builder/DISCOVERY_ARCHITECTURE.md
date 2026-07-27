# 🤖 AI Discovery — Architecture (🔒 Locked)

**Milestone:** Hubly AI Business Builder  
**Module:** 2 — AI Discovery  
**Rules:** #24 (Dual Product) · #25 (Hubly Memory) · #26 (Business + Owner Profile) · never re-ask known facts  
**Inputs:** Hubly Session from Module 1 (Landing)  
**Status:** 🔒 **Architecture locked** — Development may proceed; UI must not alter this architecture without reopening  
**Related:** [HUBLY_MEMORY.md](../HUBLY_MEMORY.md) · [HUBLY_SESSION.md](../HUBLY_SESSION.md) · [README.md](./README.md)

---

## Lock rule

AI Discovery architecture is **frozen**.

Development may implement this doc.  
**No UI or code change may alter the approved architecture** without explicitly reopening Module 2.

Workflow: Architecture → Development → QA → MAT → CMV → Approval → Merge → Lock (Stage 1 OS).

---

## Purpose

Transform Landing understanding into a complete **Business DNA** — the combination of:

1. **Business Profile** — what the business is  
2. **Owner Profile** — how the founder runs it  

By the end of Module 2, Hubly understands both well enough to generate Website · Services · Pricing · Booking · Brand · Marketing · CRM · AI recommendations that fit **this owner**, not a generic shop.

This is a conversation with a **business consultant** — not a form, not an interrogation.

---

## Rule #26 — Business Profile + Owner Profile

Calling it only “Business DNA” was incomplete. Hubly learns the **business** and the **owner**.

```
Business Profile          Owner Profile
─────────────────         ─────────────────
Industry                  Experience
Services                  Goals
Location                  Communication Style
Pricing                   Growth Priorities
Brand                     Business Stage
Website                   Risk Tolerance
                          Preferred Customers

            ╲               ╱
             ╲             ╱
              Business DNA
         (combination of both)
```

### Business Profile

| Field | Examples |
|-------|----------|
| Industry | Mobile Detailing |
| Services | Full detail, ceramic coating |
| Location | Dallas, TX |
| Pricing | Premium / market / value |
| Brand | Voice, visual direction |
| Website | URL + imported structure |

### Owner Profile

| Field | Examples |
|-------|----------|
| Experience | Just starting · 1–3 years · 5+ years |
| Goals | More customers · recurring revenue · replace software |
| Communication Style | Direct · warm · premium-consultant |
| Growth Priorities | Steady retention vs aggressive expansion |
| Business Stage | Startup · growing · established |
| Risk Tolerance | Conservative · balanced · aggressive |
| Preferred Customers | Luxury owners · residential · commercial |

### Business DNA

The **combined** model Discovery maintains and passes downstream.

Ask Hubly later coaches on **both**:

> You told me you're just starting out and want steady recurring revenue. Based on that, I'd recommend promoting maintenance memberships before expanding into ceramic coatings.

That advice needs Owner Profile (stage + goals) **and** Business Profile (services / market).

---

## Inputs (from Hubly Session)

Module 2 **begins with** Temporary Memory. Example:

| Field | Example |
|-------|---------|
| Business Type | Mobile Detailing |
| Business Name | Shine Mobile Detailing |
| Location | Dallas |
| Intent | Build Business |
| Confidence | 96% |
| Website | www.shinemobiledetail.com |
| Instagram | @shine_detailing |
| Conversation | Loaded |

**Nothing already known is asked again.**

Seed known facts into the correct profile (Business vs Owner) immediately.

---

## Experience principle

The AI is **building alongside** the user.

```
┌─────────────────────────────┬──────────────────────────────┐
│  Conversation with Hubly    │  Live Business DNA           │
│  (left)                     │  (right)                     │
│                             │  Business Profile            │
│  Known facts acknowledged   │  ✓ Industry · ✓ Location     │
│  Only missing pieces asked  │  ⏳ Services · ⏳ Pricing    │
│  Suggested reply chips      │  Owner Profile               │
│  Max 2 questions at once    │  ✓ Stage · ⏳ Goals          │
│                             │  DNA Progress 63%            │
└─────────────────────────────┴──────────────────────────────┘
```

Every answer updates the correct profile live. The user watches both the business and their own operating style take shape.

---

## Screen layout (Stage 1 target)

- Hubly wordmark
- Title: `Building {Business Name}…`
- Opener: acknowledge what Landing already learned
- Conversation thread
- Suggested replies (chips)
- Progress panel: Business Profile + Owner Profile → Business DNA %
- Editable cards (click to edit)
- Controls: Continue · Skip · Back · Edit · Pause / Save & Exit

---

## AI behavior

| Do | Do not |
|----|--------|
| Ask only for missing information | Ask random or known questions |
| Route answers into Business vs Owner Profile | Dump everything into one flat bag |
| Explain why you’re asking | Interrogate without context |
| Max **2** questions at once | Show a long questionnaire |
| Adapt questions by industry | One generic script for all trades |
| Update DNA + Hubly Session every turn | Discard answers |
| Surface import results | Pretend imports didn’t happen |

**Completion:** Business DNA **≥ 90%** (weighted across Business Profile + Owner Profile) — not “every question answered.”

---

## Discovery engine — internal checklist

### Business Profile gaps

Industry · Business Name · Location · Top Services · Pricing Style · Brand Personality · Competitive Position · Photos · Website · Socials · Booking Preferences

### Owner Profile gaps

Business Stage · Experience Level · Goals · Growth Priorities · Communication Style · Risk Tolerance · Preferred / Target Customers · Mobile/Shop preference (ops style)

Progress = weighted completeness of both checklists (shown as Business DNA %).

---

## Dynamic questions (by industry)

| Industry | Example follow-up |
|----------|-------------------|
| HVAC | Do you offer emergency service? |
| Photography | Weddings or portraits? |
| Cleaning | Residential or commercial? |
| Detailing | Mobile, shop, or both? |

Owner-profile examples (any industry): experience · primary goal · growth priority · preferred customers.

If already known, skip and ask the next gap.

---

## Imports

| Source | Discovery UX |
|--------|----------------|
| Website | “I'm reading your website…” → services / photos / pages → “Anything to change?” |
| Instagram | Posts / followers / before-after → “I'll use these while building” |
| Google Business | Stars / reviews / keywords |
| Facebook | Page linked · enrichment continues |

Errors: unreachable / private / unavailable → continue anyway.

---

## AI suggestions

Suggestions must consider **Owner Profile** when present (e.g. memberships for “steady recurring” founders). Stored in Temporary Memory / recommendations — not Permanent Memory until upgrade.

---

## Memory writes (Rule #25)

Every response updates:

1. **Hubly Session** (Temporary Memory)
2. **Business Profile** and/or **Owner Profile**
3. **Business DNA** (combined view)

Autosave after every response. Pause / refresh resumes the same conversation.

---

## Outputs → Module 3 (AI Research Engine)

| Output | Notes |
|--------|-------|
| Business Profile | Structured business facts |
| Owner Profile | Founder operating style |
| Business DNA | Combined ≥ 90% |
| Hubly Session | Intact Temporary Memory |
| Conversation | Full thread |
| Imports | Website / social analysis |
| Recommendations | Suggestions surfaced in Discovery |

---

## Must not

- Redesign locked AI Landing (Module 1)
- Alter this locked architecture without reopen
- Remove or break Marketplace
- Re-ask Landing facts
- Treat Owner Profile as optional fluff
- Invent a new Brain layer (product-direction freeze)
- Treat Discovery as a multi-page form wizard

---

## Existing code bridge

Stage 1 Development evolves Instant Site discovery (`HUBLY_DISCOVERY` + understanding panel in `public/hubly.html`) into split **Conversation + Business DNA** (Business Profile · Owner Profile), consuming `HublySession.toBuilderPayload()`.
