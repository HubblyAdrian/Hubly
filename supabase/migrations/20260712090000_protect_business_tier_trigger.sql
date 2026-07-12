-- Supersedes 20260712060000_lock_business_tier_column.sql's
-- `revoke insert (tier), update (tier) on businesses from anon,
-- authenticated` -- confirmed ineffective. anon/authenticated hold
-- their write access to businesses via a table-wide GRANT (Supabase's
-- default `GRANT ALL ON ALL TABLES IN SCHEMA public`), not a
-- column-level grant, so a column-level REVOKE had nothing to remove:
-- information_schema.column_privileges still showed anon/authenticated
-- with full INSERT/UPDATE on tier after that migration ran, and a live
-- PATCH including tier:'pro' still succeeded. A trigger enforces the
-- restriction regardless of which grant mechanism a role's broader
-- access comes from, so it isn't defeated the same way.
create or replace function _protect_business_tier()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'UPDATE' and new.tier is distinct from old.tier)
     or (tg_op = 'INSERT' and new.tier is distinct from 'starter') then
    if current_user in ('anon','authenticated') then
      raise exception 'permission denied: tier can only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_business_tier
before insert or update on businesses
for each row execute function _protect_business_tier();
