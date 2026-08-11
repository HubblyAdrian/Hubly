-- Schedules the recurring-occurrence generator (hubly-recurring-maintain)
-- every 30 minutes — same cadence class google-calendar-maintain already
-- documents for itself ("every 15-30 minutes"), not a new convention.
--
-- The shared secret this job sends as x-hubly-cron-secret is stored in
-- Supabase Vault (vault.create_secret, run once outside of migrations —
-- migrations are committed to git, and a secret value must never be) and
-- looked up by name at call time. The Edge Function itself reads the same
-- value from its own HUBLY_CRON_SECRET function secret (supabase secrets
-- set), also not stored in the repo.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- cron.schedule() upserts by job name — re-running this migration (or a
-- future migration that calls it again with the same name) replaces the
-- existing job definition rather than creating a duplicate.
select cron.schedule(
  'hubly-recurring-maintain-30min',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://rtwxxkxpkqdrhclkozma.supabase.co/functions/v1/hubly-recurring-maintain',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-hubly-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets where name = 'hubly_cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
