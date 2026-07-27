# Home Command Center contrast fix

## What looked broken

1. **Business Command Center was invisible** — `.jos-home-v2 .jos-hcard { background:#fff }` overrode the dark gradient on `.jos-command-card`, so white text sat on a white card.
2. **“Sign out Sign out”** — i18n wrote `t('signOut')` onto the last child text node instead of `.ni-lbl`, leaving the label + a duplicate text node.
3. **+ New Job on Home** — Jobs mode class could linger; Home now clears module modes on enhance.

## Fix

- Higher-specificity dark Command Center card styles
- i18n updates `.nav-signout .ni-lbl` and strips stray text nodes
- `enhanceDashboard` clears Jobs/Inbox/Leads/Pipeline modes
- KPI row grid forced with `!important` so it cannot collapse to a single column
