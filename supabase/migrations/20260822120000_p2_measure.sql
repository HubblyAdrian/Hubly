-- TEMPORARY P2 measurement (dropped immediately in 20260822120100). Answers, from
-- real data: (1) do services rows carry prices the owner never stated? (compare each
-- priced service against that business's USER transcript messages), and (2) has any
-- page price drifted from its record? (is each service's price still printed on the
-- stored page). Also returns the services table's column list so we can see whether a
-- confirmed/guessed flag or an updated_at already exists. Read-only aggregates.
create or replace function public._p2_measure()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  b record; s record;
  v_page text; v_user text;
  v_price int; v_pat text;
  v_on_page boolean; v_in_user boolean; v_has_conv boolean; v_page_has_price boolean;
  total_priced int := 0; owner_stated int := 0; suspect int := 0;
  no_transcript int := 0; printed int := 0; not_printed int := 0;
  suspects jsonb := '[]'::jsonb; drifts jsonb := '[]'::jsonb;
  cols text[];
begin
  select array_agg(column_name::text order by column_name) into cols
  from information_schema.columns where table_schema='public' and table_name='services';

  for b in select id, name from businesses loop
    select rendered_html into v_page from business_documents
      where business_id=b.id and rendered_html is not null order by version desc limit 1;
    select string_agg(content::text, ' ') into v_user from business_conversations
      where business_id=b.id and role='user';
    v_has_conv := v_user is not null;
    v_page_has_price := v_page is not null and v_page ~ '\$[0-9]';

    for s in select name, price from services where business_id=b.id and price is not null and price>0 loop
      total_priced := total_priced + 1;
      v_price := floor(s.price)::int;
      v_pat := '(^|[^0-9])' || v_price || '([^0-9]|$)';
      v_on_page := v_page is not null and v_page ~ v_pat;
      v_in_user := v_user is not null and v_user ~ v_pat;

      if v_in_user then owner_stated := owner_stated + 1;
      elsif v_has_conv then
        suspect := suspect + 1;
        suspects := suspects || jsonb_build_object('biz',b.name,'service',s.name,'price',s.price,'onPage',v_on_page);
      else no_transcript := no_transcript + 1;
      end if;

      if v_on_page then printed := printed + 1;
      elsif v_page_has_price then
        not_printed := not_printed + 1;
        drifts := drifts || jsonb_build_object('biz',b.name,'service',s.name,'price',s.price);
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'services_columns', cols,
    'total_priced_services', total_priced,
    'price_stated_in_user_transcript', owner_stated,
    'suspect_never_stated_but_transcript_exists', suspect,
    'no_transcript_to_check', no_transcript,
    'price_printed_on_page', printed,
    'price_absent_from_page_that_prints_prices', not_printed,
    'suspects', suspects,
    'drift_candidates', drifts
  );
end$$;

grant execute on function public._p2_measure() to anon, authenticated;
