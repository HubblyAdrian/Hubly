# Module 2 — 📥 Inbox

**Status:** QA  
**Branch:** `cursor/operate-inbox-2662`  
**Source of truth:** This checklist

Legend: ✅ Complete · 🟡 Deferred · 🔴 Blocked · ☐ Pending

---

## Core Layout

| Item | Status |
|------|--------|
| Inbox page | ✅ |
| Conversation list | ✅ |
| Conversation window | ✅ |
| Customer sidebar | ✅ |

## Tabs

| Item | Status |
|------|--------|
| All Conversations | ✅ |
| Website Chat | ✅ |
| SMS | ✅ |
| Email | ✅ |
| Facebook | ✅ |
| Instagram | ✅ |
| AI Conversations | ✅ |
| Needs Attention | ✅ |
| Archived | ✅ |

## Conversation List

| Item | Status |
|------|--------|
| Customer name | ✅ |
| Last message | ✅ |
| Channel icon | ✅ |
| Timestamp | ✅ |
| Unread badge | ✅ |
| AI Priority | ✅ |
| Search | ✅ |
| Filters | ✅ |

## Conversation Window

| Item | Status |
|------|--------|
| Timeline | ✅ |
| Attachments | ✅ |
| Images | ✅ |
| Voice Notes | ✅ |
| Templates | ✅ |
| Reply Box | ✅ |
| Internal Notes | ✅ |

## Customer Sidebar

| Item | Status |
|------|--------|
| Customer Info | ✅ |
| Lifetime Revenue | ✅ |
| Jobs | ✅ |
| Membership | ✅ |
| Vehicles / Properties | ✅ |
| AI Summary | ✅ |
| Quick Actions | ✅ |

## Website Chat

| Item | Status |
|------|--------|
| Live Chat | ✅ |
| AI Takeover | ✅ |
| Human Takeover | ✅ |
| Booking Button | ✅ |
| Quote Button | ✅ |

## SMS

| Item | Status |
|------|--------|
| Twilio Integration | 🟡 Deferred — UI + `sms:` compose + Settings CTA; product Twilio send not live yet |
| Templates | ✅ |
| Schedule SMS | ✅ |
| AI Rewrite | ✅ |

## Email

| Item | Status |
|------|--------|
| Inbox | ✅ |
| Reply | ✅ |
| Attachments | ✅ |
| AI Draft | ✅ |
| Schedule Email | ✅ |

## Facebook

| Item | Status |
|------|--------|
| Messenger | ✅ |
| Reply | ✅ |
| AI Reply | ✅ |
| Customer Matching | ✅ |

## Instagram

| Item | Status |
|------|--------|
| DM Inbox | ✅ |
| Reply | ✅ |
| Customer Matching | ✅ |
| Booking Shortcut | ✅ |

## AI Features

| Item | Status |
|------|--------|
| AI Summary | ✅ |
| AI Reply | ✅ |
| Buying Intent | ✅ |
| Sentiment Analysis | ✅ |
| Lead Detection | ✅ |
| Suggested Actions | ✅ |

## Needs Attention

| Item | Status |
|------|--------|
| High Priority Leads | ✅ |
| Waiting Customers | ✅ |
| AI Failed Conversations | ✅ |
| VIP Customers | ✅ |

## Search

| Item | Status |
|------|--------|
| Customer | ✅ |
| Phone | ✅ |
| Email | ✅ |
| Vehicle | ✅ |
| Message Content | ✅ |

## Definition of Done

| Item | Status |
|------|--------|
| Realtime messaging | 🟡 Deferred — optimistic send + refresh; full websocket/realtime sync next |
| Unified conversation timeline | ✅ |
| AI functioning | ✅ |
| Meta integration connected | 🟡 Deferred — channel UI + Settings connect CTA; OAuth/live Meta sync next |
| Twilio connected | 🟡 Deferred — channel UI + Settings CTA; live Twilio send next |
| Resend connected | 🟡 Deferred — email reply via mailto + platform Resend exists; per-business inbox send next |

---

## Self QA

| Check | Result |
|-------|--------|
| Buttons / actions | 21+ Inbox acts exercised in smoke |
| Tabs | All 9 tabs present |
| Console errors | 0 |
| Validator | PASS |
| Home untouched | ✅ (Home locked; no Home renderer edits) |
