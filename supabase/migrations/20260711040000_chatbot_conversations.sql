-- Customer-facing AI chatbot: conversation + message storage.
-- Every conversation gets a row regardless of tier (needed for the
-- Starter aggregate stats view); customer_name/phone/email stay null
-- unless the business is Pro AND the customer consented to follow-up.
--
-- Unlike review_submissions, there is no public insert/update policy
-- here. Every write is AI-mediated (rate limits, tier checks, fallback
-- classification, topic extraction all happen before anything is
-- persisted), so there's no safe "public insert" shape to define --
-- the edge function is the only writer, via the service role key,
-- which bypasses RLS by design.
create table if not exists chatbot_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  customer_name text,
  customer_phone text,
  customer_email text,
  consented_to_followup boolean not null default false,
  resulted_in_booking boolean not null default false,
  topics jsonb not null default '[]'::jsonb
);

create table if not exists chatbot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chatbot_conversations(id) on delete cascade,
  role text not null check (role in ('customer','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Queried on every incoming chat message for the conversations-per-hour
-- rate limit, unlike most tables in this project which are read rarely.
create index if not exists chatbot_conversations_business_started_idx
  on chatbot_conversations(business_id, started_at);

alter table chatbot_conversations enable row level security;
alter table chatbot_messages enable row level security;

-- No RLS policies for anon or authenticated on the raw tables at all --
-- see get_chatbot_conversations_for_business() below, the only owner
-- read path, and the edge function (service role), the only writer.

-- Column-level defense in depth: RLS alone can't null out specific
-- columns conditionally on a joined table's tier (grants are role-wide,
-- not row-conditional), so this mirrors get_review_request_context()'s
-- security-definer pattern -- Starter tier gets customer_name/phone/
-- email as null even though the real values are technically in the
-- row, no matter how this function is called.
create or replace function get_chatbot_conversations_for_business(p_business_id uuid)
returns table(
  id uuid, started_at timestamptz, ended_at timestamptz,
  customer_name text, customer_phone text, customer_email text,
  consented_to_followup boolean, resulted_in_booking boolean, topics jsonb
)
language sql security definer set search_path = public
as $$
  select c.id, c.started_at, c.ended_at,
    case when b.tier='pro' then c.customer_name else null end,
    case when b.tier='pro' then c.customer_phone else null end,
    case when b.tier='pro' then c.customer_email else null end,
    c.consented_to_followup, c.resulted_in_booking, c.topics
  from chatbot_conversations c
  join businesses b on b.id = c.business_id
  where c.business_id = p_business_id
    and b.owner_id = auth.uid()
  order by c.started_at desc
$$;
grant execute on function get_chatbot_conversations_for_business(uuid) to authenticated;
