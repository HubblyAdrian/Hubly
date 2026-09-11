create table if not exists public.placement_outcomes (
  id bigserial primary key,
  fn text not null,
  branch text not null,
  business_id uuid,
  detail text,
  occurred_at timestamptz not null default now()
);
create index if not exists placement_outcomes_recent on public.placement_outcomes (occurred_at desc);
create index if not exists placement_outcomes_branch on public.placement_outcomes (fn, branch, occurred_at desc);
alter table public.placement_outcomes enable row level security;
comment on table public.placement_outcomes is
'THIS TABLE RECORDS ATTEMPTS, NOT FAILURES. A ROW IS NOT A PROBLEM. Every time Hubly tries to place something on a generated page — a business name, services, a photo, contact and hours — one row is written saying which branch it took, SUCCESS INCLUDED. Read it as a RATE: "12 no_anchor out of 340 placed" is the shape of a real answer; a bare count of one branch is not. The successes are here precisely so the denominator is never missing, and the table is not called degraded_outcomes for the same reason — a name that denies the successes exist is how a healthy rate gets read as a catastrophe. WHY IT EXISTS: the degraded branches were honest and invisible. The reply would tell ONE owner "the page still shows the old header for now" — a true and accurate failure report — and nothing anywhere counted it, so the photo placer degraded honestly for months while the feature was dead. A spike in a branch should be a bug report arriving the day it starts, not an hour of forensics after somebody screenshots a broken page. DEFERRED ON PURPOSE, 2026-09-10: price_extraction_miss_events and rebuild_outcome_events are earlier instances of this same idea, built one defect at a time. They SHOULD fold in here as branches. Migrating them the night this was written would have been risk for no information, so it was deliberately not done — this note exists so the next person finds the decision rather than rediscovering the problem and creating a fourth table.';

comment on column public.placement_outcomes.branch is
'THE BRANCH, NEVER THE SENTENCE. A branch name is a stable enum the code chose; the sentence shown to the owner is model prose that varies every turn, and counting prose is a detector over free text — the thing that reported "the name is never asked" at 0/4 when it was asked 4/4.';

comment on column public.placement_outcomes.detail is
'Short internal diagnostics — why this branch, in our words. Never the owner''s text, never page content, never anything a visitor typed.';

create or replace function public.record_placement_outcome(
  p_fn text, p_branch text, p_business_id uuid default null, p_detail text default null
) returns void language plpgsql security definer set search_path to 'public' as $fn$
begin
  insert into placement_outcomes (fn, branch, business_id, detail)
  values (coalesce(nullif(btrim(p_fn), ''), 'unknown'),
          coalesce(nullif(btrim(p_branch), ''), 'unknown'),
          p_business_id, left(coalesce(p_detail, ''), 200));
exception when others then
  null;
end;
$fn$;

revoke all on function public.record_placement_outcome(text, text, uuid, text) from public;
grant execute on function public.record_placement_outcome(text, text, uuid, text) to service_role;

create or replace function public.purge_placement_outcomes()
returns void language sql security definer set search_path to 'public' as $fn$
  delete from placement_outcomes where occurred_at < now() - interval '90 days';
$fn$;
select cron.schedule('purge-placement-outcomes-daily','52 4 * * *', $$ select public.purge_placement_outcomes(); $$);
