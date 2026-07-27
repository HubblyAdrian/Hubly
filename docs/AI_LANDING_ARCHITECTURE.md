# 🌎 AI Landing Experience — Architecture

**Module:** AI Landing Experience (public front door)  
**Rules:** **#24 — Dual Product Architecture**  
**Surface:** `public/platform-home.html` + `public/landing-intent.js`  
**Status:** Stage 1 — local intent understanding (no new Brain layers)

---

## IMPORTANT — Marketplace stays

Do **not** remove or replace the Marketplace.

The landing page serves **two independent products**:

1. **I want to grow my business** → AI Business Builder → Hubly Operating System (`/signup` → Instant Site / Operate)  
2. **I need to hire someone** → AI Marketplace Concierge → Customer Booking (`/get-done`)  

Provider Marketplace (`/marketplace`) remains a core long-term path (footer / dedicated landing). It must stay intact.

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

## Intent examples

### Business → Builder

- I need a website.  
- Help me price my services.  
- I own a cleaning company.  
- I'm starting a mobile detailing company.  

### Consumer → Marketplace

- I need my house cleaned tomorrow.  
- Find a photographer.  
- I need my windows washed.  

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

Creates an **anonymous Builder Session** in `localStorage` before account creation.

**No account is created on this screen.**

---

## Routing exits (unchanged destinations)

| Intent | Exit |
|--------|------|
| Business / grow | `/signup?q=` → Welcome → Instant Site |
| Hire / get done | `/get-done?q=` → Marketplace Concierge |
| Provider get booked | `/marketplace` (footer / dedicated — not removed) |

---

## Signature UX

Subtle status line under the input:

`Hubly understands: Mobile Detailing · Dallas, TX · Startup`

Or after a paste:

`Hubly detected: Website · ready to import during setup`

Continue button stays disabled until enough context, then animates to ready.

---

## Must not

- Break or remove `/marketplace`, `/get-done`, Marketplace Lite provider app  
- Invent a new Brain layer (product-direction freeze)  
- Require login before Builder Session starts  
- Put Marketplace in primary nav customer copy (footer / dedicated entry OK)
