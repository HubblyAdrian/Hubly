# Hubly Memory

**Status:** Canonical architecture  
**Related:** [HUBLY_SESSION.md](./HUBLY_SESSION.md) · [AI_LANDING_ARCHITECTURE.md](./AI_LANDING_ARCHITECTURE.md) · [builder/DISCOVERY_ARCHITECTURE.md](./builder/DISCOVERY_ARCHITECTURE.md)

---

## Why this exists

Hubly is not one blob of “AI memory.”

There are **three kinds of memory**. Defining them now prevents Landing, Builder, Operate, and Ask Hubly from inventing conflicting stores later.

```
Temporary Memory     →  Hubly Session (pre-account)
Permanent Memory     →  Business (post-account)
Conversation Memory  →  Ask Hubly / coaching history
```

---

## 1. Temporary Memory — Hubly Session

**What it is:** Anonymous working memory from first keystroke until account creation (and briefly after handoff).

**Owner:** Hubly Session (`public/hubly-session.js` · `localStorage.hubly_session_v1`)

| Holds | Examples |
|-------|----------|
| Conversation | Landing + Discovery turns |
| Imports | Website, Instagram, Google Business, Facebook analysis |
| Intent | `build_business` / `hire_pro` + confidence |
| Builder progress | Discovery % · research cache |
| Business Profile | Industry, services, location, pricing, brand, website |
| Owner Profile | Experience, goals, communication style, growth priorities, stage, risk, preferred customers |
| Business DNA | Combination of Business Profile + Owner Profile (**canonical** — Rule #26) |
| Research Profile | Module 3 market / competitor / brand / pricing insights (cached) |
| Business Vision | Destination — long-term goals, ideal customers, positioning, timeline (Rule #27) |
| Creative Blueprint | Module 4 agency output (brand / site / booking / growth blueprints) |

**Lifecycle**

| Event | Behavior |
|-------|----------|
| Created | First meaningful Landing interaction |
| Updated | Every understand / import / discovery answer |
| Handed off | Landing → Builder (`?hs=`) |
| Upgraded | Save My Business / Create Account → becomes seed for Permanent Memory |
| Expires | **30 days** after last update (`expiresAt`) |
| Deleted | TTL, corrupt data, or explicit clear |

**Rules**

- Builder must **consume** Temporary Memory — never re-infer known facts from raw `?q=` alone.
- Marketplace Concierge may read the same session when routed from Landing.
- Nothing in Temporary Memory is durable business truth until upgraded.

---

## 2. Permanent Memory — Business

**What it is:** The durable business record. Never expires while the business exists.

**Owner:** Business Experience / Operate data owners (Settings, Storefront, Customers, Revenue, etc.) — not a second parallel CRM.

| Holds | Examples |
|-------|----------|
| Business | Profile, stage, location, brand |
| Customers | Golden customer profiles |
| Services | Storefront catalog |
| Website | Published site / storefront |
| Pricing | Packages, memberships |
| AI Preferences | Confirmation rules, coaching prefs |
| Reports | Definitions + saved views |
| Revenue | Invoices, payments (ledger owner) |

**Lifecycle**

| Event | Behavior |
|-------|----------|
| Created | Account + business provisioned from Hubly Session upgrade |
| Updated | Owner actions + approved AI writes into owning modules |
| Expires | **Never** (while business account is active) |
| Deleted | Explicit owner delete / account closure only |

**Rules**

- Temporary Memory **seeds** Permanent Memory on upgrade — it does not remain the source of truth.
- Ask Hubly may **read** Permanent Memory through owning modules; it does not clone ledgers (Operate Rules #15 · #19 · #22).

---

## 3. Conversation Memory — Ask Hubly

**What it is:** Ongoing coaching and recommendation history for a business.

**Owner:** Ask Hubly OS (`S.askHublyOs` conversations + memory notes)

| Holds | Examples |
|-------|----------|
| Ask Hubly threads | Previous conversations |
| Coaching | Advice given, follow-ups |
| Recommendations | Suggested actions, outcomes |
| Session notes | Lightweight refs — not entity copies |

**Lifecycle**

| Event | Behavior |
|-------|----------|
| Created | First Ask Hubly turn for a business (or public Ask Hubly later) |
| Updated | Each conversation turn / approved action |
| Expires | Soft retention policy TBD (Stage 2); not the same as Session TTL |
| Deleted | User clear / business delete |

**Rules**

- Conversation Memory remembers **dialogue and coaching**, not a duplicate of customers/services/revenue.
- Discovery conversation from Temporary Memory may be **summarized into** Conversation Memory after upgrade — not re-asked.

---

## How they connect

```
Landing types…
    ↓
Temporary Memory (Hubly Session)
    ↓
AI Discovery fills Business DNA
    ↓
Save My Business / Create Account
    ↓
Permanent Memory (Business)  ←── seeded, not recreated
    ↓
Ask Hubly runs on Permanent Memory
    + Conversation Memory grows over time
```

**One principle:** Nothing the AI already learned should be asked again. Memory is continuous; products are entry points.

---

## Profiles inside Temporary → Permanent Memory (Rule #26 · #27)

Hubly does not only learn “the business.” It learns the **owner** — and where they want to go.

| Layer | What it is |
|-------|------------|
| **Business Profile** | Industry, services, location, pricing, brand, website |
| **Owner Profile** | Experience, goals, communication style, growth priorities, business stage, risk tolerance, preferred customers |
| **Business DNA** | The combination of both — **canonical for all future Builder modules** |
| **Research Profile** | What the market says |
| **Business Vision** | What the owner wants to become (destination) |

Ask Hubly coaches using DNA **and** Vision, e.g. memberships before ceramic expansion for a founder who wants steady recurring revenue **and** aims to be the premium detailer in Dallas.

**🔒 Rule #26 locked.** No Builder module may bypass or duplicate Business Profile · Owner Profile · Business DNA.  
UI may not modify these models (or Research Profile / Business Vision) without reopening architecture.

See [builder/DISCOVERY_ARCHITECTURE.md](./builder/DISCOVERY_ARCHITECTURE.md) · [builder/BUSINESS_VISION.md](./builder/BUSINESS_VISION.md).

---

## Naming — do not confuse

| Say | Do not say |
|-----|------------|
| Hubly Session / Temporary Memory | “Builder Session” (retired) |
| Business / Permanent Memory | “AI memory” for customers/services |
| Conversation Memory | Dumping CRM rows into chat history |

---

## Module implications

| Module | Memory role |
|--------|-------------|
| AI Landing (🔒) | Creates Temporary Memory |
| AI Discovery (🔒 Architecture) | Fills Business Profile + Owner Profile → Business DNA |
| AI Research Engine (Module 3) | Builds Research Profile into Temporary Memory |
| Business Vision (Rule #27) | Destination object before Creative Director |
| AI Creative Director (Module 4) | Consumes all canonical objects → Creative Blueprint |
| Website / Services / Brand modules | Implement Creative Blueprint into Permanent Memory after upgrade |
| Ask Hubly (Operate 🔒) | Owns Conversation Memory; reads Permanent Memory, Owner Profile, and Vision for tailored coaching |
| Marketplace Concierge | May read Temporary Memory for hire intent; separate consumer journey |
