# Staging for Hubly

## The problem this solves

`supabase db push` **cannot build a Hubly database from this repository.**
`businesses`, `jobs`, `customers`, `booking_requests` and `owns_business()` were
created outside version control (the repo admits this in `20260805223000` and
`20260811035905`), and the first migration in the chain — `20260710010000` —
opens with `alter table booking_requests`. Statement one fails on a fresh
project.

That is why there is no staging environment, and why creating a blank Supabase
project would not have produced one.

## Two ways to build staging

### A. From a production schema dump — authoritative

```bash
pg_dump --schema-only --no-owner --no-privileges "$PROD_DB_URL" > prod_schema.sql
psql "$STAGING_DB_URL" -f prod_schema.sql
supabase db push --db-url "$STAGING_DB_URL"       # applies the 2 pending migrations
```

Needs the production DB password. This is the correct way — staging then matches
production exactly.

### B. From this repo — reconstructed, zero cost, zero production contact

```bash
createdb hubly_staging                 # or any empty Postgres 17 database
scripts/staging/apply_all_migrations.sh "postgresql://postgres@127.0.0.1:5432/hubly_staging"
```

`bootstrap_hubly_core.sql` recreates the out-of-version-control objects, then the
whole migration chain runs on top. Currently **119 of 125 migrations apply**; the
6 that don't need Supabase-managed features a plain Postgres has no equivalent
for (`pg_cron`, `pg_net`, some `auth`/`storage` internals) and none of them
touch One-Off Sessions.

**This is a reconstruction, not production.** It contains the columns this
repository demonstrably reads and writes and nothing else. Building it already
surfaced two production columns missing from the repo entirely
(`customers.customer_type`, and the `jobs` columns added by later migrations) —
which is exactly the drift option A avoids.

## Verifying

```bash
# schema, constraints, indexes and RLS — against the real database
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f scripts/staging/verify_one_off_sessions_db.sql

# the real engine against the real database
STAGING_DB_URL="postgresql://..." \
  deno run --allow-env --allow-net --allow-read --no-check \
  tests/one_off_sessions_realdb.integration.ts
```

Both are re-runnable and clean up after themselves. They only ever touch their
own scratch business ids.

## What a local database can and cannot prove

**Can** (and does): the migration applies; every constraint, index and RLS policy
behaves; anon is genuinely denied; cross-business isolation holds; the engine
works against real `date`/`time`/`jsonb` types; the seat index really raises
23505 under concurrency.

**Cannot**: Stripe, Google Calendar, PostgREST/Edge Function behaviour, or the
live AI. Those need a real Supabase project with real keys.
