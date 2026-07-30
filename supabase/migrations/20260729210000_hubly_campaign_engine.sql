-- Hubly Studio Campaign Engine — marketing knowledge layer (playbooks, calendar, triggers, plans).
-- Strategy lives here; AI writes from structured Campaign Plans. Canva is the renderer only.
-- Does NOT merge Memory (facts) with DNA (identity). Plans may *reference* both as inputs.

-- ─── Catalog: industries ───────────────────────────────────────────────────

create table if not exists public.campaign_industries (
  id text primary key, -- e.g. pressure_washing
  name text not null,
  aliases text[] not null default '{}',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.campaign_industries is
  'Industry keys for Studio Campaign Engine playbooks.';

-- ─── Catalog: goals ────────────────────────────────────────────────────────

create table if not exists public.campaign_goals (
  id text primary key, -- e.g. get_more_reviews
  label text not null,
  description text not null default '',
  priority int not null default 50,
  active boolean not null default true
);

comment on table public.campaign_goals is
  'Owner-facing campaign goals (Studio AI Creator).';

-- ─── Catalog: playbooks (proven campaign types) ────────────────────────────

create table if not exists public.campaign_playbooks (
  id text primary key, -- e.g. spring_pressure_wash
  industry_id text not null references public.campaign_industries(id) on delete cascade,
  goal_id text not null references public.campaign_goals(id) on delete restrict,
  title text not null,
  season text not null default 'any'
    check (season in ('any','spring','summer','fall','winter','holiday')),
  audience text not null default 'local_prospects'
    check (audience in (
      'local_prospects','existing_customers','past_customers','hoa','commercial','new_movers'
    )),
  frequency text not null default 'seasonal'
    check (frequency in ('once','weekly','monthly','seasonal','annual','triggered')),
  channels text[] not null default '{}',
  offer_type text not null default 'none'
    check (offer_type in ('none','percent_off','fixed_off','freebie','membership','referral_reward')),
  cta text not null default 'Book now',
  messaging_strategy text not null default '',
  ai_prompt text not null default '',
  template_refs jsonb not null default '[]'::jsonb, -- Hubly / Canva template ids
  priority int not null default 50,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists campaign_playbooks_industry_goal_idx
  on public.campaign_playbooks (industry_id, goal_id, priority desc);

comment on table public.campaign_playbooks is
  'Proven campaign types per industry. AI selects from these — does not invent strategy.';

-- ─── Required assets per playbook ──────────────────────────────────────────

create table if not exists public.campaign_playbook_assets (
  id uuid primary key default gen_random_uuid(),
  playbook_id text not null references public.campaign_playbooks(id) on delete cascade,
  asset_key text not null
    check (asset_key in (
      'logo','before_after','job_photos','review','offer','coupon','video',
      'membership_details','service_list','hours','phone','address'
    )),
  required boolean not null default true,
  notes text not null default '',
  unique (playbook_id, asset_key)
);

-- ─── Seasonal calendar ─────────────────────────────────────────────────────

create table if not exists public.campaign_seasonal_calendar (
  id uuid primary key default gen_random_uuid(),
  industry_id text not null references public.campaign_industries(id) on delete cascade,
  month int not null check (month between 1 and 12),
  playbook_id text not null references public.campaign_playbooks(id) on delete cascade,
  label text not null default '',
  priority int not null default 50,
  unique (industry_id, month, playbook_id)
);

create index if not exists campaign_seasonal_month_idx
  on public.campaign_seasonal_calendar (industry_id, month, priority desc);

-- ─── Marketing rules / triggers ────────────────────────────────────────────

create table if not exists public.campaign_triggers (
  id text primary key,
  industry_id text references public.campaign_industries(id) on delete cascade, -- null = all
  playbook_id text references public.campaign_playbooks(id) on delete set null,
  goal_id text references public.campaign_goals(id) on delete set null,
  title text not null,
  rule_kind text not null
    check (rule_kind in (
      'no_facebook_post_days','completed_jobs_week','new_five_star_review',
      'no_gbp_update_days','idle_customers_days','open_slots_tomorrow','season_start'
    )),
  threshold int not null default 0,
  priority int not null default 50,
  active boolean not null default true
);

comment on table public.campaign_triggers is
  'Proactive Studio suggestions: IF business signal THEN recommend playbook/goal.';

-- ─── Generated Campaign Plans (per business) ───────────────────────────────

create table if not exists public.campaign_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  playbook_id text references public.campaign_playbooks(id) on delete set null,
  goal_id text references public.campaign_goals(id) on delete set null,
  industry_id text references public.campaign_industries(id) on delete set null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft','ready','in_production','scheduled','published','archived')),
  -- Structured plan (source of truth for copy/visual generation — not freeform AI dump)
  objective text not null default '',
  channels text[] not null default '{}',
  required_assets jsonb not null default '[]'::jsonb,
  messaging_strategy text not null default '',
  cta text not null default '',
  timing jsonb not null default '{}'::jsonb, -- { suggest_at, season, schedule_hints[] }
  template_refs jsonb not null default '[]'::jsonb,
  offer jsonb not null default '{}'::jsonb,
  audience text not null default '',
  ai_brief text not null default '', -- prompt fed to writer/renderer
  business_inputs jsonb not null default '{}'::jsonb, -- facts from Memory/jobs/reviews (factual)
  dna_inputs jsonb not null default '{}'::jsonb, -- interpretive tone/style from DNA (separate)
  package jsonb not null default '{}'::jsonb, -- generated package slots: captions, email, sms, gbp, headlines, hashtags
  project_id uuid references public.studio_projects(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_plans_business_idx
  on public.campaign_plans (business_id, created_at desc);
create index if not exists campaign_plans_status_idx
  on public.campaign_plans (business_id, status);

comment on table public.campaign_plans is
  'Structured Campaign Plan instances. AI writes copy FROM this plan; Canva renders visuals.';

-- ─── Project Canva linkage + version/export history ────────────────────────

alter table public.studio_projects
  add column if not exists canva_design_id text,
  add column if not exists campaign_plan_id uuid,
  add column if not exists export_status text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'studio_projects_export_status_check'
  ) then
    alter table public.studio_projects
      add constraint studio_projects_export_status_check
      check (export_status in ('none','pending','ready','failed'));
  end if;
end $$;

-- FK after campaign_plans exists (project_id already on plans; bidirectional soft link)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'studio_projects_campaign_plan_id_fkey'
  ) then
    alter table public.studio_projects
      add constraint studio_projects_campaign_plan_id_fkey
      foreign key (campaign_plan_id) references public.campaign_plans(id) on delete set null;
  end if;
exception when others then
  -- tables may be created in same migration; ignore if race
  null;
end $$;

create index if not exists studio_projects_canva_idx
  on public.studio_projects (business_id, canva_design_id)
  where canva_design_id is not null;

create table if not exists public.studio_project_versions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  version_number int not null default 1,
  label text not null default '',
  canva_design_id text,
  thumbnail_url text,
  snapshot jsonb not null default '{}'::jsonb,
  source text not null default 'hubly'
    check (source in ('hubly','canva_return','export','manual')),
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

create index if not exists studio_project_versions_project_idx
  on public.studio_project_versions (project_id, version_number desc);

create table if not exists public.studio_project_exports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  format text not null default 'png',
  status text not null default 'pending'
    check (status in ('pending','ready','failed')),
  url text,
  canva_export_id text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists studio_project_exports_project_idx
  on public.studio_project_exports (project_id, created_at desc);

-- ─── RLS ───────────────────────────────────────────────────────────────────

alter table public.campaign_industries enable row level security;
alter table public.campaign_goals enable row level security;
alter table public.campaign_playbooks enable row level security;
alter table public.campaign_playbook_assets enable row level security;
alter table public.campaign_seasonal_calendar enable row level security;
alter table public.campaign_triggers enable row level security;
alter table public.campaign_plans enable row level security;
alter table public.studio_project_versions enable row level security;
alter table public.studio_project_exports enable row level security;

-- Catalog tables: readable by authenticated; service role seeds/writes
drop policy if exists campaign_industries_read on public.campaign_industries;
create policy campaign_industries_read on public.campaign_industries
  for select to authenticated using (active = true);

drop policy if exists campaign_goals_read on public.campaign_goals;
create policy campaign_goals_read on public.campaign_goals
  for select to authenticated using (active = true);

drop policy if exists campaign_playbooks_read on public.campaign_playbooks;
create policy campaign_playbooks_read on public.campaign_playbooks
  for select to authenticated using (active = true);

drop policy if exists campaign_playbook_assets_read on public.campaign_playbook_assets;
create policy campaign_playbook_assets_read on public.campaign_playbook_assets
  for select to authenticated using (true);

drop policy if exists campaign_seasonal_read on public.campaign_seasonal_calendar;
create policy campaign_seasonal_read on public.campaign_seasonal_calendar
  for select to authenticated using (true);

drop policy if exists campaign_triggers_read on public.campaign_triggers;
create policy campaign_triggers_read on public.campaign_triggers
  for select to authenticated using (active = true);

drop policy if exists campaign_plans_owner_all on public.campaign_plans;
create policy campaign_plans_owner_all on public.campaign_plans
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists studio_project_versions_owner_all on public.studio_project_versions;
create policy studio_project_versions_owner_all on public.studio_project_versions
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists studio_project_exports_owner_all on public.studio_project_exports;
create policy studio_project_exports_owner_all on public.studio_project_exports
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- ─── Seed: industries ──────────────────────────────────────────────────────

insert into public.campaign_industries (id, name, aliases, sort_order) values
  ('home_services', 'Home Services', array['home service','general'], 0),
  ('pressure_washing', 'Pressure Washing', array['pressure wash','power washing','soft wash'], 10),
  ('hvac', 'HVAC', array['heating','cooling','air conditioning','furnace'], 20),
  ('plumbing', 'Plumbing', array['plumber','drain'], 30),
  ('photography', 'Photography', array['photographer','photo studio'], 40),
  ('landscaping', 'Landscaping', array['lawn care','lawn','yard'], 50),
  ('detailing', 'Auto Detailing', array['car wash','detail'], 60),
  ('cleaning', 'Cleaning', array['house cleaning','maid','janitorial'], 70)
on conflict (id) do update set name = excluded.name, aliases = excluded.aliases;

-- ─── Seed: goals ───────────────────────────────────────────────────────────

insert into public.campaign_goals (id, label, description, priority) values
  ('get_more_reviews', 'Get More Reviews', 'Turn happy customers into public social proof.', 100),
  ('fill_tomorrow_schedule', 'Fill Tomorrow''s Schedule', 'Convert open capacity into booked jobs fast.', 95),
  ('promote_service', 'Promote a Service', 'Feature a specific offer (e.g. ceramic coatings, tune-ups).', 90),
  ('win_back_customers', 'Win Back Old Customers', 'Re-engage past customers who have gone quiet.', 85),
  ('seasonal_promotion', 'Seasonal Promotion', 'Ride the calendar with timely local offers.', 80),
  ('membership_drive', 'Membership Drive', 'Grow recurring memberships and maintenance plans.', 75),
  ('book_more_jobs', 'Book More Jobs', 'General demand generation for core services.', 70),
  ('referral', 'Referral Campaign', 'Ask happy customers to send neighbors your way.', 65)
on conflict (id) do update set label = excluded.label, description = excluded.description;

-- ─── Seed: playbooks (home services + industry samples) ────────────────────

insert into public.campaign_playbooks (
  id, industry_id, goal_id, title, season, audience, frequency, channels,
  offer_type, cta, messaging_strategy, ai_prompt, template_refs, priority
) values
  ('hs_review_spotlight', 'home_services', 'get_more_reviews', 'Review Spotlight', 'any', 'existing_customers', 'triggered',
   array['instagram','facebook','google_business'], 'none', 'Leave a review',
   'Lead with the customer quote; keep branding quiet; one clear review CTA.',
   'Create a review spotlight graphic and caption that quotes the customer, thanks them, and invites neighbors to book.',
   '[{"source":"hubly","id":"review_highlight"}]'::jsonb, 100),
  ('hs_before_after', 'home_services', 'book_more_jobs', 'Before & After Highlight', 'any', 'local_prospects', 'triggered',
   array['instagram','facebook','google_business'], 'none', 'Book this service',
   'Side-by-side proof; short outcome headline; soft CTA.',
   'Create a before/after campaign from completed job photos with a concise outcome headline and booking CTA.',
   '[{"source":"hubly","id":"before_after"}]'::jsonb, 95),
  ('hs_fill_schedule', 'home_services', 'fill_tomorrow_schedule', 'Open Slots Tomorrow', 'any', 'local_prospects', 'triggered',
   array['facebook','instagram','sms','google_business'], 'percent_off', 'Claim a slot',
   'Urgency without panic; limited openings; same-day or next-day focus.',
   'Create a same/next-day availability campaign that fills open schedule slots with a clear CTA.',
   '[{"source":"hubly","id":"seasonal_offer"}]'::jsonb, 90),
  ('hs_win_back', 'home_services', 'win_back_customers', 'We Miss You', 'any', 'past_customers', 'monthly',
   array['email','sms','facebook'], 'percent_off', 'Book your return visit',
   'Warm, personal; reference last service season; exclusive win-back offer.',
   'Create a win-back campaign for past customers with a friendly tone and a simple return offer.',
   '[{"source":"hubly","id":"membership_promotion"}]'::jsonb, 85),
  ('hs_referral', 'home_services', 'referral', 'Referral Rewards', 'any', 'existing_customers', 'seasonal',
   array['email','sms','instagram','print'], 'referral_reward', 'Refer a neighbor',
   'Thank existing customers; make the reward crystal clear; easy share path.',
   'Create a referral campaign package with poster, caption, email, and SMS inviting referrals.',
   '[{"source":"hubly","id":"referral_campaign"}]'::jsonb, 80),
  ('hs_membership', 'home_services', 'membership_drive', 'Membership Drive', 'any', 'existing_customers', 'seasonal',
   array['email','facebook','instagram','google_business'], 'membership', 'Join the plan',
   'Benefits over price; peace of mind; what members get each year.',
   'Create a membership drive campaign explaining plan benefits and a clear join CTA.',
   '[{"source":"hubly","id":"membership_promotion"}]'::jsonb, 75),
  ('hs_holiday', 'home_services', 'seasonal_promotion', 'Holiday Campaign', 'holiday', 'local_prospects', 'annual',
   array['instagram','facebook','email','google_business'], 'percent_off', 'Book for the holidays',
   'Seasonal warmth; gift-of-service framing; deadline for holiday week.',
   'Create a holiday campaign with festive but professional home-service tone and a book-by date.',
   '[{"source":"hubly","id":"holiday_campaign"}]'::jsonb, 70),
  ('hs_promote_service', 'home_services', 'promote_service', 'Service Spotlight', 'any', 'local_prospects', 'monthly',
   array['instagram','facebook','google_business','email'], 'none', 'Learn more / Book',
   'Name the service; proof; one benefit; clear CTA.',
   'Create a service promotion campaign featuring the named service, benefits, and booking CTA.',
   '[{"source":"hubly","id":"seasonal_offer"}]'::jsonb, 88),

  ('pw_spring_clean', 'pressure_washing', 'seasonal_promotion', 'Spring Cleaning', 'spring', 'local_prospects', 'annual',
   array['instagram','facebook','google_business','email'], 'percent_off', 'Book spring cleaning',
   'Fresh start; curb appeal; luxury spring cleaning tone.',
   'Create a luxury spring cleaning campaign for pressure washing with seasonal offer and local pride.',
   '[{"source":"hubly","id":"seasonal_offer"}]'::jsonb, 100),
  ('pw_driveway', 'pressure_washing', 'promote_service', 'Driveway Special', 'any', 'local_prospects', 'monthly',
   array['facebook','instagram','google_business'], 'fixed_off', 'Get a driveway quote',
   'Concrete oil stains and curb appeal; before/after heavy.',
   'Create a driveway cleaning special with before/after emphasis and quote CTA.',
   '[{"source":"hubly","id":"before_after"}]'::jsonb, 90),
  ('pw_hoa', 'pressure_washing', 'book_more_jobs', 'HOA Promotion', 'summer', 'hoa', 'seasonal',
   array['email','google_business','print'], 'none', 'Request HOA proposal',
   'Commercial-ready; multi-unit reliability; compliance and schedule.',
   'Create an HOA / property manager outreach campaign for pressure washing.',
   '[{"source":"hubly","id":"membership_promotion"}]'::jsonb, 85),
  ('pw_rainy', 'pressure_washing', 'fill_tomorrow_schedule', 'Rainy Season Prep', 'fall', 'existing_customers', 'seasonal',
   array['email','sms','facebook'], 'percent_off', 'Schedule before the rain',
   'Prep messaging; mold/mildew prevention; urgency tied to weather.',
   'Create a rainy-season prep campaign encouraging booking before wet weather.',
   '[{"source":"hubly","id":"seasonal_offer"}]'::jsonb, 80),

  ('hvac_summer_tune', 'hvac', 'seasonal_promotion', 'Summer Tune-Up', 'summer', 'existing_customers', 'annual',
   array['email','sms','facebook','google_business'], 'percent_off', 'Book tune-up',
   'Comfort + bill savings; filter and efficiency; book before heat wave.',
   'Create a summer A/C tune-up campaign with maintenance checklist tone.',
   '[{"source":"hubly","id":"seasonal_offer"}]'::jsonb, 100),
  ('hvac_winter_inspect', 'hvac', 'seasonal_promotion', 'Winter Inspection', 'winter', 'existing_customers', 'annual',
   array['email','sms','facebook'], 'percent_off', 'Schedule inspection',
   'Safety first; furnace readiness; peace of mind.',
   'Create a winter heating inspection campaign focused on safety and readiness.',
   '[{"source":"hubly","id":"seasonal_offer"}]'::jsonb, 95),
  ('hvac_membership', 'hvac', 'membership_drive', 'HVAC Membership Drive', 'any', 'existing_customers', 'seasonal',
   array['email','facebook','instagram'], 'membership', 'Enroll today',
   'Priority service + seasonal visits; membership ROI.',
   'Create an HVAC membership drive with clear plan benefits.',
   '[{"source":"hubly","id":"membership_promotion"}]'::jsonb, 90),
  ('hvac_filter', 'hvac', 'promote_service', 'Filter Change Reminder', 'any', 'existing_customers', 'monthly',
   array['sms','email'], 'none', 'Book filter service',
   'Helpful reminder; air quality; quick appointment.',
   'Create a short filter-change reminder for SMS and email.',
   '[{"source":"hubly","id":"seasonal_offer"}]'::jsonb, 70),

  ('photo_wedding', 'photography', 'seasonal_promotion', 'Wedding Season', 'summer', 'local_prospects', 'annual',
   array['instagram','facebook','email'], 'none', 'Inquire about dates',
   'Emotional, portfolio-led; limited date scarcity.',
   'Create a wedding season photography campaign highlighting portfolio and inquiry CTA.',
   '[{"source":"hubly","id":"holiday_campaign"}]'::jsonb, 100),
  ('photo_mini', 'photography', 'promote_service', 'Mini Sessions', 'fall', 'local_prospects', 'seasonal',
   array['instagram','facebook','email'], 'fixed_off', 'Book a mini session',
   'Accessible entry product; date windows; gift-able.',
   'Create a mini session campaign with date windows and booking CTA.',
   '[{"source":"hubly","id":"seasonal_offer"}]'::jsonb, 90),
  ('photo_holiday_family', 'photography', 'seasonal_promotion', 'Holiday Family Photos', 'holiday', 'local_prospects', 'annual',
   array['instagram','facebook','email'], 'none', 'Reserve your spot',
   'Warm family moments; card-ready images; book early.',
   'Create a holiday family photo campaign with reservation urgency.',
   '[{"source":"hubly","id":"holiday_campaign"}]'::jsonb, 95)
on conflict (id) do update set
  title = excluded.title,
  messaging_strategy = excluded.messaging_strategy,
  ai_prompt = excluded.ai_prompt,
  channels = excluded.channels,
  priority = excluded.priority;

-- Required assets
insert into public.campaign_playbook_assets (playbook_id, asset_key, required, notes) values
  ('hs_review_spotlight', 'review', true, 'Five-star review text + attribution'),
  ('hs_review_spotlight', 'logo', true, ''),
  ('hs_before_after', 'before_after', true, 'Paired job photos'),
  ('hs_before_after', 'logo', true, ''),
  ('hs_fill_schedule', 'offer', true, 'Open-slot offer or discount'),
  ('hs_fill_schedule', 'phone', true, ''),
  ('hs_win_back', 'offer', true, 'Win-back coupon'),
  ('hs_referral', 'offer', true, 'Referral reward'),
  ('hs_referral', 'logo', true, ''),
  ('hs_membership', 'membership_details', true, ''),
  ('hs_holiday', 'offer', false, ''),
  ('hs_holiday', 'logo', true, ''),
  ('pw_spring_clean', 'before_after', false, ''),
  ('pw_spring_clean', 'offer', true, ''),
  ('pw_spring_clean', 'logo', true, ''),
  ('pw_driveway', 'before_after', true, ''),
  ('hvac_summer_tune', 'offer', true, ''),
  ('hvac_summer_tune', 'service_list', false, ''),
  ('photo_wedding', 'job_photos', true, 'Portfolio images'),
  ('photo_mini', 'job_photos', true, '')
on conflict (playbook_id, asset_key) do nothing;

-- Seasonal calendar (representative months)
insert into public.campaign_seasonal_calendar (industry_id, month, playbook_id, label, priority) values
  ('pressure_washing', 1, 'hs_membership', 'Membership Renewal', 80),
  ('pressure_washing', 3, 'pw_spring_clean', 'Spring Cleaning', 100),
  ('pressure_washing', 5, 'pw_driveway', 'Memorial Day Driveway', 90),
  ('pressure_washing', 6, 'pw_hoa', 'Summer Ready / HOA', 85),
  ('pressure_washing', 9, 'pw_rainy', 'Rainy Season Prep', 90),
  ('pressure_washing', 11, 'hs_holiday', 'Holiday Campaign', 70),
  ('hvac', 3, 'hvac_filter', 'Filter Reminder', 60),
  ('hvac', 5, 'hvac_summer_tune', 'Summer Tune-Up', 100),
  ('hvac', 10, 'hvac_winter_inspect', 'Winter Inspection', 100),
  ('hvac', 1, 'hvac_membership', 'Membership Drive', 90),
  ('photography', 5, 'photo_wedding', 'Wedding Season', 100),
  ('photography', 9, 'photo_mini', 'Fall Minis', 95),
  ('photography', 11, 'photo_holiday_family', 'Holiday Family Photos', 100),
  ('home_services', 2, 'hs_referral', 'Valentine Referral', 70),
  ('home_services', 3, 'hs_before_after', 'Spring Proof', 80),
  ('home_services', 7, 'hs_fill_schedule', 'Summer Open Slots', 75),
  ('home_services', 11, 'hs_holiday', 'Holiday Campaign', 90)
on conflict (industry_id, month, playbook_id) do update set label = excluded.label, priority = excluded.priority;

-- Triggers
insert into public.campaign_triggers (id, industry_id, playbook_id, goal_id, title, rule_kind, threshold, priority) values
  ('trig_no_fb_7', null, 'hs_fill_schedule', 'fill_tomorrow_schedule', 'No Facebook post for 7 days', 'no_facebook_post_days', 7, 80),
  ('trig_jobs_10', null, 'hs_before_after', 'book_more_jobs', '10+ completed jobs this week', 'completed_jobs_week', 10, 90),
  ('trig_review_5', null, 'hs_review_spotlight', 'get_more_reviews', 'New 5-star review', 'new_five_star_review', 1, 100),
  ('trig_gbp_30', null, 'hs_before_after', 'book_more_jobs', 'No Google Business update 30 days', 'no_gbp_update_days', 30, 85),
  ('trig_open_tomorrow', null, 'hs_fill_schedule', 'fill_tomorrow_schedule', 'Open slots tomorrow', 'open_slots_tomorrow', 1, 95)
on conflict (id) do update set title = excluded.title, threshold = excluded.threshold, priority = excluded.priority;
