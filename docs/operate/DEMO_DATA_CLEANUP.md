# Remove hardcoded demo CRM data

Real Operate accounts no longer invent fake customers, team members, inbox threads, pipeline cards, reviews, campaigns, or home notifications.

## What changed

- Added `allowDemoSeed()` — only true for CEO demo (`S._ceoDemo`) or explicit MAT flags
- Empty accounts stay empty; empty-state UI instead of Sarah / Alex / Adrian roster filler
- Chrome placeholders: **Your business** / **Owner** (not Pro Shine / Adrian Lopez)
- CEO demo path (`/demo`, `ceo-demo.js`) unchanged

## Still allowed

- Generic templates (email/SMS copy starters) and automation toggle definitions
- Form placeholders like `(619) 555-0100`
- MAT / CMV scripts inject their own fixtures
