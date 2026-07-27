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
| Builder progress | Discovery % · DNA checklist state |
| Detected facts | Industry, name, location, stage |

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
| AI Discovery (Module 2) | Fills Business DNA inside Temporary Memory |
| Website / Services / Brand modules | Write into Permanent Memory after upgrade |
| Ask Hubly (Operate 🔒) | Owns Conversation Memory; reads Permanent Memory |
| Marketplace Concierge | May read Temporary Memory for hire intent; separate consumer journey |
