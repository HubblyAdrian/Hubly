# 🤖 AI Discovery — Architecture (required before Development)

**Milestone:** Hubly AI Business Builder  
**Module:** 2 — AI Discovery  
**Rules:** #24 (Dual Product) · #25 (Hubly Memory) · never re-ask known facts  
**Inputs:** Hubly Session from Module 1 (Landing)  
**Status:** Architecture gate — do not start Development without founder approval of this doc  
**Related:** [HUBLY_MEMORY.md](../HUBLY_MEMORY.md) · [HUBLY_SESSION.md](../HUBLY_SESSION.md) · [README.md](./README.md)

---

## Purpose

Transform the initial understanding from Landing into a complete **Business DNA**.

By the end of Module 2, Hubly understands the business well enough to generate:

Website · Services · Pricing · Booking flow · Brand · Marketing · CRM configuration · AI recommendations

This is a conversation with a **business consultant** — not a form, not an interrogation.

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

---

## Experience principle

The AI is **building alongside** the user.

```
┌─────────────────────────────┬──────────────────────────┐
│  Conversation with Hubly    │  Live Business DNA       │
│  (left)                     │  (right)                 │
│                             │  ✓ Industry              │
│  Known facts acknowledged   │  ✓ Location              │
│  Only missing pieces asked  │  ⏳ Services             │
│  Suggested reply chips      │  ⏳ Pricing              │
│  Max 2 questions at once    │  Progress 63%            │
└─────────────────────────────┴──────────────────────────┘
```

Every answer updates DNA live. The user watches the business take shape.

---

## Screen layout (Stage 1 target)

- Hubly wordmark
- Title: `Building {Business Name}…`
- Opener: acknowledge what Landing already learned (industry · location · stage · imports)
- Conversation thread
- Suggested replies (chips)
- Progress / Business DNA panel (editable cards)
- Controls: Continue · Skip · Back · Edit · Pause / Save & Exit

---

## AI behavior

| Do | Do not |
|----|--------|
| Ask only for missing information | Ask random or known questions |
| Explain why you’re asking | Interrogate without context |
| Max **2** questions at once | Show a long questionnaire |
| Adapt questions by industry | One generic script for all trades |
| Update DNA + Hubly Session every turn | Discard answers |
| Surface import results (“Found 8 services…”) | Pretend imports didn’t happen |

**Completion:** Business DNA **≥ 90%** — not “every question answered.”

---

## Discovery engine — internal checklist

Industry · Business Name · Location · Business Stage · Mobile/Shop · Target Customer · Top Services · Pricing Style · Brand Personality · Competitive Position · Experience Level · Goals · Photos · Website · Socials · Booking Preferences

Progress = weighted completeness of this checklist (shown as Business DNA %).

---

## Dynamic questions (by industry)

| Industry | Example follow-up |
|----------|-------------------|
| HVAC | Do you offer emergency service? |
| Photography | Weddings or portraits? |
| Cleaning | Residential or commercial? |
| Detailing | Mobile, shop, or both? |

If already known (e.g. mobile from Landing), skip and ask the next gap (e.g. signature service).

---

## Imports

| Source | Discovery UX |
|--------|----------------|
| Website | “I'm reading your website…” → services / photos / pages found → “Anything to change?” |
| Instagram | Posts / followers / before-after signal → “I'll use these while building” |
| Google Business | Stars / reviews / keywords |
| Facebook | Page linked · enrichment continues |

Errors: unreachable / private / unavailable → continue anyway.

---

## AI suggestions

As DNA grows, suggestions appear (e.g. membership offer + estimated revenue). Suggestions update Temporary Memory / recommendations payload — not Permanent Memory until account upgrade.

---

## Memory writes (Rule #25)

Every response updates:

1. **Hubly Session** (Temporary Memory)
2. **Business DNA** (structured facts inside the session / discovery state)

Autosave after every response. Pause / refresh resumes the same conversation.

---

## Outputs → Module 3

| Output | Notes |
|--------|-------|
| Business DNA | ≥ 90% complete structured facts |
| Hubly Session | Intact Temporary Memory |
| Conversation | Full thread |
| Imports | Website / social analysis |
| Recommendations | AI suggestions surfaced in Discovery |

---

## Must not

- Redesign locked AI Landing (Module 1) unless explicitly reopened
- Remove or break Marketplace
- Re-ask Landing facts
- Invent a new Brain layer (product-direction freeze)
- Treat Discovery as a multi-page form wizard

---

## Existing code bridge

Stage 1 Development should evolve the Instant Site discovery path (`HUBLY_DISCOVERY` + `#is-understanding-panel` in `public/hubly.html`) into the split **Conversation + Business DNA** experience — consuming `HublySession.toBuilderPayload()` already wired by Module 1.
