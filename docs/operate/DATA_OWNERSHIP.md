# Rule #15 — Single Source of Truth

**Every new feature must answer before it is built: Who owns this data?**

Every type of data in Hubly has **exactly one owner**.  
Other modules **read** that data — they do not own or duplicate it.

| Data | Owner |
|------|--------|
| Services | 🌐 Storefront → Service Catalog |
| Customers | ❤️ Customers |
| Leads | 🧲 Leads |
| Jobs | 📅 Jobs & Calendar |
| Reviews | ⭐ Reviews |
| Campaigns | 📣 Marketing |
| Templates / Automations / Coupons | 📣 Marketing |
| Membership Plans / Subscribers / Visits | 🔁 Memberships |
| Payments / Invoices / Deposits / Taxes / Stripe / Payouts | 💰 Revenue |
| Dashboards / Saved definitions / Layouts / Schedules / Forecast models | 📊 Reports (Rule #21 — aggregates only; never operational copies) |
| AI conversations / memory / actions / pending confirmations / automation allow-rules | ✨ Ask Hubly (Rule #22 — never owns operational entities) |
| Business config / Integrations / Permissions / Branding / AI prefs | ⚙️ Settings |

## Enforcement (aggressive)

1. Before adding state, name the owner module in the PR / checklist.  
2. **Forbidden:** `S.marketingCustomers`, parallel `S.services` owned by Jobs/Marketing, copied review tables in Marketing, `membershipCustomers`, Reports payment ledgers, Ask Hubly customer DBs.  
3. Cross-module UI may **filter/reference** by id or segment key only.  
4. Reports **aggregate** — they do not store copies.  
5. Pipeline **orchestrates** stages — it does not own Lead/Job/Customer entities.  
6. Storefront **owns** the Service Catalog (`S.editorSvcs` + mirror `S.services` for booking consumers).  
7. Marketing **owns** campaigns/templates/automations/coupons; audiences resolve from Customers/Leads at use time.  
8. **Rule #19:** Modules cannot bypass their owners — no silent second copies.  
9. **Rule #21:** Reports never duplicate operational data — presentation/analytics only.

## Module implications

| Module | May own | Must only read |
|--------|---------|----------------|
| Storefront | Services, website copy, gallery, SEO, domain | Reviews (display), Customers (none required) |
| Marketing | Campaigns, templates, automations, coupons, calendar, ad OS records | Customers, Leads, Services, Jobs, Reviews, Revenue |
| Reviews | Review records, requests, replies, reputation analytics (`S.reviewsOs`) | Customers, Jobs, Marketing (read flags) |
| Jobs | Jobs / calendar blocks | Services (catalog), Customers |
| Leads | Lead records | — |
| Customers | Customer profiles | — |
| Memberships | Plans, subscribers, billing rules, visit/renewal ledgers (`S.membershipsOs`) | Customers, Jobs, Revenue, Services (catalog refs) |
| Revenue | Payments / invoices / deposits / refunds / taxes / Stripe sync status / payouts (`S.revenueOs`) — Rule #20 | Customers, Jobs, Memberships, Services |
| Reports | Dashboards, definitions, layouts, schedules, forecast models (`S.reportsOs`) | Revenue, Memberships, Pipeline, Customers, Leads, Jobs, Marketing, Reviews (aggregate only) |
| Ask Hubly | Conversations, memory, action log, pending confirmations, automation allow-rules (`S.askHublyOs`) | Everything via owners (never source of truth for entities) |
| Settings | Business config, integrations, permissions, branding, AI prefs | — |

See also [MARKETING_ARCHITECTURE.md](./MARKETING_ARCHITECTURE.md), [EVENTS.md](./EVENTS.md) (Rules #17–18), [MEMBERSHIPS_PLAN.md](./MEMBERSHIPS_PLAN.md), and [OPERATE_ENGINEERING_RULES.md](./OPERATE_ENGINEERING_RULES.md).
