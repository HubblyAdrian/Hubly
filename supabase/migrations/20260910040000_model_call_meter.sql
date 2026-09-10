-- THE METER. One row per real provider call, with what it actually cost.
--
-- The burn alert counts DRAFTS PER HOUR, which is a proxy for one consumer out of
-- eighteen. It cannot see a cron, a retry, the customer chat on every live business site,
-- a page regeneration, or an unauthenticated endpoint. Three guards have now been built
-- well and aimed at a fraction of the surface: the rate limit counted our own egress IP,
-- the burn alert counts drafts instead of spend, and nobody had enumerated which
-- functions can reach the model until asked.
--
-- CALL COUNTS ARE NOT ENOUGH. A one-line reply and a full page generation are both "one
-- call" and differ by orders of magnitude. The usage numbers come back in the provider's
-- own response body, so they are free to record — a meter that says how OFTEN without
-- saying how MUCH cannot answer "why did we spend that".
--
-- Not for catching a leak. For making the next "why did we spend that" a query instead of
-- an evening.
create table if not exists public.model_calls (
  id bigserial primary key,
  fn text,                      -- which edge function (best effort; the provider layer does not always know)
  feature text,                 -- HublyAI feature, e.g. website_builder
  task text,                    -- chat / reason / website_builder ...
  provider text not null,
  model text,
  status int,                   -- upstream HTTP status; null when the call threw before a response
  ok boolean not null,
  attempt int,                  -- which retry produced this row: a failed attempt is still a call
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  latency_ms int,
  business_id uuid,
  occurred_at timestamptz not null default now()
);

create index if not exists model_calls_recent on public.model_calls (occurred_at desc);
create index if not exists model_calls_feature on public.model_calls (feature, occurred_at desc);

-- Internal only, same as endpoint_failures and first_turn_outcomes: RLS on, no policies.
alter table public.model_calls enable row level security;

create or replace function public.record_model_call(
  p_fn text, p_feature text, p_task text, p_provider text, p_model text,
  p_status int, p_ok boolean, p_attempt int,
  p_prompt_tokens int, p_completion_tokens int, p_total_tokens int,
  p_latency_ms int, p_business_id uuid default null
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into model_calls (fn, feature, task, provider, model, status, ok, attempt,
                           prompt_tokens, completion_tokens, total_tokens, latency_ms, business_id)
  values (p_fn, p_feature, p_task, coalesce(nullif(trim(p_provider),''),'unknown'), p_model,
          p_status, coalesce(p_ok,false), p_attempt,
          p_prompt_tokens, p_completion_tokens, p_total_tokens, p_latency_ms, p_business_id);
exception when others then
  null;  -- metering a call must never fail the call
end;
$$;

revoke all on function public.record_model_call(text,text,text,text,text,int,boolean,int,int,int,int,int,uuid) from public;
grant execute on function public.record_model_call(text,text,text,text,text,int,boolean,int,int,int,int,int,uuid) to service_role;

-- Ninety days of spend history is plenty to answer "what does a normal week look like",
-- and these rows carry no visitor content — only our own cost.
create or replace function public.purge_model_calls()
returns void language sql security definer set search_path to 'public' as $$
  delete from model_calls where occurred_at < now() - interval '90 days';
$$;
select cron.schedule('purge-model-calls-daily', '41 4 * * *', $$ select public.purge_model_calls(); $$);
