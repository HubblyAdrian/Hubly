# Migrations — read this before you run anything

## `supabase db push` IS BANNED. It is not a style preference.

Push applies **every migration the remote ledger does not know about**, in order. Today that
is **53 files**, back to 2026-08-23 — because the ledger stops at `20260823130000` and nothing
since has been recorded.

One of those 53 is `20260823140000_mark_test_accounts.sql`, which contains:

```sql
update public.businesses set account_kind = 'test'
  where account_kind <> 'test' and id not in (…9 ids captured on 2026-08-23…);
update public.businesses set account_kind = 'real'      -- 'real' no longer exists
  where id in (…the same 9…);
```

Run it today and **every market and internal business created since August is relabelled
`test`** — Graef included — and every user, adoption and value number computed from that
column is silently wrong from then on.

**This happened on 2026-09-12.** `supabase db push --include-all` was run to apply two
additive migrations. It replayed the backlog, reached that file, and died on the second
statement because `'real'` is not a valid `account_kind` any more. The file ran inside a
transaction and rolled back — that was luck about transaction scope, not a safeguard. The
statement that would have done the damage was the one before it.

`scripts/check-no-db-push.mjs` now fails if the command appears anywhere in the repo.

## Apply one migration, deliberately

```sh
supabase db query --linked -f supabase/migrations/20260912200000_slug_history_provenance.sql
```

Read the file end to end first and confirm it contains no `drop`, `delete`, `truncate` or
unbounded `update`. If it does, stop and ask.

## The ledger is unreconciled, and that is the actual problem

221 migration files, 168 recorded, **53 unrecorded**. The unrecorded ones are not pending —
their effects are already in the database, applied by hand exactly as above. Push cannot tell
the difference between "already applied by hand" and "never applied", which is why it replays
history and why it is dangerous here.

The repair is to BASELINE the ledger: record the already-applied versions as applied, so push
has nothing to replay. Costed but not executed — see `docs/OPEN_FINDINGS.md`. Until it is done,
every schema change is applied by hand, one file at a time, which is how the ledger rotted in
the first place.
