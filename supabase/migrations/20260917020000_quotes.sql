-- ════════════════════════════════════════════════════════════════════════════════════════════
-- QUOTES. A quote is a LEAD WITH A PRICE ON IT.
--
-- ADRIAN, 2026-09-16: "A quote is a lead with a price on it: it lives in the Leads -> Customers ->
-- Jobs pipeline, an accepted one becomes a booking or a job, and he sees THE SAME RECORD from the
-- chat and from the tab — one record, two views, never two that agree by luck."
--
-- ══ WHY A TABLE AND NOT A jsonb BAG ON THE BUSINESS ══════════════════════════════════════════
--
-- Every other "thing he sells" lives in `businesses.meta` and this codebase has paid for that twice
-- over: two stores, two readers, and a measurement that has to name which one it read. A quote has a
-- LIFECYCLE (draft -> sent -> accepted/declined) and it becomes a booking or a job, so it needs to be
-- joinable and it needs a status a reader can filter. A jsonb array cannot be joined to a job.
--
-- ══ THE PRICE IS NEVER INVENTED, AND THE ROW RECORDS WHERE IT CAME FROM ══════════════════════
--
-- `lines[].source` is not decoration. Every line says whether its price came from the owner's own
-- catalogue (`offer:<name>`), from something he typed in that message (`said`), or — the one case that
-- must be visible — that it has NO price yet (`unpriced`). A quote line with an invented number is the
-- fabricated-fact defect with money on it, and the only way to keep that honest at rest is to store
-- the provenance beside the value rather than trusting the writer that produced it.
--
-- ══ THE DISCOUNT IS STORED AS ARITHMETIC, IN HIS WORDS ══════════════════════════════════════
--
-- "he reads it aloud to a customer" (Adrian). So the row keeps the KIND, the VALUE, HIS WORDS for it,
-- and all three money figures — subtotal, discount amount, total. Not a single `total_cents` that the
-- reader has to reverse-engineer: a quote that cannot show its own arithmetic cannot be read aloud,
-- and a total recomputed by a second reader is the two-readers defect pointed at money.
--
-- ══ IT WORKS ON BOTH PAGE PATHS ═════════════════════════════════════════════════════════════
--
-- RULED 2026-09-16: classic is a supported path. Nothing here touches a page, a document or a
-- renderer — a quote is a record and a conversation — so there is nothing for a page kind to differ
-- about. That is deliberate: the classic/freeform split exists in the RENDERER, and keeping the quote
-- out of the renderer is what makes it work identically on both.
-- ════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,

  -- WHO IT IS FOR. Reachable means phone OR email, the same gate the lead list uses — a quote he
  -- cannot send is not a quote. Name alone is allowed here (unlike a lead) because HE is holding the
  -- conversation: he may be quoting someone standing in front of him.
  customer_name text,
  customer_phone text,
  customer_email text,
  -- Where the person came from, when they came from somewhere. This is the pipeline link.
  lead_id uuid references public.booking_requests(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,

  -- THE LINES. [{ name, qty, unit_cents, source }] — source is 'offer:<name>' | 'said' | 'unpriced'.
  lines jsonb not null default '[]'::jsonb,

  subtotal_cents integer not null default 0,
  -- The discount, as arithmetic and in his words. NULL kind means no discount at all, which is
  -- different from a zero discount he asked for.
  discount_kind text check (discount_kind in ('pct','flat')),
  discount_value numeric,
  discount_words text,
  discount_cents integer not null default 0,
  total_cents integer not null default 0,

  status text not null default 'draft'
    check (status in ('draft','sent','accepted','declined','expired')),
  notes text,

  -- AN ACCEPTED QUOTE BECOMES SOMETHING. Which, and which row — so the pipeline is a link and not a
  -- coincidence of names.
  became text check (became in ('booking','job')),
  became_job_id uuid references public.jobs(id) on delete set null,
  became_booking_id uuid references public.booking_requests(id) on delete set null,

  created_at timestamptz not null default now(),
  sent_at timestamptz,
  decided_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists quotes_business_status on public.quotes (business_id, status, created_at desc);
create index if not exists quotes_lead on public.quotes (lead_id) where lead_id is not null;

alter table public.quotes enable row level security;
drop policy if exists quotes_owner_all on public.quotes;
create policy quotes_owner_all on public.quotes for all
  using (exists (select 1 from public.businesses b where b.id = quotes.business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = quotes.business_id and b.owner_id = auth.uid()));

-- ── THE MONEY IS COMPUTED IN ONE PLACE, AND IT IS THE DATABASE ──────────────────────────────
--
-- The client shows the arithmetic because he reads it aloud; the server COMPUTES it because a total
-- the client sent is a number we did not check. Both must agree, and the way to guarantee that is for
-- one of them to be the answer. Rounding is half-up on cents, once, here.
create or replace function public.quote_money(p_lines jsonb, p_kind text, p_value numeric)
returns jsonb language sql immutable as $$
  with l as (
    select greatest(coalesce((x->>'qty')::numeric, 1), 0) as qty,
           greatest(coalesce((x->>'unit_cents')::numeric, 0), 0) as unit
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) x
  ),
  s as (select coalesce(round(sum(qty * unit)), 0)::integer as sub from l),
  d as (
    select sub,
           case
             when p_kind = 'pct'  and coalesce(p_value,0) > 0 then least(round(sub * least(p_value,100) / 100.0), sub)::integer
             when p_kind = 'flat' and coalesce(p_value,0) > 0 then least(round(p_value * 100), sub)::integer
             else 0
           end as disc
    from s
  )
  select jsonb_build_object('subtotal_cents', sub, 'discount_cents', disc, 'total_cents', sub - disc) from d;
