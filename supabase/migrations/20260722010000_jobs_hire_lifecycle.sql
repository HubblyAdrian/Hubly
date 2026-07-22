-- First Customer hire lifecycle: reminders + completion follow-up stamps.
-- Supports one uninterrupted flow: book → pay → remind → complete → review.

alter table public.jobs
  add column if not exists reminder_sent_at timestamptz;

alter table public.jobs
  add column if not exists completion_followup_sent_at timestamptz;

comment on column public.jobs.reminder_sent_at is
  'When Hubly emailed the customer a pre-job reminder.';

comment on column public.jobs.completion_followup_sent_at is
  'When Hubly emailed the customer a completion follow-up (usually with review link).';
