# Operate Storefront — Visual WYSIWYG Editor

**Status:** 🔓 Explicit reopen (product redesign)  
**Branch:** `cursor/operate-storefront-mission-control-2662`  
**Viewport:** full height · `#F8F9FB` · design ~1600px

## Layout

```
[ Sidebar | Toolbar: back · devices · URL · undo/redo · preview · publish ]
[         | Tabs: Website · Booking · Services · Pricing · Gallery · Reviews · SEO · Domain · Analytics ]
[         | Live preview (center)          | Context editor (right ~380px) ]
```

- Global app bar hidden while Storefront is active (`jos-storefront-mode`)
- Click anything on the live preview → right panel edits that element instantly
- Tabs switch business aspects (booking rules, services, SEO) while preview stays visible

## Website tab

- Live site mock with hero, services, reviews, footer
- Hero: headline, subheadline, background, overlay, buttons, trust badges
- Sections list (drag handles) with add/hide
- Theme shortcuts (colors, fonts, reset)

## Toolbar

- Device preview: Desktop / Tablet / Mobile
- URL bar with Published badge
- Undo / Redo (session stack)
- Publish dropdown: Publish · Schedule · Save Draft · History

## Other tabs

- **Booking** — toggles + customer field requirements (live apply)
- **Services / Pricing / Gallery / Reviews / SEO / Domain / Analytics** — existing OS data, shown in context panel

## Ownership

Service catalog remains source of truth (`editorSvcs`). Marketplace untouched. Brand accent `#D9632D`.
