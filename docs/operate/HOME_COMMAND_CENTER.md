# Operate Home — Business Command Center

**Status:** 🔓 Explicit reopen (product redesign)  
**Branch:** `cursor/operate-home-command-center-2662`  
**Supersedes UI of:** locked Home Module 1 checklist layout (logic/routes preserved)

## Intent

Post-login Home is an active operating center, not a passive CRM summary.

## Desktop shell (1440+)

- Max content width: 1440px
- Sidebar: 260px sticky
- Content padding / gap: 24px
- Cards: 16px radius, white, `#ECECEC` border, soft shadow
- App bar: 72px — search, notifications, profile, New

## Home composition

1. **Hero** — greeting, business name, weather, date  
2. **KPI row** — Revenue · Jobs Completed · New Leads · Rating (all clickable)  
3. **Command Center (65%) + Today timeline (35%)**  
4. **Recent Leads · Revenue Summary · Business Score**  
5. **Quick Actions** strip  

## Command Center

Surfaces ranked, actionable monitoring (quotes, leads, schedule gaps, pricing, retention, inbox, marketing, forecast) with one-click routes into Operate modules. Chat input opens Ask Hubly.

## Customization

Widget ⋯ menu (refresh / hide / pin / export), hide toggles, role presets (Owner, Office Manager, Employee, Sales, Franchise), saved in `hubly_home_layout_v1`.

## Mobile

Stacked cards, hamburger sidebar, Quick Actions FAB, swipeable Today cards.

## Ownership

Routes stay on existing Operate views (`money`, `jobs`, `leads`, `reviews`, `chats`, `quotes`, `marketing`, `editor`, `ask`, `settings`). No new Brain layers.
