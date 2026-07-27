# Jobs Calendar pixel fix

## What was wrong

Production Jobs looked nothing like the Mission Control screenshot:

1. **Broken sidebar** — duplicate Jobs + separate Calendar, Storefront hidden (Inbox/Jobs MC merges)
2. **Sticky table headers over the calendar** — below 1440px the right rail stacked under the table; sticky `thead` floated over the mini-calendar (overlapping “JOB # / CUSTOMER…” on the date grid)
3. **Legacy Stage‑1 CSS** still defined `.jos-jobs-layout`, fighting Mission Control
4. **Dead `renderCal` / `renderJobsPanel`** kept running against removed DOM and could fight the pixel view
5. **Demo jobs** still auto-seeded for empty real accounts

## Fix

- Keep screenshot 3-column layout (main + 320px rail) down to **1200px**
- Disable sticky table headers when stacked; stop calendar card from clipping the month grid
- Remove Stage‑1 `.jos-jobs-layout` conflict
- No-op legacy calendar/panel renderers when `#jos-jobs-root` is pixel-owned
- Gate demo job seeds behind `allowDemoSeed()`
- Clear Jobs/Inbox/Leads modes on view switch so the global app bar stays hidden on Jobs
