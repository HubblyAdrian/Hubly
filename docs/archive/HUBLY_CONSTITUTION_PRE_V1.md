# Hubly Constitution — Pre-v1 archive

Historical product rules consolidated before **Hubly Constitution v1.0**.

**Canonical document:** [`../HUBLY_CONSTITUTION.md`](../HUBLY_CONSTITUTION.md)

Kept for reference only (business stages, magical moments, living layers, older roadmap language). Prefer v1.0 for all new decisions.

---

## Production-First Principle

Hubly does **not** build demo features.

Every completed capability should be deployable to a production customer.

- Real provider interfaces  
- Real data models  
- Real execution flow  
- Real error handling, retries, logging  
- Real ownership / security  
- Real progress events  

Provider integrations may require credentials, but **no capability should rely on fake implementations or temporary “success” logic**.

Capabilities should **fail honestly** rather than simulate success:

> Provider not configured.

---

## Business stages (not software modules)

| Stage | Jobs |
|---|---|
| **Build** | Website · Booking · CRM · Dashboard |
| **Launch** | Domain · DNS · SSL · Publishing · (email / GBP later) |
| **Operate** | Jobs · Customers · Payments · Calendar |
| **Grow** | Customer Runtime · Marketing · Reviews · Coach |
| **Optimize** | Weekly Learning · Living Business · Living Marketplace |

**Business Launch** (not “domain purchase”) is the complete go-live job: availability → purchase → DNS → SSL → publish.

---

## The Four Magical Moments

1. **Hubly built my business** — owner describes; Hubly builds.  
2. **Hubly got me my first customer** — homeowner describes a project; Hubly matches, books, pays.  
3. **Hubly helped me grow** — proactive recommendations.  
4. **Hubly runs my business** — continuous work.

---

## Jobs Hubly performs

1. Build my business  
2. Get me customers  
3. Help me grow  
4. Run my business  

We no longer ask *“What feature should we build?”*  
We ask *“What job should Hubly do for the owner?”*
