# The owner home screen — the eight promises, and what is behind each one

Recorded 2026-09-08, from the home-screen rebuild.

The brief listed eight things the mockup offers an owner: four action cards and four
suggested questions. This is what each one actually has behind it, checked against
`supabase/functions/_shared/hubly_capability_registry.ts` and
`supabase/functions/_shared/hubly_operational_state.ts`.

The operational slices that exist, in full: **bookings, jobs, orders, chat_leads,
traffic, leads**. There is no customers slice, no revenue total, and no aggregate of
any kind. That single fact decides most of the table.

| # | The promise | Behind it | Verdict |
|---|---|---|---|
| 1 | View my schedule | `operations.read` slice `jobs` — real rows, real dates | **Real.** Renders. |
| 2 | See my customers | *nothing* — no capability reads the customers table | **Not real.** Does not render. |
| 3 | Check my sales | `operations.read` slice `orders` — **store** orders only | **Real only for a store.** Gated on the Store place. |
| 4 | Edit my website | the website workspace (an earned place, takes the centre) | **Real.** Renders when the place is earned. |
| 5 | Show me my bookings this week | `operations.read` slice `bookings`; rows carry `requested_date`, so "this week" is answerable from them | **Real.** Renders. |
| 6 | What are my most popular services? | would be a count over a row list truncated at `MAX_ROWS` | **Not real.** Does not render — see below. |
| 7 | Help me create a promotion | *nothing* in the registry creates one | **Not real.** Does not render. |
| 8 | Add a new service to my website | `business.setServices` — writes the record AND places the price on the page | **Real.** Renders. |

Adrian expected the last two to fail. **Four of the eight have nothing behind them**, and
the two extra failures are the interesting ones:

- **"See my customers"** is the biggest gap on the screen. There is a `customers` table
  and it is in the Realtime publication, but nothing reads it for an owner. Until a
  slice exists, the honest card is the one we DO hold: *"See who asked and didn't book"*,
  reading `chat_leads`.
- **"What are my most popular services?"** is worse than missing — it is answerable in a
  way that would be wrong. The model could count `service_name` across the returned rows,
  but that list is capped at `MAX_ROWS`, so the answer would be a ranking with a
  denominator nobody stated. A number that is accurate about what it counted and a lie
  about what it means is exactly the bot-traffic defect in another costume.

## What renders instead, and why it cannot drift

Nothing on Home is a hardcoded string any more. `HC_HOME_PROMISES` in
`public/platform-home.html` is the single list; every entry names the capability it
depends on (`cap`) and the state it needs (`needs`), and a promise renders only when both
hold. Positions are the list's own order and never reshuffle by frequency or recency
(prohibition 5); a promise that cannot render leaves its slot to the next one down.

`scripts/check-home-promises.mjs` parses those `cap` names and fails the build if any of
them is absent from the registry — wired into `npm test` as `tests/home-promises.test.mjs`.
Red-proved by pointing a chip at `business.setHours` (a capability that does not exist,
which is the exact defect it guards): exit 1, then restored byte-identical.

Four hardcoded strings is how "Set your hours" happened: it sat in the gaps panel for
weeks offering owners a fix no capability could make, and it was found by clicking it on
a real business, not by reading the code.

Clicked in the harness, all eight rendered promises fire:

```
schedule   asks: "Show me my schedule."
leads      asks: "Who asked on my site and didn’t book?"
bookings   asks: "Show me my bookings."
website    opens workspace "website"
q-week     asks: "Show me my bookings this week"
q-leads    asks: "Who asked about my services this week?"
q-service  asks: "Add a new service to my website"
q-photos   asks: "Add photos of my own work"
```

**What that proves and what it does not.** It proves each control does the thing it is
wired to do. It does NOT prove what the server answers, because that needs a real owner
JWT and there is none in this environment. The capability trace above is a hypothesis
about the answer; only Adrian signed in on the real thing turns it into a finding.

## Not built, deliberately

- **A Tasks place.** Asked before building it: it would be a second home for things that
  already have one. The un-actioned chat leads are cards in the stream, and the page gaps
  ("A few things would make your page stronger") are the list underneath them. A Tasks
  room would hold those two and nothing else — the same items in a second location, which
  is how a place stops meaning anything.
- **A customers slice.** Named here as the gap it is, not built: it is a server change and
  the brief was the home screen.
