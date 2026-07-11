-- Track when a review request was sent for a completed job
alter table jobs
  add column if not exists review_requested_at timestamptz;
