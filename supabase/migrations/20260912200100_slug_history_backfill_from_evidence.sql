-- BACKFILL, FROM EVIDENCE ONLY.
--
-- Six stored pages carry a link to https://<old-slug>.myhubly.app/?book=1 — the address the
-- draft had when the page was generated, before the owner named the business. That link IS
-- the evidence: the generator wrote the business's own address into its own page, so the
-- host in the page is that business's former slug, not a guess.
--
-- Nothing else is backfilled. A business whose old slug is not evidenced somewhere gets no
-- row: an invented history is worse than an empty table, because an empty table is honest
-- about knowing nothing.
--
-- Every row here is marked reconstructed = true and carries renamed_by = null. renamed_at is
-- the time of THIS backfill, not of the rename — the rename time is not recoverable from the
-- page, and writing a plausible one would be exactly the fabrication this project keeps
-- paying for.
insert into public.business_slug_history (business_id, old_slug, new_slug, renamed_by, was_claimed, reconstructed)
select b.id,
       m.host             as old_slug,
       b.slug             as new_slug,
       null::uuid         as renamed_by,
       (b.owner_id is not null) as was_claimed,
       true               as reconstructed
from businesses b
join lateral (
  select d.rendered_html
  from business_documents d
  where d.business_id = b.id and d.rendered_html is not null
  order by d.version desc limit 1
) doc on true
join lateral (
  -- The distinct myhubly.app hosts named in the page that are NOT this business's own slug.
  select distinct lower((regexp_matches(doc.rendered_html, 'https?://([a-z0-9-]+)\.myhubly\.app', 'gi'))[1]) as host
) m on true
where m.host <> b.slug
  and m.host ~ '^site-[0-9a-f]{6}$'          -- only a generated temporary slug, never a real one
  and not exists (
    select 1 from public.business_slug_history h
    where h.business_id = b.id and h.old_slug = m.host
  );
