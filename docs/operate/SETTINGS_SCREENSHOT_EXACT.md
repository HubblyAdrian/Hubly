# Settings — Screenshot Exact (Mission Control)

Settings Overview matches the Mission Control screenshot 1:1. Extra Overview chrome that is not in the frame is removed.

## Layout (top → bottom)

1. **Top chrome** — Title **Settings** + “Business, team, and integrations.” · search · **+ New** · **Ask Hubly** · bell badge **3** · Adrian's Lawn Service (AL).
2. **Subhead** — Settings + “Return to control center. Configure your Hubly.” · Refresh · Ask Hubly.
3. **Tabs** — Overview (active) · Business · Team · Billing · Integrations · Notifications · Branding · AI · Security · Permissions.
4. **Overview panel**
   - Hero — hubly wordmark · CONTROL CENTER · “Configure Hubly — never own business data” · shield/lock art
   - **6 status cards** — Business · Team · Status · Information (+ Live) · AI Defaults · Security (MFA: off)
   - **Platform Features** (4 green checks) · **Ask Hubly** coach card (quick prompts)
   - Ask Hubly help banner
5. **Floating Ask Hubly chat** — FAB + expandable settings coach panel on every Settings tab

## Deleted from Overview

- Platform Checklist + progress bar
- Recommended Next Steps priority list
- Forbidden Copies engineering dump
- Visible Rule #23 footnote wording in the hero
- Missing Mission Control CSS (restored)

## Demo seed

When `allowDemoSeed()` is true: Salt Lake City, 3 users, Grow · Active, helpful_pro, MFA off.

## Files

- `public/journey-os/journey.js` — `renderSettings`, `renderSetOverview`, `renderSetTopChrome`, `setSettingsMode`
- `public/journey-os/operate-pixel.css` — Settings Mission Control block
- `scripts/screenshot-settings.mjs` — visual capture
