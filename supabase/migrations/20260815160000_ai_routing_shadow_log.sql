-- AI routing shadow log — Phase 1 of the Hubly AI Operating Layer.
--
-- The router runs BESIDE the live system and changes nothing. This table records
-- the one thing Phase 1 exists to measure: where surface-driven routing and
-- intent-driven routing disagree, and where the router is uncertain.
--
-- PRIVACY. Utterances are redacted before they reach here (emails, phones,
-- addresses and URLs replaced — see redactUtterance in hubly_routing_shadow.ts)
-- and are NULL for customer-facing conversations entirely. Businesses are
-- referenced by id, never by name. No customer PII is stored.
--
-- Write-only from the service role; nothing reads it in the request path, so a
-- failure here can never affect a live conversation.

create table if not exists public.ai_routing_shadow_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,
  actor_kind text not null check (actor_kind in ('anonymous','owner','customer')),
  surface_hint text,

  -- redacted; null for customer turns
  utterance text,
  utterance_length integer,

  legacy_context text not null,
  legacy_capabilities text[] not null default '{}',

  router_intent text not null,
  router_confidence numeric not null,
  router_capabilities text[] not null default '{}',
  router_steps text[] not null default '{}',
  router_asked boolean not null default false,
  router_ask_resolves text,
  router_requires_confirmation boolean not null default false,
  router_rationale text,

  -- the headline metric
  agreement text not null
    check (agreement in ('match','router_narrower','router_wider','disagree','router_unclear')),
  capabilities_only_in_router text[] not null default '{}',
  capabilities_only_in_legacy text[] not null default '{}',
  why text,

  -- was a question fair, given what Hubly already knew?
  context_available jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

comment on table public.ai_routing_shadow_log is
  'Phase 1 shadow-mode observations of the Hubly intent router. Records old-vs-new routing agreement only; nothing reads it in the request path and it never influences behaviour. Utterances are redacted and omitted entirely for customer conversations.';

create index if not exists ai_routing_shadow_log_agreement_idx
  on public.ai_routing_shadow_log(agreement, created_at desc);
create index if not exists ai_routing_shadow_log_intent_idx
  on public.ai_routing_shadow_log(router_intent, created_at desc);
create index if not exists ai_routing_shadow_log_business_idx
  on public.ai_routing_shadow_log(business_id, created_at desc);

alter table public.ai_routing_shadow_log enable row level security;

-- No anon policy and no owner policy: this is internal telemetry, written by the
-- service role and read by Hubly staff through the service role only. A business
-- owner has no reason to read routing telemetry, and anon certainly does not.
