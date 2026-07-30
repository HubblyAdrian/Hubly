# 🌎 AI Landing Experience — Architecture

**Module:** AI Landing Experience (public front door)  
**Rules:** **#24 — Dual Product Architecture**  
**Surface:** `public/platform-home.html` + `public/hubly-session.js`  
**Session:** [HUBLY_SESSION.md](./HUBLY_SESSION.md) · [HUBLY_MEMORY.md](./HUBLY_MEMORY.md)  
**Status:** 🔓 **Stage 2 — Talk to Hubly** (reopened)  
**Companion:** [HUBLY_CONSULTANT_AI.md](./architecture/HUBLY_CONSULTANT_AI.md)

---

## Stage 2 north star

The landing page sells **working with Hubly**, not software.

Primary CTA: **Talk to Hubly.**  
Hero prompt: *What can I help you accomplish today?*

Suggested starters:

| Starter | Intent | Destination |
|---------|--------|-------------|
| 🚀 Build My Business | `build_business` | `/signup` → Consultant → Live Workspace |
| 📈 Grow My Business | `build_business` (grow seed) | `/signup` → same partner, growth focus |
| ✅ Find Help | `hire_pro` | `/get-done` → Concierge |

Every section leads toward starting a conversation — not browsing feature lists.

---

## IMPORTANT — Marketplace stays

Do **not** remove or replace the Marketplace.

The landing page serves **two independent products**:

1. **Build / Grow my business** → AI Business Builder → Hubly Operating System  
2. **Find Help** → AI Marketplace Concierge → Customer Booking  

Provider Marketplace (`/marketplace`) remains a core long-term path.

---

## Continuous AI experience

```
Landing (Talk to Hubly)
  ↓
Hubly Session  (structured memory)
  ↓
Consultant AI  (Understand → Recommend → Build → Show)
  ↓
Live Workspace / Commerce Runtime / Operate
```

One session. One memory. One partner.

---

## Rule #24 — Dual Product Architecture

| Persona | Job | Destination |
|---------|-----|-------------|
| Business Owner | Build / grow / run | Business Builder → OS |
| Consumer | Get something done | Concierge → Booking |

Same chat surface. Different destination. One AI that understands intent.

---

## What the landing AI does

Local understanding on every keystroke (no API required):

- Industry / trade · Location · Business name · Stage  
- Intent (`build_business` | `hire_pro` | `unknown`)  
- Confidence · Import URL detection  

Then hand off to Hubly Session → Consultant (no re-quiz).

---

## Filter

Before every landing change:  
*Does this make Hubly feel like one intelligent business partner — or another software brochure?*
