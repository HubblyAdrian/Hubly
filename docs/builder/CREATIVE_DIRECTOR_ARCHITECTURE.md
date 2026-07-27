# 🎨 AI Creative Director — Architecture (🔒 Architecture · Dev may begin)

**Milestone:** Hubly AI Business Builder  
**Module:** 4 — AI Creative Director  
**Rules:** #24 · #25 · #26 · #27 🔒 (Business Vision) · #28 (Creative Review) · explain every recommendation  
**Status:** 🔒 **Architecture locked** — Development may begin; UI must not alter these docs without reopening  
**Canonical output:** **Creative Blueprint** (then Creative Review before acceptance)  
**Related:** [BUSINESS_VISION.md](./BUSINESS_VISION.md) · [CREATIVE_REVIEW.md](./CREATIVE_REVIEW.md) · [REVEAL_ARCHITECTURE.md](./REVEAL_ARCHITECTURE.md) · [README.md](./README.md)

---

## Purpose

This is **not** a website generator.

This is an **AI Creative Director** that designs the entire business.

> If the world's best creative agency spent a week building this business, what would they create?

The AI uses everything learned so far to produce a cohesive **Creative Blueprint** — the **canonical output of Module 4** and source of truth for Reveal / later build modules.

Creative Director must build **toward the Business Vision** (Rule #27), not simply reflect the current business.

---

## Canonical inputs (locked — do not bypass)

| Object | Role |
|--------|------|
| Hubly Session | Temporary Memory continuity |
| **Business Profile** | What the business is today |
| **Owner Profile** | How the founder operates |
| **Business DNA** | Combination (Rule #26) |
| **Research Profile** | Market / competitor / brand / pricing intelligence |
| **Business Vision** | Destination — what the owner wants to become (Rule #27) |

No Builder module may invent parallel copies of these objects.

Creative Director builds **toward Vision**, constrained by DNA + Research — not “average template for this trade.”

---

## What the AI creates (Creative Blueprint)

Not HTML. Not a locked template. A complete **business blueprint**:

### 1. Brand Identity
Personality · tone of voice · visual identity · color palette · typography · icon style · photography style · illustration style

### 2. Messaging
Headline · subheadline · mission · value proposition · CTAs · About · trust statements · FAQs · guarantees

### 3. Service Catalog
Core services · suggested services · add-ons · memberships — each editable; tagged Imported / Research-suggested / Vision-aligned

### 4. Pricing Strategy
Premium / Competitive / Value / Luxury / Budget — with **WHY** (e.g. comps + Vision “premium Dallas”)

### 5. Website Structure — Page Blueprint
Homepage blocks example: Hero → Trust → Services → Gallery → Reviews → Membership → Booking CTA → FAQ → Footer  
Every block editable. Not final HTML.

### 6. Booking Experience
Steps · questions · deposits · travel fees · availability · cancellation · confirmation messages

### 7. Customer Journey
Visitor → hero → services → book → emails → review → membership — optimized flow

### 8. Marketing Foundation
Email / SMS / brand / social voice · campaign themes · seasonal ideas · referral messaging

### 9. AI Personality
Ask Hubly adopts the brand (luxury → professional · family → warm · photographer → elegant)

### 10. Growth Strategy
Upsells · memberships · packages · cross-sells · seasonal promos · first campaign ideas — aligned to **Business Vision**

---

## Experience principle — agency, not software

Do **not** feel like a loading screen.  
Feel like sitting beside a creative agency.

### Live timeline (left / center)

```
🎨 AI Creative Director
Designing your business...

✓ Building your brand
✓ Writing your homepage
✓ Designing your booking experience
✓ Creating your services
✓ Optimizing pricing
✓ Building your customer journey
```

Activity copy, not “Generating…”

### Live preview (right)

Tabs continuously update: Brand · Website · Booking · Voice · Pricing · Gallery  

User **watches** logo direction → sections → services → booking → brand appear.

### Signature reveal (end of Module 4)

Do **not** say: “Your website has been generated.”

Stage a reveal:

> “I'd like to present the business we've created together.”

Then reveal section by section:

1. Your brand  
2. Your positioning  
3. Your services  
4. Your booking experience  
5. Your growth strategy  

Emotional shift: from “AI made pages” → “an AI creative director presented my business.”

---

## AI explanations — never mysterious

Every recommendation includes **WHY**, citing DNA / Research / Vision when relevant.

Examples:

- “I moved Ceramic Coating above Full Detail because your competitors emphasize it and it has higher margins — and your vision is premium Dallas.”  
- “I chose dark charcoal with blue accents because your photos suggest a premium detailing brand.”

**Ask Why** control always available.

---

## User controls

Accept · Edit · Regenerate · Compare · Undo · Ask Why · Favorite

### Compare mode
Version A vs Version B (e.g. Luxury vs Modern · Minimal vs Bold). User picks; edit persists.

### Confidence
Every recommendation shows confidence (Brand Voice 97% · Pricing 81% · Hero 94% · Membership 76%). Low confidence flagged for review.

---

## Outputs — Creative Blueprint (canonical Module 4 output)

**🔒 Locked as the Module 4 deliverable.** No parallel “website JSON” may replace it.

Source of truth for Module 5 Reveal +:

| Blueprint block | Contents |
|-----------------|----------|
| Brand System | Palette, type, voice, personality, visual rules |
| Content | Headlines, about, FAQs, guarantees |
| Service Structure | Catalog + memberships + add-ons |
| Website Blueprint | Page / section order (not HTML) |
| Booking Blueprint | Flow + policies |
| Marketing Blueprint | Channels + voice + themes |
| Pricing Blueprint | Strategy + rationale |
| Growth Blueprint | Upsells, campaigns, Vision milestones |
| AI Personality | Ask Hubly tone binding |
| Confidence map | Per recommendation |
| Citations | Links to DNA / Research / Vision drivers |

Stored in Hubly Session (Temporary) until account upgrade → Permanent Memory.

---

## Creative Review (Rule #28) — required before acceptance

Before the Creative Blueprint is accepted, run the **Creative Review Engine**:

Brand Consistency · Customer Trust · Conversion · SEO Readiness · Revenue Potential

Director summary (not “Done”):

> I've reviewed the business I created. Here's what I'm most confident about, and here's where I'd continue improving it over time.

See [CREATIVE_REVIEW.md](./CREATIVE_REVIEW.md). Pipeline:

```
Creative Blueprint → Creative Review → Business Reveal (Module 5)
```

---

## Signature reveal handoff

Module 4 prepares the Creative Blueprint + Creative Review.  
Module 5 owns the full staged Business Reveal ceremony (“present the business we've created together”).

Module 4 may show a short director preview; it must not claim the website is “generated and done.”

---

## Must not

- Output “a finished website” as the only artifact  
- Skip Creative Review before Blueprint acceptance  
- Ignore Business Vision when present  
- Bypass canonical profiles / DNA / Research / Vision  
- Hide rationale (“trust the AI”)  
- Feel like a spinner  
- Modify canonical object models or these architecture docs in UI without reopening the module  
- Redesign locked Landing / Discovery architecture  

---

## Stage 1 vs Stage 2

| Stage 1 | Stage 2 |
|---------|---------|
| Deterministic + heuristic Creative Blueprint from Session objects | Generative model polish / image generation |
| Live preview of blueprint cards / wire sections | Full WYSIWYG site render |
| Compare A/B text + palette variants | Multi-variant visual mock engines |
| Reveal ceremony UI | Motion / filmic presentation polish |

---

## Workflow

Architecture → Development → QA → MAT → CMV → Approval → Merge → Lock Stage 1 OS  
Do not skip stages.
