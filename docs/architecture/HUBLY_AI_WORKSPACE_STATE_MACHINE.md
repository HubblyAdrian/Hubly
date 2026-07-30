# Hubly AI Workspace — State Machine & Interaction Model

**Status:** Design artifact (required before treating the workspace as “done”)  
**Companion:** `HUBLY_AI_V2_ARCHITECTURE_REVIEW.md` · PR #372  
**Product rule:** The **workspace is the product**. Conversation guides it. The workspace is never secondary.

---

## North star

When someone opens Hubly they should never think *“Where do I click?”*  
They should think *“Let’s keep building.”*

| Layer | Role |
|-------|------|
| **Live Workspace (center)** | Hero — whatever we’re building right now |
| **AI Conversation (side)** | Guide — recommendations, opinions, single next decision |
| **Hubly Activity (side)** | Alive — *What is Hubly doing for me right now?* |

Not a dashboard with chat attached.  
Not a notification center.  
An expert sitting beside you, changing the interface as you talk.

---

## Modes (permanent distinction)

| Mode | When | Feeling |
|------|------|---------|
| **Building Mode** | Creating / evolving: website, storefront, campaign, new service, second location, holiday promo… | Cinematic. No sidebar. No distractions. Sitting with a designer. |
| **Operating Mode** | Running the business day to day | Same workspace as home + simple sidebar |

**Building Mode never ends forever.**  
Any major project re-enters Building Mode automatically. Operating Mode is for running; Building Mode is for creating and evolving.

```text
Operating ──(major project)──► Building ──(review / done)──► Operating
                ▲                                              │
                └──────────── (next major project) ────────────┘
```

---

## Workspace State Machine

States are **what the center is**, not onboarding steps.  
The AI and UI always know the current state.

```text
                    ┌─────────┐
                    │  Idle   │  Operating home — “Let’s keep building.”
                    └────┬────┘
                         │ intent: build / grow / get done
                         ▼
              ┌──────────────────────┐
              │ Enter Building Mode  │  sidebar hides · cinematic frame
              └──────────┬───────────┘
                         ▼
         ┌───────────────────────────────────┐
         │        Building Website           │◄── compare / tweak loops
         │  Recommend → Choose → Show → React│
         └───────────────┬───────────────────┘
                         ▼
         ┌───────────────────────────────────┐
         │       Reviewing Website           │
         └───────────────┬───────────────────┘
                         ▼
         ┌───────────────────────────────────┐
         │       Building Products           │◄── import / PDF / URL
         └───────────────┬───────────────────┘
                         ▼
         ┌───────────────────────────────────┐
         │       Reviewing Products          │
         └───────────────┬───────────────────┘
                         ▼
         ┌───────────────────────────────────┐
         │       Launching Business          │
         └───────────────┬───────────────────┘
                         ▼
                    ┌──────────┐
                    │Operating │
                    └────┬─────┘
                         │ “Build a Christmas campaign”
                         ▼
         ┌───────────────────────────────────┐
         │   Campaign Building Mode          │
         │   (Studio surface in center)      │
         └───────────────┬───────────────────┘
                         ▼
                    ┌──────────┐
                    │  Review  │
                    └────┬─────┘
                         ▼
                    ┌──────────┐
                    │Operating │
                    └──────────┘
```

### Canonical states

| State ID | Mode | Center surface | AI behavior |
|----------|------|----------------|-------------|
| `idle` | Operating | Home summary / last surface | Greet · recommend next focus |
| `building_website` | Building | Website renderer | Opinionated directions · point at UI |
| `reviewing_website` | Building | Website + feedback | Single decision: tweak or continue |
| `building_commerce` | Building | Storefront builder | Morph center — no nav, no modal |
| `building_products` | Building | Product editor | Import / generate / upload |
| `reviewing_products` | Building | Catalog cards | Confidence + reasoning |
| `building_campaign` | Building | Studio canvas | Recurring Building Mode |
| `marketplace_match` | Building | Provider recommendations | Get something done |
| `launching` | Building | Launch checklist live | Visible progress only |
| `operating` | Operating | Context-aware home | Run business · sidebar available |

