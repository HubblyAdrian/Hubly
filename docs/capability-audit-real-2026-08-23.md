# Capability audit — by account category (2026-08-23, revised 2026-08-25)

> ⚠️ **The denominator that matters is MARKET, not "real".**
> `account_kind` now has three values: **test** (our own drafts), **internal** (founders,
> us, family — a real account but not an outside customer), **market** (a genuine outside
> business). Any number about users, adoption, or value filters `account_kind='market'`
> and states its denominator. The earlier "125 businesses / 62 empty / 79% never claim /
> 17% photo repeat" ratios were computed over a corpus that was ~93% **test** — us talking
> to ourselves. Do not use them.
>
> **Market N = 7.** Classifications below are Adrian's, by hand (2026-08-25), source of
> truth — not inferred.

## The businesses (test excluded; 9 non-test rows)

`Y` = present · `·` = absent · counts otherwise.

| business | category | email | created | freeform page | services | priced | hours | logo | own photos | bookings | chatbot |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Aquaspeed | market | aquaspeed723@gmail.com | 07-11 | · | 3 | 3 | 0 | Y | 0 | 0† | 0† |
| Graef's AutoCare | market | austinjgraef@gmail.com | 07-11 | · | 0 | 0 | 0 | Y | 0 | see ‡ | 0 |
| Devdetailing661 | market | fdevin180@gmail.com | 07-13 | · | 0 | 0 | 0 | Y | 0 | 0 | 0 |
| Bucket Mobile Detailing | market | bucketmobiledetailing@outlook.com | 07-20 | · | 0 | 0 | 0 | Y | 0 | 0† | 0 |
| **My Auto Detailing** ⚑ | market | jjake486@gmail.com | 07-25 | · | 0 | 0 | 0 | · | 0 | 0 | 0 |
| **Detailing Chemicals…** ⚑ | market | andres.mayorga1616@…bakersfieldcollege.edu | 08-22 | Y | 4 | 0 | 0 | · | 0 | 0 | 0 |
| **Mobile Auto Detailing in LA** ⚑ | market | andres.mayorga1616@…bakersfieldcollege.edu | 08-22 | Y | 0 | 0 | 0 | · | 0 | 0 | 0 |
| Cotter Aviation | internal | cotterjp@gmail.com | 07-25 | · | 0 | 0 | 0 | · | 0 | 0 | 0 |
| Lugnutz | internal | kaptn.awesome@gmail.com | 08-22 | Y | 3 | 0 | 0 | · | 0 | 0‡ | 0 |

**⚑ Unrecognized by Adrian — flagged, not guessed.** Two people: `jjake486@gmail.com` (My
Auto Detailing, 07-25) and `andres.mayorga1616@email.bakersfieldcollege.edu`, who built
**two** sites on 08-22 (the second in Los Angeles). Counted market. If they are strangers
who signed up on their own, they are the most valuable rows in the company and worth a
direct conversation.

† / ‡ see the booking-contamination pass below — none of these are public bookings.

## Corrected value (Job 2)

**7 market businesses have a live Hubly site. Zero have ever received a booking from a
member of the public. Every booking in the database traces to an owner, a family member, a
founder, or a test harness.**

The 10 booking rows on non-test businesses, by the account/name/phone/email test signals:
- Aquaspeed ×2 — a **proof-mode test harness** (`proof-mode+…@hubly.test`, 555 phones).
- Bucket ×1 — **Adrian** (`adrian@brnno.com`).
- Graef's AutoCare ×6 — the **owner testing his own form pre-change, plus family** (per
  Adrian): 3 are the owner's own name, 3 are the Graef family. No stranger.
- Lugnutz ×1 (abandoned) — **Talmage Harrison, a founder** (per Adrian; my earlier "only
  stranger" read was wrong).
- Aquaspeed's single chatbot conversation was the **same 2026-07-22 proof-mode session** as
  its test bookings — not a real customer.

## The instrumentation gap (the actual priority — see the separate cost analysis)
We cannot tell whether any human has ever *loaded* a market site — there is no pageview /
analytics / view-count anywhere; the only proof of a visitor is a booking or a chat, and
by that proxy the market sites have **zero known visitors** (Lugnutz's one visitor is a
founder). So "zero public bookings" cannot yet be read as a conversion problem vs. a
distribution problem — those have opposite fixes, and we can't tell them apart until page
loads are counted.

*Method: `account_kind` (test/internal/market) is trustworthy as of migrations
`20260823140000` + `20260825120000`. Layout/quality sweeps still run over ALL generated
pages (a broken layout is broken regardless of who made it); only user/adoption/value
numbers filter market. No conclusions about renderers are drawn here.*
