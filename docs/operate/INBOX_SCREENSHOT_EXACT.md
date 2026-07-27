# Operate Inbox — screenshot-exact Mission Control

**Status:** active rebuild  
**Branch:** `cursor/inbox-screenshot-exact-2662`  
**Supersedes UI of:** Inbox Intelligence Hub v2

## Composition (desktop)

1. **Header** — Inbox title · Search messages · bell · apps · profile  
2. **Tabs** — All · Unread · Leads · Customers · Archived · Mark all as read  
3. **Three columns** — Conversation list · Chat (Book Job + bubbles + quick replies + composer) · Contact / Job / Notes / Activity  
4. **Bottom KPIs** — Open Conversations · Unread Messages · New Leads · Customers · Response Rate  

## Shell

- `#p-app.jos-pixel.jos-inbox-mode` — icon rail sidebar, app bar hidden  
- Markup: `.jos-inbox-shot` in `journey.js` · styles in `operate-pixel.css`  

## Data

Real conversations when present. `allowDemoSeed()` fills the Alex Rivera demo thread and KPI targets.
