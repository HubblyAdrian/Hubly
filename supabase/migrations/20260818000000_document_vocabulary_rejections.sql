-- What the model tried to use and was refused.
--
-- The model is the only interface to the Hubly Document. There is no toolbar,
-- no inspector, no drag handle — so its vocabulary IS the product's ceiling,
-- and the list of things it reaches for and cannot have is the single most
-- valuable signal about where that ceiling actually sits.
--
-- On 2026-08-17 eleven class families turned out to be accepted by the
-- validator and mentioned nowhere in the prompt. Naming them produced
-- structurally different pages with zero renderer work: the fence was mostly
-- imaginary. Nobody could have known, because the validator computed every
-- rejection and threw it away.
--
-- This table is the standing fix. Append-only, no PII: token names, tag names,
-- an attribute name, and the business id. No brief, no copy, no customer data —
-- the whole point is the vocabulary, and the vocabulary is not personal.
--
-- Only FIRST-attempt rejections are meaningful and only those are written. The
-- retry has already been handed the rejection messages, so its choices are ours
-- rather than the model's.

create table if not exists public.document_vocabulary_rejections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,
  tag text not null default 'website',
  -- 'succeeded' = first attempt validated anyway (rejections still recorded if
  -- any), 'retried' = first failed and the retry saved it, 'failed' = both
  -- attempts failed and no document exists. The last is the most interesting
  -- and, before this table, the only one that left no trace at all.
  outcome text not null,
  rejected_classes text[] not null default '{}',
  rejected_tags text[] not null default '{}',
  rejected_attrs text[] not null default '{}',
  model_used text,
  created_at timestamptz not null default now()
);

create index if not exists document_vocabulary_rejections_created_idx
  on public.document_vocabulary_rejections (created_at desc);

alter table public.document_vocabulary_rejections enable row level security;

-- Written by Edge Functions with the service role, which bypasses RLS. No
-- client-side insert policy exists, deliberately: nothing in a browser should
-- be able to write to this.
--
-- Readable by anon because it is the working surface for exactly the analysis
-- it exists to support, and it contains no personal data by construction. If a
-- brief or any page copy is ever added to this table, this policy must be
-- reconsidered in the same change.
drop policy if exists document_vocabulary_rejections_read on public.document_vocabulary_rejections;
create policy document_vocabulary_rejections_read
  on public.document_vocabulary_rejections
  for select
  to anon, authenticated
  using (true);

select 'document_vocabulary_rejections created' as status;
