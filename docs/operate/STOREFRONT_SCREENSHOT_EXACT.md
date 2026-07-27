# Storefront — screenshot exact

Operate **Storefront** matches the website editor mock: full-bleed toolbar, Website tabs, live lawn preview, Hero Section inspector.

## Layout

1. **Toolbar** — ← Back to dashboard · Desktop/Tablet/Mobile · `adrians-lawn-service.hubly.site` · Published · ↗ · Undo/Redo · Preview · Publish changes
2. **Tabs** — Website (active) · Booking · Services · Pricing · Gallery · Reviews · SEO · Domain · Analytics
3. **Live preview** — overlay nav on hero · “Your Lawn. Our Passion.” · Salt Lake City sub · Book / View Services · three feature badges · Our Services / Complete Lawn Care Solutions · four lawn cards · green chat FAB
4. **Right panel** — Editing: Hero Section · Content / Design / Advanced · Heading · Subheading · Background image · Primary/Secondary (Text, Link `/book` `/services`, Show toggles) · Feature badges (+ Add badge)

## Files

- `public/journey-os/journey.js` — `renderStorefront`, lawn `demoStorefrontCatalog`, hero editor panel, `jos-storefront-mode`
- `public/journey-os/operate-pixel.css` — `#p-app.jos-pixel.jos-storefront-mode` full-bleed editor styles

Demo lawn catalog and hero copy apply only when `allowDemoSeed()`; live accounts keep their real website / services data.
