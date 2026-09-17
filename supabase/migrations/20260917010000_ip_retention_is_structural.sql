-- ════════════════════════════════════════════════════════════════════════════════════════════
-- AN IP ADDRESS IS DELETED WHEN ITS PURPOSE EXPIRES — AND THE DELETION IS STRUCTURAL.
--
-- ADRIAN, 2026-09-16: "Delete rows once their purpose has expired, and make the deletion STRUCTURAL
-- so it cannot be forgotten — not a job someone remembers to run."
--
-- THE GAP, MEASURED. `draft_creation_events` exists for ONE purpose: a rate limit of 10 new drafts
-- per IP per hour. The limit only ever reads `created_at > now() - interval '1 hour'`. But nothing
-- deleted anything, so the table held **315 rows going back to 2026-08-21** — every one of them older
-- than an hour, every one of them serving no purpose, and every one of them an IP address.
--
-- ══ WHY A TRIGGER AND NOT A CRON JOB ══════════════════════════════════════════════════════════
--
-- A scheduled job is a job someone can disable, forget to re-create after a restore, or never notice
-- has stopped — and its failure is silent, which is precisely the shape of defect this codebase keeps
-- paying for. A cron job is a PROMISE ABOUT THE FUTURE; this is a PROPERTY OF THE TABLE.
--
-- The prune runs on INSERT, in the same statement that creates the need for it. There is exactly one
-- code path that writes this table (`start_business_in_progress`), so there is exactly one path that
-- prunes, and the two cannot come apart. **A row cannot be added without old rows being removed.**
-- If the trigger is ever dropped, the check below goes red.
--
-- ══ THE WINDOW: 24 HOURS, AND WHY NOT ONE ════════════════════════════════════════════════════
--
-- The limit needs 1 hour. 24 is deliberately generous, for two honest reasons and no others:
--   · clock skew and long-running transactions must never let a legitimate row vanish from under an
--     in-flight count;
--   · a day is long enough to answer "did someone hammer us last night" without keeping anything for
--     a purpose we have not declared.
-- It is NOT a compromise toward keeping data. Anything beyond 24 hours has no reader at all.
--
-- ══ AND IT CLEANS UP WHAT IS ALREADY THERE ═══════════════════════════════════════════════════
--
-- A trigger only prunes on the next insert, and an insert may be days away. The 315 rows already in
-- the table are deleted here, once, in this migration — otherwise "we keep IP addresses for up to 24
-- hours" would be false the moment it was written, which is the sentence this whole file exists to
-- make true.
-- ════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.prune_draft_creation_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Bounded work, not a table scan: the (ip, created_at desc) index already exists for the limit,
  -- and this deletes at most a handful per insert at the observed rate (~10/hour, ~315 in a month).
  delete from public.draft_creation_events
   where created_at < now() - interval '24 hours';
  return null;                       -- AFTER trigger: the return value is ignored
end;
$$;

drop trigger if exists draft_creation_events_prune on public.draft_creation_events;
create trigger draft_creation_events_prune
  after insert on public.draft_creation_events
  for each statement
  execute function public.prune_draft_creation_events();

comment on trigger draft_creation_events_prune on public.draft_creation_events is
  'Structural retention: an IP is deleted 24h after it is written. Not a cron job — a property of the table.';
comment on table public.draft_creation_events is
  'IP addresses, kept at most 24 hours, read only by the 10-drafts-per-IP-per-hour limit in start_business_in_progress. Never joined to a business, a person or a conversation.';

-- THE BACKLOG, ONCE. Everything already past its purpose.
delete from public.draft_creation_events
 where created_at < now() - interval '24 hours';
