# Builder Master Workflow

**Status:** 🔒 Canonical · Architecture frozen (Rule #29)  
**Product:** Hubly AI Business Agency  
**Purpose:** The story of the entire Builder — first keystroke → Home  
**Audience:** Any developer who should not need seven module docs to understand the experience  
**Related:** [README.md](./README.md) · [HUBLY_MEMORY.md](../HUBLY_MEMORY.md) · [HUBLY_SESSION.md](../HUBLY_SESSION.md)

---

## Freeze

This workflow is **frozen** with Rule #29.

No Builder module may be **reordered, bypassed, or redesigned** without explicitly reopening Builder Architecture.

**No new architecture modules.** Development proceeds **in sequence** only:

1 → 2 → 3 → 4 → 5 → 6 → 7 → Launch → Operate OS  

Each module: Architecture → Development → QA → MAT → CMV → Approval → Merge → Lock. **No shortcuts.**

---

## End-to-end spine

```
Visitor arrives
  ↓
Hubly Session created
  ↓
Intent detected
  ↓
Business Discovery
  ↓
Business Profile created
  ↓
Owner Profile created
  ↓
Business DNA created
  ↓
Research Profile created
  ↓
Business Vision created
  ↓
Creative Blueprint created
  ↓
Creative Review
  ↓
Business Reveal
  ↓
Save My Business
  ↓
Business Activation
  ↓
AI Launch Coach
  ↓
Launch
  ↓
Hubly Operating System
  ↓
First Morning Brief
```

---

## Module map

| # | Module | Agency role | Arch status | Dev status |
|---|--------|-------------|-------------|------------|
| 1 | AI Landing Experience | Consultant | 🔒 Locked | 🔒 Stage 1 done (#259) |
| 2 | AI Discovery | Strategist | 🔒 Locked | ⏳ Next |
| 3 | AI Research | Research team | 🔒 Locked | ⏳ After M2 |
| 4 | AI Creative Director | Creative Director | 🔒 Locked | ⏳ After M3 |
| 5 | Business Reveal | Presentation | 🔒 Locked | ⏳ After M4 |
| 6 | Business Activation | Project Manager | 🔒 Locked | ⏳ After M5 |
| 7 | AI Launch Coach | Final coach | 🔒 Locked | ⏳ After M6 |
| — | Launch → Home | Operator handoff | 🔒 Locked | With M7 |

---

## Step 0 — Visitor arrives

| Field | Detail |
|-------|--------|
| **Screen** | `/` · `platform-home.html` |
| **Inputs** | None |
| **Outputs** | Landing rendered |
| **Objects** | None yet |
| **APIs** | Static / CDN assets; optional analytics |
| **Events** | `landing_view` |
| **Buttons** | Path tabs (grow business / hire someone) · chips · Continue (disabled) · Ask Hubly FAB · Marketplace footer |
| **AI** | Idle demo; ready to understand keystrokes |
| **Failure** | Page must still load without session JS (degrade gracefully) |
| **Next** | First keystroke → Step 1 |

---

## Step 1 — Hubly Session created (Module 1)

| Field | Detail |
|-------|--------|
| **Screen** | Landing hero input |
| **Inputs** | First meaningful text |
| **Outputs** | Anonymous session in `localStorage` (`hubly_session_v1`) |
| **Objects** | **Hubly Session** (Temporary Memory) |
| **APIs** | None required (local) |
| **Events** | Session create / `upsertSession` |
| **Buttons** | Continue still gated on readiness |
| **AI** | `understand()` · `upsertSession()` |
| **Failure** | Quota / private mode → in-memory fallback if possible; never crash |
| **Next** | Intent detection |

---

## Step 2 — Intent detected (Module 1)

| Field | Detail |
|-------|--------|
| **Screen** | Landing + live status line |
| **Inputs** | Session · typed text · preferred path |
| **Outputs** | `intent` · `confidence` · `destination` (`business_builder` \| `marketplace_concierge`) |
| **Objects** | Session.detected updated |
| **APIs** | None (Stage 1 local) |
| **Events** | Intent track |
| **Buttons** | Continue Building / Find someone when `ready` |
| **AI** | Score hire vs build; never remove Marketplace |
| **Failure** | Unknown intent → keep learning; don’t route prematurely |
| **Next** | If hire → Concierge (`/get-done?hs=`) · If build → Discovery path |

---

## Step 3 — Import pipeline kickoff (Module 1, optional)

| Field | Detail |
|-------|--------|
| **Screen** | Landing status: “Reading services…” |
| **Inputs** | Detected URLs (website / IG / Google / FB) |
| **Outputs** | Import jobs started · partial/ready analysis |
| **Objects** | Session.imports · importProgress |
| **APIs** | `POST /api/import-analyze` |
| **Events** | `import_pipeline_start` · `import_pipeline_item` |
| **Buttons** | Continue still available |
| **AI** | Progressive status lines; social may be partial |
| **Failure** | Unreachable → partial + continue; never block Continue |
| **Next** | Structured handoff |

---

## Step 4 — Handoff to Builder (Module 1 → 2)

| Field | Detail |
|-------|--------|
| **Screen** | Navigate `/signup?q=&hs=` |
| **Inputs** | Session id · lastText |
| **Outputs** | `markHandedOff()` · Welcome / Instant Site |
| **Objects** | Same Hubly Session |
| **APIs** | None |
| **Events** | `continue_build` |
| **Buttons** | Continue Building |
| **AI** | Must **not** re-infer known facts from `?q=` alone |
| **Failure** | Missing hs → load session by key; legacy migrate |
| **Next** | Business Discovery |

---

## Step 5 — Business Discovery (Module 2)

| Field | Detail |
|-------|--------|
| **Screen** | Split: conversation left · DNA panel right |
| **Inputs** | Hubly Session payload · conversation · imports |
| **Outputs** | Gap-fill turns · suggested replies · DNA % |
| **Objects** | Discovery session state inside Temporary Memory |
| **APIs** | Optional continue import-analyze |
| **Events** | Discovery turn / fact set |
| **Buttons** | Continue · Skip · Back · Edit · Save & Exit · chips |
| **AI** | Max 2 questions · never re-ask known · explain why · industry-dynamic |
| **Failure** | Refresh → resume from Session |
| **Next** | Profiles complete enough for DNA |

---

## Step 6 — Business Profile created (Module 2)

| Field | Detail |
|-------|--------|
| **Inputs** | Discovery answers · imports |
| **Outputs** | Industry · services · location · pricing · brand · website |
| **Objects** | **Business Profile** (Rule #26) |
| **APIs** | — |
| **Events** | `business_profile_updated` |
| **Screens / Buttons** | DNA cards (editable) |
| **AI** | Route facts into Business Profile (not Owner) |
| **Failure** | Partial OK; mark gaps |
| **Next** | Owner Profile |

---

## Step 7 — Owner Profile created (Module 2)

| Field | Detail |
|-------|--------|
| **Inputs** | Founder answers (experience, goals, style, growth, stage, risk, preferred customers) |
| **Outputs** | Owner operating style |
| **Objects** | **Owner Profile** (Rule #26) |
| **Events** | `owner_profile_updated` |
| **AI** | Do not treat as “business data” |
| **Failure** | Infer low-confidence; flag |
| **Next** | Business DNA |

---

## Step 8 — Business DNA created (Module 2 complete)

| Field | Detail |
|-------|--------|
| **Inputs** | Business Profile + Owner Profile |
| **Outputs** | Combined DNA ≥ 90% |
| **Objects** | **Business DNA** (canonical for all Agency modules) |
| **Events** | `business_dna_ready` |
| **Buttons** | Continue to Research |
| **AI** | Completion by DNA %, not “all questions asked” |
| **Failure** | Below 90% → keep Discovery |
| **Next** | AI Research |

---

## Step 9 — Research Profile created (Module 3)

| Field | Detail |
|-------|--------|
| **Screen** | “AI employee at work” timeline (not a spinner) |
| **Inputs** | DNA · Session · imports · conversation |
| **Outputs** | Market · competitor · brand · services · pricing · visual · SEO insights + confidence |
| **Objects** | **Research Profile** |
| **APIs** | `/api/import-analyze` + Stage 1 heuristics; Stage 2 live vendors |
| **Events** | Research task complete lines |
| **Buttons** | Pause · Retry · Skip source · Continue |
| **AI** | Parallel tasks; Owner Profile shapes priority notes |
| **Failure** | Source fail → continue; never stop Builder |
| **Next** | Business Vision |

---

## Step 10 — Business Vision created (Rule #27)

| Field | Detail |
|-------|--------|
| **Screen** | Discovery / Vision confirmation (may be light) |
| **Inputs** | Owner goals · DNA · Research |
| **Outputs** | Destination: long-term goals · ideal customers · positioning · timeline · metrics · expansion |
| **Objects** | **Business Vision** |
| **Events** | `business_vision_set` |
| **AI** | Destination ≠ today’s facts; Creative Director builds **toward** Vision |
| **Failure** | Missing → low-confidence draft + flag; don’t invent silently as truth |
| **Next** | Creative Director |

---

## Step 11 — Creative Blueprint created (Module 4)

| Field | Detail |
|-------|--------|
| **Screen** | Agency workbench · live preview tabs |
| **Inputs** | DNA · Research · Vision · Session |
| **Outputs** | Brand · messaging · services · pricing · page blueprint · booking · journey · marketing · growth · AI personality |
| **Objects** | **Creative Blueprint** (canonical Module 4 output) |
| **APIs** | Stage 1 heuristics / local generation |
| **Events** | Blueprint section ready |
| **Buttons** | Accept · Edit · Regenerate · Compare · Undo · Ask Why · Favorite |
| **AI** | Always WHY; Compare A/B; confidence scores |
| **Failure** | Partial blueprint OK; flag low confidence |
| **Next** | Creative Review (required) |

---

## Step 12 — Creative Review (Rule #28)

| Field | Detail |
|-------|--------|
| **Screen** | Score cards + director summary |
| **Inputs** | Creative Blueprint · DNA · Research · Vision |
| **Outputs** | Scores (Brand Consistency · Trust · Conversion · SEO · Revenue) · suggestions · summary |
| **Objects** | **Creative Review** |
| **Events** | `creative_review_complete` |
| **Buttons** | Apply suggestion · Continue to Reveal |
| **AI** | “I've reviewed the business I created…” — never “Done.” |
| **Failure** | Low scores don’t block; surface honesty |
| **Next** | Business Reveal |

**No UI may bypass** Blueprint → Review → Reveal.

---

## Step 13 — Business Reveal (Module 5)

| Field | Detail |
|-------|--------|
| **Screen** | Staged ceremony (brand → positioning → services → site → booking → marketing → growth → review → ready) |
| **Inputs** | Blueprint · Creative Review · DNA · Vision |
| **Outputs** | Approved presentation state |
| **Objects** | Business Blueprint Approved (session) |
| **Events** | Reveal stage complete |
| **Buttons** | Reveal · Approve · Edit · Regenerate · Compare · Ask Why · Pause |
| **AI** | Narrate; cite WHY |
| **Failure** | Resume from stage on refresh |
| **Next** | Save My Business (first edit or Stage 9) |

---

## Step 14 — Save My Business (account)

| Field | Detail |
|-------|--------|
| **Screen** | Lightweight prompt on first meaningful edit **or** Stage 9 CTA |
| **Inputs** | Anonymous Hubly Session |
| **Outputs** | Account · business id · `upgradeToAccount` |
| **Objects** | Session status `upgraded` · seed Permanent Memory |
| **APIs** | Auth (Google / Apple / Microsoft / email+password) · business provision |
| **Events** | `session_upgraded` · account created |
| **Buttons** | Continue with Google / Apple / Microsoft · Email & Password |
| **AI** | Copy: protect what you built — **not** “Create Account” |
| **Failure** | Auth fail → stay in Reveal; don’t lose edits |
| **Next** | Resume exact context → later Activation |

---

## Step 15 — Business Activation (Module 6)

| Field | Detail |
|-------|--------|
| **Screen** | Mission control checklist |
| **Inputs** | Approved business · Session |
| **Outputs** | Connections state · hours · travel · notifications · automations |
| **Objects** | **Activated Business** (partial → ready) |
| **APIs** | Stripe / Calendar / Domain (Stage 2 live; Stage 1 soft-connect OK) |
| **Events** | Activation item complete |
| **Buttons** | Connect · Skip · Retry · Back · Pause · Continue to Coach |
| **AI** | Why-language (fuel payments · protect schedule · stay informed) |
| **Failure** | Skip never blocks path; remind later |
| **Next** | AI Launch Coach |

Hard minimum before Launch path: business name · ≥1 service · booking enabled.

---

## Step 16 — AI Launch Coach (Module 7)

| Field | Detail |
|-------|--------|
| **Screen** | Coach · readiness · health · forecast · timeline · Ask Coach |
| **Inputs** | Activated Business · DNA · Vision · Research · Blueprint · Review |
| **Outputs** | Launch Plan · applied/deferred recommendations |
| **Objects** | **Launch Plan** |
| **APIs** | — |
| **Events** | Recommendation apply · coach chat |
| **Buttons** | Apply All · Review One by One · Launch Anyway · Save · Ask Coach · 🚀 Launch My Business |
| **AI** | Operate readiness (≠ Creative Review); never block Launch on optionals |
| **Failure** | Empty recommendations → allow Launch Anyway |
| **Next** | Launch ceremony |

---

## Step 17 — Launch

| Field | Detail |
|-------|--------|
| **Screen** | Ceremony (not hard-cut) |
| **Inputs** | Launch Plan · Activated Business |
| **Outputs** | Live site / booking · Permanent Business record |
| **Objects** | Launched business · first-session flags |
| **APIs** | Publish / activate booking (Stage 1 definition) |
| **Events** | `business_launched` |
| **Buttons** | Enter Hubly → |
| **AI** | “You launched a business… I'll be with you every day…” |
| **Failure** | Publish fail → retry; keep Activation/Coach state |
| **Next** | Hubly Operating System Home |

**Builder officially ends here.**

---

## Step 18 — Hubly Operating System + First Morning Brief

| Field | Detail |
|-------|--------|
| **Screen** | Home Dashboard (`/app` / Operate Home) |
| **Inputs** | Permanent Memory · Launch Plan · Agency journey |
| **Outputs** | Personalized greeting · Morning Brief seed |
| **Objects** | Operate OS owners (Customers, Jobs, Revenue, Ask Hubly, …) |
| **APIs** | Existing Operate loaders |
| **Events** | `first_home_enter` · Morning Brief open |
| **Buttons** | Standard Home / Ask Hubly |
| **AI** | “Welcome to Hubly, {Name}. We built the foundation together. Now let's grow your business.” Brief uses Builder memory |
| **Failure** | Brief fail → Home still loads |
| **Next** | Day-to-day Operate (locked OS modules) |

---

## Event catalog (minimum)

| Event | When |
|-------|------|
| `landing_view` | Landing load |
| `import_pipeline_*` | Import start/item |
| `continue_build` / `continue_hire` | Landing exit |
| `business_profile_updated` | M2 |
| `owner_profile_updated` | M2 |
| `business_dna_ready` | M2 complete |
| `research_profile_ready` | M3 |
| `business_vision_set` | Vision |
| `creative_blueprint_ready` | M4 |
| `creative_review_complete` | Rule #28 |
| `reveal_stage_complete` | M5 |
| `session_upgraded` | Save My Business |
| `activation_item_complete` | M6 |
| `launch_plan_ready` | M7 |
| `business_launched` | Launch |
| `first_home_enter` | Operate Home |

Exact names may be normalized in code; semantics are frozen.

---

## Object ownership summary

| Object | Created | Consumed by |
|--------|---------|-------------|
| Hubly Session | M1 | All until upgrade |
| Business Profile | M2 | M3–M7 · Operate |
| Owner Profile | M2 | M3–M7 · Ask Hubly |
| Business DNA | M2 | M3–M7 |
| Research Profile | M3 | M4–M7 |
| Business Vision | M2/M4 seed | M4–M7 · Ask Hubly |
| Creative Blueprint | M4 | M5–M7 |
| Creative Review | M4/M5 | M5 |
| Activated Business | M6 | M7 · Launch |
| Launch Plan | M7 | Launch · Home Brief |
| Permanent Business | Save / Launch | Operate OS |

---

## Failure principles (global)

1. Never stop the Agency on optional integrations or partial imports.  
2. Never re-ask known Session facts.  
3. Never bypass Blueprint → Review → Reveal.  
4. Never block Launch except hard minimums.  
5. Never say “Create Account” — say **Save My Business**.  
6. Marketplace remains a parallel product.

---

## Development order (frozen)

```
Module 1 Landing        ✅ Done · Locked
Module 2 Discovery      ← next Development
Module 3 Research
Module 4 Creative Director
Module 5 Reveal
Module 6 Activation
Module 7 Launch Coach
Launch → Home
```

Process every module:

Architecture → Development → QA → MAT → CMV → Approval → Merge → Lock  

**Architecture phase for the Agency is complete. Stop creating new architecture modules. Build in sequence.**
