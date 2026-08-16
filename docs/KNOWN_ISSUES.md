# Known issues

Open defects that are understood, deliberately not fixed yet, and should not be
rediscovered from scratch. Each entry says what is wrong, why it was left, and
what would settle it.

---

## Optional-chained provider flags default to "yes" when the provider is missing

**Status:** open, deliberately not fixed
**Found:** 2026-08-15, during the `!== false` sweep

`marketplace_providers.accepting_new_jobs`, `weekend_jobs` and
`accept_quote_requests` are `boolean not null default true`
(`supabase/migrations/20260719010000_marketplace_foundation.sql:32,34,45`). NULL
is not representable, so for any value **read from that table** `x !== false`
and `!!x` are identical, and `true` is the intended product default. That part is
settled — those call sites were reviewed and correctly left alone.

The real exposure is the sites that optional-chain through a provider object
that may itself be `undefined`:

- `supabase/functions/_shared/booking_engine.ts:312` — `provider?.weekend_jobs !== false`
- `supabase/functions/_shared/booking_engine.ts:318` — `provider?.accepting_new_jobs !== false`

When `provider` is undefined — no marketplace provider row, a failed lookup, a
business that never joined the marketplace — `provider?.weekend_jobs` evaluates
to `undefined`, and `undefined !== false` is `true`. The absence of a provider is
therefore read as a provider who accepts weekend jobs and is accepting new work.
That is a different failure from the column default: it is not "the provider said
yes", it is "there is no provider at all, so we said yes on their behalf".

**Why not fixed now:** flipping these changes who receives work. Getting it wrong
in the safe-looking direction (defaulting to `false`) can silently stop providers
from being offered jobs, which is worse than the current over-permissiveness and
is not visible in a test run. It needs a product decision plus a look at whether
a provider-less business should reach this code path at all.

**What would settle it:** decide what a missing provider row means at
`booking_engine.ts:305-320`. Most likely the caller should not be computing
availability for a business with no provider, in which case the fix is a guard at
the call site rather than a different boolean default.
