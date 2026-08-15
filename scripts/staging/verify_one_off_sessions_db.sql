-- One-Off Sessions — schema, constraint and RLS verification against a REAL
-- PostgreSQL/Supabase database.
--
-- This is the check the in-memory harness cannot make: that the DATABASE itself
-- enforces what the engine assumes. Run it against staging (or any database the
-- migration has been applied to):
--
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f scripts/staging/verify_one_off_sessions_db.sql
--
-- It writes two businesses and a handful of rows into its own scratch space and
-- removes them at the end. It never reads or touches pre-existing data.

\set QUIET on
\pset pager off

create temp table _checks(ord serial, name text, passed boolean, detail text);
-- The RLS section deliberately switches to anon / authenticated / service_role,
-- so the recorder has to remain writable from every one of them.
grant all on _checks to anon, authenticated, service_role;
grant all on sequence _checks_ord_seq to anon, authenticated, service_role;
create or replace function _ck(p_name text, p_passed boolean, p_detail text default '')
returns void language plpgsql as $$
begin insert into _checks(name, passed, detail) values (p_name, p_passed, p_detail); end $$;

-- Scratch identities this script owns. Cleared up front as well as at the end,
-- so an aborted run never poisons the next one.
\set SCRATCH_BIZ '''11111111-1111-4111-8111-111111111111'',''a1111111-1111-4111-8111-111111111111'',''b1111111-1111-4111-8111-111111111111'''
delete from public.one_off_session_bookings where business_id in (:SCRATCH_BIZ);
delete from public.one_off_sessions where business_id in (:SCRATCH_BIZ);
delete from public.jobs where business_id in (:SCRATCH_BIZ);
delete from public.businesses where id in (:SCRATCH_BIZ);

-- ═════════════════ Phase 3 — schema ═════════════════

do $$
declare n int;
begin
  select count(*) into n from information_schema.tables
   where table_schema='public' and table_name='one_off_sessions';
  perform _ck('schema · one_off_sessions exists', n = 1);

  select count(*) into n from information_schema.tables
   where table_schema='public' and table_name='one_off_session_bookings';
  perform _ck('schema · one_off_session_bookings exists', n = 1);

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='jobs' and column_name='one_off_session_id';
  perform _ck('schema · jobs.one_off_session_id exists', n = 1);

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='jobs'
     and column_name='one_off_session_id' and is_nullable='YES';
  perform _ck('schema · jobs.one_off_session_id is NULLABLE (existing jobs unaffected)', n = 1);
end $$;

-- indexes
do $$
declare
  want text[] := array[
    'one_off_sessions_business_id_idx',
    'one_off_sessions_business_status_idx',
    'one_off_sessions_date_idx',
    'one_off_session_bookings_seat_uniq',
    'one_off_session_bookings_session_idx',
    'one_off_session_bookings_business_idx',
    'one_off_session_bookings_checkout_idx',
    'jobs_one_off_session_id_idx'
  ];
  i text; n int;
begin
  foreach i in array want loop
    select count(*) into n from pg_indexes where schemaname='public' and indexname=i;
    perform _ck('index · ' || i, n = 1);
  end loop;

  -- the seat index must be UNIQUE and PARTIAL — that is the concurrency guarantee
  select count(*) into n from pg_indexes
   where schemaname='public' and indexname='one_off_session_bookings_seat_uniq'
     and indexdef ilike 'CREATE UNIQUE INDEX%' and indexdef ilike '%WHERE (status <>%';
  perform _ck('index · seat index is UNIQUE and partial on status <> cancelled', n = 1);
end $$;

-- constraints
do $$
declare want text[] := array[
    'one_off_sessions_window_ordered',
    'one_off_sessions_appointment_fits',
    'one_off_sessions_deposit_not_over_price',
    'one_off_sessions_paid_needs_price'
  ];
  c text; n int;
