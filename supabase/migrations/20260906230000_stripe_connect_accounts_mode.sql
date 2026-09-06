-- stripe_connect_accounts.mode — RAN against production 2026-09-06.
--
-- A Stripe connected account exists in EXACTLY ONE mode, and nothing in the row
-- recorded which: both a test and a live account id are `acct_` + 21 characters,
-- with no marker to parse (unlike keys, sk_test_ / sk_live_). Two modes sat in one
-- column, indistinguishable. See docs/OPEN_FINDINGS.md #49.
--
-- ONE TRANSACTION: between the DROP at step 5 and the CREATE that follows it there
-- is no uniqueness on this table at all. Wrapped, that window does not exist.
-- Plain CREATE UNIQUE INDEX (not CONCURRENTLY, which cannot run in a transaction).
begin;

-- 1. nullable first — NOT NULL with no default cannot be added to a populated table.
alter table public.stripe_connect_accounts add column mode text;

-- 2. backfill. PROVENANCE: stated by Adrian, corroborated by connected_at against
--    the 2026-09-06 switch to test keys. Mode cannot be derived from an acct_ id or
--    from any column; the only proof is calling Stripe under each key, which is what
--    scripts/verify-stripe-account-modes.mjs does. These two rows are hand-asserted
--    because we created both; that allow-list is deliberately tiny and the script
--    exits non-zero for any row not on it.
update public.stripe_connect_accounts a set mode = 'live'
  from public.businesses b
 where b.id = a.business_id and b.slug = 'adrians-lawn-service';

update public.stripe_connect_accounts a set mode = 'test'
  from public.businesses b
 where b.id = a.business_id and b.slug = 'evergreen-yard-care';

-- 3. refuse to continue on an incomplete backfill. A migration that silently leaves
--    a NULL is the exact bug this column exists to fix.
do $$
declare n int;
begin
  select count(*) into n from public.stripe_connect_accounts where mode is null;
  if n > 0 then
    raise exception 'stripe_connect_accounts: % row(s) have no mode - backfill is incomplete', n;
  end if;
end $$;

-- 4. enforce. NO DEFAULT, deliberately: a default is how a row that cannot say which
--    mode it belongs to gets one anyway. This also makes the schema enforce the
--    ordering constraint — every INSERT fails until the code supplies a mode.
alter table public.stripe_connect_accounts alter column mode set not null;
alter table public.stripe_connect_accounts
  add constraint stripe_connect_accounts_mode_chk check (mode in ('test','live'));

-- 5. UNIQUE (business_id) was the blocker: a business could NEVER hold both a test
--    and a live account, so the first dual-mode onboard would fail with 23505 at
--    insert. Dropped and replaced in that order, inside this transaction.
--    stripe_connect_accounts_stripe_unique UNIQUE (stripe_account_id) STAYS.
--
--    NOT `if not exists` on the index: if that name already existed on different
--    columns, IF NOT EXISTS would silently do nothing and this would COMMIT with no
--    uniqueness — a silent no-op in the one place nobody would check.
alter table public.stripe_connect_accounts
  drop constraint stripe_connect_accounts_business_unique;

create unique index stripe_connect_accounts_biz_mode_uniq
  on public.stripe_connect_accounts (business_id, mode);

commit;
