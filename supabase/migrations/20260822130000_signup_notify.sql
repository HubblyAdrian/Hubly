-- Platform-owner signup notification, fired SERVER-SIDE on a successful claim.
--
-- The old notify-signup only ever fired from the retired Instant-Site path; the
-- current builder never called it, so real claims announced nothing. This fires
-- from a DB trigger on the claim itself (owner_id null -> set), so it can't die
-- with a closed tab, and the content is assembled server-side (brief + edit count
-- live in the DB). See supabase/functions/signup-notify.

-- Device is the one field only the client knows, and it must be captured at the
-- moment, never inferred later. The builder writes it here (draft-token gated,
-- while still unclaimed) just before it claims, so the row carries it when the
-- claim trigger fires.
alter table public.businesses add column if not exists signup_device text;

create or replace function public.set_draft_signup_device(
  p_business_id uuid,
  p_draft_token uuid,
  p_device text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.businesses
     set signup_device = nullif(btrim(p_device), '')
   where id = p_business_id
     and owner_id is null
     and draft_token is not null
     and draft_token = p_draft_token;
  return found;
end;
$$;

revoke all on function public.set_draft_signup_device(uuid, uuid, text) from public;
grant execute on function public.set_draft_signup_device(uuid, uuid, text) to anon, authenticated;

-- On a successful claim, tell the platform owner. Presents the cron secret from
-- Vault, exactly as the booking-completion trigger does (20260821010000). Fire and
-- forget; a missing secret warns loudly rather than failing silently.
create or replace function public.notify_platform_owner_on_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'hubly_cron_secret';
  if v_secret is null then
    raise warning 'notify_platform_owner_on_claim: hubly_cron_secret missing; platform owner NOT notified for business %', new.id;
    return new;
  end if;

  perform net.http_post(
    url := 'https://rtwxxkxpkqdrhclkozma.supabase.co/functions/v1/signup-notify',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-hubly-cron-secret', v_secret
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_platform_owner_on_claim on public.businesses;
create trigger trg_notify_platform_owner_on_claim
  after update on public.businesses
  for each row
  when (old.owner_id is null and new.owner_id is not null)
  execute function public.notify_platform_owner_on_claim();
