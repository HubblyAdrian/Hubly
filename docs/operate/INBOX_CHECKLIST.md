# Module 2 — 📥 Inbox

**PR:** [#244](https://github.com/HubblyAdrian/Hubly/pull/244) · Merged `895f666`

Legend: ✅ Complete · ⏸ Deferred · 🔴 Blocked

---

## Stage 1 — Operating System ✅ COMPLETE · LOCKED

Everything inside Hubly works. No external APIs required.

### Core Layout
| Item | Status |
|------|--------|
| Inbox page | ✅ |
| Conversation list | ✅ |
| Conversation window | ✅ |
| Customer sidebar | ✅ |

### Tabs
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

### Conversation List
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

### Conversation Window
| Item | Status |
|------|--------|
| Timeline | ✅ |
| Attachments | ✅ |
| Images | ✅ |
| Voice Notes | ✅ |
| Templates | ✅ |
| Reply Box | ✅ |
| Internal Notes | ✅ |

### Customer Sidebar
| Item | Status |
|------|--------|
| Customer Info | ✅ |
| Lifetime Revenue | ✅ |
| Jobs | ✅ |
| Membership | ✅ |
| Vehicles / Properties | ✅ |
| AI Summary | ✅ |
| Quick Actions | ✅ |

### Website Chat (in-app)
| Item | Status |
|------|--------|
| Live Chat | ✅ |
| AI Takeover | ✅ |
| Human Takeover | ✅ |
| Booking Button | ✅ |
| Quote Button | ✅ |

### SMS (in-app OS)
| Item | Status |
|------|--------|
| Templates | ✅ |
| Schedule SMS (in-app) | ✅ |
| AI Rewrite | ✅ |
| Open native Messages (`sms:`) | ✅ |

### Email (in-app OS)
| Item | Status |
|------|--------|
| Inbox | ✅ |
| Reply (composer / mailto) | ✅ |
| Attachments | ✅ |
| AI Draft | ✅ |
| Schedule Email (in-app) | ✅ |

### Facebook / Instagram (in-app OS)
| Item | Status |
|------|--------|
| Messenger / DM inbox views | ✅ |
| Reply | ✅ |
| AI Reply | ✅ |
| Customer Matching | ✅ |
| Booking Shortcut (IG) | ✅ |

### AI Features (in-app)
| Item | Status |
|------|--------|
| AI Summary | ✅ |
| AI Reply | ✅ |
| Buying Intent | ✅ |
| Sentiment Analysis | ✅ |
| Lead Detection | ✅ |
| Suggested Actions | ✅ |

### Needs Attention
| Item | Status |
|------|--------|
| High Priority Leads | ✅ |
| Waiting Customers | ✅ |
| AI Failed Conversations | ✅ |
| VIP Customers | ✅ |

### Search
| Item | Status |
|------|--------|
| Customer | ✅ |
| Phone | ✅ |
| Email | ✅ |
| Vehicle | ✅ |
| Message Content | ✅ |

### Stage 1 Definition of Done
| Item | Status |
|------|--------|
| Unified conversation timeline | ✅ |
| AI functioning (in-app) | ✅ |
| Every control works or opens a real in-app action | ✅ |
| No fake “connected” integration claims | ✅ |

**Stage 1 OS is locked.** Do not modify Inbox OS unless bug fix, Stage 2 work, or explicit reopen.

---

## Stage 2 — Live Integrations ⏸ DEFERRED

Separate PR when opened. Do not pretend these are live in Stage 1 UI.

| Item | Status |
|------|--------|
| Twilio live send / sync | ⏸ |
| Meta (Facebook / Instagram) OAuth + sync | ⏸ |
| Resend per-business inbox send | ⏸ |
| Realtime websocket / live sync | ⏸ |

Connect CTAs may route to Settings; they must not show as connected until Stage 2 is done.
