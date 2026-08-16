-- businesses.meta.depositUnit — give a flat deposit an explicit unit.
--
-- booking_engine.ts converted a flat deposit to cents by GUESSING the unit from
-- the magnitude:
--
--     Math.round(deposit_val * (deposit_val < 1000 ? 100 : 1))
--
-- Under 1000 was treated as dollars and multiplied by 100; 1000 or above was
-- treated as already-cents and passed through. There is no stored unit, so the
-- number's size was the only signal.
--
-- That breaks exactly where an owner is most likely to mean dollars. A business
-- setting a $1,000 flat deposit types 1000, the heuristic reads 1000 cents, and
-- the customer is charged $10. At 999 the same owner is correctly charged $999.
-- The cliff is invisible: the UI asks for a number with no unit attached.
--
-- This backfill writes the unit the heuristic WOULD have inferred, so applying
-- it changes nothing about what anyone is charged. It only makes the existing
-- interpretation explicit, which is what lets the guess be deleted from the code.
--
-- Exposure when written (2026-08-16, 19 businesses): 10 have a deposit config,
-- 9 are percentage (unaffected — the heuristic only touches flat), and exactly
-- 1 is flat, at depositVal = 20. Zero rows are at or above the 1000 cliff, so
-- this is as cheap as the correction will ever be.
--
-- NOTE ON THE COLUMN TYPE: businesses.meta is TEXT holding JSON, not jsonb.
-- (getBusinessMeta in _shared/hubly_business_meta.ts JSON.parses it and
-- tolerates malformed content rather than throwing.) So this cannot use the
-- jsonb operators directly — every read needs a cast, and a single malformed
-- row would abort a set-based UPDATE for everyone. The row loop below skips
-- unparseable meta the same way the application does, which also keeps this
-- working on any Postgres version rather than depending on IS JSON /
-- pg_input_is_valid (PG16+).

do $$
declare
  r record;
  m jsonb;
  unit text;
  updated int := 0;
  skipped int := 0;
begin
  for r in
    select id, meta
    from public.businesses
    where meta is not null
      and btrim(meta) <> ''
  loop
    begin
      m := r.meta::jsonb;
    exception when others then
      -- Malformed JSON in storage. The application already treats this as "no
      -- meta"; do the same rather than failing the migration for one bad row.
      skipped := skipped + 1;
      continue;
    end;

    if jsonb_typeof(m) is distinct from 'object' then
      skipped := skipped + 1;
      continue;
    end if;

    -- Only rows that have a deposit value and no unit yet.
    if not (m ? 'depositVal') or (m ? 'depositUnit') then
      continue;
    end if;

    -- Mirror the old heuristic exactly: >= 1000 meant "already cents".
    if (m ->> 'depositVal') ~ '^[0-9]+(\.[0-9]+)?$'
       and (m ->> 'depositVal')::numeric >= 1000 then
      unit := 'cents';
    else
      unit := 'dollars';
    end if;

    update public.businesses
    set meta = jsonb_set(m, '{depositUnit}', to_jsonb(unit), true)::text
    where id = r.id;

    updated := updated + 1;
  end loop;

  raise notice 'depositUnit backfill: % row(s) updated, % skipped (unparseable or not an object)', updated, skipped;
end $$;

comment on column public.businesses.meta is
  'Business settings blob, stored as TEXT containing JSON (parsed by '
  'getBusinessMeta). meta.depositUnit (''dollars'' | ''cents'') states how '
  'meta.depositVal should be read for a flat deposit. Absent means dollars — it '
  'must never be inferred from the number''s magnitude again (see '
  'docs/KNOWN_ISSUES.md).';
