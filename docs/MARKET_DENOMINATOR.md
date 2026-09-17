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