begin
  foreach c in array want loop
    select count(*) into n from pg_constraint where conname = c;
    perform _ck('constraint · ' || c, n = 1);
  end loop;
end $$;

-- RLS enabled + policies present
do $$
declare n int;
begin
  select count(*) into n from pg_tables
   where schemaname='public' and tablename='one_off_sessions' and rowsecurity;
  perform _ck('rls · enabled on one_off_sessions', n = 1);

  select count(*) into n from pg_tables
   where schemaname='public' and tablename='one_off_session_bookings' and rowsecurity;
  perform _ck('rls · enabled on one_off_session_bookings', n = 1);

  select count(*) into n from pg_policies
   where schemaname='public' and tablename='one_off_sessions';
  perform _ck('rls · exactly one policy on one_off_sessions (owner only)', n = 1, 'found ' || n);

  select count(*) into n from pg_policies
   where schemaname='public' and tablename='one_off_session_bookings';
  perform _ck('rls · exactly one policy on one_off_session_bookings (owner only)', n = 1, 'found ' || n);

  -- No policy may be granted to anon. This is what makes the feature private.
  select count(*) into n from pg_policies
   where schemaname='public' and tablename in ('one_off_sessions','one_off_session_bookings')
     and 'anon' = any(roles);
  perform _ck('rls · NO policy grants anon anything', n = 0, 'anon policies: ' || n);

  select count(*) into n from pg_policies
   where schemaname='public' and tablename in ('one_off_sessions','one_off_session_bookings')
     and 'authenticated' = any(roles) and qual ilike '%owns_business%';
  perform _ck('rls · owner policies are gated on owns_business()', n = 2, 'found ' || n);
end $$;

-- ═════════════════ real constraint enforcement ═════════════════
-- Each of these must be REJECTED by the database, not merely by app code.

do $$
declare
  biz uuid := '11111111-1111-4111-8111-111111111111';
  ok boolean;
  base jsonb;
begin
  insert into public.businesses(id, owner_id, name, slug)
  values (biz, '99999999-9999-4999-8999-999999999999', 'Constraint Test Co', 'ctest-' || biz)
  on conflict (id) do nothing;

  -- end before start
  begin
    insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,booking_token)
    values (biz,'bad','2099-08-20','14:00','08:00','tok-a');
    ok := false;
  exception when check_violation then ok := true; end;
  perform _ck('db-constraint · rejects end_time before start_time', ok);

  -- appointment longer than the window
  begin
    insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,appointment_duration_minutes,booking_token)
    values (biz,'bad','2099-08-20','08:00','09:00',600,'tok-b');
    ok := false;
  exception when check_violation then ok := true; end;
  perform _ck('db-constraint · rejects appointment longer than the window', ok);

  -- deposit greater than price
  begin
    insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,price_cents,deposit_cents,booking_token)
    values (biz,'bad','2099-08-20','08:00','14:00',15000,20000,'tok-c');
    ok := false;
  exception when check_violation then ok := true; end;
  perform _ck('db-constraint · rejects a deposit larger than the price', ok);

  -- negative price
  begin
    insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,price_cents,booking_token)
    values (biz,'bad','2099-08-20','08:00','14:00',-1,'tok-d');
    ok := false;
  exception when check_violation then ok := true; end;
  perform _ck('db-constraint · rejects a negative price', ok);

  -- charging with no price
  begin
    insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,payment_mode,booking_token)
    values (biz,'bad','2099-08-20','08:00','14:00','deposit','tok-e');
    ok := false;
  exception when check_violation then ok := true; end;
  perform _ck('db-constraint · rejects payment_mode with no price', ok);

  -- invalid status
  begin
    insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,status,booking_token)
    values (biz,'bad','2099-08-20','08:00','14:00','totally-made-up','tok-f');
    ok := false;
  exception when check_violation then ok := true; end;
  perform _ck('db-constraint · rejects an invalid status', ok);

  -- capacity below 1
  begin
    insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,capacity_per_slot,booking_token)
    values (biz,'bad','2099-08-20','08:00','14:00',0,'tok-g');
    ok := false;
  exception when check_violation then ok := true; end;
  perform _ck('db-constraint · rejects capacity below 1', ok);

  -- duplicate booking_token
  insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,booking_token)
  values (biz,'first','2099-08-20','08:00','14:00','tok-unique');
  begin
    insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,booking_token)
    values (biz,'second','2099-08-20','08:00','14:00','tok-unique');
    ok := false;
  exception when unique_violation then ok := true; end;
  perform _ck('db-constraint · booking_token is globally unique', ok);
