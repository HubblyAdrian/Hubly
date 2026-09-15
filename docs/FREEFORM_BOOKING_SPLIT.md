# The freeform page-vs-booking split — measured, and what it actually cost

Measured 2026-09-15 against the live database. Fixed at the reader.

## What the split was

On a **freeform** page (29 of 41 claimed businesses) the site is **baked HTML** from
`business_documents`, while the booking wizard called `loadServicesFromDb`, whose last-resort
branch selected `public.services` directly. Two sources, no shared answer. A stranger could be
offered something the page never advertised.

## First: what the "page shows N services" number is worth

**Nothing, and a conclusion was built on one.** A previous sweep counted `data-hubly-service="`
occurrences and reported "crestview shows 6". It does not. Those six are a section heading
(`Clean windows`), three real services, and **two duplicates** of services already counted.
`OPEN_FINDINGS #11` had already recorded why — the anchor pass stamps headings and descriptions
too, and `allServiceAnchors` returns a paragraph as if it were a service.

**There is no reliable way to derive "what services does this baked page display" from the
stored HTML today.** So this measurement does not try. It asks a question that IS answerable:

> for each service the booking wizard offers, is that name on the page, and is that price on the
> page?

That is a presence test on a specific string, not an attempt to enumerate the page.

## The harm, measured

**Services booking offers that the page never names — 4, on 3 businesses:**

| business | kind | service | price |
|---|---|---|---|
| `detailing-chemicals-equipment-courses` | **market** | Detailing Skills Courses | $0 |
| `site-aa7537` | **market** | "watch adrian smithe and make sure he is doing his work" | $0 |
| `larkspur-landscaping` | test | Lawn care | $0 |
| `larkspur-landscaping` | test | Seasonal cleanups | $0 |

**Every one is unpriced.** The second is obviously junk data, not a service.

**Prices booking quotes that the page never shows — ZERO.** All 36 priced services offered on a
freeform page have their price on the page, as `$N`.

### That number took three tries, and the first two were wrong

Reported in the previous message as *"9 businesses quote a price the page never shows"*. It was
false, twice over:

1. The first scan looked for `'$' || price` — **the exact `$`-anchored price scan CLAUDE.md names
   as a recurring mistake**, which misses any price rendered without the symbol.
2. The rewrite meant to fix that used `to_char(price,'FM999999990.99')`, which returns `220.`
   with a **trailing dot** for a whole number — so it searched for `$220.` and found nothing.
   Both the "$-only" test and the "number anywhere" test were broken by the same formatting, and
   they agreed with each other, which is what made the wrong answer look solid.

Corrected by trimming the trailing dot and re-running: **0 of 36**. Two detectors agreeing is not
corroboration when they share a bug.

## Has it cost anybody anything? No.

**7 booking requests exist on freeform businesses with a service name. All 7 name a service the
page names.** One is market (`lugnuts-regulators`, "motorcycle rebuilds", pending 2026-09-01) and
it is on the page. **There is no incident.** This is a live exposure that has not yet been taken,
which is the moment to close it.

## The fix: one reader, and it is NOT the union

`get_public_business_services(p_slug)` — `20260915210000`. Anon-callable, keyed by slug, public
columns only. `loadServicesFromDb` now calls it, falling back to the old table read if the RPC
fails, because a visitor seeing nothing is worse than a visitor seeing the table.

**The first draft of it was wrong and would have introduced the very harm it closes.** It was
`get_business_services` with the owner gate swapped for a slug — a full outer join of both
stores. Run against Graef it returned **nine**, the ninth being `clay and seal` at **$0** from
the relational table: a service his page has never shown. Routing booking through that would have
offered a stranger a service the page never advertised at a price the owner does not charge.

So the two readers answer **different questions** and must not share a rule:

| reader | question | rule |
|---|---|---|
| `get_business_services` (owner/model) | what does this business **have on record** | the **union**, with `source` and `conflicts` — an owner needs to see what is on file and not showing |
| `get_public_business_services` (visitor) | what does this business **offer me** | **the catalogue is the page**; the table only when there is no catalogue |

Plus: a catalogue entry with `status != active` or `flags.website = false` is **not offered** —
offering one would be the booking flow re-publishing what the owner took down.

### And a third inflated number, corrected

`star-windows` was reported as **9 services**. It is **5**. The relational table holds genuine
duplicates — four services written twice, seven seconds apart, on 2026-07-18; `adrians-lawn-service`
has four more. Checked before collapsing them: **all 8 duplicate names agree exactly on price**,
so the reader emits one row per name. If a future pair ever disagrees it quotes the **lowest** and
raises `conflicts` — never quote a customer more than the lowest number the owner has on record,
and never resolve the disagreement quietly.

**So "star-windows would gain nine cards no visitor has ever seen" is really five.** The shape of
that ruling is unchanged; the number was wrong.

## What this does NOT do

**It does not make a baked freeform page agree with the booking wizard.** That page is HTML
written at generation, and the only machine-readable record of what it displays is the anchor
set, which is unreliable. Making them agree requires rebuilding the page, which is a separate
decision. What this does is remove one of the two independent sources, so the booking flow now
answers from the same reader as the classic page and the model.

**Unverified by a human.** No real visitor has booked through the new reader. The change was
exercised against the live database by calling the RPC for five businesses and comparing counts;
the wizard itself has not been driven end to end by a person.
