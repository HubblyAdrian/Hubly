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
| Membership Plans | 🔁 Memberships |
| Payments | 💰 Revenue |

## Enforcement (aggressive)

1. Before adding state, name the owner module in the PR / checklist.  
2. **Forbidden:** `S.marketingCustomers`, parallel `S.services` owned by Jobs/Marketing, copied review tables in Marketing.  
3. Cross-module UI may **filter/reference** by id or segment key only.  
4. Reports **aggregate** — they do not store copies.  
5. Pipeline **orchestrates** stages — it does not own Lead/Job/Customer entities.  
6. Storefront **owns** the Service Catalog (`S.editorSvcs` + mirror `S.services` for booking consumers).  
7. Marketing **owns** campaigns/templates/automations/coupons; audiences resolve from Customers/Leads at use time.

## Module implications

| Module | May own | Must only read |
|--------|---------|----------------|
| Storefront | Services, website copy, gallery, SEO, domain | Reviews (display), Customers (none required) |
| Marketing | Campaigns, templates, automations, coupons, calendar, ad OS records | Customers, Leads, Services, Jobs, Reviews, Revenue |
| Reviews | Review records, requests, replies, reputation analytics (`S.reviewsOs`) | Customers, Jobs, Marketing (read flags) |
| Jobs | Jobs / calendar blocks | Services (catalog), Customers |
| Leads | Lead records | — |
| Customers | Customer profiles | — |
| Revenue | Payments / invoices OS | Customers, Jobs |
| Memberships | Plans | Customers, Services |

See also [MARKETING_ARCHITECTURE.md](./MARKETING_ARCHITECTURE.md), [EVENTS.md](./EVENTS.md) (Rule #17), and [OPERATE_ENGINEERING_RULES.md](./OPERATE_ENGINEERING_RULES.md).
