-- Every 10 minutes, ask whether the endpoint is refusing or drafts are burning.
-- Same shape and same vault secret as hubly-recurring-maintain-30min.
--
-- 10 minutes is the cadence, not the alert rate: ops-alert holds a 6h cooldown per alert
-- kind, so an outage produces one email, not one every ten minutes for as long as it runs.
select cron.schedule(
  'hubly-ops-alert-10min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://rtwxxkxpkqdrhclkozma.supabase.co/functions/v1/ops-alert',
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
