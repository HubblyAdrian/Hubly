# Capability audit — by account category (2026-08-23, revised 2026-08-25)

> ⚠️ **The denominator that matters is MARKET, and market splits into identified vs not.**
> `account_kind`: **test** (our drafts), **internal** (founders, us, family), **market** (a
> genuine outside business). Plus `owner_identified` (bool): true only once a human has
> confirmed who the owner is — a real-email claim lands market/`owner_identified=false` and
> stays unidentified until confirmed. Report market as **"N market, M identified"**.
> The earlier "125 businesses / 62 empty / 79% never claim / 17% photo repeat" ratios were
> ~93% **test** — us talking to ourselves. Do not use them.
>
> **Market = 6, of which 4 identified.** Classifications are Adrian's, by hand — not inferred.

## The businesses (test excluded; 9 non-test rows)

`Y` = present · `·` = absent · counts otherwise.

| business | category | identified | email | created | freeform page | services | priced | logo | bookings | chatbot |
|---|---|---|---|---|---|---|---|---|---|---|
| Aquaspeed | market | Y | aquaspeed723@gmail.com | 07-11 | · | 3 | 3 | Y | 0† | 0† |
| Graef's AutoCare | market | Y | austinjgraef@gmail.com | 07-11 | · | 0 | 0 | Y | 0‡ | 0 |
| Devdetailing661 | market | Y | fdevin180@gmail.com | 07-13 | · | 0 | 0 | Y | 0 | 0 |
| Bucket Mobile Detailing | market | Y | bucketmobiledetailing@outlook.com | 07-20 | · | 0 | 0 | Y | 0† | 0 |
| **Detailing Chemicals…** | market | **·** | andres.mayorga1616@…bakersfieldcollege.edu | 08-22 | Y | 4 | 0 | · | 0 | 0 |
| **Mobile Auto Detailing in LA** | market | **·** | andres.mayorga1616@…bakersfieldcollege.edu | 08-22 | Y | 0 | 0 | · | 0 | 0 |
| My Auto Detailing | internal | Y | jjake486@gmail.com | 07-25 | · | 0 | 0 | · | 0 | 0 |
| Cotter Aviation | internal | Y | cotterjp@gmail.com | 07-25 | · | 0 | 0 | · | 0 | 0 |
| Lugnutz | internal | Y | kaptn.awesome@gmail.com | 08-22 | Y | 3 | 0 | · | 0‡ | 0 |

**The entire unidentified group is one person.** `andres.mayorga1616@email.bakersfieldcollege.edu`
created two businesses on 2026-08-22 — Detailing Chemicals, Equipment & Courses (freeform
page, 4 services) and Mobile Auto Detailing in Los Angeles (freeform page, 0 services).
Everything else in market is a customer Adrian knows by name.

**Of the six market businesses, four were recruited directly by Adrian; one person,
unrecruited, accounts for the other two.** So the entire inbound funnel in Hubly's history
is one signup — and it's the only market owner the system could ever have classified on its
own, which is why `owner_identified` defaults to false and only a human sets it true.

## Corrected value (Job 2)

**6 market businesses have a live Hubly site. Zero have ever received a booking from a
member of the public. Every booking in the database traces to an owner, a family member, a
founder, or a test harness.**

The 10 booking rows on non-test businesses, by the account/name/phone/email signals:
- Aquaspeed ×2 — a **proof-mode test harness** (`proof-mode+…@hubly.test`, 555 phones); its
  single chatbot conversation was the same 2026-07-22 proof-mode session.
- Bucket ×1 — **Adrian** (`adrian@brnno.com`).
- Graef's AutoCare ×6 — the **owner testing his own form pre-change, plus family** (3 owner's
  own name, 3 the Graef family). No stranger.
- Lugnutz ×1 (abandoned) — **Talmage Harrison, a founder** (internal).

## The instrumentation gap (the actual priority)
We cannot tell whether any human other than the owner has ever *loaded* a market site — no
pageview/analytics/view-count exists; the only proof of a visitor is a booking or a chat,
and by that proxy the market sites have zero known visitors. So "zero public bookings"
cannot yet be read as conversion vs. distribution — opposite fixes. A visitor counter
(Option B, forward-only) is being built to answer that one binary question.

**The market page-load query (once the counter ships) — filters market, same rule as everything:**
```sql
select b.name, b.owner_identified, count(pl.*) as non_owner_loads, min(pl.loaded_at) as first_load
from businesses b
left join page_loads pl on pl.business_id = b.id and pl.is_owner_preview = false
where b.account_kind = 'market'
group by b.id, b.name, b.owner_identified
order by non_owner_loads desc;
```

*Method: `account_kind` (test/internal/market) + `owner_identified` are trustworthy as of
migrations `20260823140000` + `20260825120000` + `20260825130000`. Layout/quality sweeps
still run over ALL generated pages; only user/adoption/value numbers filter market. No
conclusions about renderers are drawn here.*
