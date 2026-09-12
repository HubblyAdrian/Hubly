-- WHY DID A SERVICE NOT LAND? Read the row; do not reconstruct the story from the chat.
--   supabase db query --linked -f scripts/queries/placement.sql
--
-- Exists because on 2026-09-12 an owner was told two contradictory things about his page
-- and placement_outcomes had NOTHING to say, since only the name placer was wired. Every
-- services branch writes a row now.
--
-- THIS TABLE RECORDS ATTEMPTS, NOT FAILURES. A row is not a problem. Read it as a rate —
-- the successes are here so the denominator is never missing.
select 'recent' as section, to_char(p.occurred_at,'MM-DD HH24:MI:SS') as at,
       coalesce(b.slug,'(deleted)') as business, p.fn, p.branch,
       left(coalesce(p.detail,''),60) as detail, null::bigint as n
from placement_outcomes p left join businesses b on b.id=p.business_id
where p.occurred_at > now() - interval '3 days'
union all
select 'rate_7d', null, null, fn, branch, null, count(*)
from placement_outcomes where occurred_at > now() - interval '7 days'
group by fn, branch
order by 1 desc, 2 desc nulls last, 7 desc nulls last
limit 40;
