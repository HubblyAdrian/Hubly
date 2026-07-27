# Website editor restored (classic)

Operate nav `editor` opens the classic **Website editor** (`#ed-shell`) again instead of Storefront Mission Control.

## What changed

- `onSwitchView('editor')` → `restoreWebsiteEditor()` (clears `jos-storefront-mode` / `jos-pixel-owned`)
- Sidebar label: **Website editor**
- Chrome title: **Website editor**
- Legacy `switchV` init (`initWsPeEditor`, `mountEdChrome`, hubs) runs again

## Kept

- Storefront OS helpers (`renderStorefront`, catalog sync) remain in `journey.js` for Stage 1 MAT / catalog ownership, but are not the default Operate UI.

## Files

- `public/journey-os/journey.js`
- `public/hubly.html`
- `scripts/cmv-locked-modules.mjs`
- `scripts/check-customer-journey-os.mjs`
