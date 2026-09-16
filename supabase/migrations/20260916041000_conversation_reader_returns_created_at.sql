-- THE CONVERSATION READER RETURNS WHEN EACH ROW WAS WRITTEN.
--
-- ══ WHY ═══════════════════════════════════════════════════════════════════════════════════
--
-- businesses.claimed_at (migration 20260916040000) records WHEN a business was claimed, so
-- "was this message written before the claim" is now a timestamp comparison rather than the
-- content regex that was measured wrong 1 time in 3 on the market set. But the client cannot
-- make that comparison: this reader returns (seq, role, content) and no date.
--
-- So the reader returns created_at. Nothing else about it changes — same argument, same
-- security definer, same ownership gate (b.owner_id = auth.uid()), same ordering.
--
-- ══ WHY DROP AND RECREATE ═════════════════════════════════════════════════════════════════
--
-- A function's RETURNS TABLE shape cannot be altered by CREATE OR REPLACE; Postgres refuses
-- with "cannot change return type of existing function". Dropping is therefore required, and
-- it is the risky half of this file — between the DROP and the CREATE the function does not
-- exist, and a client calling it in that window gets an error and falls back to an empty
-- conversation. Both statements are in ONE file so they run in one transaction, which closes
-- that window.
--
-- ══ WHAT READS IT ═════════════════════════════════════════════════════════════════════════
--
-- public/platform-home.html, the claimed-owner restore. Adding a column to a returned table is
-- additive for a caller that names its fields (m.seq, m.role, m.content), which this one does.

drop function if exists public.get_my_business_conversation(uuid);

create function public.get_my_business_conversation(p_business_id uuid)
returns table(seq integer, role text, content jsonb, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select c.seq, c.role, c.content, c.created_at
  from public.business_conversations c
  join public.businesses b on b.id = c.business_id
  where c.business_id = p_business_id
    and b.owner_id = auth.uid()
  order by c.seq asc;
$$;

revoke all on function public.get_my_business_conversation(uuid) from public, anon;
grant execute on function public.get_my_business_conversation(uuid) to authenticated;