$$;

create or replace function public.create_quote(
  p_business_id uuid, p_owner_id uuid,
  p_lines jsonb,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_email text default null,
  p_discount_kind text default null,
  p_discount_value numeric default null,
  p_discount_words text default null,
  p_notes text default null,
  p_lead_id uuid default null,
  p_customer_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.quotes; m jsonb; n integer;
begin
  if not public.hubly_owns_business(p_business_id, p_owner_id) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  select count(*) into n from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb));
  -- A QUOTE WITH NO LINES IS NOT A QUOTE. Refused here as well as in the composer, so the owner hears
  -- it immediately rather than after a round trip.
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'no_lines'); end if;
  -- EVERY LINE MUST SAY WHERE ITS PRICE CAME FROM. A line with no `source` is a number whose
  -- provenance we did not keep, and there is no honest way to show it to a customer later.
  if exists (
    select 1 from jsonb_array_elements(p_lines) x
     where nullif(btrim(coalesce(x->>'source','')),'') is null
        or nullif(btrim(coalesce(x->>'name','')),'') is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'line_without_source');
  end if;

  m := public.quote_money(p_lines, p_discount_kind, p_discount_value);

  insert into public.quotes
    (business_id, customer_name, customer_phone, customer_email, lead_id, customer_id,
     lines, subtotal_cents, discount_kind, discount_value, discount_words, discount_cents,
     total_cents, notes)
  values
    (p_business_id,
     nullif(btrim(coalesce(p_customer_name ,'')),''),
     nullif(btrim(coalesce(p_customer_phone,'')),''),
     nullif(btrim(coalesce(p_customer_email,'')),''),
     p_lead_id, p_customer_id,
     p_lines,
     (m->>'subtotal_cents')::integer,
     case when p_discount_kind in ('pct','flat') then p_discount_kind end,
     case when p_discount_kind in ('pct','flat') then p_discount_value end,
     nullif(btrim(coalesce(p_discount_words,'')),''),
     (m->>'discount_cents')::integer,
     (m->>'total_cents')::integer,
     nullif(btrim(coalesce(p_notes,'')),''))
  returning * into r;

  return jsonb_build_object('ok', true, 'id', r.id, 'status', r.status,
    'subtotal_cents', r.subtotal_cents, 'discount_cents', r.discount_cents,
    'total_cents', r.total_cents, 'lines', r.lines);
end;
$$;

-- ONE READER FOR BOTH VIEWS. The chat and the tab call this, so "one record, two views" is
-- structural rather than a hope that two queries agree.
create or replace function public.get_business_quotes(
  p_business_id uuid, p_owner_id uuid, p_status text default null
) returns table (
  id uuid, customer_name text, customer_phone text, customer_email text,
  lines jsonb, subtotal_cents integer, discount_kind text, discount_value numeric,
  discount_words text, discount_cents integer, total_cents integer,
  status text, notes text, became text, created_at timestamptz, sent_at timestamptz
) language sql stable security definer set search_path = public as $$
  select q.id, q.customer_name, q.customer_phone, q.customer_email,
         q.lines, q.subtotal_cents, q.discount_kind, q.discount_value,
         q.discount_words, q.discount_cents, q.total_cents,
         q.status, q.notes, q.became, q.created_at, q.sent_at
  from public.quotes q
  where q.business_id = p_business_id
    and public.hubly_owns_business(p_business_id, p_owner_id)
    and (p_status is null or q.status = p_status)
  order by q.created_at desc;
$$;

create or replace function public.set_quote_status(
  p_quote_id uuid, p_owner_id uuid, p_status text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare b uuid; v_old text;
begin
  select business_id, status into b, v_old from public.quotes where id = p_quote_id;
  if b is null or not public.hubly_owns_business(b, p_owner_id) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  if p_status not in ('draft','sent','accepted','declined','expired') then
    return jsonb_build_object('ok', false, 'error', 'bad_status');
  end if;
  update public.quotes
     set status = p_status,
         sent_at = case when p_status = 'sent' and sent_at is null then now() else sent_at end,
         decided_at = case when p_status in ('accepted','declined') then now() else decided_at end,
         updated_at = now()
   where id = p_quote_id;
  return jsonb_build_object('ok', true, 'status', p_status, 'was', v_old);
end;
$$;

grant execute on function public.quote_money(jsonb,text,numeric) to authenticated, service_role;
grant execute on function public.create_quote(uuid,uuid,jsonb,text,text,text,text,numeric,text,text,uuid,uuid) to authenticated, service_role;
grant execute on function public.get_business_quotes(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.set_quote_status(uuid,uuid,text) to authenticated, service_role;
