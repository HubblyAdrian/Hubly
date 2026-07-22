-- Expand Proof Mode verticals to full blueprint suite industries.
alter table public.hubly_proof_runs drop constraint if exists hubly_proof_runs_vertical_check;
alter table public.hubly_proof_runs
  add constraint hubly_proof_runs_vertical_check
  check (vertical in (
    'detailing', 'cleaning', 'windows', 'pressure_washing', 'landscaping', 'hvac',
    'electrical', 'plumbing', 'painting', 'junk_removal', 'photography', 'spa',
    'lawn_care' -- legacy alias retained
  ));
