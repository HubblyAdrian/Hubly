-- Correction (2026-08-25): the previous claim trigger promoted an unrecognized real-email
-- claim straight to 'market' and left 'internal' as a manual override Adrian had to remember
-- — i.e. the category defaulted to the FLATTERING value and the honest one required action.
-- That is exactly how account_kind defaulted to 'real' and cost a week, rebuilt one level up.
--
-- Fix: 'market' still means "claimed with a real email", but a new boolean owner_identified
-- (default FALSE) records whether a human has actually confirmed who the owner is. Market
-- numbers now report both — "6 market, of which N identified" — so an unconfirmed claim is
-- counted honestly as unidentified until Adrian says otherwise. The default is the honest
-- value; confirmation is the manual action, not the other way round.
--
-- Also: jjake486@gmail.com / "My Auto Detailing" is a FOUNDER (Adrian, 2026-08-25) -> internal.
-- New counts: market 6, internal 3, test 121. The ONLY market owner Adrian does not recognize
-- is andres.mayorga1616@email.bakersfieldcollege.edu (built two sites 2026-08-22).

alter table public.businesses
  add column if not exists owner_identified boolean not null default false;
comment on column public.businesses.owner_identified is
  'TRUE only once a human has confirmed who this owner is. A category describing people must '
  'not default to the flattering value: a real-email claim lands market/owner_identified=false '
  'and stays unidentified until confirmed. Report market counts as "N market, M identified".';

-- jjake486 is a founder -> internal.
update public.businesses set account_kind = 'internal'
 where owner_id in (select id from auth.users where lower(email) = 'jjake486@gmail.com');

-- Everyone Adrian has named (all current market + internal) is identified; the one owner he
-- does not recognize (andres.mayorga) is not.
update public.businesses set owner_identified = true  where account_kind in ('market','internal');
update public.businesses set owner_identified = false
 where owner_id in (select id from auth.users where lower(email) = 'andres.mayorga1616@email.bakersfieldcollege.edu');

-- Claim trigger: test email -> 'test'; any other real-email claim -> 'market' but leaves
-- owner_identified at its default FALSE. Only a hand-classification ever sets it true.
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
      elsif new.account_kind = 'test' then
        new.account_kind := 'market';   -- claimed, real email, but owner_identified stays false
      end if;
    end if;
  end if;
  return new;
end; $$;
