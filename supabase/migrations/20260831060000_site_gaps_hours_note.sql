-- has_hours must count BOTH forms of the fact: structured rows OR a free-text
-- hours_note ("weekends by appointment"). Otherwise the "Set your hours" Home
-- suggestion keeps nagging an owner who set a note. Same two-forms-of-one-fact
-- discipline as the hours-schedule detector (OPEN_FINDINGS #9).
create or replace function public.get_my_site_gaps(p_business_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case when b.id is null then null else jsonb_build_object(
    'has_phone',    coalesce(nullif(btrim(b.phone), ''), '') <> '',
    'has_hours',    (exists (select 1 from public.settings_business_hours h where h.business_id = b.id)
                     or coalesce(nullif(btrim(b.hours_note), ''), '') <> ''),
    'own_photos',   (select count(*) from public.service_photos p join public.services s on s.id = p.service_id where s.business_id = b.id),
    'services',     (select count(*) from public.services s where s.business_id = b.id),
    'services_no_desc', (select count(*) from public.services s where s.business_id = b.id and coalesce(nullif(btrim(s.description), ''), '') = ''),
    'has_priced_services', exists (select 1 from public.services s where s.business_id = b.id and s.price is not null and s.price > 0)
  ) end
  from (
    select id, phone, hours_note from public.businesses
    where id = p_business_id and owner_id = auth.uid()
  ) b;
$$;
revoke all on function public.get_my_site_gaps(uuid) from public, anon;
grant execute on function public.get_my_site_gaps(uuid) to authenticated;
