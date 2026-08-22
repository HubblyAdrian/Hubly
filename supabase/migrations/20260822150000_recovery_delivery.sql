-- The claim now also sends the PERSON a recovery email (their way back if they forget
-- which address they claimed with). Its delivery outcome is recorded, not assumed:
-- the trigger writes a pending 'owner' row before the call, and signup-notify flips it
-- to sent/failed. A row stuck at 'pending' means the call never landed.
--
-- Everything else is unchanged from 20260822130000.
create or replace function public.notify_platform_owner_on_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_recovery_id uuid;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'hubly_cron_secret';
  if v_secret is null then
    raise warning 'notify_platform_owner_on_claim: hubly_cron_secret missing; platform owner + person NOT notified for business %', new.id;
    return new;
  end if;

  -- Pending recovery row (recipient is the business owner / the person). subject is
  -- the signup itself; subject_id is the business.
  insert into public.notification_deliveries
    (business_id, subject_type, subject_id, recipient_role, channel, provider, status)
  values (new.id, 'signup', new.id, 'owner', 'email', 'resend', 'pending')
  returning id into v_recovery_id;

  perform net.http_post(
    url := 'https://rtwxxkxpkqdrhclkozma.supabase.co/functions/v1/signup-notify',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-hubly-cron-secret', v_secret
    ),
    body := jsonb_build_object(
      'record', to_jsonb(new),
      'recovery_delivery_id', v_recovery_id
    )
  );
  return new;
end;
$$;
