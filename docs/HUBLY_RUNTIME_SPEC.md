# Hubly Runtime Specification v1.0

**Status:** Constitution  
**Audience:** Every engineer, agent, and product partner working on Hubly  
**Product principle:** Do not optimize for adding industries. Optimize for making each industry feel like Hubly was built just for them.

**Experience principle:** When making implementation decisions, optimize for the experience first and the architecture second. If a technically elegant solution creates a slower, more confusing, or less magical onboarding experience, choose the solution that creates delight. The Runtime exists to support an exceptional customer experience — not the other way around.

**Blueprint path:** `public/business-blueprints/*.json` (validator + registry alongside).

---

## 1. Purpose

Hubly is an operating system for local service businesses.

| Layer | Owns | Contains |
|---|---|---|
| **Hubly Runtime** | Engines | Execution only — no business knowledge |
| **Business Blueprint** | Knowledge | How a kind of business should behave |
| **Business Instance** | Customer data | One real company (Emily Photography, ABC HVAC) |

The Runtime never contains business knowledge.

Every industry teaches the Runtime how to behave through its Blueprint.

```
Hubly Runtime (versioned)
        ↓
Business Blueprint (versioned)
        ↓
Business Instance
```

Always ask: **What does the blueprint say?**  
Never ask: **What industry is this?**

---

## 2. Runtime Responsibilities

The Runtime owns:

- Authentication
- Website Engine
- Booking Engine
- Rendering Engine
- AI Engine
- Growth Engine
- Automation Engine
- Notification Engine
- Analytics Engine
- Payment Engine
- Calendar Engine
- Media Engine
- Storage

**Nothing else.**

Engines are industry-ignorant. They execute. They do not invent HVAC logic, photography logic, or spa logic.

Future engines (CRM, Estimates, Invoices, Team, Payroll integrations, Marketing automation, Reputation, AI phone/email/scheduling assistants, Customer portal) must follow the same rule: **Runtime engines consume Blueprints; they do not encode industries.**

Both Runtime and Blueprint are versioned:

```
Runtime vN  +  Blueprint vM  →  Business Instance
```

---

## 3. Blueprint Responsibilities

The Blueprint owns:

- Customer psychology
- Website structure
- Booking flow
- Gallery behavior
- Brand voice
- Decision rules
- Growth recommendations
- Automations / playbooks
- Homepage priorities
- Service catalog (including upsells)
- Success metrics
- Customer expectations
- Dashboard widget definitions
- AI guidance (knowledge — not stored prompts)
- Capabilities, customer journey, specialties, lifecycle, performance priorities
- Blueprint `version` and `runtimeMinVersion`

**One object. Everything reads this.**

Adding Plumbing should mean creating or updating a Blueprint — not teaching the Runtime what plumbing is.

---

## 4. Runtime Rule

**If an engineer needs to write `if (industry === ...)`, they should first ask whether the Blueprint can express the same behavior. Runtime changes should be the exception, not the default.**

That is Hubly engineering culture.

Architecture has failed when:

> Adding a new industry requires changing runtime logic instead of creating or updating a Blueprint.

---

## 5. Feature Placement Rule

Every new feature must answer one question:

**Does this belong in Runtime or Blueprint?**

| If it belongs in… | Then… |
|---|---|
| **Blueprint** | No Runtime changes. Ship config. |
| **Runtime** | New engine capability that any Blueprint may use (e.g. a new notification channel, a new booking field component). Architecture review if industry-specific. |

Gate product features on **capabilities** and **decision rules** from the Blueprint — not on industry id.

---

## 6. Engineering KPI: Industry Coverage

Track how industries are added.

**Success:**

```
8 industries
     ↓
Add Plumbing
     ↓
Files changed:
  Blueprint ✅
  Runtime   ❌
```

**If Runtime changes:** architecture review required.

Optimize delivery so each industry *feels purpose-built* — not so that “one more vertical checkbox” is cheap. Depth of Blueprint beat speed of adding shallow industries.

---

## 7. Blueprint Validator

Every Business Blueprint **must pass validation** before the Runtime accepts it.

Requirements:

1. Required top-level sections present (identity, knowledge, capabilities, customerJourney, decisionFactors, customerExpectations, successMetrics, homepage, website, booking, services, gallery, growth, decisionRules, playbooks, automation, dashboard, performance, version).
2. Schema shape valid (types, enums, registered widget/field/action IDs).
3. `version` and `runtimeMinVersion` present; Runtime rejects blueprints that demand a newer Runtime than deployed.
4. Capabilities referenced by other sections must be coherent (e.g. gallery widgets require portfolio/clientGalleries capabilities as defined by validator rules).
5. CI / deploy / Blueprint publish path fails closed on invalid Blueprint.

Effects:

- Consistent blueprints  
- Safer deployments  
- Easier tooling  
- Better AI generation (Claude knows exact required fields)

---

## 8. Product Philosophy

Hubly is not a website builder that also does booking.

Hubly is a Business OS whose surfaces today include website, booking, and dashboard — and tomorrow include CRM, estimates, invoices, team, marketing automation, reputation, and AI assistants — **all as Runtime engines taught by Blueprints**.

**Do not optimize for adding industries.**  
**Optimize for making each industry feel like Hubly was built just for them.**

A roofer should not think: *“This is software that also supports roofers.”*  
A roofer should think: *“These people understand roofing.”*

That feeling comes only from deep Blueprints — never from Runtime special cases.

---

## Document control

| Field | Value |
|---|---|
| Spec version | 1.0 |
| Runtime version this governs | 1.0 (initial) |
| Companion plan | Hubly v2 Business OS implementation plan |

Changes to this constitution require an explicit Spec version bump and an architecture note explaining why Runtime or Blueprint boundaries moved.
