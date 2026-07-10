-- Membership pricing card: pending signups on booking_requests
alter table booking_requests
  add column if not exists is_membership_signup boolean default false,
  add column if not exists membership_snapshot jsonb;
