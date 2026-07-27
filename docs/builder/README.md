# Hubly AI Business Builder — Milestone

**Status:** Active  
**Entry:** AI Landing Experience (🔒 locked — Module 1)  
**Session:** Hubly Session · [HUBLY_MEMORY.md](../HUBLY_MEMORY.md)  
**Parallel product:** Marketplace remains intact (`/marketplace`, `/get-done`)

---

## Vision

The Builder does **not** start after “Get Started.”

It starts the moment the user types on the landing page.

```
Landing (Module 1) 🔒
  ↓  Hubly Session
AI Discovery (Module 2)
  ↓  Business DNA ≥ 90%
Module 3+ (Website · Services · Pricing · Brand · …)
  ↓
Save My Business → Account → Permanent Memory → Operate OS
```

Marketplace stays a **parallel** product for “I need to hire someone.”

---

## Modules

| # | Module | Purpose | Status |
|---|--------|---------|--------|
| 1 | 🌎 AI Landing Experience | Intent router · Hubly Session · import kickoff | 🔒 Locked |
| 2 | 🤖 AI Discovery | Fill missing pieces → complete Business DNA | ⏳ Architecture |
| 3 | Website / Brand / Services / … | Generate from DNA | ❌ Not started |

---

## Locked — Module 1

**AI Landing Experience** is the official entry point into Hubly.

- Dual Product Architecture (Rule #24)
- Hubly Session handoff (`?hs=` + `toBuilderPayload`)
- Real import pipeline start (`/api/import-analyze`)
- Marketplace preserved

**Do not redesign Landing unless explicitly reopened.**

Docs: [AI_LANDING_ARCHITECTURE.md](../AI_LANDING_ARCHITECTURE.md) · [AI_LANDING_CHECKLIST.md](../AI_LANDING_CHECKLIST.md) · [HUBLY_SESSION.md](../HUBLY_SESSION.md)

---

## Next — Module 2 · AI Discovery

Architecture required before Development:

- [DISCOVERY_ARCHITECTURE.md](./DISCOVERY_ARCHITECTURE.md)
- [DISCOVERY_CHECKLIST.md](./DISCOVERY_CHECKLIST.md)
- [DISCOVERY_MAT.md](./DISCOVERY_MAT.md)

**Core idea:** Not “ask questions.” Fill the gaps. Split view: conversation (left) · live Business DNA (right).

---

## Memory

See [HUBLY_MEMORY.md](../HUBLY_MEMORY.md).

| Kind | Scope | Expires |
|------|-------|---------|
| Temporary | Hubly Session | 30 days |
| Permanent | Business | Never |
| Conversation | Ask Hubly | Soft retention |