Transitions are driven by **conversation + customer choice**, never by a Next button.

---

## Interaction model (signature)

### 1. Conversation drives the UI

When Hubly says *“Let’s build your storefront”*:

- No navigation  
- No modal  
- Center **morphs** into the Storefront Builder  

Every conversational turn may change `surface` + `state`.

### 2. Hubly points

Signature interaction — the AI manipulates the interface:

| AI says | Workspace does |
|---------|----------------|
| “I’m moving your booking button higher.” | Booking CTA animates upward (highlight pulse) |
| “I made your logo larger.” | Logo scales with emphasis |
| “Let’s compare two homepage directions.” | Center splits into dual preview |
| “I recommend this layout…” | Recommended card glows + shows confidence |

### 3. Opinionated recommendations

Every recommendation includes:

- **Choice** (what to pick)  
- **Confidence** (e.g. 92%)  
- **Reasoning** (why — tied to goal / DNA / market)  

Example: *“I recommend moving reviews higher because trust is the biggest conversion factor for local businesses.”* (Confidence 91%)

### 4. Show, don’t tell

If Hubly claims work, Hubly Activity answers: **What is Hubly doing for me right now?**

- Analyzing your website…  
- Building your homepage…  
- Importing products…  
- Generating brand colors…  
- Creating your first email campaign…  

Alive work — not a notification inbox.

### 5. Current Focus (not “milestones”)

Rename away from onboarding language:

| Avoid | Use |
|-------|-----|
| Milestone | **Current Focus** |
| Step 3 | **What’s Next** |
| Onboarding checklist | **Building Blocks** (secondary) |

---

## Layout contract

```text
┌──────────────────────────────────────────────────────────────┐
│ hubly                              Building Adrian's Brand   │
├────────────┬───────────────────────────────┬─────────────────┤
│ Conversation│     LIVE WORKSPACE (HERO)    │ Hubly Activity  │
│  guide      │     eye lands here first     │ What Hubly is   │
│  ~28%       │     ~48–52%                  │ doing · ~20%    │
├────────────┴───────────────────────────────┴─────────────────┤
│  Ask Hubly…   Upload · Website · Screenshot · PDF · Voice    │
│  (large ChatGPT-class input · drag & drop · paste)           │
└──────────────────────────────────────────────────────────────┘
```

Building Mode: no sidebar.  
Operating Mode sidebar (only): Home · Website · Commerce · Customers · Media · Studio · Growth · Settings.

---

## Input contract

The compose control is the most important UI in Hubly.

Supports: text · voice · screenshot · website URL · PDF · images · **drag & drop** · **paste**.

Everything starts here. It must feel large, calm, and inevitable — not a toolbar afterthought.

---

## Three product tests (every change)

1. Does it feel like working with an expert, not software?  
2. Does every interaction produce visible progress in the **center**?  
3. Does it make Hubly feel like one product — not many pages?

Plus: *How does this make the conversation with Hubly better?*

---

## Implementation mapping (PR #372+)

| Design | Code hook |
|--------|-----------|
| State machine | `S._aw.state` / `HublyAIWorkspace.transition(state)` |
| Building ↔ Operating | `enterBuildingMode(project)` / `enterOperatingMode()` |
| Surface morph | `setSurface(id)` → center renderer |
| Pointing | `aw-point` / `aw-pulse` on preview nodes + `pointAt(selector)` |
| Recommendations | message payload `{ choice, confidence, reasoning }` |
| Activity | `setDoing(verbPhrase)` — present continuous only |
| Current Focus | `aw.focusId` — not “milestone” in UI copy |

Shell is the frame.  
This state machine + interaction model is what makes Hubly feel revolutionary.

---

*End of Workspace State Machine design artifact.*
