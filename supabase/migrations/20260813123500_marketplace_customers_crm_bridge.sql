-- Marketplace -> CRM convergence (P0-2): give the lightweight
-- marketplace_customers staging row an explicit pointer to the canonical
-- CRM customers row it resolves to. The original marketplace_customers
-- migration always anticipated this ("Customer records created at booking
-- time (lightweight; CRM sync later)"). Additive + nullable: existing rows
-- are unaffected and historical Marketplace customers simply keep a null
-- bridge until/unless backfilled (a separate, later task).
alter table public.marketplace_customers
  add column if not exists crm_customer_id uuid references public.customers(id) on delete set null;

comment on column public.marketplace_customers.crm_customer_id is
  'Canonical CRM customers.id this Marketplace customer resolved to at booking time. The CRM customer is the identity of record; marketplace_customers remains only for Marketplace-specific/conversation data. Null on historical rows created before the convergence (not backfilled here).';

create index if not exists marketplace_customers_crm_idx
  on public.marketplace_customers (crm_customer_id)
  where crm_customer_id is not null;