end $$;

-- ═════════════════ THE concurrency guarantee, in the real DB ═════════════════

do $$
declare
  biz uuid := '11111111-1111-4111-8111-111111111111';
  sess uuid;
  ok boolean;
begin
  insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,
    appointment_duration_minutes,capacity_per_slot,booking_token)
  values (biz,'Seat Test','2099-08-20','08:00','14:00',20,1,'tok-seat')
  returning id into sess;

  insert into public.one_off_session_bookings(session_id,business_id,slot_date,slot_time,
    duration_minutes,seat_no,customer_name,status)
  values (sess,biz,'2099-08-20','10:20',20,0,'Customer A','confirmed');

  -- second booking, same slot, same seat → the index must refuse it
  begin
    insert into public.one_off_session_bookings(session_id,business_id,slot_date,slot_time,
      duration_minutes,seat_no,customer_name,status)
    values (sess,biz,'2099-08-20','10:20',20,0,'Customer B','confirmed');
    ok := false;
  exception when unique_violation then ok := true; end;
  perform _ck('db-index · two live bookings cannot share a seat (23505)', ok);

  -- cancelling frees the seat back up
  update public.one_off_session_bookings set status='cancelled'
   where session_id=sess and slot_time='10:20' and seat_no=0;
  begin
    insert into public.one_off_session_bookings(session_id,business_id,slot_date,slot_time,
      duration_minutes,seat_no,customer_name,status)
    values (sess,biz,'2099-08-20','10:20',20,0,'Customer C','confirmed');
    ok := true;
  exception when unique_violation then ok := false; end;
  perform _ck('db-index · cancelling releases the seat (partial index)', ok);

  -- a different seat at the same time is fine (capacity > 1 support)
  begin
    insert into public.one_off_session_bookings(session_id,business_id,slot_date,slot_time,
      duration_minutes,seat_no,customer_name,status)
    values (sess,biz,'2099-08-20','10:20',20,1,'Customer D','confirmed');
    ok := true;
  exception when unique_violation then ok := false; end;
  perform _ck('db-index · a different seat at the same time is allowed', ok);

  -- cascade: deleting a session removes its bookings
  delete from public.one_off_sessions where id = sess;
  perform _ck('db-fk · bookings cascade with their session',
    not exists(select 1 from public.one_off_session_bookings where session_id = sess));
end $$;

-- ═════════════════ Phase 4 — RLS against the real database ═════════════════

do $$
declare
  ownerA uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  ownerB uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  bizA uuid := 'a1111111-1111-4111-8111-111111111111';
  bizB uuid := 'b1111111-1111-4111-8111-111111111111';
  sessA uuid;
  n int; ok boolean;
