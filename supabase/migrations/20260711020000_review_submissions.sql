-- Public customer review submissions, pending owner approval before
-- being copied into businesses.meta.website.manualReviews. Only ever
-- reachable via a real review-request link tied to a specific job that
-- was actually sent a request (jobs.review_requested_at is not null).
create table if not exists review_submissions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  customer_name text not null,
  service_name text,
  stars int not null check (stars between 1 and 5),
  quote text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table review_submissions enable row level security;

-- Lets the public "leave a review" page confirm a review link is real
-- before showing the form, without exposing the rest of the jobs table
-- (phone/email/address) to anonymous visitors.
create or replace function get_review_request_context(p_job_id uuid)
returns table(business_id uuid, customer_name text, service_name text)
language sql security definer set search_path = public
as $$
  select business_id, customer_name, service_name
  from jobs
  where id = p_job_id and review_requested_at is not null
$$;
grant execute on function get_review_request_context(uuid) to anon, authenticated;

-- The actual security boundary: even a direct API call (bypassing the
-- RPC / UI check above) is rejected unless job_id really did have a
-- review request sent for it.
create policy "Public can submit reviews for a real requested job"
  on review_submissions for insert
  to public
  with check (
    status = 'pending'
    and exists (
      select 1 from jobs
      where jobs.id = review_submissions.job_id
        and jobs.business_id = review_submissions.business_id
        and jobs.review_requested_at is not null
    )
  );

create policy "Owners can view their own review submissions"
  on review_submissions for select
  to authenticated
  using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "Owners can approve or reject their own review submissions"
  on review_submissions for update
  to authenticated
  using (business_id in (select id from businesses where owner_id = auth.uid()))
  with check (business_id in (select id from businesses where owner_id = auth.uid()));
