-- THE OWNER HAS A NAME, AND NOWHERE TO PUT IT.
--
-- Measured 2026-09-14 (docs/WHAT_THE_MODEL_KNOWS.md §1): there is no owner-name column
-- anywhere. `hcIdentity.owner` is DERIVED at render time from auth.users.raw_user_meta_data,
-- falling back to guessing at the email local-part. Consequences, all of them measured:
--   · populated for 9 of 29 owners, and 4 of those 9 only because Google supplied it;
--   · never persisted — re-derived every page load;
--   · never reaches the model, so the assistant cannot use it in a single sentence;
--   · nothing has ever ASKED (spec step 7 is unimplemented).
--
-- A PURE ADD. New table, new functions, nothing existing is altered — the same rule as
-- get_business_jobs and set_business_service_catalog.
--
-- KEYED BY THE OWNER, NOT THE BUSINESS. A name is a fact about a person; an owner with two
-- businesses is one person with one name. "Welcome to Hubly" is likewise said once to a
-- person, not once per business they own.
--
-- AND IT CARRIES THE WELCOME. hcArrivalSeen reads localStorage, so whether an owner has been
-- welcomed is currently a fact about their BROWSER: a new laptop or a cleared cache makes them
-- a stranger again. Worse, that is the same state in which the deterministic new-signup opener
-- fires — so they are greeted as a stranger AND given no greeting, at the same moment. Storing
-- it here makes it a fact about the owner; localStorage becomes a fallback, not the truth.
create table if not exists public.hubly_owner_profile (
  owner_id     uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  -- WHERE THE NAME CAME FROM, because a name the owner typed must never be overwritten by one
  -- an identity provider guessed. Ranked in set_owner_display_name below.
  --   'owner'   — they told Hubly, in conversation. Highest trust.
  --   'signup'  — they typed it into Hubly's own signup form.
  --   'google'  — an OAuth profile supplied it. Useful, not authoritative.
  --   'unknown' — no name.
  name_source  text not null default 'unknown',
  name_set_at  timestamptz,
  welcomed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.hubly_owner_profile enable row level security;

-- An owner reads and nothing else: every write goes through the security-definer functions
-- below, so the precedence rule cannot be bypassed by a direct update from the browser.
drop policy if exists hubly_owner_profile_self_read on public.hubly_owner_profile;
create policy hubly_owner_profile_self_read on public.hubly_owner_profile
  for select using (owner_id = auth.uid());

create or replace function public.get_owner_profile(p_owner_id uuid)
returns table (display_name text, name_source text, welcomed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.display_name, p.name_source, p.welcomed_at
  from public.hubly_owner_profile p
  where p.owner_id = p_owner_id and p_owner_id = auth.uid();
$$;

-- A NAME THE OWNER GAVE US IS NEVER OVERWRITTEN BY ONE A PROVIDER GUESSED.
--
-- Ruled 2026-09-14. Without this the next Google token refresh silently replaces "Auz" with
-- "Austin Graef" and the assistant starts calling him by a name he did not choose — a fact
-- about a person, changed by us, from a source they never pointed at.
--
-- Returns: 1 written · 0 refused because a higher-trust name is already stored · -1 not the owner.
create or replace function public.set_owner_display_name(
  p_owner_id uuid, p_name text, p_source text default 'owner'
) returns integer language plpgsql security definer set search_path = public as $$
declare v_rank int; v_cur_rank int; v_cur text; v_name text;
begin
  if p_owner_id is null or p_owner_id <> auth.uid() then return -1; end if;
  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then return 0; end if;
  v_rank := case lower(coalesce(p_source,'unknown'))
              when 'owner' then 3 when 'signup' then 2 when 'google' then 1 else 0 end;
  select name_source into v_cur from public.hubly_owner_profile where owner_id = p_owner_id;
  v_cur_rank := case lower(coalesce(v_cur,'unknown'))
                  when 'owner' then 3 when 'signup' then 2 when 'google' then 1 else 0 end;
  -- Equal rank DOES overwrite: an owner correcting the name they gave us is still the owner.
  if v_cur is not null and v_rank < v_cur_rank then return 0; end if;

  insert into public.hubly_owner_profile (owner_id, display_name, name_source, name_set_at, updated_at)
  values (p_owner_id, v_name, lower(coalesce(p_source,'unknown')), now(), now())
  on conflict (owner_id) do update
    set display_name = excluded.display_name,
        name_source  = excluded.name_source,
        name_set_at  = now(),
        updated_at   = now();
  return 1;
end;
$$;

-- Said once to a person. Idempotent: a second call does not move the timestamp, so "have they
-- been welcomed" cannot drift with retries.
create or replace function public.mark_owner_welcomed(p_owner_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v timestamptz;
begin
  if p_owner_id is null or p_owner_id <> auth.uid() then return null; end if;
  insert into public.hubly_owner_profile (owner_id, welcomed_at, updated_at)
  values (p_owner_id, now(), now())
  on conflict (owner_id) do update
    set welcomed_at = coalesce(public.hubly_owner_profile.welcomed_at, now()),
        updated_at  = now();
  select welcomed_at into v from public.hubly_owner_profile where owner_id = p_owner_id;
  return v;
end;
$$;

revoke all on function public.set_owner_display_name(uuid, text, text) from public, anon;
revoke all on function public.mark_owner_welcomed(uuid) from public, anon;
grant execute on function public.get_owner_profile(uuid)                   to authenticated, service_role;
grant execute on function public.set_owner_display_name(uuid, text, text)  to authenticated, service_role;
grant execute on function public.mark_owner_welcomed(uuid)                 to authenticated, service_role;

comment on table public.hubly_owner_profile is
  'The owner as a PERSON: their name, where the name came from, and whether Hubly has welcomed them. '
  'Keyed by owner_id because a name and a welcome belong to a person, not to each business they own.';
