-- TEMPORARY measurement (dropped immediately after in 20260822100100).
-- Extracts the body/hero background colour of the latest stored page per
-- business, IN SQL, so no full page HTML is ever exposed to anon. Used once to
-- quantify the "every page comes out cream" palette default, then removed.
create or replace function public._measure_page_backgrounds()
returns table(name text, body_bg text, first_bg text, hero_bg text)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.name,
    (regexp_match(d.rendered_html, 'body[^{]*\{[^}]*?background(?:-color)?\s*:\s*(#[0-9a-f]{3,6})', 'i'))[1] as body_bg,
    (regexp_match(d.rendered_html, 'background(?:-color)?\s*:\s*(#[0-9a-f]{3,6})', 'i'))[1] as first_bg,
    (regexp_match(d.rendered_html, '\.hero[^{]*\{[^}]*?background(?:-color)?\s*:\s*(#[0-9a-f]{3,6})', 'i'))[1] as hero_bg
  from public.businesses b
  join lateral (
    select rendered_html
    from public.business_documents dd
    where dd.business_id = b.id and dd.rendered_html is not null
    order by version desc
    limit 1
  ) d on true
  order by b.created_at desc
  limit 80;
$$;

grant execute on function public._measure_page_backgrounds() to anon, authenticated;
