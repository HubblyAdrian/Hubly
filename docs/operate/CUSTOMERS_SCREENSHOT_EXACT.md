# Customers — screenshot exact

Operate **Customers** matches the CRM mock: sticky header, segment tabs with counts, three-column list / workspace / intelligence rail.

## Layout

1. **Header** — Customers + subtitle · global search · + Add Customer · Import · bell badge · profile chip (“Adrian Owner” in demo)
2. **Segment tabs** — All Customers · Active · New · Past · VIP · Lost (orange underline; demo counts 1,248 / 982 / 156 / 78 / 32 / 12)
3. **List (~25%)** — search · All Tags / Sort: Recent · cards with VIP badge · selected = soft orange + thick left accent · pagination `1 2 3 … 178`
4. **Workspace (~50%)** — James Anderson VIP · Message · ⋯ · stats · Overview / Jobs / Messages / Notes / Files / Payments · Insights · Preferences · Notes · Recent Activity
5. **Rail (~25%)** — Customer Value · Tags · Upcoming · Satisfaction (Based on N reviews)

## Files

- `public/journey-os/journey.js` — `renderCustomers`, demo seed (James Anderson VIP + fillers), `customersDemoCounts`
- `public/journey-os/operate-pixel.css` — `#p-app.jos-pixel.jos-customers-mode` screenshot styles

Demo counts and filler CRM show only when `allowDemoSeed()`; real account CRM data is never invented.
