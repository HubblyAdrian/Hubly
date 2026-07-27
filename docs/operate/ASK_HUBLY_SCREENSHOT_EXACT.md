# Ask Hubly — Screenshot Exact (Mission Control)

Ask Hubly Overview (`Chat` tab) matches the Mission Control screenshot 1:1. Extra OS chrome is removed from the default view.

## Layout (top → bottom)

1. **Top chrome** — Title **Ask Hubly** + “Use smarter AI to grow your business.” · search · **+ New** · **Ask Hubly** · bell badge **3** · Adrian's Lawn Service.
2. **Navy hero** — Ask Hubly ✦ · “Good morning, Adrian 👋” · assistant subcopy · white input + orange send · **4** chips · robot + orange orbs.
3. **KPI row (4)** — Customers **1** ↑100% · Active Jobs **1** ↑50% · Collected **$0** `--` · Campaigns **3** ↑2.
4. **Mid (3 equal columns)** — Conversation (assistant bubble + 4 suggest chips) · Recent activity (5 rows + View all) · Popular actions (6 title-only cards).
5. **Bottom (2 columns)** — Hubly Insight (spans with Conversation+Activity) · Pro tip (Google Calendar + Connect Calendar) under Popular actions.

## Deleted from Overview

- Rule #22 / constitution footnote
- OS tabs (Chat / History / Saved) on the default chat surface
- Fifth hero chip (“Recover abandoned bookings”)
- Popular Actions subtitle lines
- Unequal mid layout / tip as a fourth mid column

## Demo seed

When `allowDemoSeed()` is true, Ask Hubly seeds `_demoShot` KPIs, feed, and the locked assistant welcome. Production without demo seed stays empty / live.

## Files

- `public/journey-os/journey.js` — `renderAskHubly`, `renderAhChatTab`, `ahRenderHero`, `ahContextKpis`, `setAskHublyMode`
- `public/journey-os/operate-pixel.css` — Ask Hubly Mission Control block
- `scripts/screenshot-ask-hubly.mjs` — visual capture
