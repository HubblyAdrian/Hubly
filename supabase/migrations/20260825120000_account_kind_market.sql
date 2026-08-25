-- account_kind meant "not a test draft" and we misread it as "the market." Widen to THREE
-- categories, because they have opposite implications for what to build:
--   test     = our own drafts (Claude Code + harness testing).
--   internal = founders, us, family — a real account, but not an outside customer.
--   market   = a genuine outside business.
-- The denominator that matters for any user/adoption/value number is MARKET, not "real".
--
-- The nine formerly-'real' rows are classified BY HAND by Adrian (2026-08-25), source of
-- truth, not inferred:
--   market   = Aquaspeed, Graef's AutoCare, Devdetailing661, Bucket Mobile Detailing,
--              My Auto Detailing, Detailing Chemicals…, Mobile Auto Detailing in LA
--   internal = Cotter Aviation (founder), Lugnutz (founder — Talmage Harrison)
-- The last three market rows are ones Adrian does NOT recognize (jjake486@gmail.com;
-- andres.mayorga1616@email.bakersfieldcollege.edu built two). Counted market, flagged as
-- unrecognized — not guessed. If they are strangers they are the company's best rows.

alter table public.businesses drop constraint if exists businesses_account_kind_check;
alter table public.businesses alter column account_kind set default 'test';

-- reclassify the nine (currently 'real') per Adrian's hand list
update public.businesses set account_kind = 'internal'
 where account_kind = 'real'
   and owner_id in (select id from auth.users where lower(email) in ('cotterjp@gmail.com','kaptn.awesome@gmail.com'));
update public.businesses set account_kind = 'market'
 where account_kind = 'real';   -- the remaining seven

alter table public.businesses add constraint businesses_account_kind_check
  check (account_kind in ('test','internal','market'));

-- Classify future claims automatically: a claim by a clearly-ours/test email stays 'test';
-- any other real-email claim promotes the default 'test' draft to 'market'. 'internal' is a
-- manual override Adrian applies for founders/family (email can't tell those from market).
create or replace function public.mark_test_on_claim()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_email text;
begin
  if new.owner_id is not null and (old.owner_id is null or old.owner_id is distinct from new.owner_id) then
    select lower(email) into v_email from auth.users where id = new.owner_id;
    if v_email is not null then
      if ( v_email like 'adriansmithee%' or v_email like 'adrian@brnno%'
        or v_email like '%@hublytest.dev' or v_email like 'test@%'
        or position('+' in split_part(v_email,'@',1)) > 0 ) then
        new.account_kind := 'test';
      elsif new.account_kind = 'test' then      -- default; a real-email claim = an outside signup
        new.account_kind := 'market';
      end if;                                    -- leave 'internal'/'market' untouched
    end if;
  end if;
  return new;
end; $$;
