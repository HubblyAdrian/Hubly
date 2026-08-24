-- MAKE account_kind TRUSTWORTHY. It defaulted to 'real' for every draft made through the
-- normal flow, so a week of our own test drafts polluted every audit ratio (2026-08-23:
-- ~125 businesses, but only ~9 from real outside people). Three parts:
--
-- 1. Claim-time trigger: when a draft is claimed by an email that is clearly ours/testing
--    (adriansmithee%, +addressed, @hublytest.dev harness, test@%, adrian@brnno%), mark it
--    'test' automatically. A real claim is left 'real'.
-- 2. mark_business_test(id, draft_token): our test tooling calls this right after creating
--    a draft, so automated/unclaimed test drafts flag themselves at creation.
-- 3. Backfill: everything that isn't one of the 9 genuinely-real businesses -> 'test',
--    and the 9 -> 'real'. NOTE: 2 of the 9 (andres.mayorga1616@email.bakersfieldcollege.edu
--    — "Detailing Chemicals…" and "Mobile Auto Detailing in LA") are borderline (generic
--    names, college email); marked REAL deliberately, because wrongly excluding a genuine
--    user is worse than including a possible tester (each row is ~11% at N=9).

create or replace function public.mark_test_on_claim()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_email text;
begin
  if new.owner_id is not null and (old.owner_id is null or old.owner_id is distinct from new.owner_id) then
    select lower(email) into v_email from auth.users where id = new.owner_id;
    if v_email is not null and (
         v_email like 'adriansmithee%' or v_email like 'adrian@brnno%'
      or v_email like '%@hublytest.dev' or v_email like 'test@%'
      or position('+' in split_part(v_email, '@', 1)) > 0
    ) then
      new.account_kind := 'test';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_mark_test_on_claim on public.businesses;
create trigger trg_mark_test_on_claim before update on public.businesses
  for each row execute function public.mark_test_on_claim();

-- Creation-time flag: the draft-token holder (our test tooling) can mark its own draft.
create or replace function public.mark_business_test(p_business_id uuid, p_draft_token uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.businesses set account_kind = 'test'
   where id = p_business_id and draft_token = p_draft_token;
end; $$;
grant execute on function public.mark_business_test(uuid, uuid) to anon, authenticated;

-- Backfill (the 9 real ids captured 2026-08-23; andres x2 kept real, see note above).
update public.businesses set account_kind = 'test'
  where account_kind <> 'test' and id not in ('22a06e17-883e-42d6-a9f6-3ecdc694ce06','abda07ef-35cf-4f6e-b561-0a109f5545e3','64211e3a-93ee-4ee2-8182-fcf27d8febbf','7246aa18-5ec2-45b3-adde-0adf0cad9a54','e47ef0b8-4c9c-4c9b-bd94-5b5f4d22a2be','477bcec1-542d-4532-8a73-de75dd9ed3b8','172d4777-d2c5-4178-ba49-1c7e97f89270','456b3554-dad2-449e-9acb-31e8754e058f','b53382a2-4f02-4102-9a05-020c384237a2');
update public.businesses set account_kind = 'real'
  where id in ('22a06e17-883e-42d6-a9f6-3ecdc694ce06','abda07ef-35cf-4f6e-b561-0a109f5545e3','64211e3a-93ee-4ee2-8182-fcf27d8febbf','7246aa18-5ec2-45b3-adde-0adf0cad9a54','e47ef0b8-4c9c-4c9b-bd94-5b5f4d22a2be','477bcec1-542d-4532-8a73-de75dd9ed3b8','172d4777-d2c5-4178-ba49-1c7e97f89270','456b3554-dad2-449e-9acb-31e8754e058f','b53382a2-4f02-4102-9a05-020c384237a2');
