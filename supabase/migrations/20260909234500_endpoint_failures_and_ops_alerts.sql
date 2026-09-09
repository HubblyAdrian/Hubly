-- THE REFUSAL WRITES A ROW, SO SOMEBODY CAN BE TOLD.
--
-- hubly-conversation's catch block returned an honest 502 to the visitor and then did
-- console.error and nothing else. On 2026-09-09 the OpenAI account emptied twice and
-- both times the way we found out was a test script — the second time, hours in. Every
-- refusal branch writes a row (the standing ruling); this is that row for the endpoint
-- that matters most, and it is what the alert reads.
--
-- Deliberately NOT a synthetic probe: a probe on a schedule spends model quota
-- continuously, and quota is the scarce thing. This costs nothing and counts the
-- failures real people actually hit.

create table if not exists public.endpoint_failures (
  id bigserial primary key,
  fn text not null,                 -- which function refused
  detail text,                      -- the upstream message, already truncated by the caller
  upstream_status int,              -- 429 quota, 401 rotated key, 500 provider — three different problems
  context text,                     -- 'owner' signup vs 'customer' chat: same outage, different victim
  occurred_at timestamptz not null default now()
);

create index if not exists endpoint_failures_recent
  on public.endpoint_failures (occurred_at desc);

-- Nobody but the service role touches this. It records our own breakages; a visitor
-- has no reason to read it and no reason to be able to write it.
alter table public.endpoint_failures enable row level security;

-- WHAT HAS ALREADY BEEN SAID, so an outage sends one email and not one every ten
-- minutes for as long as it lasts. Keyed by alert kind; the cron reads last_sent_at
-- before deciding to speak.
create table if not exists public.ops_alerts (
  kind text primary key,
  last_sent_at timestamptz,
  last_detail text
);
alter table public.ops_alerts enable row level security;

-- Recording a failure must never itself fail the request path, and must never need the
-- caller to hold write rights on the table. SECURITY DEFINER, no return value anyone
-- waits on.
create or replace function public.record_endpoint_failure(
  p_fn text,
  p_detail text default null,
  p_upstream_status int default null,
  p_context text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into endpoint_failures (fn, detail, upstream_status, context)
  values (coalesce(nullif(trim(p_fn), ''), 'unknown'), left(coalesce(p_detail, ''), 300),
          p_upstream_status, nullif(trim(coalesce(p_context, '')), ''));
exception when others then
  -- A failure to record a failure is not worth failing a request over.
  null;
end;
$$;

revoke all on function public.record_endpoint_failure(text, text, int, text) from public;
grant execute on function public.record_endpoint_failure(text, text, int, text) to service_role;
