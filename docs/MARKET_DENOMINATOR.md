# The market denominator — what "the market" actually is

**Read from the live database on 2026-09-17.** Every number in this repo that describes users,
adoption or value must filter `account_kind = 'market'` and state its denominator. This file IS
that denominator, listed by name so a rate can never again be quoted over a corpus that is mostly
our own drafts.

**`account_kind` has three values and the difference is the whole point:** `test` (our drafts),
`internal` (founders, us, family), `market` (a genuine outside business). Reading "not test" as
"the market" is how a week of priorities once came to rest on a corpus that was ~93% test.

## The ten

| slug | claimed | `owner_identified` | page versions | services | jobs | customers | bookings | page loads | created |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `aquaspeed` | yes | **yes** | 0 (classic) | 3 | 0 | 0 | 6 | 12 | 2026-07-11 |
| `graefs-autocare` | yes | **yes** | 0 (classic) | 1 | 2 | 4 | 11 | 34 | 2026-07-11 |
| `devdetailing661` | yes | **yes** | 0 (classic) | 0 | 0 | 0 | 0 | 4 | 2026-07-13 |
| `bucket-mobile-detailing` | yes | **yes** | 0 (classic) | 0 | 0 | 0 | 1 | 6 | 2026-07-20 |
| `detailing-chemicals-equipment-courses` | yes | no | 2 | 4 | 0 | 0 | 0 | 3 | 2026-08-22 |
| `mobile-auto-detailing-in-los-angeles` | yes | no | 2 | 0 | 0 | 0 | 0 | 6 | 2026-08-22 |
| `window-washing` | yes | no | 3 | 2 | 0 | 0 | 0 | 7 | 2026-08-26 |
| `modern-landscaping-business` | yes | no | 2 | 0 | 0 | 0 | 0 | 5 | 2026-09-01 |
| `lugnuts-regulators` | yes | no | 2 | 3 | 0 | 1 | 1 | 3 | 2026-09-01 |
| `site-aa7537` | yes | no | 3 | 0 | 0 | 0 | 0 | 2 | 2026-09-10 |

## What this table says, and it is uncomfortable

- **N = 10.** Any percentage over the market moves by 10 points per business. A rate is barely
  meaningful at this size and a COUNT is usually the honest form.
- **SIX OF THE TEN ARE `owner_identified = false`** — our own column saying *we have never
  confirmed who this is*. The four that are confirmed are the four oldest, and they are the four
  on classic. So "market" on a row created since August means "the claim trigger classified it",
  not "a person we know". **That is the caveat that belongs beside every market number**, and it
  is the one that made the lugnuts alarm wrong (Lesson 96).
- **The four confirmed businesses have ZERO freeform page versions** — they are all classic, which
  is why "classic is a supported path" is a fact about our real customers and not a legacy note.
- **Six of the ten have no services, no jobs, no customers and no bookings.** Page loads are in
  single digits. On the evidence in this table, **one business (graefs-autocare) is using Hubly to
  run work**, and one more (aquaspeed) has taken bookings.

## How to use it

- Quote a COUNT out of 10, never a percentage, unless the count is large enough to survive one row
  changing.
- Say which of the two market sets you mean: **confirmed** (4) or **classified** (10).
- `scripts/lib/kind-split.mjs` (`rateLine`, `subsetLine`) refuses to print a rate without the
  split, and `scripts/check-denominator-rule.mjs` fails the run if a script prints one anyway.
  This file is the human-readable half of the same rule.

## SOURCE FACT, DERIVED FACT, EXPRESSION — which one is each number here

> *"What IS the denominator, what is it a denominator OF, how is it counted, and what is the source
> of truth? If it is derived, show the derivation. Source fact, derived fact and expression are three
> different things — be explicit which one the number is."* — Adrian, 2026-09-17

### The answer in one paragraph

**The denominator is 10, it is a denominator OF BUSINESS RECORDS, and it is an EXPRESSION over a
DERIVED fact — not a source fact and not a count of people.** It is
`select count(*) from public.businesses where account_kind = 'market'`. `account_kind` is a stored
column written by a TRIGGER that classifies an email address, so "market" means *"a claim arrived
from an address that did not look like ours"* — a derivation, with a known failure mode — and not
*"a real outside business exists"*. The source facts underneath it are a row in `businesses`, a
non-null `claimed_at`, and an address in `auth.users`. **Nothing in this file is a count of people,
and `businesses` is not a table of people** — that is the standing rule *a row is not evidence of a
person*, and it is why `owner_identified` exists.

### The three layers, named

| layer | what it is | here |
| --- | --- | --- |
| **SOURCE FACT** | something that happened and was recorded once, by the event itself | a row in `public.businesses` · `claimed_at` becoming non-null · the row in `auth.users` and its `email` · a row in `booking_requests`, `jobs`, `customers`, `page_views` |
| **DERIVED FACT** | a stored value COMPUTED from source facts by code we wrote, which can therefore be wrong in a way the source cannot | **`account_kind`** · `owner_identified` (false by default — set true only by hand) · `business_events` (a view over rows) |
| **EXPRESSION** | a number computed at read time from the two above, existing only in an answer | **"N = 10"** · every per-column figure in the table above · every rate anywhere in this repo |

### The derivation, shown

`account_kind` is set by the trigger `public.mark_test_on_claim`
(`supabase/migrations/20260825130000_owner_identified.sql`), which fires when `owner_id` is first
set — i.e. at CLAIM, never at draft creation:

```
if the claimer's auth email matches any of
      adriansmithee%   ·   adrian@brnno%   ·   %@hublytest.dev   ·   test@%
      ·   a local part containing '+'
  then account_kind := 'test'
elsif account_kind = 'test'                    -- the default for every draft
  then account_kind := 'market'                -- and owner_identified STAYS FALSE
```

`internal` is never set by this trigger. It is written by hand, by an `update` in that same
migration, for founders, us and family.

**So the derivation is one string match against five patterns, and its failure mode is stated in the
code it replaced:** the honest default is the unflattering one. Before 2026-08-25 the trigger
promoted anything unrecognised straight to the flattering value, which is the same defect
`account_kind`'s own `'real'` default had one level down. `owner_identified` is the column that
carries what the derivation cannot know, and **6 of the 10 have it false.**

### What each is a denominator OF, precisely

- **10** — business RECORDS classified `market`. Not people, not paying customers, not active users.
- **4** — of those, records where a human has confirmed who the owner is (`owner_identified = true`).
  **This is the honest denominator for any sentence containing the word "customer".**
- **1** — of those, records with jobs AND customers AND bookings, i.e. a business running work
  through Hubly (`graefs-autocare`). This is the denominator for "is anyone using it".
- **208** — business records with a page in either store, fixtures excluded. The denominator for
  sweeps about PAGES, which are not about users and correctly include test drafts
  (a broken layout is broken regardless of who made it).

### The source of truth, and what would move any of these

The **live database**, read at the moment of the claim. Never a cached export: a reused
`corpus.json` silently undercounts, which is a standing rule. Re-derive with

```
select account_kind, count(*), sum((owner_identified)::int) as confirmed
  from public.businesses group by 1 order by 1;
```

**Three things would move these numbers and none of them is a change in the market:** a founder
signing up with an unrecognised address (10 → 11, confirmed stays 4), a hand-classification
(4 → 5 with no new business), and a new pattern added to that trigger's five (10 → 9 retroactively
for every future claim, and not for past ones). **A number that can move without the world moving
must be quoted with the mechanism that moves it.**
