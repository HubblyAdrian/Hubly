-- Onboarding was hitting:
--   new row violates row-level security policy for table "businesses"
-- during the first save. Make authenticated owner INSERT/UPDATE explicit
-- and permissive alongside any existing "manage" policies.

alter table businesses enable row level security;

drop policy if exists "Owners can insert their own business" on businesses;
create policy "Owners can insert their own business"
  on businesses
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Owners can update their own business" on businesses;
create policy "Owners can update their own business"
  on businesses
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners can select their own business" on businesses;
create policy "Owners can select their own business"
  on businesses
  for select
  to authenticated
  using (owner_id = auth.uid());
