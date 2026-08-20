-- Token usage, as columns.
--
-- Every OpenAI and Anthropic response reports how many tokens it consumed.
-- hubly_ai.ts parsed that object out of the response and then discarded it on
-- every single call -- so "what does generating a page actually cost" had to be
-- reasoned about from prompt sizes rather than read from what happened. The
-- estimate people kept reaching for was ~3,000 tokens of document schema plus
-- ~1,000 of styling; nobody had ever checked it against a bill.
--
-- Columns rather than a jsonb blob, because the only question anyone asks of
-- this data is an aggregate: cost per phase, cost per page, input vs output.
-- That should be a group-by, not a JSON dig.

alter table public.hubly_brain_executions
  add column if not exists prompt_tokens integer,
  add column if not exists completion_tokens integer,
  -- Reasoning models bill hidden reasoning tokens inside the completion budget.
  -- Recorded separately: an exhausted budget with no visible output is the exact
  -- failure that made hubly-conversation return empty completions, and it is
  -- invisible if reasoning is folded into the completion count.
  add column if not exists reasoning_tokens integer,
  -- conversation | extraction | generation | edit | storefront | other
  add column if not exists phase text;

create index if not exists hubly_brain_executions_phase_idx
  on public.hubly_brain_executions (phase, created_at desc);
