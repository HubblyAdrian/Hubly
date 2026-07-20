-- Phase 5 — Marketplace Lite messaging (booking-threaded only)

create table if not exists public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.marketplace_conversations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid references public.marketplace_bookings(id) on delete set null,
  sender_role text not null
    check (sender_role in ('provider', 'customer', 'system')),
  body text not null,
  photo_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_messages_conversation_idx
  on public.marketplace_messages (conversation_id, created_at);

create index if not exists marketplace_messages_business_idx
  on public.marketplace_messages (business_id, created_at desc);

alter table public.marketplace_messages enable row level security;

drop policy if exists marketplace_messages_owner_select on public.marketplace_messages;
create policy marketplace_messages_owner_select
  on public.marketplace_messages for select
  to authenticated
  using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

comment on table public.marketplace_messages is
  'Marketplace Lite booking-thread messages only — not CRM/chatbot messaging.';
