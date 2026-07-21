# Hubly Constitution

This is not code. These are the permanent rules of Hubly.

When adding features, check this document first.
Do not invent new Brain layers.
Do not redesign the Runtime.
Do not build demo implementations or temporary code.

---

## Production-First Principle

Hubly does **not** build prototypes.

Every completed capability must be **production deployable** for a real business:

- Real execution path  
- Real data  
- Real authentication / authorization / ownership  
- Real persistence  
- Real error handling, logging, progress events  

If something cannot execute because a Connection is missing, return the **real system state**.

Never simulate success. Never fake progress. Never invent reviews, bookings, or availability.

Owner-facing copy when an external system is not linked:

> Domain connection required  
> Stripe connection required  
> Google Calendar connection required  

Internally: **connectors**. Externally: **Connections**.

Done means: *Could we release this to paying customers today?*

---

## Customer outcome milestones (not engineering phases)

Stop naming work by Phase / Sprint / Runtime numbers.

Name work by what a customer can do:

| Milestone | Meaning |
|---|---|
| **Business Created** | A business can be created entirely through conversation (Identity, Website, Booking, CRM, Health, Timeline). |
| **Business Launched** | A business can go live with website, booking, and domain (Domain Connection when linked). |
| **First Customer** | A homeowner can find, book, and pay a business. |
| **Business Running** | Hubly manages jobs, customers, and payments. |
| **Business Growing** | Hubly proactively improves the business (Coach, Living Business, Marketing). |

Investors, employees, and customers understand these immediately.

### Sprint question (permanent)

At the start of every sprint ask:

> **If a customer signed up today, what is the single biggest thing preventing them from relying on Hubly for their business?**

Build that. Ship it. Ask again.

---

## Capabilities vs Connectors

```
Capability  → WHAT Hubly does          (Hubly IP)
Connector   → HOW Hubly talks outside  (infrastructure)
```

Hubly Runtime **never** embeds vendor-specific APIs.

Spend engineering time on Hubly IP: Runtime · AI · Memory · DNA · Planner · Matching · Coach · Living Business · Customer Runtime · Creative Director.

Do not over-engineer connectors. Choose one production vendor when a capability is ready to launch.

---

## Business stages (jobs, not modules)

1. **Build My Business** — Identity · Creative Director · Website Runtime · DNA · Memory · Instant Site  
2. **Launch My Business** — Business Launch · Domain · Publishing · SSL · DNS · indexing · Connections  
3. **Run My Business** — Booking · CRM · Calendar · Messaging · Payments · Hubly Daily · Timeline · Health  
4. **Grow My Business** — Customer Runtime · AI Coach · Marketing · Reviews · SEO · Living Business  
5. **Optimize My Business** — Weekly Learning · DNA evolution · Living Marketplace · Autonomous Growth  

Finish one capability completely before beginning another.

### Current priority (customer value)

1. **Website Runtime complete** → unlocks **Business Created**  
2. **Business Launch** → unlocks **Business Launched**  
3. **Booking + Payments + Customer Runtime** → unlocks **First Customer**  

---

## Guiding principle

> **Hubly should make owning a business feel as simple as describing one.**

---

## Product truth

The Hubly Brain architecture is **complete and frozen**.

Hubly is **not** a CRM, website builder, marketplace, or chatbot.

Hubly is an **AI that builds, launches, runs, and grows local service businesses**.

Everything else is a **capability**.

### Sprint filter

1. Does this reduce owner work?  
2. Does this make Hubly feel more like an employee?  
3. Does this fit the Runtime?  
4. Does this become a reusable capability?  
5. Is this production deployable?  
6. Will this still make sense two years from now?  
7. **Could we release this to paying customers today?**

If any answer is **no**, redesign before building.

---

## Architecture (frozen)

```
Conversation
    ↓
Understanding
    ↓
Business Memory          ← What is true?
Business DNA             ← What kind of business is this?
    ↓
Planner                  ← WHAT should happen?
    ↓
Execution Plan
    ↓
Orchestrator             ← HOW should it happen?
    ↓
Capabilities
    ↓
Executors
    ↓
Connectors               ← external systems
    ↓
Platform
```

**Never combine Memory and DNA / Customer Profile.**

| Layer | Answers |
|---|---|
| Memory | What is true? |
| DNA | What kind of business is this? |
| Planner | What should happen? |
| Orchestrator | How should it happen? |
| Executors | Perform work |
| Connectors | Talk to external systems |

---

## Public APIs

```
Hubly.buildBusiness(prompt)   → Business Created
Hubly.findPro(prompt)         → First Customer path
Hubly.daily()                 → Business Running / Growing surface
```

---

## Website Runtime (Definition of Done)

A business owner can **create, publish, edit, and manage** their website entirely through Hubly.

Must include (no placeholders, no unfinished sections):

Homepage · About · Services · Gallery · Contact · Booking · SEO · Sitemap · Robots · FAQ Schema · Business Schema · Analytics hooks · Editing · Publishing · AI Creative Director · Business DNA integration

Never invent verified reviews or fake “someone just booked” social proof.

---

## Business Launch

The experience of making a business real:

Business Identity · Logo · Brand Colors · Domain Suggestions · Publishing · Business Health · Timeline · Connection status

Domain purchasing remains **connector-based** until a registrar is intentionally chosen.
Missing Domain Connection → **Domain connection required**.

---

## Customer Runtime

Customers describe what they need. No categories. No marketplace language.

Understanding → Customer Memory → Customer Profile → Matching (DNA fit) → Booking → Payment → Reviews.

---

## Signature surfaces

### Hubly Daily

Owners land on advice first — not charts.

### Business Health

Primary success metric. Everything Hubly does should improve this score.

### AI Coach

Proactive. Surface opportunities. Drive Business Health from real data.

### Living Business

When reviews, pricing, services, or photos change — website, quotes, and gallery stay current.

### Connections

Owner mental model for Stripe, Google, Domain, Email, SMS, etc.

---

## Long-term proof

A person types: `I own Acme Home Cleaning.` → Hubly creates the business.

A homeowner types: `I need my house cleaned.` → Hubly completes the transaction.

Everything else is optimization.

---

## One-line test

If a change invents a new core Brain layer, redesigns the Runtime, fakes success, invents trust content, merges Memory with DNA, bypasses Planner → Orchestrator → Executors → Connectors, fails the paying-customer test, or makes owning a business feel harder than describing one — it violates this constitution.
