-- Lets a Business in Progress (see 20260803120000_business_in_progress.sql)
-- get real rows in the real `services` table -- the one the public renderer
-- already reads via loadServicesFromDb() -- instead of services staying
-- text-only in conversation. Same security shape as
-- patch_business_in_progress: narrow SECURITY DEFINER function, draft_token
-- required, only works while the business is still unclaimed.
--
-- Replace semantics, not append: each call supplies the complete current
-- service list (same convention as Business Understanding array patches --
-- "array fields REPLACE the previous value entirely") so re-describing
-- services as the conversation refines never produces duplicates or stale
-- rows.

create or replace function set_business_draft_services(
  p_id uuid,
  p_draft_token uuid,
  p_services jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row businesses%rowtype;
  v_item jsonb;
  v_count int := 0;
  v_sort int := 0;
begin
  select * into v_row from businesses where id = p_id;

  if not found
     or v_row.owner_id is not null
     or v_row.draft_token is null
     or v_row.draft_token is distinct from p_draft_token
     or jsonb_typeof(p_services) is distinct from 'array'
  then
    return jsonb_build_object('ok', false);
  end if;

  delete from services where business_id = p_id;

  for v_item in select * from jsonb_array_elements(p_services)
  loop
    if coalesce(trim(v_item->>'name'), '') = '' then
      continue;
    end if;
    insert into services (business_id, name, description, price, duration_hours, sort_order)
    values (
      p_id,
      trim(v_item->>'name'),
      nullif(v_item->>'description', ''),
      coalesce((v_item->>'price')::numeric, 0),
      nullif(v_item->>'durationHours', '')::numeric,
      v_sort
    );
    v_count := v_count + 1;
    v_sort := v_sort + 1;
  end loop;

  return jsonb_build_object('ok', true, 'id', p_id, 'slug', v_row.slug, 'count', v_count);
end;
$$;

grant execute on function set_business_draft_services(uuid, uuid, jsonb) to anon, authenticated;
revoke all on function set_business_draft_services(uuid, uuid, jsonb) from public;
