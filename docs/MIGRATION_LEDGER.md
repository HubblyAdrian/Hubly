# The migration ledger — what diverged, what is applied, and what repair looks like

Established 2026-09-09. **Nothing has been changed.** This is the report that precedes
repair, as ruled.

---

## 1. It is 28, not 30

I said "thirty" from a glance at the list yesterday and did not count. The exact figure,
from `supabase migration list --linked`:

| | |
|---|---|
| ledger entries in total | 196 |
| local **and** recorded remotely | **168** |
| local, **NOT** recorded remotely | **28** |
| recorded remotely with no local file | **0** |

The last recorded version is `20260823130000`. Everything from `20260823140000` onward
— every migration since 2026-08-23 — is unrecorded. Zero remote-only entries means the
divergence runs in exactly one direction: **the repo has files the ledger has never
heard of; the ledger has nothing the repo lacks.**

## 2. All 28 are actually applied to the database

Not assumed — checked. Every DDL object each migration creates was looked up in
`information_schema` / `pg_proc` / `pg_publication_tables`: **40 functions, 7 tables,
3 views, 4 columns, 3 triggers.** All present.

Two of the 28 create no DDL and so cannot be verified by object existence. Both were
verified by the state they were supposed to produce instead:

| Migration | How it was verified | Result |
|---|---|---|
| `20260831050000_normalize_stored_phones` | phones not matching the normalised pattern | **0 of 76** — applied |
| `20260909000500_chat_realtime` | `chatbot_conversations` in `supabase_realtime`, SELECT policy present | both true — applied |

The full list, all verified applied:

```
20260823140000_mark_test_accounts             20260831060000_site_gaps_hours_note
20260825120000_account_kind_market            20260831070000_owner_authorised_fact_writers
20260825130000_owner_identified               20260902000000_patch_business_hours_note
20260825140000_page_loads                     20260904190000_restore_business_document_version
20260827180000_planner_fallback_events        20260906230000_stripe_connect_accounts_mode
20260827200000_image_slot_probe               20260908000000_sync_brand_meta_with_columns
20260827230000_rebuild_outcome_events         20260908010000_business_places
20260830010000_price_extraction_miss_events   20260908020000_places_workspace_scope_and_seed
20260831020000_restore_prev_business_document 20260908030000_add_business_place
20260831030000_get_my_site_gaps               20260908210000_visitor_conversation_retention
20260831040000_hours_note                     20260908230000_business_events
20260831050000_normalize_stored_phones        20260908234500_business_events_stage_b
                                              20260909000500_chat_realtime
                                              20260909010000_business_traffic_rpc
                                              20260909020000_chat_event_detail
                                              20260909040000_owner_answerable_readers
```

**So the schema is correct and the ledger is wrong.** That is the good version of this
problem: repair is a bookkeeping change, not a schema change.

## 3. What a re-run would actually do — and how close it came

`supabase db push` re-runs every unrecorded migration. Across the 28 there are
**26 top-level statements that would change data or drop an object** (function bodies
excluded — redefining a function does not run the DML inside it).

The one that matters is the first file, `20260823140000_mark_test_accounts`:

```sql
-- statement 6
update public.businesses set account_kind = 'test'
  where account_kind <> 'test' and id not in (<9 hardcoded ids>);
-- statement 7
update public.businesses set account_kind = 'real' where id in (<the same 9>);
```

Statement 6 **reclassifies every business in the corpus to `test`** except nine
hardcoded ids. `account_kind` is what every user, adoption and value number in this
product filters on. Losing it means every such figure silently becomes a claim about
167 test drafts.

**It did not happen, and I verified that rather than assuming it.** If statement 6 had
committed, no business outside those nine ids could still be non-test. Counted now:

- `account_kind` today: **167 test · 9 market · 3 internal** (179 total, 93.3% test)
- non-test businesses **outside** the nine hardcoded ids: **3**
- `owner_identified`: 7 true, 172 false
- Stripe modes: `adrians-lawn-service` = live, `evergreen-yard-care` = test

Three non-test businesses outside the list proves statement 6 never committed — **the
migration ran inside a transaction and rolled back when statement 7 hit the
`account_kind` check constraint**, which no longer permits `'real'`.

So two things had to hold, and both were luck:

1. `'real'` had to still be invalid — it is only invalid because
   `20260825120000_account_kind_market` replaced the constraint later.
2. The runner had to be transactional. Had these been applied one statement at a time,
   statement 6 would have committed before 7 failed.

**And the migration is stale regardless.** Only **6 of its 9 hardcoded ids** are market
today. Re-running it successfully would have been wrong even without the constraint.

Other statements that would change data on a re-run, for completeness:

| File | What re-running would do |
|---|---|
| `20260825130000_owner_identified` | sets `owner_identified = true` for every market/internal business — overwriting a field whose whole point is that confirmation is a **manual** action |
| `20260906230000_stripe_connect_accounts_mode` | sets `adrians-lawn-service` to Stripe **live** mode, and drops a unique constraint. Real money has moved through that account |
| `20260825120000_account_kind_market` | `'real' → 'market'`; harmless now (no `'real'` rows), and drops/recreates the check constraint |
| `20260908230000_business_events` | `drop table if exists business_timeline_events` — already gone, harmless |
| six files | `drop function if exists …` then recreate — the intended behaviour |

## 4. What repair looks like

The ledger is `supabase_migrations.schema_migrations (version text, statements text[], name text)`,
holding 168 rows, newest `20260823130000`.

Repair is to **record the 28 as applied without executing them**:

```
supabase migration repair --status applied <version> …   # 28 versions
```

`migration repair` writes the ledger row and does not run the SQL — which is exactly
right here, because the SQL is already in the database. After it, `migration list` shows
196/196 matched and `db push` becomes a no-op rather than a loaded gun.

**Three things to decide before running it, none of which I have decided:**

1. **Whether to repair `20260823140000_mark_test_accounts` at all, or delete it.** Its
   hardcoded id list is stale (6 of 9), it writes a value the constraint now rejects,
   and marking it "applied" freezes a file that must never run again. The alternative is
   to delete the file and repair the remaining 27 — the schema keeps the trigger and
   functions it created either way, because those are already live.
2. **Whether `stripe_connect_accounts_mode` should keep a hardcoded slug → live-mode
   update in a file that any future `db push` would re-run.** Same question, higher
   stakes: that statement puts a real account into live mode.
3. **Whether repair should be verified by a checker afterwards.** A check that
   `migration list` reports zero unrecorded versions would make this class of drift
   fail the build instead of being discovered by a push that nearly fired. I would
   write that; it needs database access, so it runs beside `check:answerable-live`
   rather than inside `npm test`.

## 5. Until it is repaired

`docs/CHECKER_LESSONS.md` opens with the warning. Apply SQL with
`supabase db query --linked -f <file>` and keep the migration file in sync by hand —
which is how the four migrations written on 2026-09-08 and 09 were applied, and how
`check-backend-answerable.mjs` caught three functions that had reached production
without reaching the repo.
