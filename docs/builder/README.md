# Hubly AI Business Agency — Milestone

**Product name (canonical):** Hubly AI Business Agency  
**Legacy label:** “Business Builder”  
**Status:** 🔒 **Architecture complete & frozen (Rule #29)**  
**Master workflow:** [BUILDER_MASTER_WORKFLOW.md](./BUILDER_MASTER_WORKFLOW.md) ← start here  
**Entry:** AI Landing Experience (🔒 Stage 1 done)  
**Exit:** Launch → Hubly Operating System  
**Parallel:** Marketplace intact (`/marketplace`, `/get-done`)

---

## Architecture freeze

The Agency is **complete at the architecture level**.

Modules:

1. AI Landing Experience  
2. AI Discovery  
3. AI Research  
4. AI Creative Director  
5. Business Reveal  
6. Business Activation  
7. AI Launch Coach  

Launch → Hubly Operating System.

**No Builder module may be reordered, bypassed, or redesigned without explicitly reopening Builder Architecture.**

**Stop creating new architecture documents.** Build next.

---

## Development order (mandatory)

```
1 Landing ✅ → 2 Discovery → 3 Research → 4 Creative Director
  → 5 Reveal → 6 Activation → 7 Launch Coach → Launch → Home
```

Do **not** build modules out of order.

Every module:

Architecture → Development → QA → MAT → CMV → Approval → Merge → Lock  

**No shortcuts.**

| # | Module | Arch | Dev |
|---|--------|------|-----|
| 1 | AI Landing | 🔒 | 🔒 Done (#259) |
| 2 | AI Discovery | 🔒 | ⏳ **Next** |
| 3 | AI Research | 🔒 | ⏳ |
| 4 | AI Creative Director | 🔒 | ⏳ |
| 5 | Business Reveal | 🔒 | ⏳ |
| 6 | Business Activation | 🔒 | ⏳ |
| 7 | AI Launch Coach | 🔒 | ⏳ |

---

## Agency roles

| Module | Role |
|--------|------|
| Landing | AI Consultant |
| Discovery | Business Strategist |
| Research | Market Research Team |
| Creative Director | Creative Director |
| Reveal | Creative Presentation |
| Activation | AI Project Manager |
| Launch Coach | Final coach before go-live |

---

## Canonical pipeline (no bypass)

```
Hubly Session → Profiles → DNA → Research → Vision
  → Creative Blueprint → Creative Review → Reveal
  → Save My Business → Activation → Launch Coach
  → Launch → Operate Home → First Morning Brief
```

See [BUILDER_MASTER_WORKFLOW.md](./BUILDER_MASTER_WORKFLOW.md) for inputs/outputs/APIs/events per step.

---

## Canonical objects (Rules #26–#29)

Business Profile · Owner Profile · Business DNA · Research Profile · Business Vision · Creative Blueprint · Creative Review · Activated Business · Launch Plan

---

## Doc index (do not expand with new modules)

| Doc | Role |
|-----|------|
| [BUILDER_MASTER_WORKFLOW.md](./BUILDER_MASTER_WORKFLOW.md) | **Master story** |
| [HUBLY_MEMORY.md](../HUBLY_MEMORY.md) | Memory kinds |
| [HUBLY_SESSION.md](../HUBLY_SESSION.md) | Temporary session |
| [DISCOVERY_*](./DISCOVERY_ARCHITECTURE.md) | Module 2 |
| [RESEARCH_*](./RESEARCH_ARCHITECTURE.md) | Module 3 |
| [CREATIVE_DIRECTOR_*](./CREATIVE_DIRECTOR_ARCHITECTURE.md) · [CREATIVE_REVIEW.md](./CREATIVE_REVIEW.md) | Module 4 |
| [BUSINESS_VISION.md](./BUSINESS_VISION.md) | Rule #27 |
| [REVEAL_*](./REVEAL_ARCHITECTURE.md) | Module 5 |
| [ACTIVATION_*](./ACTIVATION_ARCHITECTURE.md) | Module 6 |
| [LAUNCH_COACH_*](./LAUNCH_COACH_ARCHITECTURE.md) | Module 7 |