begin
  insert into public.businesses(id,owner_id,name,slug) values
    (bizA, ownerA, 'Business A', 'biz-a-rls'),
    (bizB, ownerB, 'Business B', 'biz-b-rls')
  on conflict (id) do nothing;

  insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,booking_token)
  values (bizA,'A private session','2099-08-20','08:00','14:00','tok-rls-a')
  returning id into sessA;

  -- ── anonymous ──
  set local role anon;
  select count(*) into n from public.one_off_sessions;
  perform _ck('rls-anon · cannot READ any session', n = 0, 'saw ' || n);

  select count(*) into n from public.one_off_session_bookings;
  perform _ck('rls-anon · cannot READ any booking', n = 0, 'saw ' || n);

  begin
    insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,booking_token)
    values (bizA,'hostile','2099-09-09','08:00','09:00','tok-hostile');
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  perform _ck('rls-anon · cannot INSERT a session', ok);

  update public.one_off_sessions set name='hijacked';
  get diagnostics n = ROW_COUNT;
  perform _ck('rls-anon · cannot UPDATE any session', n = 0, 'updated ' || n);

  delete from public.one_off_sessions;
  get diagnostics n = ROW_COUNT;
  perform _ck('rls-anon · cannot DELETE any session', n = 0, 'deleted ' || n);

  select count(*) into n from public.businesses;
  perform _ck('rls-anon · cannot read provider records', n = 0, 'saw ' || n);
  reset role;

  -- ── owner A ──
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', ownerA, 'role', 'authenticated')::text, true);

  select count(*) into n from public.one_off_sessions;
  perform _ck('rls-owner · CAN read own session', n = 1, 'saw ' || n);

  begin
    insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,booking_token)
    values (bizA,'A second','2099-08-21','08:00','14:00','tok-rls-a2');
    ok := true;
  exception when insufficient_privilege then ok := false; end;
  perform _ck('rls-owner · CAN create own session', ok);

  update public.one_off_sessions set name='A renamed' where id = sessA;
  get diagnostics n = ROW_COUNT;
  perform _ck('rls-owner · CAN update own session', n = 1);

  update public.one_off_sessions set status='published' where id = sessA;
  get diagnostics n = ROW_COUNT;
  perform _ck('rls-owner · CAN publish own session', n = 1);

  update public.one_off_sessions set status='closed' where id = sessA;
  get diagnostics n = ROW_COUNT;
  perform _ck('rls-owner · CAN close own session', n = 1);

  update public.one_off_sessions set status='cancelled' where id = sessA;
  get diagnostics n = ROW_COUNT;
  perform _ck('rls-owner · CAN cancel own session', n = 1);

  -- must NOT be able to plant a session on someone else's business
  begin
    insert into public.one_off_sessions(business_id,name,session_date,start_time,end_time,booking_token)
    values (bizB,'planted','2099-08-22','08:00','14:00','tok-planted');
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  perform _ck('rls-owner · cannot create a session on ANOTHER business', ok);
  reset role;

  -- ── owner B looking at A ──
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', ownerB, 'role', 'authenticated')::text, true);

  select count(*) into n from public.one_off_sessions where business_id = bizA;
  perform _ck('rls-cross · business B cannot READ business A''s sessions', n = 0, 'saw ' || n);

  update public.one_off_sessions set name='stolen' where business_id = bizA;
  get diagnostics n = ROW_COUNT;
  perform _ck('rls-cross · business B cannot UPDATE business A''s sessions', n = 0, 'updated ' || n);

  delete from public.one_off_sessions where business_id = bizA;
  get diagnostics n = ROW_COUNT;
  perform _ck('rls-cross · business B cannot DELETE business A''s sessions', n = 0, 'deleted ' || n);
  reset role;

  -- ── service_role (what the Edge Function runs as) ──
  set local role service_role;
  select count(*) into n from public.one_off_sessions where business_id = bizA;
  perform _ck('rls-service · the Edge Function role CAN read (public access path)', n > 0, 'saw ' || n);
  reset role;
end $$;

-- ═════════════════ cleanup ═════════════════
delete from public.one_off_session_bookings where business_id in (:SCRATCH_BIZ);
delete from public.one_off_sessions where business_id in (:SCRATCH_BIZ);
delete from public.jobs where business_id in (:SCRATCH_BIZ);
delete from public.businesses where id in (:SCRATCH_BIZ);

\set QUIET off
select case when passed then 'PASS' else 'FAIL' end as result,
       name,
       case when passed then '' else detail end as detail
  from _checks order by ord;

select count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
  from _checks;
