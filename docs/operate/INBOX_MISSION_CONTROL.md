# Operate Inbox — Mission Control (v2)

**Status:** 🔓 Explicit reopen (product redesign)  
**Branch:** `cursor/operate-inbox-mission-control-2662`  
**Spec:** pixel layout for 1728×1117 (min 1440)

## Layout

```
Header 72px
Filter tabs 56px
[ 80px rail | 340px list | flexible chat | 360px Intelligence Hub ]
KPI dock 72px (collapsible)
```

- Independent scroll per column
- Global app bar hidden while Inbox is active; Inbox owns its header
- Sidebar collapses to 80px icon rail (hover expands labels)

## Columns

1. **Conversation list** — search, sort, 96px cards, hover actions, right-click menu, status border colors  
2. **Active conversation** — 88px header, AI strip, message stream, quick-action pills, suggested replies, 128px composer  
3. **Intelligence Hub** — Profile, Revenue, Jobs, Membership, AI Summary, Suggested Actions, Quick Actions, Timeline, Notes, Automations, Activity  

## KPI dock

Clickable metrics drill into filtered Operate views (open/unread inbox, leads, jobs, revenue, quotes, reports, reviews).

## Interactions

- `/` focus search · `Esc` close drawers · `⌘/Ctrl+Enter` send  
- No dead UI: phones, email, address, badges, KPIs, timeline rows all navigate or act  

## Ownership

Routes stay on existing Operate modules. Marketplace untouched.
