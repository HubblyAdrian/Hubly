# Capability audit — REAL businesses only (2026-08-23)

> ⚠️ **READ THIS BEFORE USING ANY NUMBER FROM THE EARLIER AUDIT.**
> The capability audit circulated earlier (125 businesses; "62 of 108 empty booking
> pages"; "79% never claim"; "53 with services"; "17% photo repeat") was computed over a
> corpus that was **~93% our own test drafts** — a week of Claude Code's and Adrian's
> testing, created in the 2026-08-20→23 flood. Those ratios describe **us talking to
> ourselves, not the market.** Do not make design or product decisions from them.
>
> This document is the real-filtered replacement: `account_kind = 'real'`, **N = 9**.
> No percentages — at N=9 a percentage hides more than it shows. The rows are printed in
> full; read the rows.

## The nine real businesses

`Y` = present · `·` = absent · numbers are counts.

| business | email | created | renderer | freeform page | services | priced | hours | logo | own photos | real bookings | chatbot |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Aquaspeed | aquaspeed723@gmail.com | 2026-07-11 | classic | · | 3 | 3 | 0 | Y | 0 | **2** | **1** |
| Graef's AutoCare | austinjgraef@gmail.com | 2026-07-11 | classic | · | 0 | 0 | 0 | Y | 0 | **6** | 0 |
| Devdetailing661 | fdevin180@gmail.com | 2026-07-13 | classic | · | 0 | 0 | 0 | Y | 0 | 0 | 0 |
| Bucket Mobile Detailing | bucketmobiledetailing@outlook.com | 2026-07-20 | classic | · | 0 | 0 | 0 | Y | 0 | **1** | 0 |
| Cotter Aviation | cotterjp@gmail.com | 2026-07-25 | classic | · | 0 | 0 | 0 | · | 0 | 0 | 0 |
| My Auto Detailing | jjake486@gmail.com | 2026-07-25 | classic | · | 0 | 0 | 0 | · | 0 | 0 | 0 |
| Detailing Chemicals, Equipment & Courses † | andres.mayorga1616@email.bakersfieldcollege.edu | 2026-08-22 | classic | Y | 4 | 0 | 0 | · | 0 | 0 | 0 |
| Mobile Auto Detailing in Los Angeles † | andres.mayorga1616@email.bakersfieldcollege.edu | 2026-08-22 | classic | Y | 0 | 0 | 0 | · | 0 | 0 | 0 |
| Lugnutz | kaptn.awesome@gmail.com | 2026-08-22 | classic | Y | 3 | 0 | 0 | · | 0 | 0 | 0 |

† **Borderline, kept REAL deliberately.** Both rows are the same college address
(`andres.mayorga1616@email.bakersfieldcollege.edu`) with generic/SEO-ish names. They may
be a genuine student/local operator or a tester. At N=9 each row is ~11%, and wrongly
excluding a real user is worse than including a possible tester — so they are counted real.
Named here so we never silently include or exclude them again.

## What is actually true at N=9
- **Bookings — the only value signal — go to the CLASSIC renderer, not the new builder.**
  All 9 real bookings landed on classic-renderer businesses from July (Graef's 6,
  Aquaspeed 2, Bucket 1). The 3 businesses with a freeform page (the builder's output) are
  all from 2026-08-22 and have **0 bookings so far.** The freeform builder — the whole
  week's work — has produced 3 real pages and, as yet, no real booking.
- **Chatbot:** used by exactly one real customer, ever (Aquaspeed, 1 conversation).
- **Prices:** one business has real prices (Aquaspeed). **Hours:** zero. **Own photos:**
  zero — no real business has uploaded a real photograph; every page relies on stock or
  nothing.
- **Logo:** 4 of 9.

## The correction to the queue
The services-first capture and screenshot-extraction we shipped are still correct — Hubly
genuinely never asked for services, and now it does. But the *urgency ranking* behind them
came from test-inflated ratios. At N=9, polish measured on the test corpus is not the
priority; the value that exists is bookings through real (classic-renderer) sites, and the
open question is whether the new builder can convert a real person the way the classic
renderer already has.

*Method: `account_kind='real'` (trustworthy as of migration `20260823140000` — claim-time
trigger + creation-flag RPC + backfill). Design/layout sweeps still run over ALL generated
pages on purpose; only capability/market/value numbers filter to real.*
