# Hubly AI Business Builder — Milestone

**Status:** Active  
**Entry:** AI Landing Experience (🔒 locked — Module 1)  
**Session:** Hubly Session · [HUBLY_MEMORY.md](../HUBLY_MEMORY.md)  
**Parallel product:** Marketplace remains intact (`/marketplace`, `/get-done`)

---

## Canonical objects (🔒 Rule #26 + #27)

No Builder module may bypass or duplicate these models. UI may not modify them without reopening architecture.

| Object | Doc | Role |
|--------|-----|------|
| **Business Profile** | Rule #26 | What the business is |
| **Owner Profile** | Rule #26 | How the founder operates |
| **Business DNA** | Rule #26 | Combination of both — **canonical for all future Builder modules** |
| **Research Profile** | Module 3 | Market / competitor / brand / pricing intelligence |
| **Business Vision** | [BUSINESS_VISION.md](./BUSINESS_VISION.md) · Rule #27 | Destination — what the owner wants to become |
| Creative Blueprint | Module 4 output | Agency blueprint for build modules |

```
Hubly Session
  → Business Profile + Owner Profile → Business DNA
  → Research Profile
  → Business Vision
  → Creative Blueprint (Module 4)
```

---

## Vision

The Builder starts the moment the user types on the landing page.

```
Landing (Module 1) 🔒
  ↓
AI Discovery (Module 2) 🔒 Architecture · Dev may begin
  ↓  DNA ≥ 90%
AI Research Engine (Module 3) ⏳ Architecture
  ↓  Research Profile
Business Vision (Rule #27) ⏳ Canonical
  ↓
AI Creative Director (Module 4) ⏳ Architecture
  ↓  Creative Blueprint
Module 5+ (implement blueprints)
  ↓
Save My Business → Permanent Memory → Operate OS
```

---

## Modules

| # | Module | Purpose | Status |
|---|--------|---------|--------|
| 1 | 🌎 AI Landing Experience | Intent router · Hubly Session | 🔒 Locked |
| 2 | 🤖 AI Discovery | Business + Owner → DNA | 🔒 Architecture · Dev may begin |
| 3 | 🔍 AI Research Engine | Research before build | ⏳ Architecture |
| 4 | 🎨 AI Creative Director | Creative Blueprint + agency reveal | ⏳ Architecture |
| 5+ | Implement / publish | Website runtime, etc. | ❌ Not started |

---

## Locked

### Module 1 — Landing
Do not redesign unless explicitly reopened. [AI_LANDING_ARCHITECTURE.md](../AI_LANDING_ARCHITECTURE.md)

### Module 2 — Discovery Architecture
Frozen. Dev uses `DISCOVERY_*`. Do not alter architecture without reopen.

### Rule #26 — Business DNA model
**Canonical for all future Builder modules.** Business Profile · Owner Profile · Business DNA may not be bypassed or duplicated.

---

## Module 3 — Research
[RESEARCH_ARCHITECTURE.md](./RESEARCH_ARCHITECTURE.md) · checklist · MAT

## Module 4 — Creative Director
[CREATIVE_DIRECTOR_ARCHITECTURE.md](./CREATIVE_DIRECTOR_ARCHITECTURE.md) · [CREATIVE_DIRECTOR_CHECKLIST.md](./CREATIVE_DIRECTOR_CHECKLIST.md) · [CREATIVE_DIRECTOR_MAT.md](./CREATIVE_DIRECTOR_MAT.md)

**Signature:** Present the business together — brand → positioning → services → booking → growth. Not “website generated.”

## Business Vision
[BUSINESS_VISION.md](./BUSINESS_VISION.md) — destination before Creative Director builds.

---

## Memory

| Kind | Scope | Expires |
|------|-------|---------|
| Temporary | Hubly Session (+ DNA / research / vision / blueprint) | 30 days |
| Permanent | Business | Never |
| Conversation | Ask Hubly | Soft retention |

Workflow: Architecture → Development → QA → MAT → CMV → Approval → Merge → Lock. **Do not skip stages.**
