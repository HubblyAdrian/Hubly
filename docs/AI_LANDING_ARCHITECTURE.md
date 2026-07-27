# 🌎 AI Landing Experience — Architecture

**Module:** AI Landing Experience (public front door)  
**Rules:** **#24 — Dual Product Architecture**  
**Surface:** `public/platform-home.html` + `public/hubly-session.js`  
**Session:** [HUBLY_SESSION.md](./HUBLY_SESSION.md)  
**Status:** Stage 1 — continuous Hubly Session + import pipeline start

---

## IMPORTANT — Marketplace stays

Do **not** remove or replace the Marketplace.

The landing page serves **two independent products**:

1. **I want to grow my business** → AI Business Builder → Hubly Operating System (`/signup` → Instant Site / Operate)  
2. **I need to hire someone** → AI Marketplace Concierge → Customer Booking (`/get-done`)  

Provider Marketplace (`/marketplace`) remains a core long-term path (footer / dedicated landing). It must stay intact.

---

## Continuous AI experience

```
Landing
  ↓
Hubly Session  (structured memory)
  ↓
Business Builder  (consumes session — does not re-infer)
```

Same session can later continue into Marketplace, Public Ask Hubly, and future products.

One session. One memory.

---

## Rule #24 — Dual Product Architecture

Hubly serves two different users.

| Persona | Job | Destination |
|---------|-----|-------------|
| Business Owner | Grow / build / run a business | Business Builder → Operating System |
| Consumer | Get something done / hire someone | Marketplace Concierge → Booking |

Neither flow should interfere with the other.

The landing page is an **intelligent router**, not a brochure.

Same chat. Different destination. One AI that understands intent.

---

## User-phrased options (not product jargon)

| User says | Routes to |
|-----------|-----------|
| I want to grow my business | Business Builder |
| I need to hire someone | Marketplace Concierge |

Do not lead with “Marketplace” or “Operating System” as the primary choice labels.

---

## What the landing AI does (Stage 1)

Local understanding on every keystroke (no API required):

- Industry / trade  
- Location  
- Business name  
- Stage (startup / growing / established)  
- Intent (`build_business` | `hire_pro` | `unknown`)  
- Confidence  
- Import URLs (website, Instagram, Google, Facebook)

Creates an **anonymous Hubly Session** in `localStorage` (`hubly_session_v1`) before account creation.

**No account is created on this screen.**

### Structured handoff (required)

Landing writes the Hubly Session, then navigates with `?hs=<sessionId>` (and `?q=` for display continuity).

Builder / Welcome loads `HublySession.toBuilderPayload()` and applies:

conversation · industry · business name · location · stage · intent · confidence · detected imports · website / Instagram / Google Business / Facebook analysis · future AI memory

**Do not re-infer facts the session already learned.**

### Import pipeline (required)

Paste a website → analysis begins immediately via `/api/import-analyze`:

Reading services… → branding… → reviews… → photos…

Builder opens already knowing what was extracted. Social sources get structured partial analysis and continue enrichment in Builder.

---

## Routing exits

| Intent | Exit |
|--------|------|
| Business / grow | `/signup?q=&hs=` → Welcome → Instant Site (session consume) |
| Hire / get done | `/get-done?q=&hs=` → Marketplace Concierge |
| Provider get booked | `/marketplace` (footer / dedicated — not removed) |

---

## Session lifecycle

| Event | When |
|-------|------|
| Created | First meaningful Landing `understand` / `upsertSession` |
| Importing | URL detected → `startImportPipeline` |
| Handed off | Continue Building / Find someone |
| Upgraded | Save My Business / Create Account → `upgradeToAccount` |
| Expires | 30 days after last update (`expiresAt`) |
| Deleted | TTL, corrupt JSON, or `clearSession()` |

Full detail: [HUBLY_SESSION.md](./HUBLY_SESSION.md).

---

## Signature UX

Subtle status line under the input:

`Hubly understands: Mobile Detailing · Dallas, TX · Startup`

Or while importing:

`Hubly Reading services…`

Continue button stays disabled until enough context, then animates to ready.

---

## Must not

- Break or remove `/marketplace`, `/get-done`, Marketplace Lite provider app  
- Invent a new Brain layer (product-direction freeze)  
- Require login before Hubly Session starts  
- Hand off only raw `?q=` and re-infer in Builder  
- Treat website/social as detect-only with no analysis job  
- Put Marketplace in primary nav customer copy (footer / dedicated entry OK)
