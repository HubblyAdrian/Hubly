# Hubly Constitution

This is not code. These are the permanent rules of Hubly.

When adding features months from now, check this document first.
Do not invent new Brain layers unless absolutely required.

---

## Product truth

Hubly is an **AI operating system that builds, runs, and grows a local service business from a conversation**.

Business owners describe **outcomes**, not software.
Hubly builds around the business — not the other way around.

---

## Pipeline (frozen)

```
Conversation
    ↓
Understanding
    ↓
Business Memory          ← What is true?
Business DNA             ← Who is this business?
    ↓
Planner                  ← WHAT (never HOW)
    ↓
Execution Plan
    ↓
Orchestrator             ← HOW
    ↓
Capabilities
    ↓
Executors
    ↓
Platform
```

**Architecture is frozen after Business DNA.**
Next work proves the architecture by migrating real capabilities onto the Runtime.

Roadmap proof order:

1. **Website Runtime** (first Conversation → Platform proof)
2. **Marketplace Runtime** (customers enter; Brain understands both sides)
3. **CRM Runtime**
4. Business Coach
5. Autonomous Growth

---

## Permanent separations

### Business Memory stores facts

Answers: **“What is true?”**

Examples: name, city, services, prices, hours, CRM counts, published slug.

Module: `hubly_brain_memory.ts` · Table: `business_memories`

### Business DNA stores identity

Answers: **“What kind of business is this?”**

Examples: brand personality, ideal customer, sales style, goals, tone, competitive advantage, seasonality meaning.

Module: `hubly_brain_dna.ts` · Table: `business_dna`

**Never combine Memory and DNA.**
Prompt injection keeps two labeled blocks.

---

## Role boundaries

| Layer | Owns | Must not |
|---|---|---|
| **Understanding** | Read raw conversation; write Memory facts + DNA patches | Plan execution or write platform tables |
| **Planner** | Decide WHAT (capabilities, dependsOn, priority) from Memory + DNA | Decide HOW, order mechanics, retries, or inspect raw chat |
| **Orchestrator** | HOW — DAG, parallel, retries, cancel, progress, history, confidence gates | Invent business strategy or rewrite DNA/Memory meaning |
| **Capabilities** | Reusable, composable nodes in the registry | Special-case one-off flows outside the registry |
| **Executors** | Perform work; write through platform APIs / Memory / DNA | Reason about strategy; the **model never writes the database directly** |

---

## AI rules

1. AI never writes directly to the database — **Executors** write.
2. Features must not invent their own personality prompts — they receive **Business DNA**.
3. Features must not rebuild factual context by hand — they receive **Business Memory**.
4. Low capability confidence → **ask clarifying questions**, do not guess.
5. New product work funnels through `Hubly.buildBusiness(prompt)` / the Runtime — do not bypass the pipeline for new capabilities.

---

## Website (first proof)

The Website Builder must not ask: “Build a website.”

It answers:

- Who is this business?
- Who are they serving?
- Why do customers hire them?
- What makes them different?
- What emotions should the website create?
- What actions should visitors take?

The website is a **visual expression of Business DNA**, grounded in Memory facts, executed by the Website capability.

---

## Progress

Owners see live execution, not black-box completion:

Understanding… → Learning your business… → Building brand… → Writing homepage… → …
→ Done.

Nothing polls random endpoints for core Runtime progress — the Progress Bus is the source of truth.

---

## One-line test

If a change invents a new core Brain layer, or lets a model write the DB, or merges Memory with DNA, or bypasses Planner → Orchestrator → Executors — it violates this constitution.
