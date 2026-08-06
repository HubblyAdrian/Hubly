-- Fixes #390: an abandoned booking_requests row that never gets a clean
-- complete_abandoned_booking() resume (RPC rejection, or -- the more common
-- case -- the customer returns in a fresh session with no memory of the
-- old row) stays status='abandoned' forever, even after the same person
-- completes a real booking under a brand-new row. That orphan then shows
-- up permanently as an actionable "new" lead with a live "Text them"
-- button, double-counting one real customer.
--
-- This trigger runs at write time (AFTER INSERT on booking_requests, not a
-- periodic job) so it can't be missed by a future insert path, and keeps
-- the phone-matching logic in one place next to complete_abandoned_booking's
-- own guard rather than duplicated across client JS and edge functions.
--
-- Matching is deliberately conservative -- ALL of the following must hold,
-- and any ambiguity means "do nothing", not "guess":
--   1. Same business_id (hard boundary).
--   2. Normalized phone digits match exactly (same regexp_replace already
--      used in complete_abandoned_booking's own security guard).
--   3. Within 30 days of the abandoned row's created_at.
--   4. Name corroborates: exact match, OR one first-name token is a
--      *prefix* (not substring-anywhere -- "Ann" inside "Joanne" is not
--      corroboration) of the other, and the shorter token is at least 4
--      characters (kills "Jo"/"Joan", "Al"/"Alan" false positives while
--      still catching "Jacque"/"Jacquelyn").
--   5. Exactly one abandoned candidate matches -- if there's more than
--      one, skip rather than pick.
--
-- Resolution is a status flip + pointer, never a delete or merge: a wrong
-- match just silently un-hides a still-real lead (bounded, recoverable),
-- never destroys or corrupts data.
alter table public.booking_requests
  add column if not exists superseded_by uuid references public.booking_requests(id),
  add column if not exists superseded_at timestamptz;

comment on column public.booking_requests.superseded_by is
  'Set when this abandoned row is auto-matched to a later real booking from the same customer (see supersede_abandoned_booking_on_resume trigger). Points at the row that superseded it. Never set on non-abandoned rows.';
comment on column public.booking_requests.superseded_at is
  'Timestamp of the auto-match in superseded_by. Null unless superseded_by is set.';

create or replace function public.first_name_token(p_name text)
returns text
language sql
immutable
as $$
  select lower(trim(split_part(trim(coalesce(p_name, '')), ' ', 1)));
$$;

create or replace function public.names_corroborate(p_name_a text, p_name_b text)
returns boolean
language sql
immutable
as $$
  select
    case
      when public.first_name_token(p_name_a) = '' or public.first_name_token(p_name_b) = '' then false
      when public.first_name_token(p_name_a) = public.first_name_token(p_name_b) then true
      when length(public.first_name_token(p_name_a)) >= 4
           and left(public.first_name_token(p_name_b), length(public.first_name_token(p_name_a))) = public.first_name_token(p_name_a)
        then true
      when length(public.first_name_token(p_name_b)) >= 4
           and left(public.first_name_token(p_name_a), length(public.first_name_token(p_name_b))) = public.first_name_token(p_name_b)
        then true
      else false
    end;
$$;

create or replace function public.supersede_abandoned_booking_on_resume()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidates uuid[];
begin
  if NEW.status = 'abandoned' or NEW.customer_phone is null or trim(NEW.customer_phone) = '' then
    return NEW;
  end if;

  select array_agg(id) into v_candidates
  from public.booking_requests
  where business_id = NEW.business_id
    and status = 'abandoned'
    and id <> NEW.id
    and customer_phone is not null
    and regexp_replace(customer_phone, '\D', '', 'g') = regexp_replace(NEW.customer_phone, '\D', '', 'g')
    and created_at >= NEW.created_at - interval '30 days'
    and created_at <= NEW.created_at
    and public.names_corroborate(customer_name, NEW.customer_name);

  -- Ambiguous (0 or >1 candidates) -- do nothing rather than guess.
  if v_candidates is null or array_length(v_candidates, 1) <> 1 then
    return NEW;
  end if;

  update public.booking_requests
  set status = 'superseded',
      superseded_by = NEW.id,
      superseded_at = now()
  where id = v_candidates[1];

  return NEW;
end;
$$;

drop trigger if exists trg_supersede_abandoned_booking on public.booking_requests;
create trigger trg_supersede_abandoned_booking
  after insert on public.booking_requests
  for each row
  execute function public.supersede_abandoned_booking_on_resume();
