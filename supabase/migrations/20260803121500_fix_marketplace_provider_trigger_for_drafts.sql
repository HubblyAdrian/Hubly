-- ensure_marketplace_provider_for_business (marketplace_foundation) assumed
-- every business always has a real owner_id at insert time -- true until
-- Business in Progress started creating rows with owner_id null
-- (20260803120000_business_in_progress.sql). Two real fixes, not a
-- workaround around the symptom:
--
-- 1. Skip the marketplace_providers insert when there's no owner yet --
--    nothing real to attach a provider to.
-- 2. Run the same logic on the transition that was always missing: when a
--    business gets claimed later (owner_id set from null to a real value).
--    This was a latent gap even before Business in Progress existed -- every
--    business has always gotten owner_id at INSERT time until now, so this
--    UPDATE path was simply never exercised.

create or replace function public.ensure_marketplace_provider_for_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is null then
    return new;
  end if;
  insert into public.marketplace_providers (business_id, owner_id, provider_kind)
  values (new.id, new.owner_id, 'hubly')
  on conflict (business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_businesses_ensure_marketplace_provider_claim on public.businesses;
create trigger trg_businesses_ensure_marketplace_provider_claim
  after update of owner_id on public.businesses
  for each row
  when (old.owner_id is null and new.owner_id is not null)
  execute function public.ensure_marketplace_provider_for_business();
