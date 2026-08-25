-- Visitor counter, not analytics. Answers ONE binary question: has any human other than the
-- owner ever loaded a market site? One table, one column on businesses. No second table.

create table if not exists public.page_loads (
  id            bigint generated always as identity primary key,
  business_id   uuid not null references public.businesses(id) on delete cascade,
  loaded_at     timestamptz not null default now(),
  loaded_day    date not null default current_date,   -- UTC day the beacon computed; matches visitor_hash's day
  -- RAW referrer. DO NOT INTERPRET. Most real sharing — a link texted to a customer, opened
  -- from a saved contact, or tapped from an Instagram bio — arrives as DIRECT with an EMPTY
  -- referrer. Empty means "unknown", NOT "nobody shared it".
  referrer      text,
  device_class  text,          -- 'mobile'|'tablet'|'desktop' (human) · 'bot' · 'unknown'. Only the
                               -- three human classes may trip the first-visitor alert.
  is_owner_preview boolean not null default false,   -- an OWNER load (derived server-side; see owner_decision)
  owner_decision text,          -- HOW is_owner_preview was decided, for later audit:
                               -- 'server_auth' (session = owner) | 'sticky_hash' (device seen as
                               -- owner before) | 'client_hint' (page said so) | 'visitor' (none)
  -- Salted DAILY hash of (ip+ua+business). One device = one row per day; a reloading owner or
  -- visitor is not many visitors. Stores NO raw IP — identifies no person. NOTE: day-scoping
  -- DELIBERATELY discards repeat-visit / returning-visitor signal — fine to lose for now; the
  -- question is binary (did anyone come at all), not frequency.
  visitor_hash  text
);
create index if not exists page_loads_business_idx on public.page_loads (business_id, loaded_at desc);
create unique index if not exists page_loads_dedup_idx
  on public.page_loads (business_id, visitor_hash, loaded_day) where visitor_hash is not null;

alter table public.page_loads enable row level security;
revoke all on public.page_loads from anon, authenticated;   -- only the edge beacon (service key) writes

alter table public.businesses add column if not exists first_visitor_at timestamptz;
comment on column public.businesses.first_visitor_at is
  'Set on the first non-owner, non-bot, human page load of a market site; its NULL->now '
  'transition fires a one-time platform-owner alert. Marker claimed atomically before the send.';
