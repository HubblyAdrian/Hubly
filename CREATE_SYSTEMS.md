# Create Systems — Durable builds websites. Hubly builds businesses.

## North star

**Never ask:** “Which template should I use?”  
**Always ask:** “Which combination of components best represents this business?”

Industry templates (`fitness-theme`, `spa-theme`) are retired as the Create path.  
Reusable systems assemble every customer-facing experience. Hubly SaaS (CRM, Jobs, Revenue, Stripe, Calendar) stays constant; the front of house is unique.

## Pipeline

```
Conversation
    ↓
OpenAI
    ↓
Business Blueprint   (who they sell to, voice, offer, trust, position, price, feeling)
    ↓
Design Engine        (Luxury | Minimal | Editorial | Bold | Playful | Corporate | Modern | Dark | Light)
    ↓
Layout Engine        (existing HublyLayouts — picked by direction, not by industry)
    ↓
Component Picker     (Hero N · Nav N · CTA N · Services N · Gallery N · Testimonials N · Pricing N · FAQ N · Footer N · Booking N)
    ↓
Copy Generator
    ↓
Website → Booking → Packages → Brand → CRM → Strategy → Automations
```

## Five systems

### 1 — Layout Engine
Variants for hero, navigation, CTA, services, gallery, testimonials, pricing, FAQ, footer.  
AI picks IDs (`hero_12`, `nav_4`, …). Combinations scale without new templates.

### 2 — Design Engine
Directions: Luxury, Minimal, Editorial, Bold, Playful, Corporate, Modern, Dark, Light.  
Maps to layout + theme + accent + composition — **not** “Fitness Theme.”

### 3 — Business Blueprint
Before pixels: Ideal customer → Brand voice → Offer → Trust signals → Competitive position → Price level → Desired feeling.  
Everything else derives from this.

### 4 — Component Library
Grow toward: 40 heroes · 25 pricing · 30 testimonials · 20 FAQ · 15 galleries · 20 CTAs · 10 booking styles.  
v1 ships a starter registry (IDs + CSS hooks) that AI can already pick.

### 5 — AI chooses everything
```
AI → Luxury brand → Professional audience → High-ticket
  → Dark Editorial → Minimal nav → Results-first homepage → Premium booking
```
Not `industry == fitness → fitness-theme.tsx`.

## Implementation status

| Piece | Status |
|-------|--------|
| `CREATE_SYSTEMS.md` north star | Done |
| `public/create-systems/registry.js` component + design catalogs | Done (starter set) |
| `public/create-systems/assemble.js` blueprint → site/booking/packages | Done |
| Discovery OpenAI returns `businessBlueprint` | Done |
| Create prefers assemble-from-blueprint over pack/template | Done |
| Full 40×25×30 component inventory | Grow over time |
| Automations from blueprint | Later |

## Rule for Cursor

Stop building templates. Build systems.  
When OpenAI returns a blueprint, **assemble**. Do not map industry → hard-coded theme.
