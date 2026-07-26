# Rule #15 — Single Source of Truth

Every type of data in Hubly has **exactly one owner**.

Other modules **read** that data — they do not own or duplicate it.

| Data | Owner |
|------|--------|
| Customer | ❤️ Customers |
| Lead | 🧲 Leads |
| Job | 📅 Jobs & Calendar |
| Service (catalog) | 🌐 Storefront → Service Catalog |
| Membership | 🔁 Memberships |
| Payment | 💰 Revenue |
| Review | ⭐ Reviews |
| Campaign | 📣 Marketing |

## Implications

- Jobs **reference** services from the Storefront Service Catalog — they do not define a parallel service list as source of truth.
- Marketing **references** customer segments from Customers — no separate customer database.
- Reports **aggregate** from owning modules — they do not store copies.
- Pipeline **orchestrates** Lead / Quote / Job / Customer / Review / Membership stages — it does not own those entities.
- Storefront **owns** `S.editorSvcs` / service catalog / website copy / gallery / SEO / domain presentation. Reviews shown on the site are **read** from Reviews (or demo `website.manualReviews` until Reviews locks).

## Stage 1 Storefront

Service Catalog OS lives under Storefront. Consumers (`getBookingServices`, booking preview, Jobs service pickers) should prefer catalog data owned here.
