-- HOME's "what your site still needs" — the honest, high-value recap. Every field here is a
-- real gap read from the record, owner-scoped to auth.uid(). It reports what is MISSING, not
-- activity (bookings/customers/revenue are zero for every business, so a recap of them is a
-- recap of nothing). A thin page is why generated pages look sparse; these gaps are the levers
-- that exist before any demand shows up. Business FACTS stay conversational — this returns
-- counts/flags to decide which suggestion is EARNED, never a second copy of the data itself.
create or replace function public.get_my_site_gaps(p_business_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case when b.id is null then null else jsonb_build_object(
    'has_phone',    coalesce(nullif(btrim(b.phone), ''), '') <> '',
    'has_hours',    exists (select 1 from public.settings_business_hours h where h.business_id = b.id),
    'own_photos',   (select count(*) from public.service_photos p join public.services s on s.id = p.service_id where s.business_id = b.id),
    'services',     (select count(*) from public.services s where s.business_id = b.id),
    'services_no_desc', (select count(*) from public.services s where s.business_id = b.id and coalesce(nullif(btrim(s.description), ''), '') = ''),
    'has_priced_services', exists (select 1 from public.services s where s.business_id = b.id and s.price is not null and s.price > 0)
  ) end
  from (
    select id, phone from public.businesses
    where id = p_business_id and owner_id = auth.uid()
  ) b;
$$;
revoke all on function public.get_my_site_gaps(uuid) from public, anon;
grant execute on function public.get_my_site_gaps(uuid) to authenticated;
