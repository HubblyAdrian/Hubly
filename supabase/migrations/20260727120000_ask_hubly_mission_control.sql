-- Ask Hubly Mission Control (Stage 2 schema foundation)
-- Stage 1 Operate UI continues to use S.askHublyOs in journey.js.
-- These tables support future live LLM / action logging without owning
-- customers, jobs, payments, leads, or campaigns row clones (Rule #19/#22).

create extension if not exists pgcrypto;

create table if not exists public.ask_hubly_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  title text not null default 'Ask Hubly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ask_hubly_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ask_hubly_conversations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ask_hubly_ai_actions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  status text not null check (status in ('proposed', 'confirmed', 'cancelled', 'executed', 'failed')),
  requires_confirm boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  note text,
  pending_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.ask_hubly_insights (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  body text not null,
  priority int not null default 0,
  delta_pct numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.ask_hubly_activity_feed (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null,
  label text not null,
  meta text,
  href text,
  created_at timestamptz not null default now()
);

comment on table public.ask_hubly_conversations is
  'Ask Hubly conversation threads. Operational rows stay in owner modules.';
comment on table public.ask_hubly_ai_actions is
  'Append-only Ask Hubly action log for confirmation + audit (Rule #22).';

create index if not exists ask_hubly_conversations_business_idx
  on public.ask_hubly_conversations (business_id, updated_at desc);
create index if not exists ask_hubly_messages_conversation_idx
  on public.ask_hubly_messages (conversation_id, created_at);
create index if not exists ask_hubly_ai_actions_business_idx
  on public.ask_hubly_ai_actions (business_id, created_at desc);
create index if not exists ask_hubly_insights_business_idx
  on public.ask_hubly_insights (business_id, created_at desc);
create index if not exists ask_hubly_activity_feed_business_idx
  on public.ask_hubly_activity_feed (business_id, created_at desc);

alter table public.ask_hubly_conversations enable row level security;
alter table public.ask_hubly_messages enable row level security;
alter table public.ask_hubly_ai_actions enable row level security;
alter table public.ask_hubly_insights enable row level security;
alter table public.ask_hubly_activity_feed enable row level security;

drop policy if exists ask_hubly_conversations_select_owner on public.ask_hubly_conversations;
create policy ask_hubly_conversations_select_owner on public.ask_hubly_conversations for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));
drop policy if exists ask_hubly_conversations_insert_owner on public.ask_hubly_conversations;
create policy ask_hubly_conversations_insert_owner on public.ask_hubly_conversations for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));
drop policy if exists ask_hubly_conversations_update_owner on public.ask_hubly_conversations;
create policy ask_hubly_conversations_update_owner on public.ask_hubly_conversations for update
  using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists ask_hubly_messages_select_owner on public.ask_hubly_messages;
create policy ask_hubly_messages_select_owner on public.ask_hubly_messages for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));
drop policy if exists ask_hubly_messages_insert_owner on public.ask_hubly_messages;
create policy ask_hubly_messages_insert_owner on public.ask_hubly_messages for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists ask_hubly_ai_actions_select_owner on public.ask_hubly_ai_actions;
create policy ask_hubly_ai_actions_select_owner on public.ask_hubly_ai_actions for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));
drop policy if exists ask_hubly_ai_actions_insert_owner on public.ask_hubly_ai_actions;
create policy ask_hubly_ai_actions_insert_owner on public.ask_hubly_ai_actions for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists ask_hubly_insights_select_owner on public.ask_hubly_insights;
create policy ask_hubly_insights_select_owner on public.ask_hubly_insights for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));
drop policy if exists ask_hubly_insights_insert_owner on public.ask_hubly_insights;
create policy ask_hubly_insights_insert_owner on public.ask_hubly_insights for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists ask_hubly_activity_feed_select_owner on public.ask_hubly_activity_feed;
create policy ask_hubly_activity_feed_select_owner on public.ask_hubly_activity_feed for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));
drop policy if exists ask_hubly_activity_feed_insert_owner on public.ask_hubly_activity_feed;
create policy ask_hubly_activity_feed_insert_owner on public.ask_hubly_activity_feed for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));
