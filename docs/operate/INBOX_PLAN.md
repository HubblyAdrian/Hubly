# Module 2 — 📥 Inbox · Planning

**Branch:** `cursor/operate-inbox-2662`  
**Status:** Planning  
**Home module:** Locked — do not modify Home code

---

## Blocker before Development

Part 2 **Inbox checklist** was not provided in the same detail as Home Part 1.

**Please paste the full Inbox checklist** (tabs, channels, composer actions, AI, customer side panel, polish, definition of done).

Until that arrives, Development will not start (no guessing).

---

## What we know today (context only)

From Home Messages Waiting + current code:

- Nav label: **Inbox** (`data-v="chats"`)
- Existing surface: `#v-chats` + `renderChatsPanel()` / pro + starter views in `public/hubly.html`
- Demo seed conversations in `public/journey-os/ceo-demo.js` (SMS, Instagram, website chat)
- Home already deep-links here via `go-chats`

Likely scope (to confirm against your checklist):

- Unified inbox for Website Chat, SMS, Email, Facebook, Instagram
- AI Needs Attention queue
- Conversation list + thread + customer context
- Reply / AI draft / open customer / convert to lead or job
- Empty / loading / error / mobile

---

## Proposed implementation plan (pending checklist)

1. Own Inbox under Journey OS (`renderInbox` in `journey.js`) without changing Home.
2. Match screenshot chrome already used by Operate (reuse `operate-pixel.css` Inbox styles; add Inbox-only CSS as needed).
3. Channel filters + unread badges wired to `S.conversations` / live chat data.
4. Thread view with send (or compose modal), AI draft via Ask Hubly.
5. Customer side panel → existing customer profile / add customer.
6. Self QA every tab, button, modal, route; console clean; validator update for Inbox markers only.
7. One PR: Module 2 Inbox only.

---

## Files expected to change (pending checklist)

| File | Why |
|------|-----|
| `public/journey-os/journey.js` | Add `renderInbox` + Inbox actions only |
| `public/journey-os/operate-pixel.css` | Inbox layout styles only |
| `public/hubly.html` | Mount `#jos-inbox-root`, switchV → Inbox renderer (no Home edits) |
| `public/journey-os/ceo-demo.js` | Inbox conversation seed if needed |
| `scripts/check-customer-journey-os.mjs` | Inbox gate checks |
| `docs/operate/INBOX_CHECKLIST.md` | Official checklist + completion tracking |
| `docs/operate/MODULE_STATUS.md` | Status → In Progress / QA / … |

**Will not change:** Home renderer, Home checklist, locked Home behavior.

---

## Next step

Send the **Inbox checklist**. Then status moves to **In Progress** and Development begins.
