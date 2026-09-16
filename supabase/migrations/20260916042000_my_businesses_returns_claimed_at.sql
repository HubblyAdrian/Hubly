-- THE OWNED-BUSINESS READER CARRIES THE CLAIM DATE.
--
-- Without this, businesses.claimed_at (20260916040000) and the conversation reader's created_at
-- (20260916041000) both exist and the client still cannot compare them, because the business it
-- holds in memory has no claimed_at on it. The derivation would silently never fire and the
-- content regex would keep deciding — a fix that is present in the database and absent in
-- behaviour, which is the "missing door" shape.
--
-- ADDITIVE AND SAFE: this function returns jsonb, so adding a key changes no signature and needs
-- no drop. Every existing key is preserved exactly; `claimedAt` is appended.
--
-- NULL STAYS NULL. A business claimed before the column existed reports claimedAt: null, and the
-- client treats null as "unknown" rather than inventing a date.

create or replace function public.get_my_businesses()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(obj order by ord desc), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'id', b.id,
        'slug', b.slug,
        'name', b.name,
        'url', 'https://' || b.slug || '.myhubly.app',
        'draftToken', b.draft_token,
        'hasPage', exists (select 1 from public.business_documents d where d.business_id = b.id),
        'claimedAt', b.claimed_at,
        'updatedAt', coalesce(
          (select max(d.created_at) from public.business_documents d where d.business_id = b.id),
          b.created_at
        )
      ) as obj,
      b.created_at as ord
    from public.businesses b
    where b.owner_id = auth.uid()
  ) t;
$$;

revoke all on function public.get_my_businesses() from public, anon;
grant execute on function public.get_my_businesses() to authenticated;
