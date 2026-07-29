-- Studio V1.0 freeze: prompt_template on playbooks + detailing playbooks + email publish channel note.

alter table public.campaign_playbooks
  add column if not exists description text not null default '',
  add column if not exists prompt_template text not null default '',
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaign_playbooks_status_check'
  ) then
    alter table public.campaign_playbooks
      add constraint campaign_playbooks_status_check
      check (status in ('active','draft','archived'));
  end if;
end $$;

-- Backfill prompt_template from Brief schema placeholders only (no strategic invention).
update public.campaign_playbooks
set prompt_template = 'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.'
where prompt_template is null or prompt_template = '';

update public.campaign_playbooks
set description = coalesce(nullif(description, ''), messaging_strategy)
where description = '';

-- Detailing-first playbooks (V1 success metric)
insert into public.campaign_playbooks (
  id, industry_id, goal_id, title, description, season, audience, frequency, channels,
  offer_type, cta, messaging_strategy, ai_prompt, prompt_template, template_refs, priority, status
) values
  ('dt_review_spotlight', 'detailing', 'get_more_reviews', 'Review Spotlight',
   'Turn a 5-star review into an email campaign that builds trust.',
   'any', 'existing_customers', 'triggered', array['email','instagram','facebook'],
   'none', 'Book your detail',
   'Lead with the customer quote; thank them; invite neighbors.',
   'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.',
   'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.',
   '[{"source":"hubly","id":"review_highlight"}]'::jsonb, 100, 'active'),
  ('dt_before_after', 'detailing', 'book_more_jobs', 'Before & After Reveal',
   'Share job-photo proof with a booking CTA.',
   'any', 'local_prospects', 'triggered', array['email','instagram','facebook'],
   'none', 'Book this detail',
   'Side-by-side proof; short outcome headline; soft CTA.',
   'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.',
   'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.',
   '[{"source":"hubly","id":"before_after"}]'::jsonb, 95, 'active'),
  ('dt_fill_schedule', 'detailing', 'fill_tomorrow_schedule', 'OpenSlots Tomorrow',
   'Fill open capacity tomorrow via email.',
   'any', 'local_prospects', 'triggered', array['email','sms'],
   'percent_off', 'Claim a slot',
   'Urgency without panic; limited openings tomorrow.',
   'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.',
   'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.',
   '[{"source":"hubly","id":"seasonal_offer"}]'::jsonb, 90, 'active'),
  ('dt_ceramic', 'detailing', 'promote_service', 'Promote Ceramic Coatings',
   'Feature ceramic coating as a premium upsell.',
   'any', 'local_prospects', 'monthly', array['email','instagram'],
   'none', 'Ask about ceramic',
   'Name ceramic coating; one benefit; proof; clear CTA.',
   'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.',
   'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.',
   '[{"source":"hubly","id":"seasonal_offer"}]'::jsonb, 88, 'active'),
  ('dt_win_back', 'detailing', 'win_back_customers', 'Win Back Past Customers',
   'Re-engage quiet customers with a return offer.',
   'any', 'past_customers', 'monthly', array['email','sms'],
   'percent_off', 'Book your return detail',
   'Warm, personal; exclusive win-back offer.',
   'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.',
   'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.',
   '[{"source":"hubly","id":"membership_promotion"}]'::jsonb, 85, 'active'),
  ('dt_seasonal', 'detailing', 'seasonal_promotion', 'Seasonal Detail Special',
   'Calendar-timed detail offer.',
   'any', 'local_prospects', 'seasonal', array['email','instagram'],
   'percent_off', 'Book seasonal special',
   'Seasonal timing; paint protection framing.',
   'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.',
   'Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.',
   '[{"source":"hubly","id":"seasonal_offer"}]'::jsonb, 80, 'active')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  prompt_template = excluded.prompt_template,
  channels = excluded.channels,
  priority = excluded.priority,
  status = 'active';

update public.campaign_playbooks set title = 'Open Slots Tomorrow' where id = 'dt_fill_schedule' and title like 'OpenSlots%';

-- Ensure email is present on core home_services playbook channels for V1 publish path
update public.campaign_playbooks
set channels = array['email'] || channels
where not ('email' = any(channels));

comment on column public.campaign_playbooks.prompt_template is
  'AI Writer template. May only reference Campaign Brief schema placeholders. Never open-ended strategy.';
