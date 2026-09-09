-- The greeting's page-view figure, through the same reader everything else uses.
-- Bots and owner previews excluded HERE so no surface can forget to: measured 2026-09-08,
-- 54 of 135 page_loads rows were device_class='bot' and 49 were owner previews. Only 32
-- were real visits. "N people looked at your page" is a claim about humans and has to be one.
create or replace function public.get_business_traffic(p_business_id uuid, p_owner_id uuid)
returns table (day date, people bigint)
language plpgsql security definer set search_path = public as $$
begin
  if p_owner_id is null or not exists (
    select 1 from public.businesses where id = p_business_id and owner_id = p_owner_id
  ) then return; end if;
  return query
    select pl.loaded_day as day, count(distinct pl.visitor_hash) as people
    from public.page_loads pl
    where pl.business_id = p_business_id
      and pl.is_owner_preview = false
      and coalesce(pl.device_class, '') <> 'bot'
      and pl.loaded_day >= (current_date - 14)
    group by pl.loaded_day
    having count(distinct pl.visitor_hash) > 0
    order by pl.loaded_day desc
    limit 14;
end; $$;
revoke all on function public.get_business_traffic(uuid, uuid) from public, anon;
grant execute on function public.get_business_traffic(uuid, uuid) to authenticated, service_role;
