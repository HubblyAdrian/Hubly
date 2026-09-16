-- THE GUARD CAN NOW STAY QUIET, SO ITS SILENCE HAS TO BE COUNTABLE.
--
-- 2026-09-16, Adrian's walk. seq 44 and seq 45 were written in the SAME hcFlushPersist batch,
-- to the microsecond (02:27:32.467109Z), and they contradict each other:
--
--   44  "Window washing is saved for September 17 at 8:00 PM."      <- the truth composer
--   45  "I didn't get those down — say them again?"                 <- the capture guard
--
-- The job row exists (created 02:27:29.951946Z). The write LANDED and the next sentence told
-- him it had not. The capture guard decided that from `relevant.length === 0` — it filtered the
-- turn's actions down to the ones that write THIS fact (setServices), found none, and read that
-- empty list as "the server never tried". The turn had run addJob. An empty list meant "nothing
-- I know how to look for", and it was read as "nothing happened" — the empty reader telling you
-- about itself (Lesson 86), one level down inside a guard.
--
-- The fix makes the guard yield to any turn that really changed something. That closes the
-- contradiction and OPENS a quiet direction: a genuine capture miss on a turn that also did
-- real work now goes unspoken. Per Lesson 89 the direction that says "this is fine" is the one
-- to red-proof hardest — so it is not merely unspoken, it is RECORDED. One column.
--
--   reasked  the miss was detected and Hubly asked again  (every row before today)
--   quiet    the miss was detected and Hubly said nothing (new, and the one to watch)
--
-- A spike in `quiet` is a real fact going uncaptured behind a successful turn. Without this
-- column that would be instance five of the failure-that-leaves-no-trace shape, created by the
-- fix for instance four.

alter table public.capture_miss_events
  add column if not exists outcome text;

-- EVERY EXISTING ROW IS A RE-ASK, and that is a fact about the CODE, not an assumption about
-- the rows: from 20260823120000 until today the only caller of record_capture_miss sat inside
-- the branch that speaks (public/platform-home.html, hcCheckCaptureMiss). There was no path
-- that recorded a miss without also asking again.
update public.capture_miss_events set outcome = 'reasked' where outcome is null;

alter table public.capture_miss_events
  drop constraint if exists capture_miss_events_outcome_check;
alter table public.capture_miss_events
  add constraint capture_miss_events_outcome_check
  check (outcome is null or outcome in ('reasked', 'quiet'));

-- THE OLD TWO-ARGUMENT FUNCTION GOES, so PostgREST cannot see two candidates for a two-argument
-- call and refuse both as ambiguous. A client still running the old page sends two arguments and
-- lands here with p_outcome defaulted to 'reasked' — which is exactly what that client does.
drop function if exists public.record_capture_miss(uuid, text);

create or replace function public.record_capture_miss(
  p_business_id uuid,
  p_asked_for   text,
  p_outcome     text default 'reasked'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_asked_for not in ('services','hours','area','phone') then
    return;  -- ignore anything outside the known vocabulary, never error the client
  end if;
  insert into public.capture_miss_events (business_id, asked_for, outcome)
  values (
    p_business_id,
    p_asked_for,
    case when p_outcome in ('reasked','quiet') then p_outcome else 'reasked' end
  );
end;
$$;

grant execute on function public.record_capture_miss(uuid, text, text) to anon, authenticated;

comment on column public.capture_miss_events.outcome is
  'reasked = Hubly asked again; quiet = the miss was detected and deliberately not spoken, '
  'because the turn had already changed something real and reported it. A rising quiet count '
  'is a fact going uncaptured with nothing said about it.';
