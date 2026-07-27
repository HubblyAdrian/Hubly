# Operate tabs — backend wiring audit

Snapshot of what is **really hooked up** vs local/demo UI in Journey OS (`public/journey-os/journey.js`) + classic Hubly (`public/hubly.html`).

| Tab | Real backend today | Mostly local `S()` / toast | Notes |
|---|---|---|---|
| **Home** | Reads jobs/customers/leads already in `S()` | Widget layout → localStorage; Command Center tips computed in UI | Tips must use real services (not Ceramic for lawn) |
| **Inbox** | Conversations loaded via hubly RPC `get_chatbot_conversations_for_business` | Reply/archive in Journey OS are in-memory | Badge/count from local list |
| **Jobs & Calendar** | `loadJobs()` → `jobs` + `booking_requests` (+ Google Calendar blocks) | Journey OS status toggles often mutate `S().jobs` only; legacy modals persist | |
| **Leads** | Pipeline meta can persist via hubly `businesses.meta.pipeline` | Many Journey OS lead edits stay in memory until a hubly save path runs | |
| **Customers** | `loadCustomers()` / `upsertCustomer` in hubly | Journey OS “Add customer” can stay local if it never calls `upsertCustomer` | |
| **Pipeline** | Same pipeline meta as Leads when hubly persists | Drag/stage in OS often local | |
| **Website editor** | Classic `#ed-shell` saves via `saveBusiness` / `buildBizMeta` / catalog | Storefront Mission Control path is **not** the nav default | Nav → `restoreWebsiteEditor` |
| **Marketing** | Score reads local jobs/customers/reviews | Campaigns/send are Stage-2 toasts — not Meta/Twilio/Resend | |
| **Reviews** | Local `reviewsOs` + website manual reviews | Google/FB “Sync” is toast-only | |
| **Memberships** | Website membership offers save with site meta | Operate Memberships OS KPIs/subs are local unless wired | Fake 128/$8450 gated to demo |
| **Revenue** | Stripe Connect exists in hubly | Revenue Mission Control ledger is largely local / Stage-2 | |
| **Reports** | Aggregates from in-memory modules | Export/forecasts local | |
| **Ask Hubly** | Legacy `askAI` → `ai-advisor` edge fn exists | Journey OS Ask page uses local `ahAsk` parser, not HublyAI | |
| **Settings** | Some profile fields overlap `S()` / business | Settings OS modules often toast-save only | |

## Demo gate

`allowDemoSeed()` is true only when `S._ceoDemo` or `__HUBLY_MAT__` / `__HUBLY_ALLOW_DEMO_SEED__`.

Real accounts must not see: Ceramic Coating tips, Memberships 128/$8450, Inbox fake KPI docks, Reviews 122 Sent, Jobs padded KPIs.

## Highest-value next wiring

1. Journey OS lead/customer/job mutations → existing hubly persist helpers  
2. Ask Hubly OS → HublyAI / `ai-advisor`  
3. Memberships OS ↔ `website.membershipOffers` + Stripe  
4. Reviews sync → real Google/Facebook connectors  
