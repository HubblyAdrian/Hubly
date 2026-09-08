-- ============================================================================
-- business_places — the first real capability structure in this system.
--
-- WHY A TABLE AND NOT meta (RULING 1, and I agree with it)
--
--   businesses.meta is jsonb-in-a-TEXT-column with eleven writers, no CAS, and a
--   lost-update race we specified and never built. It has produced #54 (services
--   in two homes), #57/#58 (the CAS that does not exist), #63 and #64 — and, this
--   week alone, a silent 26->16 truncation of an owner's photos and a logo revert
--   that took three attempts to close. Putting the places list there would inherit
--   every one of those on day one.
--
--   A table gives what meta cannot: a UNIQUE constraint the database enforces,
--   one row per place so two writers cannot clobber each other's list, real types,
--   and an index. Nothing about places wants to be a blob.
--
-- PHASE 1 ONLY. Nothing reads this table yet. Creating it changes no behaviour;
-- the readers land in a separate deploy after the backfill is verified across all
-- 179 businesses (RULING 3). The write RPC ships with Phase 2 and is deliberately
-- absent here — an unused writer is a thing to get wrong for free.
-- ============================================================================

create table if not exists public.business_places (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,

  -- WHAT the place is. THESE VALUES ARE THE RAIL'S OWN data-v STRINGS, verbatim,
  -- so there is no translation layer between the table and the renderer.
  --
  -- Checked one by one against `grep data-v=` in public/hubly.html rather than
  -- from memory, and the first draft of this list was wrong in three ways at once:
  -- it invented `revenue`/`inbox`/`media` where the rail says `money`/`chats`/
  -- `photo-projects` (so those three could never have matched), it omitted twelve
  -- real rail entries, and it had exactly 19 values against a rail of 19 VISIBLE
  -- entries — a coincidence of counts, since the source actually defines 25.
  --
  -- FOUR ARE DELIBERATELY ABSENT and can never become places: dashboard (Home),
  -- settings, editor and ask. They are the shell itself, not something a business
  -- earns, and leaving them out means this mechanism cannot take them away.
  -- Home is excluded on purpose, not forgotten.
  kind         text not null check (kind in (
                 -- tabs — every rail data-v except the four structural ones
                 'activity','apps','calendar','chats','customers','growth','jobs',
                 'leads','marketing','marketplace','memberships','money',
                 'opportunities','photo-projects','pipeline','projects','quotes',
                 'reports','reviews','store','studio',
                 -- sections — SECTION_DEFS, public/hubly.html:50388
                 'portfolio','services','about','story'
               )),

  -- WHERE it appears. A tab in the rail and a section on the page are the SAME
  -- kind of entry; only this field differs. That is the whole reason one
  -- mechanism can serve "add me a store" and "add me a reviews section".
  scope        text not null check (scope in ('tab','section')),

  -- NAMED sort_order, NOT `position`. `position` is a SQL keyword (the
  -- position(x in y) function) and Postgres will accept it as a column but it
  -- needs quoting in a RETURNS TABLE signature, which is exactly the kind of
  -- detail that works until someone writes the obvious thing. `sort_order` is
  -- also what services already uses, so one convention rather than two.
  -- Sparse integers, gaps of 10, so an insert between two neighbours needs no
  -- renumbering. Authoritative for order; row order means nothing here.
  sort_order   integer not null default 0,

  -- THREE STATES, and they are NOT two. Settled before there is any data,
  -- because retrofitting a distinction into a predicate is how a third meaning
  -- appears:
  --
  --   business has NO rows at all  -> UNKNOWN. Not backfilled, or created after
  --                                   the backfill. hasPlace() returns TRUE for
  --                                   everything — the old full rail. Fail open.
  --   business has rows, none of   -> ABSENT. Never had this place. The assistant
  --   this kind                       says "I've added Store."
  --   row exists, visible = false  -> OFF. They had it and turned it off. The
  --                                   assistant says "I've turned Store back on",
  --                                   and the row's config and sort_order survive,
  --                                   so it returns where it was.
  --
  -- ABSENT and OFF both render nothing. They differ in what the product SAYS and
  -- in whether position is remembered, which is why deleting a row and setting
  -- visible=false are not interchangeable.
  visible      boolean not null default true,
  config       jsonb   not null default '{}'::jsonb,

  -- Who asked for it. 'system' means the backfill inferred it from usage rather
  -- than anyone requesting it — which is exactly the distinction the loss table
  -- and any future announcement need, and it cannot be reconstructed later.
  added_by     text not null default 'system'
                 check (added_by in ('assistant','owner','system','backfill')),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One place of a given kind and scope per business. The database enforces it, so
-- a double-add is an error at the write rather than a duplicate tab someone finds.
create unique index if not exists business_places_unique_kind_scope
  on public.business_places (business_id, kind, scope);

-- Every read is "all places for this business, in order".
create index if not exists business_places_by_business
  on public.business_places (business_id, scope, sort_order);

comment on table public.business_places is
  'What a business has ASKED FOR. One of three separate axes, deliberately not collapsed: '
  'PLAN is businesses.tier (what it is entitled to), PLACES is this table (what it asked for), '
  'CONTENT is meta/services/commerce_products (what is in it). Collapsing any two is how '
  'capabilities.hubly_pro and businesses.tier came to disagree on 32 rows.';

comment on column public.business_places.scope is
  'tab = an entry in the app rail. section = a band on the public page. Same mechanism, '
  'different renderer — this field is the only difference between them.';

-- updated_at IS MAINTAINED. Without this it is a column that stops being true
-- after the first write — a fact the schema asserts and nothing produces, which is
-- the same defect as the hardcoded "Average 1.8 Hours" deleted from the reviews
-- dashboard on 2026-09-07. Either the trigger exists or the column should not.
create or replace function public.touch_business_places_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_places_touch_updated_at on public.business_places;
create trigger business_places_touch_updated_at
  before update on public.business_places
  for each row execute function public.touch_business_places_updated_at();

alter table public.business_places enable row level security;

-- No anon or authenticated grants. Reads go through the security-definer function
-- below; writes go through the Phase 2 RPC, which will authorise by p_owner_id the
-- same way every other owner write does. A table an owner can write directly is a
-- table an owner can write for somebody else.
revoke all on public.business_places from anon, authenticated;

-- The public page needs the list for a slug, and only for a business that has an
-- owner — the same gate get_public_business already applies. Created now because
-- Phase 2 needs it and it is inert until something calls it.
create or replace function public.get_public_business_places(p_slug text)
returns table(kind text, scope text, sort_order integer, visible boolean, config jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.kind, p.scope, p.sort_order, p.visible, p.config
  from public.business_places p
  join public.businesses b on b.id = p.business_id
  where b.slug = p_slug
    and b.owner_id is not null
  order by p.scope, p.sort_order, p.kind;
$$;

revoke all on function public.get_public_business_places(text) from public;
grant execute on function public.get_public_business_places(text) to anon, authenticated;

-- NOTE FOR THE READER (Phase 2), because it is the ruling most easily lost in code:
--   hasPlace() MUST FAIL OPEN. A business with ZERO rows in this table gets the
--   OLD FULL RAIL — true, never false. A business that slipped the backfill, or one
--   created between the backfill and the reader shipping, must look exactly like it
--   does today. Getting it backwards signs an owner into an empty product with no
--   way to ask for anything back, and it lands on whoever we missed — which is by
--   definition the case nobody thought about. It is an explicit branch, not a
--   fallback that happens to work.

-- NOT CONSTRAINED, DELIBERATELY: nothing stops kind='money' scope='section', which
-- is meaningless. Left open rather than over-specified this early — but the reader
-- must not treat "the table allowed it" as "this combination is valid". The
-- catalogue in code decides which kinds are legal in which scope; the CHECK only
-- decides which kinds exist at all.
