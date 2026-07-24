# Section 5 — Business Memory (Release Gate)

**Status: Proven only when `node scripts/check-section5-business-memory.mjs` exits 0.**

Do not begin Section 6 until this section passes.

## Objective

Business Memory is the permanent source of truth about every business.
Conversation history is only a small input — Memory is what Hubly remembers like a long-term partner.

## Ownership

| Actor | Permission |
|-------|------------|
| Experts | Read + **suggest** updates |
| Hubly Brain | **Commit** updates |
| Customers | Never see internal changelog / fact meta |

No expert writes Business Memory directly.

## What it stores

- **Owner** — name, preferred name, role, communication style  
- **Business** — name, industry, service area, description, years, stage, goals  
- **Brand** — personality, tone, positioning, audience, visual + creative direction  
- **Services** — current / removed / planned / recommended  
- **Website history** — versions, headlines, packages, booking, approved/rejected AI changes  
- **Strategy** — versioned positioning, homepage, pricing, booking, growth  
- **Goals** — business, revenue, growth, personal, future plans  
- **AI history** — recommendations, approvals, rejections, edits, reasoning, confidence, expert, date  
- **Connected services** — Stripe, Calendar, GBP, website, marketplace, CRM, integrations  

## Memory Importance

Every fact tracks:

| Field | Purpose |
|-------|---------|
| Importance | `low` / `medium` / `high` / `critical` |
| Confidence | 0–100 |
| Source | `user` / `ai_inference` / `external_integration` |
| Last verified | ISO timestamp |

## Rules

Persistent · Versioned · Searchable · Explainable · Updatable · Auditable  

Every commit stores: timestamp, responsible expert, reason, previous value, new value, importance.

## Demonstration

1. `I'm starting a pressure washing business.` → store  
2. `Focus on commercial properties instead.` → update  
3. `What kind of business are we building?` → answer from Memory  
4. `Why did we change our positioning?` → answer from stored reasoning  
5. `Show me what changed this week.` → changelog summary  

## Verify

```bash
node scripts/check-section5-business-memory.mjs
```

Evidence: `docs/HUBLY_BRAIN_SECTION5_PROOF.json`
