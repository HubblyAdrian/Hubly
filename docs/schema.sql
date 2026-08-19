--
-- PostgreSQL database dump
--

\restrict Gz6Z4KmKu0ohe4dLPRKMDRKX0nAh5kbCoghPekbzUbHnZbfusoY7xKZJ2M5bvqv

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: _protect_business_tier(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._protect_business_tier() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if (tg_op = 'UPDATE' and new.tier is distinct from old.tier)
     or (tg_op = 'INSERT' and new.tier is distinct from 'starter') then
    if current_user in ('anon','authenticated') then
      raise exception 'permission denied: tier can only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: complete_abandoned_booking(uuid, text, text, text, text[], text, text, text, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_abandoned_booking(p_id uuid, p_phone text, p_customer_email text DEFAULT NULL::text, p_service_name text DEFAULT NULL::text, p_addons text[] DEFAULT NULL::text[], p_vehicle_color text DEFAULT NULL::text, p_condition text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_requested_date text DEFAULT NULL::text, p_requested_time text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_deposit_cents integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row booking_requests%rowtype;
begin
  select * into v_row from booking_requests where id = p_id;

  if not found
     or v_row.status is distinct from 'abandoned'
     or v_row.customer_phone is null
     or regexp_replace(v_row.customer_phone, '\D', '', 'g') is distinct from regexp_replace(coalesce(p_phone,''), '\D', '', 'g')
  then
    return jsonb_build_object('ok', false);
  end if;

  update booking_requests set
    status = 'pending',
    customer_email = coalesce(p_customer_email, customer_email),
    service_name = coalesce(p_service_name, service_name),
    addons = coalesce(p_addons, addons),
    vehicle_color = coalesce(p_vehicle_color, vehicle_color),
    condition = coalesce(p_condition, condition),
    notes = coalesce(p_notes, notes),
    requested_date = coalesce(p_requested_date::date, requested_date),
    requested_time = coalesce(p_requested_time, requested_time),
    address = coalesce(p_address, address),
    deposit_cents = p_deposit_cents
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;


--
-- Name: create_business_document(uuid, uuid, text, jsonb, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_business_document(p_business_id uuid, p_draft_token uuid, p_tag text DEFAULT 'website'::text, p_document jsonb DEFAULT '{}'::jsonb, p_rendered_html text DEFAULT NULL::text, p_created_by text DEFAULT 'ai'::text, p_design_rationale text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row businesses%rowtype;
  v_next_version int;
  v_id uuid;
begin
  select * into v_row from businesses where id = p_business_id;

  if not found
     or v_row.owner_id is not null
     or v_row.draft_token is null
     or v_row.draft_token is distinct from p_draft_token
  then
    return jsonb_build_object('ok', false, 'error', 'not_a_draft_or_token_mismatch');
  end if;

  if p_created_by not in ('ai', 'user', 'patch') then
    return jsonb_build_object('ok', false, 'error', 'invalid_created_by');
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from business_documents
  where business_id = p_business_id and tag = coalesce(p_tag, 'website');

  insert into business_documents (business_id, tag, version, document, rendered_html, created_by, design_rationale)
  values (p_business_id, coalesce(p_tag, 'website'), v_next_version, p_document, p_rendered_html, p_created_by, p_design_rationale)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_next_version, 'slug', v_row.slug);
end;
$$;


--
-- Name: ensure_marketplace_provider_for_business(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_marketplace_provider_for_business() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.owner_id is null then
    return new;
  end if;
  insert into public.marketplace_providers (business_id, owner_id, provider_kind)
  values (new.id, new.owner_id, 'hubly')
  on conflict (business_id) do nothing;
  return new;
end;
$$;


--
-- Name: first_name_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.first_name_token(p_name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select lower(trim(split_part(trim(coalesce(p_name, '')), ' ', 1)));
$$;


--
-- Name: get_booked_times(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_booked_times(p_business_id uuid, p_date date) RETURNS TABLE(scheduled_time time without time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT scheduled_time FROM jobs
  WHERE business_id = p_business_id
    AND scheduled_date = p_date
    AND status <> 'cancelled'
    AND scheduled_time IS NOT NULL;
$$;


--
-- Name: get_busy_windows(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_busy_windows(p_business_id uuid, p_date date) RETURNS TABLE(scheduled_time time without time zone, duration_hours numeric)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT j.scheduled_time, COALESCE(j.duration_hours, s.duration_hours, 2)
  FROM jobs j
  LEFT JOIN services s ON s.business_id = j.business_id AND s.name = j.service_name
  WHERE j.business_id = p_business_id
    AND j.scheduled_date = p_date
    AND j.status <> 'cancelled'
    AND j.scheduled_time IS NOT NULL;
$$;


--
-- Name: get_chatbot_conversations_for_business(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_chatbot_conversations_for_business(p_business_id uuid) RETURNS TABLE(id uuid, started_at timestamp with time zone, ended_at timestamp with time zone, customer_name text, customer_phone text, customer_email text, consented_to_followup boolean, resulted_in_booking boolean, topics jsonb)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.id, c.started_at, c.ended_at,
    case when b.tier='pro' then c.customer_name else null end,
    case when b.tier='pro' then c.customer_phone else null end,
    case when b.tier='pro' then c.customer_email else null end,
    c.consented_to_followup, c.resulted_in_booking, c.topics
  from chatbot_conversations c
  join businesses b on b.id = c.business_id
  where c.business_id = p_business_id
    and b.owner_id = auth.uid()
  order by c.started_at desc
$$;


--
-- Name: get_chatbot_messages_for_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_chatbot_messages_for_conversation(p_conversation_id uuid) RETURNS TABLE(id uuid, role text, content text, created_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select m.id, m.role, m.content, m.created_at
  from chatbot_messages m
  join chatbot_conversations c on c.id = m.conversation_id
  join businesses b on b.id = c.business_id
  where m.conversation_id = p_conversation_id
    and b.owner_id = auth.uid()
    and b.tier = 'pro'
  order by m.created_at asc
$$;


--
-- Name: get_document_build_status(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_document_build_status(p_slug text, p_tag text DEFAULT 'website'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_business_id uuid;
  v_job record;
  v_has_doc boolean;
begin
  select id into v_business_id from businesses where slug = p_slug;
  if v_business_id is null then
    return jsonb_build_object('status', 'unknown');
  end if;

  select exists(
    select 1 from business_documents
    where business_id = v_business_id and tag = p_tag
  ) into v_has_doc;

  select * into v_job
  from document_build_jobs
  where business_id = v_business_id and tag = p_tag
  order by started_at desc
  limit 1;

  if v_job is null then
    -- No job row: either nothing was ever asked for, or the page predates this
    -- table. An existing document means the second, and "done" is the honest
    -- answer to "is a build still coming".
    return jsonb_build_object('status', case when v_has_doc then 'succeeded' else 'none' end,
                              'hasDocument', v_has_doc);
  end if;

  return jsonb_build_object(
    -- A document that exists beats whatever the job says. A build can succeed
    -- and lose its status write; the page is the outcome, the row is the record.
    'status', case
                when v_has_doc then 'succeeded'
                when v_job.status = 'running' and now() > v_job.expected_by then 'stalled'
                else v_job.status
              end,
    'hasDocument', v_has_doc,
    'attempts', v_job.attempts,
    'startedAt', v_job.started_at,
    'expectedBy', v_job.expected_by,
    -- Coarse, and only for terminal failures the build itself reported. Never
    -- the raw error, which can carry model output.
    'reason', case when v_job.status = 'failed' then coalesce(v_job.error, 'unknown') else null end
  );
end;
$$;


--
-- Name: get_public_business(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_business(p_slug text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select to_jsonb(b) - 'draft_token'
  from public.businesses b
  where b.slug = p_slug
  limit 1;
$$;


--
-- Name: get_public_business_document(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_business_document(p_slug text, p_tag text DEFAULT 'website'::text) RETURNS TABLE(rendered_html text, version integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select d.rendered_html, d.version
  from public.business_documents d
  join public.businesses b on b.id = d.business_id
  where b.slug = p_slug
    and d.tag = coalesce(nullif(p_tag, ''), 'website')
  order by d.version desc
  limit 1;
$$;


--
-- Name: get_review_request_context(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_review_request_context(p_job_id uuid) RETURNS TABLE(business_id uuid, customer_name text, service_name text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select business_id, customer_name, service_name
  from jobs
  where id = p_job_id and review_requested_at is not null
$$;


--
-- Name: jobs_sync_metadata_touch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.jobs_sync_metadata_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  -- Always keep hubly_job_id aligned with primary key
  if new.id is not null then
    new.hubly_job_id := new.id;
  end if;

  if tg_op = 'INSERT' then
    if new.last_hubly_update is null then
      new.last_hubly_update := now();
    end if;
    if new.sync_status is null or new.sync_status = '' then
      new.sync_status := 'idle';
    end if;
    return new;
  end if;

  -- UPDATE: Sync Engine Google→Hubly writes set sync_origin = 'google'
  if new.sync_origin is not null and lower(new.sync_origin) = 'google' then
    new.sync_origin := null;
    return new;
  end if;

  -- Hubly-origin change to schedule / location / notes / status
  if (new.scheduled_date, new.scheduled_time, new.address, new.notes,
      new.duration_hours, new.status, new.customer_name, new.service_name, new.phone)
     is distinct from
     (old.scheduled_date, old.scheduled_time, old.address, old.notes,
      old.duration_hours, old.status, old.customer_name, old.service_name, old.phone)
  then
    new.last_hubly_update := now();
    if new.google_event_id is not null and coalesce(new.sync_status, '') not in ('error') then
      new.sync_status := 'pending';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: names_corroborate(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.names_corroborate(p_name_a text, p_name_b text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select
    case
      when public.first_name_token(p_name_a) = '' or public.first_name_token(p_name_b) = '' then false
      when public.first_name_token(p_name_a) = public.first_name_token(p_name_b) then true
      when length(public.first_name_token(p_name_a)) >= 4
           and left(public.first_name_token(p_name_b), length(public.first_name_token(p_name_a))) = public.first_name_token(p_name_a)
        then true
      when length(public.first_name_token(p_name_b)) >= 4
           and left(public.first_name_token(p_name_a), length(public.first_name_token(p_name_b))) = public.first_name_token(p_name_b)
        then true
      else false
    end;
$$;


--
-- Name: owns_business(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_business(bid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
  select exists (
    select 1 from businesses
    where id = bid and owner_id = auth.uid()
  );
$$;


--
-- Name: patch_business_in_progress(uuid, uuid, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.patch_business_in_progress(p_id uuid, p_draft_token uuid, p_patch jsonb DEFAULT '{}'::jsonb, p_website_meta jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

declare
  v_row businesses%rowtype;
  v_meta jsonb;
  v_sections text[];
  v_business_type text;
  v_header_mode text;
  -- jsonb, matching the service_area_cities column.
  v_cities jsonb;
begin
  select * into v_row from businesses where id = p_id;

  if not found
     or v_row.owner_id is not null
     or v_row.draft_token is null
     or v_row.draft_token is distinct from p_draft_token
  then
    return jsonb_build_object('ok', false);
  end if;

  v_business_type := nullif(p_patch->>'business_type', '');
  v_header_mode := nullif(p_patch->>'header_mode', '');

  if p_website_meta is not null or v_business_type is not null or v_header_mode is not null then
    v_meta := coalesce(nullif(v_row.meta, '')::jsonb, '{}'::jsonb);
    if p_website_meta is not null then
      v_meta := jsonb_set(
        v_meta,
        '{website}',
        coalesce(v_meta->'website', '{}'::jsonb) || p_website_meta,
        true
      );
    end if;
    if v_business_type is not null then
      v_meta := jsonb_set(v_meta, '{businessType}', to_jsonb(v_business_type), true);
    end if;
    if v_header_mode is not null then
      v_meta := jsonb_set(v_meta, '{headerMode}', to_jsonb(v_header_mode), true);
    end if;
  end if;

  -- PRESERVED FROM 20260817040000, verbatim. Only the four real sections,
  -- deduplicated, order preserved. Anything else is dropped rather than
  -- trusted: this array drives rendering, and an invented or misspelled
  -- section name would render a page with a hole in it.
  if p_patch ? 'section_order' then
    select array_agg(s order by ord)
      into v_sections
      from (
        select distinct on (s) s, ord
        from (
          select value::text as s, ordinality as ord
          from jsonb_array_elements_text(p_patch->'section_order') with ordinality as t(value, ordinality)
        ) raw
        where s in ('services', 'portfolio', 'reviews', 'about')
        order by s, ord
      ) dedup;
  end if;

  -- An empty array means "no change", not "clear the list": every caller with
  -- nothing to say sends nothing, and a caller that genuinely wants it emptied
  -- is not a case that exists yet.
  if jsonb_typeof(p_patch->'service_area_cities') = 'array'
     and jsonb_array_length(p_patch->'service_area_cities') > 0 then
    v_cities := p_patch->'service_area_cities';
  end if;

  update businesses set
    name = coalesce(nullif(p_patch->>'name', ''), name),
    tagline = coalesce(p_patch->>'tagline', tagline),
    about = coalesce(p_patch->>'about', about),
    phone = coalesce(p_patch->>'phone', phone),
    email = coalesce(p_patch->>'email', email),
    city = coalesce(p_patch->>'city', city),
    -- The five this migration series exists to add.
    state = coalesce(nullif(p_patch->>'state', ''), state),
    address = coalesce(nullif(p_patch->>'address', ''), address),
    service_area_cities = coalesce(v_cities, service_area_cities),
    travel_radius_miles = coalesce((nullif(p_patch->>'travel_radius_miles', ''))::numeric, travel_radius_miles),
    years_in_business = coalesce((nullif(p_patch->>'years_in_business', ''))::int, years_in_business),
    business_type = coalesce(v_business_type, business_type),
    brand_color = coalesce(p_patch->>'brand_color', brand_color),
    bg_color = coalesce(p_patch->>'bg_color', bg_color),
    -- Only when at least one valid section survived validation above.
    section_order = case
      when v_sections is not null and array_length(v_sections, 1) > 0 then v_sections
      else section_order
    end,
    logo_url = coalesce(p_patch->>'logo_url', logo_url),
    banner_url = coalesce(p_patch->>'banner_url', banner_url),
    gen_hero_headline = coalesce(p_patch->>'gen_hero_headline', gen_hero_headline),
    gen_hero_subhead = coalesce(p_patch->>'gen_hero_subhead', gen_hero_subhead),
    gen_about = coalesce(p_patch->>'gen_about', gen_about),
    gen_seo_title = coalesce(p_patch->>'gen_seo_title', gen_seo_title),
    gen_seo_description = coalesce(p_patch->>'gen_seo_description', gen_seo_description),
    gen_why_choose = coalesce(p_patch->'gen_why_choose', gen_why_choose),
    gen_faq = coalesce(p_patch->'gen_faq', gen_faq),
    meta = coalesce(v_meta::text, meta)
  where id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id, 'slug', v_row.slug);
end;
$$;


--
-- Name: release_gcal_sync_lock(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_gcal_sync_lock(p_business_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.google_calendar_connections
  set sync_lock_until = null, updated_at = now()
  where business_id = p_business_id;
end;
$$;


--
-- Name: set_business_draft_services(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_business_draft_services(p_id uuid, p_draft_token uuid, p_services jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row businesses%rowtype;
  v_item jsonb;
  v_count int := 0;
  v_sort int := 0;
begin
  select * into v_row from businesses where id = p_id;

  if not found
     or v_row.owner_id is not null
     or v_row.draft_token is null
     or v_row.draft_token is distinct from p_draft_token
     or jsonb_typeof(p_services) is distinct from 'array'
  then
    return jsonb_build_object('ok', false);
  end if;

  delete from services where business_id = p_id;

  for v_item in select * from jsonb_array_elements(p_services)
  loop
    if coalesce(trim(v_item->>'name'), '') = '' then
      continue;
    end if;
    insert into services (business_id, name, description, price, duration_hours, sort_order)
    values (
      p_id,
      trim(v_item->>'name'),
      nullif(v_item->>'description', ''),
      coalesce((v_item->>'price')::numeric, 0),
      nullif(v_item->>'durationHours', '')::numeric,
      v_sort
    );
    v_count := v_count + 1;
    v_sort := v_sort + 1;
  end loop;

  return jsonb_build_object('ok', true, 'id', p_id, 'slug', v_row.slug, 'count', v_count);
end;
$$;


--
-- Name: set_business_hours_in_progress(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_business_hours_in_progress(p_id uuid, p_draft_token uuid, p_hours jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row businesses%rowtype;
  v_entry jsonb;
  v_weekday smallint;
  v_written int := 0;
begin
  select * into v_row from businesses where id = p_id;

  if not found
     or v_row.owner_id is not null
     or v_row.draft_token is null
     or v_row.draft_token is distinct from p_draft_token
  then
    return jsonb_build_object('ok', false, 'error', 'not_an_open_draft');
  end if;

  if jsonb_typeof(p_hours) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'hours_not_an_array');
  end if;

  for v_entry in select * from jsonb_array_elements(p_hours) loop
    v_weekday := (v_entry->>'weekday')::smallint;
    if v_weekday is null or v_weekday < 0 or v_weekday > 6 then
      continue;
    end if;
    insert into settings_business_hours (business_id, weekday, open_time, close_time, closed)
    values (
      p_id,
      v_weekday,
      nullif(v_entry->>'open', '')::time,
      nullif(v_entry->>'close', '')::time,
      coalesce((v_entry->>'closed')::boolean, false)
    )
    on conflict (business_id, weekday) do update
      set open_time = excluded.open_time,
          close_time = excluded.close_time,
          closed = excluded.closed;
    v_written := v_written + 1;
  end loop;

  return jsonb_build_object('ok', true, 'written', v_written);
end;
$$;


--
-- Name: start_business_in_progress(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_business_in_progress(p_name text, p_business_type text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_token uuid := gen_random_uuid();
  v_base text;
  v_slug text;
  v_type text;
  v_meta text;
  v_tries int := 0;
begin
  if coalesce(trim(p_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_name');
  end if;

  v_type := nullif(trim(coalesce(p_business_type, '')), '');
  v_meta := case when v_type is not null
    then jsonb_build_object('businessType', v_type)::text
    else null
  end;

  v_base := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'business'; end if;
  v_base := left(v_base, 40);

  loop
    v_slug := v_base || case when v_tries = 0 then '' else '-' || substr(md5(random()::text), 1, 5) end;
    begin
      if v_type is null then
        insert into businesses (name, slug, owner_id, draft_token)
        values (trim(p_name), v_slug, null, v_token)
        returning id into v_id;
      else
        insert into businesses (name, slug, business_type, owner_id, draft_token, meta)
        values (trim(p_name), v_slug, v_type, null, v_token, v_meta)
        returning id into v_id;
      end if;
      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 6 then
        return jsonb_build_object('ok', false, 'error', 'slug_unavailable');
      end if;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug, 'draft_token', v_token);
end;
$$;


--
-- Name: supersede_abandoned_booking_on_resume(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.supersede_abandoned_booking_on_resume() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_candidates uuid[];
begin
  if NEW.status = 'abandoned' or NEW.customer_phone is null or trim(NEW.customer_phone) = '' then
    return NEW;
  end if;

  select array_agg(id) into v_candidates
  from public.booking_requests
  where business_id = NEW.business_id
    and status = 'abandoned'
    and id <> NEW.id
    and customer_phone is not null
    and regexp_replace(customer_phone, '\D', '', 'g') = regexp_replace(NEW.customer_phone, '\D', '', 'g')
    and created_at >= NEW.created_at - interval '30 days'
    and created_at <= NEW.created_at
    and public.names_corroborate(customer_name, NEW.customer_name);

  -- Ambiguous (0 or >1 candidates) -- do nothing rather than guess.
  if v_candidates is null or array_length(v_candidates, 1) <> 1 then
    return NEW;
  end if;

  update public.booking_requests
  set status = 'superseded',
      superseded_by = NEW.id,
      superseded_at = now()
  where id = v_candidates[1];

  return NEW;
end;
$$;


--
-- Name: sync_business_marketplace_capability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_business_marketplace_capability() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.businesses
  set capabilities = coalesce(capabilities, '{}'::jsonb) ||
    jsonb_build_object(
      'marketplace', coalesce(new.marketplace_enabled, false),
      'hubly_pro', case
        when coalesce(new.provider_kind, 'hubly') = 'marketplace_only' then
          coalesce((capabilities->>'hubly_pro')::boolean, false)
        else
          coalesce((capabilities->>'hubly_pro')::boolean, true)
      end
    )
  where id = new.business_id;
  return new;
end;
$$;


--
-- Name: touch_business_dna_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_business_dna_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_business_memories_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_business_memories_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_business_table_config_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_business_table_config_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_commerce_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_commerce_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_hubly_app_connections_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_hubly_app_connections_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_hubly_conversation_memories_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_hubly_conversation_memories_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: touch_photography_project_workspaces_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_photography_project_workspaces_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_photography_projects_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_photography_projects_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_user_table_preferences_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_user_table_preferences_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_workspace_memories_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_workspace_memories_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: try_acquire_gcal_sync_lock(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.try_acquire_gcal_sync_lock(p_business_id uuid, p_ttl_seconds integer DEFAULT 45) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  updated int;
begin
  if p_business_id is null then
    return false;
  end if;
  update public.google_calendar_connections
  set
    sync_lock_until = now() + make_interval(secs => greatest(5, least(coalesce(p_ttl_seconds, 45), 120))),
    updated_at = now()
  where business_id = p_business_id
    and (
      sync_lock_until is null
      or sync_lock_until < now()
    );
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;


--
-- Name: try_gcal_webhook_debounce(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.try_gcal_webhook_debounce(p_business_id uuid, p_min_seconds integer DEFAULT 15) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  updated int;
begin
  update public.google_calendar_connections
  set
    last_webhook_at = now(),
    updated_at = now()
  where business_id = p_business_id
    and (
      last_webhook_at is null
      or last_webhook_at < now() - make_interval(secs => greatest(1, least(coalesce(p_min_seconds, 15), 120)))
    );
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;


--
-- Name: update_abandoned_booking_lead(uuid, text, text, text, text, text, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_abandoned_booking_lead(p_id uuid, p_old_phone text, p_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_service_name text DEFAULT NULL::text, p_vehicle_type text DEFAULT NULL::text, p_vehicle_year text DEFAULT NULL::text, p_vehicle_make text DEFAULT NULL::text, p_vehicle_model text DEFAULT NULL::text, p_requested_date text DEFAULT NULL::text, p_requested_time text DEFAULT NULL::text, p_address text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row booking_requests%rowtype;
begin
  select * into v_row from booking_requests where id = p_id;

  if not found
     or v_row.status is distinct from 'abandoned'
     or v_row.customer_phone is null
     or regexp_replace(v_row.customer_phone, '\D', '', 'g') is distinct from regexp_replace(coalesce(p_old_phone,''), '\D', '', 'g')
  then
    return jsonb_build_object('ok', false);
  end if;

  update booking_requests set
    customer_name = coalesce(p_name, customer_name),
    customer_phone = coalesce(p_phone, customer_phone),
    customer_email = coalesce(p_email, customer_email),
    service_name = coalesce(p_service_name, service_name),
    vehicle_type = coalesce(p_vehicle_type, vehicle_type),
    vehicle_year = coalesce(p_vehicle_year, vehicle_year),
    vehicle_make = coalesce(p_vehicle_make, vehicle_make),
    vehicle_model = coalesce(p_vehicle_model, vehicle_model),
    requested_date = coalesce(p_requested_date::date, requested_date),
    requested_time = coalesce(p_requested_time, requested_time),
    address = coalesce(p_address, address)
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;


--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[array_length(_parts, 1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    name text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    description text,
    sort_order integer DEFAULT 0
);


--
-- Name: adobe_lightroom_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adobe_lightroom_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    adobe_user_id text NOT NULL,
    adobe_email text,
    adobe_display_name text,
    refresh_token text,
    access_token text,
    access_token_expires_at timestamp with time zone,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    connected_at timestamp with time zone DEFAULT now() NOT NULL,
    last_sync_at timestamp with time zone,
    last_error text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    catalog_id text,
    last_token_refresh_at timestamp with time zone
);


--
-- Name: TABLE adobe_lightroom_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.adobe_lightroom_connections IS 'Owner Adobe Lightroom OAuth tokens (IMS). Never expose refresh/access tokens to the browser.';


--
-- Name: COLUMN adobe_lightroom_connections.catalog_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.adobe_lightroom_connections.catalog_id IS 'Cached Lightroom catalog id from GET /v2/catalog (service-role only).';


--
-- Name: COLUMN adobe_lightroom_connections.last_token_refresh_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.adobe_lightroom_connections.last_token_refresh_at IS 'When the access token was last refreshed via IMS.';


--
-- Name: adobe_oauth_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adobe_oauth_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    state text NOT NULL,
    owner_id uuid NOT NULL,
    business_id uuid NOT NULL,
    return_to text,
    project_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: ask_hubly_activity_feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ask_hubly_activity_feed (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    kind text NOT NULL,
    label text NOT NULL,
    meta text,
    href text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ask_hubly_ai_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ask_hubly_ai_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    user_id uuid,
    action_type text NOT NULL,
    status text NOT NULL,
    requires_confirm boolean DEFAULT true NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    note text,
    pending_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ask_hubly_ai_actions_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'confirmed'::text, 'cancelled'::text, 'executed'::text, 'failed'::text])))
);


--
-- Name: TABLE ask_hubly_ai_actions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ask_hubly_ai_actions IS 'Append-only Ask Hubly action log for confirmation + audit (Rule #22).';


--
-- Name: ask_hubly_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ask_hubly_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    user_id uuid,
    title text DEFAULT 'Ask Hubly'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE ask_hubly_conversations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ask_hubly_conversations IS 'Ask Hubly conversation threads. Operational rows stay in owner modules.';


--
-- Name: ask_hubly_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ask_hubly_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    delta_pct numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ask_hubly_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ask_hubly_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    business_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ask_hubly_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);


--
-- Name: booking_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    customer_email text,
    service_name text,
    addons text[],
    vehicle_type text,
    vehicle_year text,
    vehicle_make text,
    vehicle_model text,
    vehicle_color text,
    condition text,
    requested_date date,
    requested_time text,
    address text,
    notes text,
    sms_consent boolean,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    is_membership_signup boolean DEFAULT false,
    membership_snapshot jsonb,
    payment_status text DEFAULT 'none'::text NOT NULL,
    amount_due_cents integer,
    amount_paid_cents integer,
    currency text DEFAULT 'usd'::text NOT NULL,
    stripe_checkout_session_id text,
    stripe_payment_intent_id text,
    paid_at timestamp with time zone,
    deposit_cents integer,
    superseded_by uuid,
    superseded_at timestamp with time zone,
    payment_rule text,
    amount_required_cents integer,
    sms_consent_at timestamp with time zone,
    sms_consent_text text,
    sms_marketing_consent boolean DEFAULT false NOT NULL,
    sms_marketing_consent_at timestamp with time zone,
    sms_marketing_consent_text text,
    CONSTRAINT booking_requests_payment_rule_check CHECK (((payment_rule IS NULL) OR (payment_rule = ANY (ARRAY['pay_in_full'::text, 'deposit'::text, 'pay_after_service'::text, 'customer_choice'::text, 'card_on_file'::text]))))
);


--
-- Name: COLUMN booking_requests.sms_consent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.sms_consent IS 'TRANSACTIONAL SMS consent — messages about THIS booking (scheduling, service updates). Existed unused since creation; wired 2026-08-17. Does NOT authorise marketing: see sms_marketing_consent. NULL means never asked, which is not the same as false (declined).';


--
-- Name: COLUMN booking_requests.payment_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.payment_status IS 'none | pending_checkout | paid | failed | refunded';


--
-- Name: COLUMN booking_requests.deposit_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.deposit_cents IS 'Real configured deposit amount for this booking, from the business''s Payment & deposits setting at time of booking. Null = no deposit was configured (full payment or pay-in-person).';


--
-- Name: COLUMN booking_requests.superseded_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.superseded_by IS 'Set when this abandoned row is auto-matched to a later real booking from the same customer (see supersede_abandoned_booking_on_resume trigger). Points at the row that superseded it. Never set on non-abandoned rows.';


--
-- Name: COLUMN booking_requests.superseded_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.superseded_at IS 'Timestamp of the auto-match in superseded_by. Null unless superseded_by is set.';


--
-- Name: COLUMN booking_requests.payment_rule; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.payment_rule IS 'The payment rule that applied WHEN THIS BOOKING WAS MADE, frozen so a later change to the business or package default cannot re-judge an old booking. NULL means the booking predates this column — consumers must fall back to inference from payment_status/amount_due_cents and must NOT assume pay_after_service. Website bookings only; marketplace uses marketplace_bookings.payment_rule.';


--
-- Name: COLUMN booking_requests.amount_required_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.amount_required_cents IS 'What had to be paid AT BOOKING TIME for this booking to be considered settled — the deposit for a deposit booking, the full total for pay_in_full, and 0 when nothing was owed (pay in person). NOT the order total. A booking is paid up when amount_paid_cents >= amount_required_cents. NULL means unknown (pre-migration row), which is NOT the same as 0.';


--
-- Name: COLUMN booking_requests.sms_consent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.sms_consent_at IS 'When transactional consent was given. NULL for rows backfilled from the [SMS_CONSENT:yes] notes marker, where only the booking timestamp is known.';


--
-- Name: COLUMN booking_requests.sms_consent_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.sms_consent_text IS 'The EXACT consent wording shown to the customer. A boolean records that someone agreed; this records what they agreed to, which is the part that matters when it is challenged. NULL on backfilled rows — the wording at the time was not captured.';


--
-- Name: COLUMN booking_requests.sms_marketing_consent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.sms_marketing_consent IS 'Promotional/marketing SMS consent. Requires prior express written consent: a separate, unticked-by-default box that names the sender, discloses automated messaging and frequency, and states consent is not a condition of purchase. FALSE for every existing row — nobody has ever been asked.';


--
-- Name: business_dna; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_dna (
    business_id uuid NOT NULL,
    dna jsonb DEFAULT '{"brand": {}, "goals": [], "pricing": {}, "version": 1, "identity": {}, "services": {}, "marketing": {}, "operations": {}, "personality": {}, "customerProfile": {}}'::jsonb NOT NULL,
    dna_version integer DEFAULT 1 NOT NULL,
    source text DEFAULT 'system'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_dna_source_check CHECK ((source = ANY (ARRAY['understanding'::text, 'client'::text, 'weekly_learning'::text, 'system'::text])))
);


--
-- Name: TABLE business_dna; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.business_dna IS 'Hubly Business DNA — interpretive identity (personality, goals, ideal customer). Separate from business_memories facts.';


--
-- Name: COLUMN business_dna.dna; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_dna.dna IS 'Canonical HublyBusinessDNA JSON. Never store raw conversation or Memory facts here.';


--
-- Name: business_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    tag text DEFAULT 'website'::text NOT NULL,
    version integer NOT NULL,
    document jsonb NOT NULL,
    rendered_html text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    design_rationale text,
    CONSTRAINT business_documents_created_by_check CHECK ((created_by = ANY (ARRAY['ai'::text, 'user'::text, 'patch'::text])))
);


--
-- Name: COLUMN business_documents.design_rationale; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.design_rationale IS 'The model''s own real, in-band explanation of its structural/creative choices for this specific version (see buildDesignRationaleInstructions) -- including why any reserved element was or wasn''t included. Null for patch-created versions, which don''t produce one.';


--
-- Name: business_memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_memories (
    business_id uuid NOT NULL,
    memory jsonb DEFAULT '{"version": 1}'::jsonb NOT NULL,
    memory_version integer DEFAULT 1 NOT NULL,
    source text DEFAULT 'client'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_memories_source_check CHECK ((source = ANY (ARRAY['client'::text, 'ingest'::text, 'understanding'::text, 'system'::text, 'brain'::text, 'hubly_brain'::text])))
);


--
-- Name: TABLE business_memories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.business_memories IS 'Hubly Brain Business Memory SSOT. Structured facts only — Planner reads this, never raw conversation.';


--
-- Name: COLUMN business_memories.memory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_memories.memory IS 'Canonical HublyBusinessMemory JSON (versioned). Updated by Understanding / client sync; never by the model writing DB directly.';


--
-- Name: business_memory_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_memory_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    change_id text NOT NULL,
    memory_version integer NOT NULL,
    path text NOT NULL,
    previous jsonb,
    next jsonb,
    reason text NOT NULL,
    expert_id text NOT NULL,
    importance text DEFAULT 'medium'::text NOT NULL,
    confidence integer DEFAULT 0 NOT NULL,
    source text DEFAULT 'ai_inference'::text NOT NULL,
    committed_by text DEFAULT 'hubly_brain'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_memory_changes_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100))),
    CONSTRAINT business_memory_changes_importance_check CHECK ((importance = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT business_memory_changes_source_check CHECK ((source = ANY (ARRAY['user'::text, 'ai_inference'::text, 'external_integration'::text])))
);


--
-- Name: TABLE business_memory_changes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.business_memory_changes IS 'Hubly Brain Business Memory changelog — every commit is versioned, reasoned, timestamped, and attributable.';


--
-- Name: business_table_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_table_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    table_key text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE business_table_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.business_table_config IS 'Business-wide (shared across every employee) table configuration — custom field definitions, renamed defaults, required fields. Distinct from user_table_preferences, which is per-user and never shared.';


--
-- Name: business_timeline_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_timeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    detail text,
    capability text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_timeline_events_kind_check CHECK ((kind = ANY (ARRAY['action'::text, 'recommendation'::text, 'milestone'::text, 'learning'::text])))
);


--
-- Name: TABLE business_timeline_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.business_timeline_events IS 'Hubly signature Business Timeline — what Hubly did and what it recommends next.';


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.businesses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    name text NOT NULL,
    tagline text,
    slug text NOT NULL,
    phone text,
    email text,
    city text,
    about text,
    brand_color text DEFAULT '#1a3a6e'::text,
    bg_color text DEFAULT '#f0f0ee'::text,
    logo_url text,
    banner_url text,
    ig_handle text,
    fb_url text,
    tiktok_handle text,
    google_url text,
    review_embed_code text,
    payment_setting text DEFAULT 'later'::text,
    deposit_type text,
    deposit_value numeric,
    deposit_message text DEFAULT 'We will call you to arrange your deposit.'::text,
    section_order text[] DEFAULT ARRAY['services'::text, 'portfolio'::text, 'reviews'::text, 'about'::text],
    created_at timestamp with time zone DEFAULT now(),
    meta text,
    timezone text,
    buffer_before_min integer DEFAULT 0,
    buffer_after_min integer DEFAULT 0,
    site_mode text DEFAULT 'classic'::text,
    hero_photos jsonb DEFAULT '[]'::jsonb,
    service_area_cities jsonb DEFAULT '[]'::jsonb,
    gen_hero_headline text,
    gen_hero_subhead text,
    gen_about text,
    gen_faq jsonb DEFAULT '[]'::jsonb,
    gen_seo_title text,
    gen_seo_description text,
    gen_why_choose jsonb DEFAULT '[]'::jsonb,
    site_theme jsonb DEFAULT '{}'::jsonb,
    tier text DEFAULT 'starter'::text NOT NULL,
    travel_radius_miles integer,
    years_in_business integer,
    gen_hero_headline_options jsonb DEFAULT '[]'::jsonb,
    business_type text,
    capabilities jsonb DEFAULT '{}'::jsonb NOT NULL,
    draft_token uuid,
    address text,
    zip text,
    state text,
    latitude numeric(9,6),
    longitude numeric(9,6),
    location_source text,
    CONSTRAINT businesses_tier_check CHECK ((tier = ANY (ARRAY['starter'::text, 'pro'::text])))
);


--
-- Name: TABLE businesses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.businesses IS 'Canonical Hubly Business. One record per company. Experiences (Marketplace Lite, Hubly Pro, website, AI) are capabilities — never duplicate profile/services/stripe into parallel business tables.';


--
-- Name: COLUMN businesses.meta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.businesses.meta IS 'Business settings blob, stored as TEXT containing JSON (parsed by getBusinessMeta). meta.depositUnit (''dollars'' | ''cents'') states how meta.depositVal should be read for a flat deposit. Absent means dollars — it must never be inferred from the number''s magnitude again (see docs/KNOWN_ISSUES.md).';


--
-- Name: COLUMN businesses.business_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.businesses.business_type IS 'Trade/industry id, matching a Business Blueprint (detailing, photography, hvac, ...). NULL means NOT KNOWN — never guess a value here and never default it to a real trade. Clients resolve NULL to the neutral "generic" blueprint; the server resolves it to no Business DNA at all, which makes the AI say it does not know the industry.';


--
-- Name: COLUMN businesses.capabilities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.businesses.capabilities IS 'Per-business capability flags, e.g. {"marketplace":true,"hubly_pro":true,"projects":true,"lightroom":true,"website":true,"storefront":true}. website/storefront gate the Hubly Builder surfaces and public routing (/ vs /store).';


--
-- Name: COLUMN businesses.latitude; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.businesses.latitude IS 'Derived from zip via zip_centroids (location_source=''zip_centroid''). Null means this business has not completed location setup -- must never be guessed from city text.';


--
-- Name: COLUMN businesses.longitude; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.businesses.longitude IS 'See businesses.latitude.';


--
-- Name: campaign_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_goals (
    id text NOT NULL,
    label text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    priority integer DEFAULT 50 NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE campaign_goals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.campaign_goals IS 'Owner-facing campaign goals (Studio AI Creator).';


--
-- Name: campaign_industries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_industries (
    id text NOT NULL,
    name text NOT NULL,
    aliases text[] DEFAULT '{}'::text[] NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE campaign_industries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.campaign_industries IS 'Industry keys for Studio Campaign Engine playbooks.';


--
-- Name: campaign_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    playbook_id text,
    goal_id text,
    industry_id text,
    title text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    objective text DEFAULT ''::text NOT NULL,
    channels text[] DEFAULT '{}'::text[] NOT NULL,
    required_assets jsonb DEFAULT '[]'::jsonb NOT NULL,
    messaging_strategy text DEFAULT ''::text NOT NULL,
    cta text DEFAULT ''::text NOT NULL,
    timing jsonb DEFAULT '{}'::jsonb NOT NULL,
    template_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    offer jsonb DEFAULT '{}'::jsonb NOT NULL,
    audience text DEFAULT ''::text NOT NULL,
    ai_brief text DEFAULT ''::text NOT NULL,
    business_inputs jsonb DEFAULT '{}'::jsonb NOT NULL,
    dna_inputs jsonb DEFAULT '{}'::jsonb NOT NULL,
    package jsonb DEFAULT '{}'::jsonb NOT NULL,
    project_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready'::text, 'in_production'::text, 'scheduled'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: TABLE campaign_plans; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.campaign_plans IS 'Structured Campaign Plan instances. AI writes copy FROM this plan; Canva renders visuals.';


--
-- Name: campaign_playbook_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_playbook_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    playbook_id text NOT NULL,
    asset_key text NOT NULL,
    required boolean DEFAULT true NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    CONSTRAINT campaign_playbook_assets_asset_key_check CHECK ((asset_key = ANY (ARRAY['logo'::text, 'before_after'::text, 'job_photos'::text, 'review'::text, 'offer'::text, 'coupon'::text, 'video'::text, 'membership_details'::text, 'service_list'::text, 'hours'::text, 'phone'::text, 'address'::text])))
);


--
-- Name: campaign_playbooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_playbooks (
    id text NOT NULL,
    industry_id text NOT NULL,
    goal_id text NOT NULL,
    title text NOT NULL,
    season text DEFAULT 'any'::text NOT NULL,
    audience text DEFAULT 'local_prospects'::text NOT NULL,
    frequency text DEFAULT 'seasonal'::text NOT NULL,
    channels text[] DEFAULT '{}'::text[] NOT NULL,
    offer_type text DEFAULT 'none'::text NOT NULL,
    cta text DEFAULT 'Book now'::text NOT NULL,
    messaging_strategy text DEFAULT ''::text NOT NULL,
    ai_prompt text DEFAULT ''::text NOT NULL,
    template_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    priority integer DEFAULT 50 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    prompt_template text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT campaign_playbooks_audience_check CHECK ((audience = ANY (ARRAY['local_prospects'::text, 'existing_customers'::text, 'past_customers'::text, 'hoa'::text, 'commercial'::text, 'new_movers'::text]))),
    CONSTRAINT campaign_playbooks_frequency_check CHECK ((frequency = ANY (ARRAY['once'::text, 'weekly'::text, 'monthly'::text, 'seasonal'::text, 'annual'::text, 'triggered'::text]))),
    CONSTRAINT campaign_playbooks_offer_type_check CHECK ((offer_type = ANY (ARRAY['none'::text, 'percent_off'::text, 'fixed_off'::text, 'freebie'::text, 'membership'::text, 'referral_reward'::text]))),
    CONSTRAINT campaign_playbooks_season_check CHECK ((season = ANY (ARRAY['any'::text, 'spring'::text, 'summer'::text, 'fall'::text, 'winter'::text, 'holiday'::text]))),
    CONSTRAINT campaign_playbooks_status_check CHECK ((status = ANY (ARRAY['active'::text, 'draft'::text, 'archived'::text])))
);


--
-- Name: TABLE campaign_playbooks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.campaign_playbooks IS 'Proven campaign types per industry. AI selects from these — does not invent strategy.';


--
-- Name: COLUMN campaign_playbooks.prompt_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_playbooks.prompt_template IS 'AI Writer template. May only reference Campaign Brief schema placeholders. Never open-ended strategy.';


--
-- Name: campaign_seasonal_calendar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_seasonal_calendar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    industry_id text NOT NULL,
    month integer NOT NULL,
    playbook_id text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    priority integer DEFAULT 50 NOT NULL,
    CONSTRAINT campaign_seasonal_calendar_month_check CHECK (((month >= 1) AND (month <= 12)))
);


--
-- Name: campaign_triggers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_triggers (
    id text NOT NULL,
    industry_id text,
    playbook_id text,
    goal_id text,
    title text NOT NULL,
    rule_kind text NOT NULL,
    threshold integer DEFAULT 0 NOT NULL,
    priority integer DEFAULT 50 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT campaign_triggers_rule_kind_check CHECK ((rule_kind = ANY (ARRAY['no_facebook_post_days'::text, 'completed_jobs_week'::text, 'new_five_star_review'::text, 'no_gbp_update_days'::text, 'idle_customers_days'::text, 'open_slots_tomorrow'::text, 'season_start'::text])))
);


--
-- Name: TABLE campaign_triggers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.campaign_triggers IS 'Proactive Studio suggestions: IF business signal THEN recommend playbook/goal.';


--
-- Name: chatbot_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    customer_name text,
    customer_phone text,
    customer_email text,
    consented_to_followup boolean DEFAULT false NOT NULL,
    resulted_in_booking boolean DEFAULT false NOT NULL,
    topics jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: chatbot_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chatbot_messages_role_check CHECK ((role = ANY (ARRAY['customer'::text, 'assistant'::text])))
);


--
-- Name: commerce_bundle_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_bundle_products (
    bundle_id uuid NOT NULL,
    product_id uuid NOT NULL,
    business_id uuid NOT NULL,
    qty integer DEFAULT 1 NOT NULL,
    CONSTRAINT commerce_bundle_products_qty_check CHECK ((qty > 0))
);


--
-- Name: commerce_bundles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_bundles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    price_cents integer DEFAULT 0 NOT NULL,
    discount_cents integer DEFAULT 0 NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_bundles_discount_cents_check CHECK ((discount_cents >= 0)),
    CONSTRAINT commerce_bundles_price_cents_check CHECK ((price_cents >= 0)),
    CONSTRAINT commerce_bundles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])))
);


--
-- Name: commerce_cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_cart_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cart_id uuid NOT NULL,
    business_id uuid NOT NULL,
    product_id uuid,
    variant_id uuid,
    bundle_id uuid,
    title text NOT NULL,
    qty integer DEFAULT 1 NOT NULL,
    unit_price_cents integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_cart_items_qty_check CHECK ((qty > 0)),
    CONSTRAINT commerce_cart_items_unit_price_cents_check CHECK ((unit_price_cents >= 0))
);


--
-- Name: commerce_carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_carts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    customer_id uuid,
    guest_token text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_carts_status_check CHECK ((status = ANY (ARRAY['open'::text, 'converted'::text, 'abandoned'::text])))
);


--
-- Name: commerce_collection_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_collection_products (
    collection_id uuid NOT NULL,
    product_id uuid NOT NULL,
    business_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: commerce_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    published boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: commerce_discounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_discounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    code text NOT NULL,
    discount_type text NOT NULL,
    value numeric NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    uses integer DEFAULT 0 NOT NULL,
    usage_limit integer,
    applies_to text DEFAULT 'all'::text NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_discounts_discount_type_check CHECK ((discount_type = ANY (ARRAY['percent'::text, 'fixed'::text]))),
    CONSTRAINT commerce_discounts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'scheduled'::text, 'expired'::text, 'disabled'::text]))),
    CONSTRAINT commerce_discounts_value_check CHECK ((value >= (0)::numeric))
);


--
-- Name: commerce_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    product_id uuid,
    title text NOT NULL,
    source_type text NOT NULL,
    source_url text,
    body_text text DEFAULT ''::text NOT NULL,
    embedding jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_documents_source_type_check CHECK ((source_type = ANY (ARRAY['pdf'::text, 'docx'::text, 'image'::text, 'markdown'::text, 'url'::text, 'text'::text])))
);


--
-- Name: commerce_gift_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_gift_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    code text NOT NULL,
    initial_cents integer NOT NULL,
    balance_cents integer NOT NULL,
    customer_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_gift_cards_balance_cents_check CHECK ((balance_cents >= 0)),
    CONSTRAINT commerce_gift_cards_initial_cents_check CHECK ((initial_cents >= 0)),
    CONSTRAINT commerce_gift_cards_status_check CHECK ((status = ANY (ARRAY['active'::text, 'redeemed'::text, 'disabled'::text])))
);


--
-- Name: commerce_inventory_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_inventory_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    before_qty integer,
    after_qty integer,
    delta integer NOT NULL,
    reason text NOT NULL,
    order_id uuid,
    actor_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: commerce_merchandising_recs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_merchandising_recs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    product_id uuid,
    kind text NOT NULL,
    title text NOT NULL,
    detail text DEFAULT ''::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_merchandising_recs_status_check CHECK ((status = ANY (ARRAY['open'::text, 'accepted'::text, 'dismissed'::text])))
);


--
-- Name: commerce_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    business_id uuid NOT NULL,
    product_id uuid,
    variant_id uuid,
    bundle_id uuid,
    title text NOT NULL,
    sku text,
    qty integer DEFAULT 1 NOT NULL,
    unit_price_cents integer DEFAULT 0 NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_order_items_qty_check CHECK ((qty > 0))
);


--
-- Name: commerce_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    customer_id uuid,
    order_number text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    fulfillment text DEFAULT 'unfulfilled'::text NOT NULL,
    channel text DEFAULT 'website'::text NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    subtotal_cents integer DEFAULT 0 NOT NULL,
    discount_cents integer DEFAULT 0 NOT NULL,
    shipping_cents integer DEFAULT 0 NOT NULL,
    tax_cents integer DEFAULT 0 NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    shipping_method text,
    customer_name text,
    customer_email text,
    customer_phone text,
    shipping_address jsonb DEFAULT '{}'::jsonb NOT NULL,
    stripe_checkout_session_id text,
    stripe_payment_intent_id text,
    discount_code text,
    notes text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_orders_fulfillment_check CHECK ((fulfillment = ANY (ARRAY['unfulfilled'::text, 'packed'::text, 'ready'::text, 'shipped'::text, 'delivered'::text, 'digital'::text, 'pickup'::text, 'cancelled'::text]))),
    CONSTRAINT commerce_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'packed'::text, 'ready'::text, 'shipped'::text, 'delivered'::text, 'refunded'::text, 'cancelled'::text])))
);


--
-- Name: commerce_product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_product_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    product_id uuid NOT NULL,
    url text NOT NULL,
    alt text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: commerce_product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    sku text,
    price_cents integer,
    inventory integer,
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: commerce_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    short_description text DEFAULT ''::text NOT NULL,
    price_cents integer DEFAULT 0 NOT NULL,
    compare_at_cents integer,
    cost_cents integer,
    sku text,
    barcode text,
    status text DEFAULT 'draft'::text NOT NULL,
    product_type text DEFAULT 'physical'::text NOT NULL,
    inventory integer,
    track_inventory boolean DEFAULT true NOT NULL,
    low_stock_at integer DEFAULT 5 NOT NULL,
    weight_grams integer,
    brand text,
    featured boolean DEFAULT false NOT NULL,
    seo jsonb DEFAULT '{}'::jsonb NOT NULL,
    visibility jsonb DEFAULT jsonb_build_object('website', true, 'booking', true, 'customerPortal', true, 'quoteBuilder', true, 'email', true, 'memberships', false) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_products_compare_at_cents_check CHECK (((compare_at_cents IS NULL) OR (compare_at_cents >= 0))),
    CONSTRAINT commerce_products_cost_cents_check CHECK (((cost_cents IS NULL) OR (cost_cents >= 0))),
    CONSTRAINT commerce_products_price_cents_check CHECK ((price_cents >= 0)),
    CONSTRAINT commerce_products_product_type_check CHECK ((product_type = ANY (ARRAY['physical'::text, 'digital'::text, 'gift_card'::text, 'service_addon'::text]))),
    CONSTRAINT commerce_products_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])))
);


--
-- Name: commerce_shipping_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_shipping_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    mode text NOT NULL,
    rate_cents integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_shipping_profiles_mode_check CHECK ((mode = ANY (ARRAY['pickup'::text, 'flat_rate'::text, 'local_delivery'::text, 'free'::text]))),
    CONSTRAINT commerce_shipping_profiles_rate_cents_check CHECK ((rate_cents >= 0))
);


--
-- Name: commerce_store_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_store_settings (
    business_id uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    store_path text DEFAULT '/store'::text NOT NULL,
    hero_title text,
    hero_subtitle text,
    theme jsonb DEFAULT '{}'::jsonb NOT NULL,
    shipping_defaults jsonb DEFAULT '{"modes": ["pickup", "flat_rate", "local_delivery", "free"]}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE commerce_store_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.commerce_store_settings IS 'Per-business Store / Commerce Engine settings. Independent of Website service catalog.';


--
-- Name: customer_memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_memories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id uuid,
    session_key text,
    memory jsonb DEFAULT '{"version": 1}'::jsonb NOT NULL,
    memory_version integer DEFAULT 1 NOT NULL,
    source text DEFAULT 'system'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_memories_source_check CHECK ((source = ANY (ARRAY['understanding'::text, 'client'::text, 'system'::text, 'booking'::text])))
);


--
-- Name: TABLE customer_memories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_memories IS 'Customer Runtime facts SSOT (name, address, job). Separate from customer_profiles identity.';


--
-- Name: customer_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id uuid,
    session_key text,
    profile jsonb DEFAULT '{"version": 1}'::jsonb NOT NULL,
    profile_version integer DEFAULT 1 NOT NULL,
    source text DEFAULT 'system'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_profiles_source_check CHECK ((source = ANY (ARRAY['understanding'::text, 'client'::text, 'system'::text])))
);


--
-- Name: TABLE customer_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_profiles IS 'Customer Runtime identity (premium preference, weekend books, carefulness). Never merge into Memory.';


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    name text NOT NULL,
    phone text,
    email text,
    vehicle text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    vehicle_type text,
    vehicle_year text,
    vehicle_make text,
    vehicle_model text,
    vehicle_color text,
    preferred_service text,
    customer_type text DEFAULT 'one_off'::text,
    recurring_amount numeric,
    recurring_service text,
    recurring_cadence text,
    recurring_next_date date,
    sms_consent boolean,
    sms_consent_at timestamp with time zone,
    sms_consent_text text,
    sms_marketing_consent boolean DEFAULT false NOT NULL,
    sms_marketing_consent_at timestamp with time zone,
    sms_marketing_consent_text text
);


--
-- Name: COLUMN customers.sms_consent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.sms_consent IS 'TRANSACTIONAL SMS consent for this customer. NULL = never asked (NOT the same as declined). Replaces the [SMS:yes] marker in customers.notes.';


--
-- Name: COLUMN customers.sms_marketing_consent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.sms_marketing_consent IS 'Promotional SMS consent. FALSE for every existing row — never asked.';


--
-- Name: document_build_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_build_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    tag text DEFAULT 'website'::text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    attempts integer DEFAULT 1 NOT NULL,
    brief text,
    error text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    expected_by timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT document_build_jobs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'succeeded'::text, 'failed'::text])))
);


--
-- Name: document_vocabulary_rejections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_vocabulary_rejections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    tag text DEFAULT 'website'::text NOT NULL,
    outcome text NOT NULL,
    rejected_classes text[] DEFAULT '{}'::text[] NOT NULL,
    rejected_tags text[] DEFAULT '{}'::text[] NOT NULL,
    rejected_attrs text[] DEFAULT '{}'::text[] NOT NULL,
    model_used text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: draft_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    claimed_at timestamp with time zone,
    claimed_by uuid
);


--
-- Name: TABLE draft_claims; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.draft_claims IS 'Pending claims of unowned draft businesses. Written when the magic link is requested, consumed when the verified user returns. Exists because the claim must survive opening the email on a different device, where no browser state from the build can reach.';


--
-- Name: COLUMN draft_claims.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.draft_claims.email IS 'Lower-cased. Matched against the authenticated user''s verified email at finish — never trusted from the client at that point.';


--
-- Name: COLUMN draft_claims.claimed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.draft_claims.claimed_at IS 'Set once. A row with claimed_at is spent and cannot claim again, so a forwarded or replayed link does nothing.';


--
-- Name: gallery_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gallery_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    job_id uuid,
    before_url text,
    after_url text,
    caption text,
    service_name text,
    featured boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: google_calendar_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_calendar_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    google_user_id text NOT NULL,
    google_email text,
    calendar_id text DEFAULT 'primary'::text NOT NULL,
    refresh_token text NOT NULL,
    access_token text,
    access_token_expires_at timestamp with time zone,
    connected_at timestamp with time zone DEFAULT now() NOT NULL,
    last_sync_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sync_token text,
    watch_channel_id text,
    watch_resource_id text,
    watch_expiration timestamp with time zone,
    last_inbound_at timestamp with time zone,
    google_picture_url text,
    calendar_summary text,
    watch_channel_token text,
    sync_lock_until timestamp with time zone,
    last_webhook_at timestamp with time zone,
    last_error text
);


--
-- Name: TABLE google_calendar_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.google_calendar_connections IS 'Owner Google Calendar OAuth tokens. Never expose refresh/access tokens to the browser.';


--
-- Name: COLUMN google_calendar_connections.sync_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.google_calendar_connections.sync_token IS 'Google Calendar events.list nextSyncToken for incremental inbound sync.';


--
-- Name: COLUMN google_calendar_connections.watch_channel_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.google_calendar_connections.watch_channel_id IS 'Active Google push-notification channel id (events.watch).';


--
-- Name: COLUMN google_calendar_connections.google_picture_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.google_calendar_connections.google_picture_url IS 'Google account avatar URL from OpenID userinfo (safe to expose to client).';


--
-- Name: COLUMN google_calendar_connections.calendar_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.google_calendar_connections.calendar_summary IS 'Display name of the connected calendar (e.g. Primary).';


--
-- Name: COLUMN google_calendar_connections.watch_channel_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.google_calendar_connections.watch_channel_token IS 'Random secret sent as X-Goog-Channel-Token. Never equal to business_id.';


--
-- Name: COLUMN google_calendar_connections.sync_lock_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.google_calendar_connections.sync_lock_until IS 'Single-flight lock for inbound/import sync. Holders skip concurrent runs.';


--
-- Name: COLUMN google_calendar_connections.last_webhook_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.google_calendar_connections.last_webhook_at IS 'Debounce timestamp for Google push notifications.';


--
-- Name: COLUMN google_calendar_connections.last_error; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.google_calendar_connections.last_error IS 'Last non-fatal sync/watch error message for owner UI (never tokens).';


--
-- Name: google_calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_calendar_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    google_event_id text NOT NULL,
    calendar_id text DEFAULT 'primary'::text NOT NULL,
    summary text,
    description text,
    location text,
    html_link text,
    status text,
    all_day boolean DEFAULT false NOT NULL,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    local_date date NOT NULL,
    local_start_time time without time zone,
    duration_hours numeric(6,2),
    google_updated_at timestamp with time zone,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE google_calendar_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.google_calendar_events IS 'Google Calendar events imported into Hubly as blocked time. Hubly jobs are not pushed to Google.';


--
-- Name: google_calendar_oauth_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_calendar_oauth_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    state text NOT NULL,
    owner_id uuid NOT NULL,
    business_id uuid NOT NULL,
    return_to text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: hubly_app_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hubly_app_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    provider text NOT NULL,
    status text DEFAULT 'disconnected'::text NOT NULL,
    account_label text,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    last_sync_at timestamp with time zone,
    health text DEFAULT 'disconnected'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hubly_app_connections_health_check CHECK ((health = ANY (ARRAY['healthy'::text, 'degraded'::text, 'not_configured'::text, 'disconnected'::text, 'error'::text]))),
    CONSTRAINT hubly_app_connections_status_check CHECK ((status = ANY (ARRAY['disconnected'::text, 'pending'::text, 'connected'::text, 'error'::text, 'revoked'::text])))
);


--
-- Name: TABLE hubly_app_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.hubly_app_connections IS 'Hubly Core Connected Apps — business-level provider connections (Canva, Adobe, Dropbox, Meta, …). Projects link via project workspace tables.';


--
-- Name: COLUMN hubly_app_connections.provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hubly_app_connections.provider IS 'Connected App id matching ConnectedAppProvider.id (adobe_lightroom, canva, dropbox, …).';


--
-- Name: hubly_brain_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hubly_brain_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    run_id text,
    kind text NOT NULL,
    feature text DEFAULT 'unknown'::text NOT NULL,
    task text,
    intent text,
    experts_selected jsonb DEFAULT '[]'::jsonb NOT NULL,
    merged_response boolean DEFAULT false NOT NULL,
    memory_updated boolean DEFAULT false NOT NULL,
    confidence integer,
    ok boolean DEFAULT true NOT NULL,
    latency_ms integer DEFAULT 0 NOT NULL,
    provider text,
    model text,
    error text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hubly_brain_executions_confidence_check CHECK (((confidence IS NULL) OR ((confidence >= 0) AND (confidence <= 100)))),
    CONSTRAINT hubly_brain_executions_kind_check CHECK ((kind = ANY (ARRAY['think'::text, 'complete'::text])))
);


--
-- Name: TABLE hubly_brain_executions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.hubly_brain_executions IS 'Hubly Brain execution log — every AI request that enters Brain is recorded here.';


--
-- Name: hubly_conversation_memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hubly_conversation_memories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    session_id text,
    memory jsonb DEFAULT '{"turns": [], "version": 1}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE hubly_conversation_memories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.hubly_conversation_memories IS 'Hubly Brain Conversation Memory — turns, summaries, pending tasks across sessions.';


--
-- Name: hubly_execution_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hubly_execution_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    prompt text,
    status text DEFAULT 'started'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    duration_ms integer,
    memory_snapshot jsonb,
    execution_plan jsonb DEFAULT '{"steps": [], "version": 1}'::jsonb NOT NULL,
    executor_results jsonb,
    progress_events jsonb DEFAULT '[]'::jsonb NOT NULL,
    errors jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hubly_execution_runs_status_check CHECK ((status = ANY (ARRAY['started'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: TABLE hubly_execution_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.hubly_execution_runs IS 'Hubly Runtime execution history. Planner WHAT + Orchestrator HOW results for replay/debug/analytics.';


--
-- Name: hubly_reasoning_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hubly_reasoning_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    run_id text,
    domain text DEFAULT 'general'::text NOT NULL,
    decision text NOT NULL,
    reason text NOT NULL,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    confidence integer DEFAULT 0 NOT NULL,
    expected_impact text,
    expert_id text,
    source text DEFAULT 'brain'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hubly_reasoning_events_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100)))
);


--
-- Name: TABLE hubly_reasoning_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.hubly_reasoning_events IS 'Hubly Brain Reasoning Engine — every important decision stores why + confidence.';


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    customer_id uuid,
    customer_name text,
    service_name text,
    addons text[],
    scheduled_date date,
    scheduled_time time without time zone,
    address text,
    vehicle text,
    vehicle_color text,
    condition text,
    amount numeric,
    notes text,
    status text DEFAULT 'scheduled'::text,
    paid boolean DEFAULT false,
    pay_method text,
    pay_notes text,
    paid_at timestamp with time zone,
    from_booking boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    phone text,
    email text,
    duration_hours numeric,
    is_recurring boolean DEFAULT false,
    review_requested_at timestamp with time zone,
    google_event_id text,
    google_etag text,
    hubly_push_at timestamp with time zone,
    hubly_job_id uuid,
    last_synced_at timestamp with time zone,
    last_google_update timestamp with time zone,
    last_hubly_update timestamp with time zone,
    sync_status text DEFAULT 'idle'::text,
    sync_origin text,
    deposit_cents integer,
    deposit_status text,
    assigned_to text,
    recurring_schedule_id uuid,
    service_id text,
    booking_request_id uuid
);


--
-- Name: COLUMN jobs.google_event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.google_event_id IS 'Google Calendar event id created for this Hubly job. Prevents duplicate pushes.';


--
-- Name: COLUMN jobs.google_etag; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.google_etag IS 'Last known Google Calendar event etag — skip inbound apply when unchanged.';


--
-- Name: COLUMN jobs.hubly_push_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.hubly_push_at IS 'When Hubly last wrote this event to Google — short window skips inbound to prevent loops.';


--
-- Name: COLUMN jobs.hubly_job_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.hubly_job_id IS 'Canonical Hubly job id for sync (equals jobs.id). Stored on Google as private hublyJobId.';


--
-- Name: COLUMN jobs.last_synced_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.last_synced_at IS 'When Hubly↔Google last successfully reconciled this job.';


--
-- Name: COLUMN jobs.last_google_update; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.last_google_update IS 'Google event.updated timestamp last applied or observed.';


--
-- Name: COLUMN jobs.last_hubly_update; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.last_hubly_update IS 'When Hubly last changed sync-relevant job fields (trigger).';


--
-- Name: COLUMN jobs.sync_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.sync_status IS 'idle | pending | synced | conflict | error | local_only';


--
-- Name: COLUMN jobs.sync_origin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.sync_origin IS 'Transient: set to google when Sync Engine writes from Google (skips last_hubly_update bump).';


--
-- Name: COLUMN jobs.deposit_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.deposit_status IS 'none | due | paid_online | collected. Populated from the real booking_requests row at acceptance time — paid_online only when payment_status=''paid'' (Stripe-webhook-confirmed). collected is set only by a real human action (Mark deposit collected), never inferred.';


--
-- Name: COLUMN jobs.assigned_to; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.assigned_to IS 'Technician/team-member name assigned to this job. Free text matching jobsTeam() entries in the app, not a foreign key — there is no normalized team-members table yet.';


--
-- Name: COLUMN jobs.recurring_schedule_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.recurring_schedule_id IS 'Parent recurring schedule this occurrence belongs to, if any. Null for one-time jobs. Every occurrence remains a fully real, independently-completable/cancellable job row regardless.';


--
-- Name: COLUMN jobs.service_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.service_id IS 'Soft reference to businesses.meta.service_catalog services[].id (Service Engine). No FK — the catalog is JSON, not a relational table. Nullable: blank drafts, freeform services, and historical jobs have none. Always written together with service_name from the same resolved Service Engine object — never independently.';


--
-- Name: COLUMN jobs.booking_request_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.jobs.booking_request_id IS 'The booking_requests row this job was created from, or NULL for jobs created directly (manual entry, blocks, Google Calendar imports). Job creation from a booking MUST be idempotent on this column — see jobs_booking_request_id_unique. Backfilled 2026-08-17 for unambiguous historical matches only.';


--
-- Name: marketplace_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    business_id uuid NOT NULL,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    service_name text,
    requested_date date,
    requested_time text,
    address text,
    notes text,
    status text DEFAULT 'requested'::text NOT NULL,
    booking_request_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    service_id text,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    duration_minutes integer,
    price_cents integer,
    currency text DEFAULT 'usd'::text NOT NULL,
    payment_rule text DEFAULT 'pay_after_service'::text NOT NULL,
    payment_status text DEFAULT 'none'::text NOT NULL,
    deposit_cents integer,
    amount_paid_cents integer DEFAULT 0 NOT NULL,
    confirmation_code text,
    channel text DEFAULT 'marketplace'::text NOT NULL,
    customer_id uuid,
    conversation_id uuid,
    job_id uuid,
    calendar_event_id text,
    add_ons jsonb DEFAULT '[]'::jsonb NOT NULL,
    what_happens_next text,
    instant_book boolean DEFAULT false NOT NULL,
    service_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT marketplace_bookings_channel_check CHECK ((channel = ANY (ARRAY['marketplace'::text, 'website'::text, 'ai'::text, 'crm'::text]))),
    CONSTRAINT marketplace_bookings_payment_rule_check CHECK ((payment_rule = ANY (ARRAY['pay_in_full'::text, 'deposit'::text, 'card_on_file'::text, 'pay_after_service'::text]))),
    CONSTRAINT marketplace_bookings_payment_status_check CHECK ((payment_status = ANY (ARRAY['none'::text, 'pending'::text, 'authorized'::text, 'paid'::text, 'failed'::text, 'refunded'::text]))),
    CONSTRAINT marketplace_bookings_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'confirmed'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: TABLE marketplace_bookings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.marketplace_bookings IS 'Hubly Booking Engine appointments. Provider-agnostic: service_id + duration + pricing + rules. Catalog lives on businesses.meta.';


--
-- Name: marketplace_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    provider_id uuid,
    booking_id uuid,
    customer_id uuid,
    subject text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE marketplace_conversations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.marketplace_conversations IS 'Conversation thread stubs linked to bookings (expand with messages later).';


--
-- Name: marketplace_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    crm_customer_id uuid
);


--
-- Name: TABLE marketplace_customers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.marketplace_customers IS 'Lightweight customer records created at marketplace booking time.';


--
-- Name: COLUMN marketplace_customers.crm_customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.marketplace_customers.crm_customer_id IS 'Canonical CRM customers.id this Marketplace customer resolved to at booking time. The CRM customer is the identity of record; marketplace_customers remains only for Marketplace-specific/conversation data. Null on historical rows created before the convergence (not backfilled here).';


--
-- Name: marketplace_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    business_id uuid NOT NULL,
    booking_id uuid,
    sender_role text NOT NULL,
    body text NOT NULL,
    photo_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['provider'::text, 'customer'::text, 'system'::text])))
);


--
-- Name: TABLE marketplace_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.marketplace_messages IS 'Marketplace Lite booking-thread messages only — not CRM/chatbot messaging.';


--
-- Name: marketplace_ops_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_ops_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid,
    business_id uuid,
    booking_id uuid,
    flag_type text DEFAULT 'general'::text NOT NULL,
    severity text DEFAULT 'low'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    summary text NOT NULL,
    details text,
    created_by text DEFAULT 'ops'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT marketplace_ops_flags_flag_type_check CHECK ((flag_type = ANY (ARRAY['general'::text, 'customer_report'::text, 'provider_report'::text, 'suspicious'::text, 'fraud'::text, 'verification'::text]))),
    CONSTRAINT marketplace_ops_flags_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT marketplace_ops_flags_status_check CHECK ((status = ANY (ARRAY['open'::text, 'reviewing'::text, 'resolved'::text, 'dismissed'::text])))
);


--
-- Name: TABLE marketplace_ops_flags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.marketplace_ops_flags IS 'Trust & Safety flags for Marketplace Ops (architecture ready for future moderation).';


--
-- Name: marketplace_ops_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_ops_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    business_id uuid NOT NULL,
    author text DEFAULT 'ops'::text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE marketplace_ops_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.marketplace_ops_notes IS 'Internal Hubly notes on marketplace providers — never shown to providers/customers.';


--
-- Name: marketplace_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    marketplace_enabled boolean DEFAULT false NOT NULL,
    marketplace_status text DEFAULT 'draft'::text NOT NULL,
    provider_kind text DEFAULT 'hubly'::text NOT NULL,
    category text,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    verification_notes text,
    insurance_verified boolean DEFAULT false NOT NULL,
    license_verified boolean DEFAULT false NOT NULL,
    background_check_status text DEFAULT 'none'::text NOT NULL,
    calendar_connected boolean DEFAULT false NOT NULL,
    marketplace_score integer DEFAULT 0 NOT NULL,
    score_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    accepting_new_jobs boolean DEFAULT true NOT NULL,
    instant_booking boolean DEFAULT false NOT NULL,
    accept_quote_requests boolean DEFAULT true NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    response_time_minutes integer,
    completion_rate numeric(5,2),
    cancellation_rate numeric(5,2),
    travel_radius_miles integer,
    emergency_jobs boolean DEFAULT false NOT NULL,
    weekend_jobs boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    settings_updated_at timestamp with time zone,
    verified_at timestamp with time zone,
    status_changed_at timestamp with time zone DEFAULT now(),
    status_reason text,
    reviewed_at timestamp with time zone,
    reviewed_by text,
    ai_document jsonb,
    ai_document_updated_at timestamp with time zone,
    CONSTRAINT marketplace_providers_background_check_status_check CHECK ((background_check_status = ANY (ARRAY['none'::text, 'pending'::text, 'passed'::text, 'failed'::text]))),
    CONSTRAINT marketplace_providers_marketplace_score_check CHECK (((marketplace_score >= 0) AND (marketplace_score <= 100))),
    CONSTRAINT marketplace_providers_marketplace_status_check CHECK ((marketplace_status = ANY (ARRAY['draft'::text, 'hidden'::text, 'pending_verification'::text, 'verified'::text, 'paused'::text, 'suspended'::text, 'rejected'::text]))),
    CONSTRAINT marketplace_providers_provider_kind_check CHECK ((provider_kind = ANY (ARRAY['hubly'::text, 'marketplace_only'::text]))),
    CONSTRAINT marketplace_providers_verification_status_check CHECK ((verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])))
);


--
-- Name: TABLE marketplace_providers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.marketplace_providers IS 'Marketplace capability + lifecycle for a Business (1:1). Listing status, Instant Book, scores. Profile/services/hours/stripe live on businesses — no data duplication.';


--
-- Name: COLUMN marketplace_providers.marketplace_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.marketplace_providers.marketplace_enabled IS 'Capability flag: business participates in the Hubly marketplace. Enabling Hubly Pro does not copy this row — Pro is a separate capability on the same Business.';


--
-- Name: COLUMN marketplace_providers.marketplace_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.marketplace_providers.marketplace_status IS 'Lifecycle: draft|hidden|pending_verification|verified|paused|suspended|rejected. Only verified is publicly listed.';


--
-- Name: COLUMN marketplace_providers.provider_kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.marketplace_providers.provider_kind IS 'hubly = also uses Hubly Pro/storefront tools; marketplace_only = Provider Experience (Marketplace Lite) packaging without implying a second business entity.';


--
-- Name: COLUMN marketplace_providers.status_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.marketplace_providers.status_reason IS 'Human/ops reason for current lifecycle status (reject/suspend/pause notes).';


--
-- Name: COLUMN marketplace_providers.ai_document; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.marketplace_providers.ai_document IS 'Cached hubly.marketplace.provider.v1 document for AI agents. Rebuild via marketplace API.';


--
-- Name: marketplace_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    business_id uuid NOT NULL,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    service_interest text,
    preferred_date date,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'responded'::text, 'closed'::text])))
);


--
-- Name: memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    plan_name text NOT NULL,
    service_name text,
    cadence text,
    price numeric,
    default_duration numeric,
    status text DEFAULT 'active'::text NOT NULL,
    next_due_date date,
    includes jsonb,
    source_plan_ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: photography_project_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photography_project_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    business_id uuid NOT NULL,
    actor_name text,
    action text NOT NULL,
    detail text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: photography_project_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photography_project_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    business_id uuid NOT NULL,
    title text DEFAULT 'Photography Agreement'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    sent_at timestamp with time zone,
    signed_at timestamp with time zone,
    document_url text,
    signer_name text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photography_project_contracts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'viewed'::text, 'signed'::text, 'void'::text])))
);


--
-- Name: photography_project_deliverables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photography_project_deliverables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    business_id uuid NOT NULL,
    title text NOT NULL,
    kind text DEFAULT 'gallery'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    due_at timestamp with time zone,
    delivered_at timestamp with time zone,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photography_project_deliverables_kind_check CHECK ((kind = ANY (ARRAY['gallery'::text, 'print'::text, 'album'::text, 'usb'::text, 'cloud'::text, 'other'::text]))),
    CONSTRAINT photography_project_deliverables_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'ready'::text, 'delivered'::text])))
);


--
-- Name: photography_project_galleries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photography_project_galleries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    business_id uuid NOT NULL,
    name text DEFAULT 'Client Gallery'::text NOT NULL,
    visibility text DEFAULT 'private'::text NOT NULL,
    delivery_status text DEFAULT 'draft'::text NOT NULL,
    share_url text,
    watermark_enabled boolean DEFAULT true NOT NULL,
    watermark_text text,
    expires_at timestamp with time zone,
    download_enabled boolean DEFAULT false NOT NULL,
    ai_favorites jsonb DEFAULT '[]'::jsonb NOT NULL,
    albums jsonb DEFAULT '[]'::jsonb NOT NULL,
    photo_count integer DEFAULT 0 NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photography_project_galleries_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['draft'::text, 'ready'::text, 'published'::text, 'delivered'::text, 'expired'::text]))),
    CONSTRAINT photography_project_galleries_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'client'::text, 'public'::text])))
);


--
-- Name: photography_project_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photography_project_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    business_id uuid NOT NULL,
    label text DEFAULT 'Invoice'::text NOT NULL,
    kind text DEFAULT 'balance'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    amount_cents integer DEFAULT 0 NOT NULL,
    paid_cents integer DEFAULT 0 NOT NULL,
    due_at timestamp with time zone,
    paid_at timestamp with time zone,
    stripe_invoice_id text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photography_project_invoices_kind_check CHECK ((kind = ANY (ARRAY['deposit'::text, 'balance'::text, 'retainer'::text, 'addon'::text, 'other'::text]))),
    CONSTRAINT photography_project_invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'partial'::text, 'paid'::text, 'overdue'::text, 'void'::text])))
);


--
-- Name: photography_project_lightroom; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photography_project_lightroom (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    business_id uuid NOT NULL,
    adobe_account_email text,
    album_name text,
    album_id text,
    photo_count integer DEFAULT 0 NOT NULL,
    edited_count integer DEFAULT 0 NOT NULL,
    favorites_count integer DEFAULT 0 NOT NULL,
    connection_status text DEFAULT 'not_connected'::text NOT NULL,
    last_sync_at timestamp with time zone,
    upload_queue jsonb DEFAULT '[]'::jsonb NOT NULL,
    import_queue jsonb DEFAULT '[]'::jsonb NOT NULL,
    export_queue jsonb DEFAULT '[]'::jsonb NOT NULL,
    sync_activity jsonb DEFAULT '[]'::jsonb NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    twin_key text,
    catalog_id text,
    twin_status text DEFAULT 'unlinked'::text NOT NULL,
    CONSTRAINT photography_project_lightroom_connection_status_check CHECK ((connection_status = ANY (ARRAY['not_connected'::text, 'connected'::text, 'syncing'::text, 'synced'::text, 'error'::text]))),
    CONSTRAINT photography_project_lightroom_twin_status_check CHECK ((twin_status = ANY (ARRAY['unlinked'::text, 'pending'::text, 'linked'::text, 'syncing'::text, 'synced'::text, 'error'::text])))
);


--
-- Name: TABLE photography_project_lightroom; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.photography_project_lightroom IS 'DEPRECATED Lightroom-specific link. Use photography_project_workspaces with provider=adobe_lightroom. Kept for back-compat.';


--
-- Name: COLUMN photography_project_lightroom.twin_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.photography_project_lightroom.twin_key IS 'Mirrors photography_projects.twin_key — Hubly always knows they are the same project.';


--
-- Name: photography_project_marketing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photography_project_marketing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    business_id uuid NOT NULL,
    channel text NOT NULL,
    status text DEFAULT 'idle'::text NOT NULL,
    title text,
    body text,
    asset_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photography_project_marketing_channel_check CHECK ((channel = ANY (ARRAY['instagram'::text, 'facebook'::text, 'pinterest'::text, 'blog'::text, 'website'::text, 'email'::text, 'review_request'::text, 'referral'::text, 'before_after'::text]))),
    CONSTRAINT photography_project_marketing_status_check CHECK ((status = ANY (ARRAY['idle'::text, 'ready'::text, 'queued'::text, 'published'::text, 'skipped'::text])))
);


--
-- Name: photography_project_questionnaires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photography_project_questionnaires (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    business_id uuid NOT NULL,
    title text DEFAULT 'Client Questionnaire'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    questions jsonb DEFAULT '[]'::jsonb NOT NULL,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    sent_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photography_project_questionnaires_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'in_progress'::text, 'completed'::text])))
);


--
-- Name: photography_project_team; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photography_project_team (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    business_id uuid NOT NULL,
    role text NOT NULL,
    member_name text NOT NULL,
    member_email text,
    member_user_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photography_project_team_role_check CHECK ((role = ANY (ARRAY['lead_photographer'::text, 'second_shooter'::text, 'assistant'::text, 'editor'::text, 'other'::text])))
);


--
-- Name: photography_project_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photography_project_timeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    business_id uuid NOT NULL,
    event_key text NOT NULL,
    label text NOT NULL,
    occurred_at timestamp with time zone,
    completed boolean DEFAULT false NOT NULL,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: photography_project_workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photography_project_workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    business_id uuid NOT NULL,
    provider text NOT NULL,
    external_id text,
    display_name text,
    sync_state text DEFAULT 'unlinked'::text NOT NULL,
    last_sync_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photography_project_workspaces_provider_check CHECK ((provider = ANY (ARRAY['adobe_lightroom'::text, 'capture_one'::text, 'dropbox'::text, 'google_drive'::text, 'canva'::text, 'frame_io'::text, 'meta'::text, 'google_business'::text, 'stripe'::text, 'twilio'::text, 'other'::text]))),
    CONSTRAINT photography_project_workspaces_sync_state_check CHECK ((sync_state = ANY (ARRAY['unlinked'::text, 'pending'::text, 'linked'::text, 'syncing'::text, 'synced'::text, 'error'::text])))
);


--
-- Name: TABLE photography_project_workspaces; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.photography_project_workspaces IS 'Project-scoped Connected Apps links (internal workspace rows). Product UI: Connected Apps. Hubly Core engine is industry-agnostic; photography is the first project surface.';


--
-- Name: COLUMN photography_project_workspaces.provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.photography_project_workspaces.provider IS 'External system id, e.g. adobe_lightroom | capture_one | dropbox | google_drive | canva.';


--
-- Name: COLUMN photography_project_workspaces.external_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.photography_project_workspaces.external_id IS 'Provider-side album/catalog/folder/file id. Opaque to Hubly Project core.';


--
-- Name: COLUMN photography_project_workspaces.sync_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.photography_project_workspaces.sync_state IS 'unlinked | pending | linked | syncing | synced | error';


--
-- Name: COLUMN photography_project_workspaces.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.photography_project_workspaces.metadata IS 'Provider-specific payload (album name, account email, queues, favorites count, etc.).';


--
-- Name: photography_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photography_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    project_type text DEFAULT 'Other'::text NOT NULL,
    status text DEFAULT 'Lead'::text NOT NULL,
    shoot_date date,
    location text,
    estimated_photos integer,
    photo_count integer DEFAULT 0 NOT NULL,
    notes text,
    cover_photo_url text,
    client_id uuid,
    client_name text,
    client_email text,
    client_phone text,
    client_address text,
    client_relationship text,
    revenue_cents integer DEFAULT 0 NOT NULL,
    outstanding_cents integer DEFAULT 0 NOT NULL,
    editing_progress integer DEFAULT 0 NOT NULL,
    lightroom_status text DEFAULT 'not_connected'::text NOT NULL,
    gallery_status text DEFAULT 'draft'::text NOT NULL,
    invoice_status text DEFAULT 'none'::text NOT NULL,
    last_sync_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace jsonb DEFAULT '{}'::jsonb NOT NULL,
    twin_key text,
    lightroom_catalog_id text,
    lightroom_album_id text,
    twin_status text DEFAULT 'unlinked'::text NOT NULL,
    CONSTRAINT photography_projects_editing_progress_check CHECK (((editing_progress >= 0) AND (editing_progress <= 100))),
    CONSTRAINT photography_projects_gallery_status_check CHECK ((gallery_status = ANY (ARRAY['draft'::text, 'private'::text, 'published'::text, 'delivered'::text, 'expired'::text]))),
    CONSTRAINT photography_projects_invoice_status_check CHECK ((invoice_status = ANY (ARRAY['none'::text, 'draft'::text, 'sent'::text, 'partial'::text, 'paid'::text, 'overdue'::text]))),
    CONSTRAINT photography_projects_lightroom_status_check CHECK ((lightroom_status = ANY (ARRAY['not_connected'::text, 'connected'::text, 'album_ready'::text, 'syncing'::text, 'synced'::text, 'error'::text]))),
    CONSTRAINT photography_projects_project_type_check CHECK ((project_type = ANY (ARRAY['Wedding'::text, 'Portrait'::text, 'Family'::text, 'Sports'::text, 'Commercial'::text, 'Product'::text, 'Real Estate'::text, 'Graduation'::text, 'Event'::text, 'Other'::text]))),
    CONSTRAINT photography_projects_status_check CHECK ((status = ANY (ARRAY['Lead'::text, 'Booked'::text, 'Scheduled'::text, 'Shooting'::text, 'Editing'::text, 'Proofing'::text, 'Delivered'::text, 'Archived'::text]))),
    CONSTRAINT photography_projects_twin_status_check CHECK ((twin_status = ANY (ARRAY['unlinked'::text, 'pending'::text, 'linked'::text, 'syncing'::text, 'synced'::text, 'error'::text])))
);


--
-- Name: TABLE photography_projects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.photography_projects IS 'Photography Projects OS — independent of jobs. Lightroom is optional enhancement.';


--
-- Name: COLUMN photography_projects.workspace; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.photography_projects.workspace IS 'Nested project OS state (timeline, gallery, team, marketing, activity, shot list, questionnaire). Core columns stay queryable; related tables mirror for future server workflows.';


--
-- Name: COLUMN photography_projects.twin_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.photography_projects.twin_key IS 'DEPRECATED — prefer photography_project_workspaces. Kept for back-compat during External Workspace cutover.';


--
-- Name: COLUMN photography_projects.twin_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.photography_projects.twin_status IS 'DEPRECATED — prefer photography_project_workspaces.sync_state.';


--
-- Name: portal_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_access_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: portfolio_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolio_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    url text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: recurring_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    customer_id uuid,
    customer_name text,
    service_name text,
    frequency text NOT NULL,
    custom_interval_days integer,
    status text DEFAULT 'active'::text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    next_occurrence_date date,
    preferred_time text,
    amount numeric,
    address text,
    assigned_to text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    service_id text,
    CONSTRAINT recurring_schedules_frequency_check CHECK ((frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'custom'::text]))),
    CONSTRAINT recurring_schedules_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text])))
);


--
-- Name: TABLE recurring_schedules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.recurring_schedules IS 'The operational repetition of a service for a customer — parent of job occurrences (jobs.recurring_schedule_id). Distinct from Membership (customers.notes'' packed [RP]/[RPJOB] tags), which is the commercial/billing relationship. A schedule may exist with no membership.';


--
-- Name: COLUMN recurring_schedules.service_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.recurring_schedules.service_id IS 'Soft reference to businesses.meta.service_catalog services[].id (Service Engine). No FK. Nullable, same rules as jobs.service_id. Every occurrence job generated from a schedule should carry the same service_id as the schedule.';


--
-- Name: review_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    job_id uuid NOT NULL,
    customer_name text NOT NULL,
    service_name text,
    stars integer NOT NULL,
    quote text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_submissions_stars_check CHECK (((stars >= 1) AND (stars <= 5)))
);


--
-- Name: service_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid,
    url text NOT NULL,
    sort_order integer DEFAULT 0
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    name text NOT NULL,
    description text,
    price numeric DEFAULT 0 NOT NULL,
    duration_hours numeric DEFAULT 2,
    includes text[],
    is_popular boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: settings_ai; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_ai (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    tone text DEFAULT 'helpful_pro'::text,
    permissions text DEFAULT 'propose_with_confirm'::text,
    auto_actions_default boolean DEFAULT false,
    memory_default boolean DEFAULT true,
    automation_defaults text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    label text NOT NULL,
    prefix text NOT NULL,
    hashed_secret text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: settings_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    actor_id uuid,
    label text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_billing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_billing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    plan text DEFAULT 'Grow'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    payment_method text,
    usage jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_branding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_branding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    logo_url text,
    primary_color text,
    accent_color text,
    font_display text,
    font_body text,
    favicon_url text,
    website_defaults text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_business; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_business (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text,
    address text,
    city text,
    region text,
    postal text,
    country text DEFAULT 'US'::text,
    time_zone text,
    currency text DEFAULT 'USD'::text,
    tax_default numeric(8,4) DEFAULT 0,
    logo_url text,
    contact_email text,
    contact_phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_business_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_business_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    weekday smallint NOT NULL,
    open_time time without time zone,
    close_time time without time zone,
    closed boolean DEFAULT false,
    CONSTRAINT settings_business_hours_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);


--
-- Name: settings_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    provider text NOT NULL,
    status text DEFAULT 'not_connected'::text NOT NULL,
    note text,
    last_sync_at timestamp with time zone,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    email boolean DEFAULT true,
    sms boolean DEFAULT true,
    push boolean DEFAULT false,
    desktop boolean DEFAULT true,
    ai boolean DEFAULT true,
    weekly_reports boolean DEFAULT true,
    marketing boolean DEFAULT false,
    automation boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_oauth_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_oauth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    provider text NOT NULL,
    access_token text,
    refresh_token text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_organization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    role_id uuid,
    module_key text NOT NULL,
    can_view boolean DEFAULT true,
    can_create boolean DEFAULT false,
    can_edit boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    can_export boolean DEFAULT false,
    can_manage_settings boolean DEFAULT false
);


--
-- Name: settings_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    modules text DEFAULT 'operate'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_security; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_security (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    mfa_required boolean DEFAULT false,
    password_min_length integer DEFAULT 10,
    require_symbol boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    provider text DEFAULT 'hubly'::text,
    external_id text,
    plan text,
    status text DEFAULT 'active'::text,
    renews_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    user_id uuid,
    name text NOT NULL,
    email text,
    role text DEFAULT 'Employee'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    invited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stripe_connect_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_connect_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    stripe_account_id text NOT NULL,
    charges_enabled boolean DEFAULT false NOT NULL,
    payouts_enabled boolean DEFAULT false NOT NULL,
    details_submitted boolean DEFAULT false NOT NULL,
    email text,
    connected_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text
);


--
-- Name: TABLE stripe_connect_accounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stripe_connect_accounts IS 'Per-business Stripe Connect Express account. Never expose secret keys; status via edge functions.';


--
-- Name: studio_analytics_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_analytics_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    period_days integer DEFAULT 30 NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    insights jsonb DEFAULT '[]'::jsonb NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: studio_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    kind text DEFAULT 'image'::text NOT NULL,
    url text NOT NULL,
    thumb_url text,
    bytes bigint DEFAULT 0 NOT NULL,
    width integer,
    height integer,
    source jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_assets_kind_check CHECK ((kind = ANY (ARRAY['image'::text, 'graphic'::text, 'upload'::text, 'job_photo'::text, 'logo'::text])))
);


--
-- Name: studio_brand_kit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_brand_kit (
    business_id uuid NOT NULL,
    logos jsonb DEFAULT '[]'::jsonb NOT NULL,
    colors jsonb DEFAULT '[]'::jsonb NOT NULL,
    typography jsonb DEFAULT '{}'::jsonb NOT NULL,
    voice_tones jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE studio_brand_kit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.studio_brand_kit IS 'Studio Brand Kit — logos, palette, fonts, copywriting tones. Interpretive voice may mirror DNA but stays Studio-owned for creative output.';


--
-- Name: studio_project_exports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_project_exports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    project_id uuid NOT NULL,
    format text DEFAULT 'png'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    url text,
    canva_export_id text,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT studio_project_exports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'ready'::text, 'failed'::text])))
);


--
-- Name: studio_project_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_project_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    project_id uuid NOT NULL,
    format text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    width integer DEFAULT 1080 NOT NULL,
    height integer DEFAULT 1080 NOT NULL,
    canvas jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_project_pages_format_check CHECK ((format = ANY (ARRAY['instagram_post'::text, 'facebook_feed'::text, 'instagram_story'::text, 'print_flyer'::text, 'google_business'::text, 'email_header'::text, 'facebook_post'::text])))
);


--
-- Name: studio_project_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_project_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    project_id uuid NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    canva_design_id text,
    thumbnail_url text,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    source text DEFAULT 'hubly'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_project_versions_source_check CHECK ((source = ANY (ARRAY['hubly'::text, 'canva_return'::text, 'export'::text, 'manual'::text])))
);


--
-- Name: studio_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    format_primary text DEFAULT 'instagram_post'::text NOT NULL,
    thumbnail_url text,
    prompt text DEFAULT ''::text NOT NULL,
    platform text DEFAULT 'instagram'::text NOT NULL,
    style text DEFAULT 'bold'::text NOT NULL,
    tone text DEFAULT 'expert'::text NOT NULL,
    source jsonb DEFAULT '{}'::jsonb NOT NULL,
    canvas jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_edited_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    canva_design_id text,
    campaign_plan_id uuid,
    export_status text DEFAULT 'none'::text NOT NULL,
    CONSTRAINT studio_projects_export_status_check CHECK ((export_status = ANY (ARRAY['none'::text, 'pending'::text, 'ready'::text, 'failed'::text]))),
    CONSTRAINT studio_projects_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready'::text, 'scheduled'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: studio_publish_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_publish_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    project_id uuid,
    title text NOT NULL,
    caption text DEFAULT ''::text NOT NULL,
    channels text[] DEFAULT '{}'::text[] NOT NULL,
    scheduled_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    thumbnail_url text,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_publish_queue_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready'::text, 'scheduled'::text, 'publishing'::text, 'published'::text, 'failed'::text])))
);


--
-- Name: studio_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_settings (
    business_id uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    storage_used_bytes bigint DEFAULT 0 NOT NULL,
    storage_quota_bytes bigint DEFAULT '10737418240'::bigint NOT NULL,
    canva_linked boolean DEFAULT false NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE studio_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.studio_settings IS 'Per-business Hubly Studio settings. Canva link is informational until Connected Apps OAuth is live.';


--
-- Name: studio_social_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_social_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    provider text NOT NULL,
    handle text DEFAULT ''::text NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'not_connected'::text NOT NULL,
    external_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_social_accounts_provider_check CHECK ((provider = ANY (ARRAY['instagram'::text, 'facebook'::text, 'google_business'::text]))),
    CONSTRAINT studio_social_accounts_status_check CHECK ((status = ANY (ARRAY['not_connected'::text, 'connected'::text, 'sync_active'::text, 'error'::text])))
);


--
-- Name: studio_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    title text NOT NULL,
    category text DEFAULT 'social'::text NOT NULL,
    format text DEFAULT 'instagram_post'::text NOT NULL,
    industry text DEFAULT 'home_services'::text NOT NULL,
    thumbnail_url text,
    preview jsonb DEFAULT '{}'::jsonb NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    published boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_table_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_table_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    user_id uuid NOT NULL,
    table_key text NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE user_table_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_table_preferences IS 'Per-user, per-business, per-table workspace preferences (column order/width/hidden/labels, density, sort, saved views). Generic across every configurable table in Hubly via table_key.';


--
-- Name: website_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    path text NOT NULL,
    page_type text DEFAULT 'custom'::text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    published boolean DEFAULT true NOT NULL,
    source_engine text DEFAULT 'website'::text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT website_pages_page_type_check CHECK ((page_type = ANY (ARRAY['home'::text, 'services'::text, 'about'::text, 'contact'::text, 'store'::text, 'custom'::text]))),
    CONSTRAINT website_pages_source_engine_check CHECK ((source_engine = ANY (ARRAY['website'::text, 'commerce'::text, 'booking'::text])))
);


--
-- Name: TABLE website_pages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.website_pages IS 'Website Engine pages. page_type=store + source_engine=commerce → Commerce storefront renderer.';


--
-- Name: workspace_memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_memories (
    business_id uuid NOT NULL,
    memory jsonb DEFAULT '{"version": 1}'::jsonb NOT NULL,
    memory_version integer DEFAULT 1 NOT NULL,
    source text DEFAULT 'client'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_memories_source_check CHECK ((source = ANY (ARRAY['client'::text, 'brain'::text, 'system'::text, 'hubly_brain'::text])))
);


--
-- Name: TABLE workspace_memories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_memories IS 'Hubly Brain Workspace Memory — sidebar, dashboard, pins. Separate from Business Memory.';


--
-- Name: workspace_memory_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_memory_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    change_id text NOT NULL,
    memory_version integer NOT NULL,
    path text NOT NULL,
    previous jsonb,
    next jsonb,
    reason text NOT NULL,
    expert_id text NOT NULL,
    importance text DEFAULT 'medium'::text NOT NULL,
    confidence integer DEFAULT 0 NOT NULL,
    source text DEFAULT 'ai_inference'::text NOT NULL,
    committed_by text DEFAULT 'hubly_brain'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_memory_changes_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100))),
    CONSTRAINT workspace_memory_changes_importance_check CHECK ((importance = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT workspace_memory_changes_source_check CHECK ((source = ANY (ARRAY['user'::text, 'ai_inference'::text, 'external_integration'::text])))
);


--
-- Name: TABLE workspace_memory_changes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_memory_changes IS 'Hubly Brain Workspace Memory changelog — how the owner likes to work (sidebar, pins, hidden tools). Separate from Business Memory.';


--
-- Name: zip_centroids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zip_centroids (
    zip text NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    latitude numeric(9,6) NOT NULL,
    longitude numeric(9,6) NOT NULL
);


--
-- Name: TABLE zip_centroids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.zip_centroids IS 'US ZIP -> approximate centroid (city/state/lat/lng). National coverage imported from GeoNames US postal codes (CC-BY 4.0, https://www.geonames.org). 50 states + DC + MH; excludes overseas military APO/FPO ZIPs. Backend-only lookup used by the marketplace edge function (resolveZipCentroid) for geographic provider discovery. PR/GU/VI/AS/MP territories are NOT included (separate GeoNames country files).';


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: addons addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addons
    ADD CONSTRAINT addons_pkey PRIMARY KEY (id);


--
-- Name: adobe_lightroom_connections adobe_lightroom_connections_business_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adobe_lightroom_connections
    ADD CONSTRAINT adobe_lightroom_connections_business_unique UNIQUE (business_id);


--
-- Name: adobe_lightroom_connections adobe_lightroom_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adobe_lightroom_connections
    ADD CONSTRAINT adobe_lightroom_connections_pkey PRIMARY KEY (id);


--
-- Name: adobe_oauth_states adobe_oauth_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adobe_oauth_states
    ADD CONSTRAINT adobe_oauth_states_pkey PRIMARY KEY (id);


--
-- Name: adobe_oauth_states adobe_oauth_states_state_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adobe_oauth_states
    ADD CONSTRAINT adobe_oauth_states_state_key UNIQUE (state);


--
-- Name: ask_hubly_activity_feed ask_hubly_activity_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_activity_feed
    ADD CONSTRAINT ask_hubly_activity_feed_pkey PRIMARY KEY (id);


--
-- Name: ask_hubly_ai_actions ask_hubly_ai_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_ai_actions
    ADD CONSTRAINT ask_hubly_ai_actions_pkey PRIMARY KEY (id);


--
-- Name: ask_hubly_conversations ask_hubly_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_conversations
    ADD CONSTRAINT ask_hubly_conversations_pkey PRIMARY KEY (id);


--
-- Name: ask_hubly_insights ask_hubly_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_insights
    ADD CONSTRAINT ask_hubly_insights_pkey PRIMARY KEY (id);


--
-- Name: ask_hubly_messages ask_hubly_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_messages
    ADD CONSTRAINT ask_hubly_messages_pkey PRIMARY KEY (id);


--
-- Name: booking_requests booking_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_pkey PRIMARY KEY (id);


--
-- Name: business_dna business_dna_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_dna
    ADD CONSTRAINT business_dna_pkey PRIMARY KEY (business_id);


--
-- Name: business_documents business_documents_business_id_tag_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_documents
    ADD CONSTRAINT business_documents_business_id_tag_version_key UNIQUE (business_id, tag, version);


--
-- Name: business_documents business_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_documents
    ADD CONSTRAINT business_documents_pkey PRIMARY KEY (id);


--
-- Name: business_memories business_memories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_memories
    ADD CONSTRAINT business_memories_pkey PRIMARY KEY (business_id);


--
-- Name: business_memory_changes business_memory_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_memory_changes
    ADD CONSTRAINT business_memory_changes_pkey PRIMARY KEY (id);


--
-- Name: business_table_config business_table_config_business_id_table_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_table_config
    ADD CONSTRAINT business_table_config_business_id_table_key_key UNIQUE (business_id, table_key);


--
-- Name: business_table_config business_table_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_table_config
    ADD CONSTRAINT business_table_config_pkey PRIMARY KEY (id);


--
-- Name: business_timeline_events business_timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_timeline_events
    ADD CONSTRAINT business_timeline_events_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_owner_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_owner_id_key UNIQUE (owner_id);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_slug_key UNIQUE (slug);


--
-- Name: campaign_goals campaign_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_goals
    ADD CONSTRAINT campaign_goals_pkey PRIMARY KEY (id);


--
-- Name: campaign_industries campaign_industries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_industries
    ADD CONSTRAINT campaign_industries_pkey PRIMARY KEY (id);


--
-- Name: campaign_plans campaign_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_plans
    ADD CONSTRAINT campaign_plans_pkey PRIMARY KEY (id);


--
-- Name: campaign_playbook_assets campaign_playbook_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_playbook_assets
    ADD CONSTRAINT campaign_playbook_assets_pkey PRIMARY KEY (id);


--
-- Name: campaign_playbook_assets campaign_playbook_assets_playbook_id_asset_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_playbook_assets
    ADD CONSTRAINT campaign_playbook_assets_playbook_id_asset_key_key UNIQUE (playbook_id, asset_key);


--
-- Name: campaign_playbooks campaign_playbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_playbooks
    ADD CONSTRAINT campaign_playbooks_pkey PRIMARY KEY (id);


--
-- Name: campaign_seasonal_calendar campaign_seasonal_calendar_industry_id_month_playbook_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_seasonal_calendar
    ADD CONSTRAINT campaign_seasonal_calendar_industry_id_month_playbook_id_key UNIQUE (industry_id, month, playbook_id);


--
-- Name: campaign_seasonal_calendar campaign_seasonal_calendar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_seasonal_calendar
    ADD CONSTRAINT campaign_seasonal_calendar_pkey PRIMARY KEY (id);


--
-- Name: campaign_triggers campaign_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_triggers
    ADD CONSTRAINT campaign_triggers_pkey PRIMARY KEY (id);


--
-- Name: chatbot_conversations chatbot_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_conversations
    ADD CONSTRAINT chatbot_conversations_pkey PRIMARY KEY (id);


--
-- Name: chatbot_messages chatbot_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_messages
    ADD CONSTRAINT chatbot_messages_pkey PRIMARY KEY (id);


--
-- Name: commerce_bundle_products commerce_bundle_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_bundle_products
    ADD CONSTRAINT commerce_bundle_products_pkey PRIMARY KEY (bundle_id, product_id);


--
-- Name: commerce_bundles commerce_bundles_business_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_bundles
    ADD CONSTRAINT commerce_bundles_business_id_slug_key UNIQUE (business_id, slug);


--
-- Name: commerce_bundles commerce_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_bundles
    ADD CONSTRAINT commerce_bundles_pkey PRIMARY KEY (id);


--
-- Name: commerce_cart_items commerce_cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_cart_items
    ADD CONSTRAINT commerce_cart_items_pkey PRIMARY KEY (id);


--
-- Name: commerce_carts commerce_carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_carts
    ADD CONSTRAINT commerce_carts_pkey PRIMARY KEY (id);


--
-- Name: commerce_collection_products commerce_collection_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_collection_products
    ADD CONSTRAINT commerce_collection_products_pkey PRIMARY KEY (collection_id, product_id);


--
-- Name: commerce_collections commerce_collections_business_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_collections
    ADD CONSTRAINT commerce_collections_business_id_slug_key UNIQUE (business_id, slug);


--
-- Name: commerce_collections commerce_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_collections
    ADD CONSTRAINT commerce_collections_pkey PRIMARY KEY (id);


--
-- Name: commerce_discounts commerce_discounts_business_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_discounts
    ADD CONSTRAINT commerce_discounts_business_id_code_key UNIQUE (business_id, code);


--
-- Name: commerce_discounts commerce_discounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_discounts
    ADD CONSTRAINT commerce_discounts_pkey PRIMARY KEY (id);


--
-- Name: commerce_documents commerce_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_documents
    ADD CONSTRAINT commerce_documents_pkey PRIMARY KEY (id);


--
-- Name: commerce_gift_cards commerce_gift_cards_business_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_gift_cards
    ADD CONSTRAINT commerce_gift_cards_business_id_code_key UNIQUE (business_id, code);


--
-- Name: commerce_gift_cards commerce_gift_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_gift_cards
    ADD CONSTRAINT commerce_gift_cards_pkey PRIMARY KEY (id);


--
-- Name: commerce_inventory_logs commerce_inventory_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_inventory_logs
    ADD CONSTRAINT commerce_inventory_logs_pkey PRIMARY KEY (id);


--
-- Name: commerce_merchandising_recs commerce_merchandising_recs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_merchandising_recs
    ADD CONSTRAINT commerce_merchandising_recs_pkey PRIMARY KEY (id);


--
-- Name: commerce_order_items commerce_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_items
    ADD CONSTRAINT commerce_order_items_pkey PRIMARY KEY (id);


--
-- Name: commerce_orders commerce_orders_business_id_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_orders
    ADD CONSTRAINT commerce_orders_business_id_order_number_key UNIQUE (business_id, order_number);


--
-- Name: commerce_orders commerce_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_orders
    ADD CONSTRAINT commerce_orders_pkey PRIMARY KEY (id);


--
-- Name: commerce_product_images commerce_product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_product_images
    ADD CONSTRAINT commerce_product_images_pkey PRIMARY KEY (id);


--
-- Name: commerce_product_variants commerce_product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_product_variants
    ADD CONSTRAINT commerce_product_variants_pkey PRIMARY KEY (id);


--
-- Name: commerce_products commerce_products_business_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_products
    ADD CONSTRAINT commerce_products_business_id_slug_key UNIQUE (business_id, slug);


--
-- Name: commerce_products commerce_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_products
    ADD CONSTRAINT commerce_products_pkey PRIMARY KEY (id);


--
-- Name: commerce_shipping_profiles commerce_shipping_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_shipping_profiles
    ADD CONSTRAINT commerce_shipping_profiles_pkey PRIMARY KEY (id);


--
-- Name: commerce_store_settings commerce_store_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_store_settings
    ADD CONSTRAINT commerce_store_settings_pkey PRIMARY KEY (business_id);


--
-- Name: customer_memories customer_memories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_memories
    ADD CONSTRAINT customer_memories_pkey PRIMARY KEY (id);


--
-- Name: customer_profiles customer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: document_build_jobs document_build_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_build_jobs
    ADD CONSTRAINT document_build_jobs_pkey PRIMARY KEY (id);


--
-- Name: document_vocabulary_rejections document_vocabulary_rejections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_vocabulary_rejections
    ADD CONSTRAINT document_vocabulary_rejections_pkey PRIMARY KEY (id);


--
-- Name: draft_claims draft_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_claims
    ADD CONSTRAINT draft_claims_pkey PRIMARY KEY (id);


--
-- Name: gallery_items gallery_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_items
    ADD CONSTRAINT gallery_items_pkey PRIMARY KEY (id);


--
-- Name: google_calendar_connections google_calendar_connections_business_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_business_unique UNIQUE (business_id);


--
-- Name: google_calendar_connections google_calendar_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_pkey PRIMARY KEY (id);


--
-- Name: google_calendar_events google_calendar_events_business_event_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_events
    ADD CONSTRAINT google_calendar_events_business_event_unique UNIQUE (business_id, google_event_id);


--
-- Name: google_calendar_events google_calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_events
    ADD CONSTRAINT google_calendar_events_pkey PRIMARY KEY (id);


--
-- Name: google_calendar_oauth_states google_calendar_oauth_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_oauth_states
    ADD CONSTRAINT google_calendar_oauth_states_pkey PRIMARY KEY (id);


--
-- Name: google_calendar_oauth_states google_calendar_oauth_states_state_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_oauth_states
    ADD CONSTRAINT google_calendar_oauth_states_state_key UNIQUE (state);


--
-- Name: hubly_app_connections hubly_app_connections_business_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubly_app_connections
    ADD CONSTRAINT hubly_app_connections_business_id_provider_key UNIQUE (business_id, provider);


--
-- Name: hubly_app_connections hubly_app_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubly_app_connections
    ADD CONSTRAINT hubly_app_connections_pkey PRIMARY KEY (id);


--
-- Name: hubly_brain_executions hubly_brain_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubly_brain_executions
    ADD CONSTRAINT hubly_brain_executions_pkey PRIMARY KEY (id);


--
-- Name: hubly_conversation_memories hubly_conversation_memories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubly_conversation_memories
    ADD CONSTRAINT hubly_conversation_memories_pkey PRIMARY KEY (id);


--
-- Name: hubly_execution_runs hubly_execution_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubly_execution_runs
    ADD CONSTRAINT hubly_execution_runs_pkey PRIMARY KEY (id);


--
-- Name: hubly_reasoning_events hubly_reasoning_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubly_reasoning_events
    ADD CONSTRAINT hubly_reasoning_events_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: marketplace_bookings marketplace_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_bookings
    ADD CONSTRAINT marketplace_bookings_pkey PRIMARY KEY (id);


--
-- Name: marketplace_conversations marketplace_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_conversations
    ADD CONSTRAINT marketplace_conversations_pkey PRIMARY KEY (id);


--
-- Name: marketplace_customers marketplace_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_customers
    ADD CONSTRAINT marketplace_customers_pkey PRIMARY KEY (id);


--
-- Name: marketplace_messages marketplace_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_messages
    ADD CONSTRAINT marketplace_messages_pkey PRIMARY KEY (id);


--
-- Name: marketplace_ops_flags marketplace_ops_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_ops_flags
    ADD CONSTRAINT marketplace_ops_flags_pkey PRIMARY KEY (id);


--
-- Name: marketplace_ops_notes marketplace_ops_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_ops_notes
    ADD CONSTRAINT marketplace_ops_notes_pkey PRIMARY KEY (id);


--
-- Name: marketplace_providers marketplace_providers_business_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_providers
    ADD CONSTRAINT marketplace_providers_business_unique UNIQUE (business_id);


--
-- Name: marketplace_providers marketplace_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_providers
    ADD CONSTRAINT marketplace_providers_pkey PRIMARY KEY (id);


--
-- Name: marketplace_requests marketplace_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_requests
    ADD CONSTRAINT marketplace_requests_pkey PRIMARY KEY (id);


--
-- Name: memberships memberships_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_customer_id_key UNIQUE (customer_id);


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);


--
-- Name: photography_project_activity photography_project_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_activity
    ADD CONSTRAINT photography_project_activity_pkey PRIMARY KEY (id);


--
-- Name: photography_project_contracts photography_project_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_contracts
    ADD CONSTRAINT photography_project_contracts_pkey PRIMARY KEY (id);


--
-- Name: photography_project_deliverables photography_project_deliverables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_deliverables
    ADD CONSTRAINT photography_project_deliverables_pkey PRIMARY KEY (id);


--
-- Name: photography_project_galleries photography_project_galleries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_galleries
    ADD CONSTRAINT photography_project_galleries_pkey PRIMARY KEY (id);


--
-- Name: photography_project_invoices photography_project_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_invoices
    ADD CONSTRAINT photography_project_invoices_pkey PRIMARY KEY (id);


--
-- Name: photography_project_lightroom photography_project_lightroom_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_lightroom
    ADD CONSTRAINT photography_project_lightroom_pkey PRIMARY KEY (id);


--
-- Name: photography_project_lightroom photography_project_lightroom_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_lightroom
    ADD CONSTRAINT photography_project_lightroom_project_id_key UNIQUE (project_id);


--
-- Name: photography_project_marketing photography_project_marketing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_marketing
    ADD CONSTRAINT photography_project_marketing_pkey PRIMARY KEY (id);


--
-- Name: photography_project_questionnaires photography_project_questionnaires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_questionnaires
    ADD CONSTRAINT photography_project_questionnaires_pkey PRIMARY KEY (id);


--
-- Name: photography_project_team photography_project_team_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_team
    ADD CONSTRAINT photography_project_team_pkey PRIMARY KEY (id);


--
-- Name: photography_project_timeline photography_project_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_timeline
    ADD CONSTRAINT photography_project_timeline_pkey PRIMARY KEY (id);


--
-- Name: photography_project_workspaces photography_project_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_workspaces
    ADD CONSTRAINT photography_project_workspaces_pkey PRIMARY KEY (id);


--
-- Name: photography_projects photography_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_projects
    ADD CONSTRAINT photography_projects_pkey PRIMARY KEY (id);


--
-- Name: portal_access_tokens portal_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_access_tokens
    ADD CONSTRAINT portal_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: portal_access_tokens portal_access_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_access_tokens
    ADD CONSTRAINT portal_access_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: portfolio_photos portfolio_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_photos
    ADD CONSTRAINT portfolio_photos_pkey PRIMARY KEY (id);


--
-- Name: recurring_schedules recurring_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_schedules
    ADD CONSTRAINT recurring_schedules_pkey PRIMARY KEY (id);


--
-- Name: review_submissions review_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_submissions
    ADD CONSTRAINT review_submissions_pkey PRIMARY KEY (id);


--
-- Name: service_photos service_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_photos
    ADD CONSTRAINT service_photos_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: settings_ai settings_ai_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_ai
    ADD CONSTRAINT settings_ai_business_id_key UNIQUE (business_id);


--
-- Name: settings_ai settings_ai_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_ai
    ADD CONSTRAINT settings_ai_pkey PRIMARY KEY (id);


--
-- Name: settings_api_keys settings_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_api_keys
    ADD CONSTRAINT settings_api_keys_pkey PRIMARY KEY (id);


--
-- Name: settings_audit_logs settings_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_audit_logs
    ADD CONSTRAINT settings_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: settings_billing settings_billing_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_billing
    ADD CONSTRAINT settings_billing_business_id_key UNIQUE (business_id);


--
-- Name: settings_billing settings_billing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_billing
    ADD CONSTRAINT settings_billing_pkey PRIMARY KEY (id);


--
-- Name: settings_branding settings_branding_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_branding
    ADD CONSTRAINT settings_branding_business_id_key UNIQUE (business_id);


--
-- Name: settings_branding settings_branding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_branding
    ADD CONSTRAINT settings_branding_pkey PRIMARY KEY (id);


--
-- Name: settings_business settings_business_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_business
    ADD CONSTRAINT settings_business_business_id_key UNIQUE (business_id);


--
-- Name: settings_business_hours settings_business_hours_business_id_weekday_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_business_hours
    ADD CONSTRAINT settings_business_hours_business_id_weekday_key UNIQUE (business_id, weekday);


--
-- Name: settings_business_hours settings_business_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_business_hours
    ADD CONSTRAINT settings_business_hours_pkey PRIMARY KEY (id);


--
-- Name: settings_business settings_business_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_business
    ADD CONSTRAINT settings_business_pkey PRIMARY KEY (id);


--
-- Name: settings_integrations settings_integrations_business_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_integrations
    ADD CONSTRAINT settings_integrations_business_id_provider_key UNIQUE (business_id, provider);


--
-- Name: settings_integrations settings_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_integrations
    ADD CONSTRAINT settings_integrations_pkey PRIMARY KEY (id);


--
-- Name: settings_notifications settings_notifications_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_notifications
    ADD CONSTRAINT settings_notifications_business_id_key UNIQUE (business_id);


--
-- Name: settings_notifications settings_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_notifications
    ADD CONSTRAINT settings_notifications_pkey PRIMARY KEY (id);


--
-- Name: settings_oauth_tokens settings_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_oauth_tokens
    ADD CONSTRAINT settings_oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: settings_organization settings_organization_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_organization
    ADD CONSTRAINT settings_organization_business_id_key UNIQUE (business_id);


--
-- Name: settings_organization settings_organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_organization
    ADD CONSTRAINT settings_organization_pkey PRIMARY KEY (id);


--
-- Name: settings_permissions settings_permissions_business_id_role_id_module_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_permissions
    ADD CONSTRAINT settings_permissions_business_id_role_id_module_key_key UNIQUE (business_id, role_id, module_key);


--
-- Name: settings_permissions settings_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_permissions
    ADD CONSTRAINT settings_permissions_pkey PRIMARY KEY (id);


--
-- Name: settings_roles settings_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_roles
    ADD CONSTRAINT settings_roles_pkey PRIMARY KEY (id);


--
-- Name: settings_security settings_security_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_security
    ADD CONSTRAINT settings_security_business_id_key UNIQUE (business_id);


--
-- Name: settings_security settings_security_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_security
    ADD CONSTRAINT settings_security_pkey PRIMARY KEY (id);


--
-- Name: settings_subscriptions settings_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_subscriptions
    ADD CONSTRAINT settings_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: settings_team_members settings_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_team_members
    ADD CONSTRAINT settings_team_members_pkey PRIMARY KEY (id);


--
-- Name: stripe_connect_accounts stripe_connect_accounts_business_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_connect_accounts
    ADD CONSTRAINT stripe_connect_accounts_business_unique UNIQUE (business_id);


--
-- Name: stripe_connect_accounts stripe_connect_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_connect_accounts
    ADD CONSTRAINT stripe_connect_accounts_pkey PRIMARY KEY (id);


--
-- Name: stripe_connect_accounts stripe_connect_accounts_stripe_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_connect_accounts
    ADD CONSTRAINT stripe_connect_accounts_stripe_unique UNIQUE (stripe_account_id);


--
-- Name: studio_analytics_snapshots studio_analytics_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_analytics_snapshots
    ADD CONSTRAINT studio_analytics_snapshots_pkey PRIMARY KEY (id);


--
-- Name: studio_assets studio_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_assets
    ADD CONSTRAINT studio_assets_pkey PRIMARY KEY (id);


--
-- Name: studio_brand_kit studio_brand_kit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_brand_kit
    ADD CONSTRAINT studio_brand_kit_pkey PRIMARY KEY (business_id);


--
-- Name: studio_project_exports studio_project_exports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_exports
    ADD CONSTRAINT studio_project_exports_pkey PRIMARY KEY (id);


--
-- Name: studio_project_pages studio_project_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_pages
    ADD CONSTRAINT studio_project_pages_pkey PRIMARY KEY (id);


--
-- Name: studio_project_pages studio_project_pages_project_id_format_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_pages
    ADD CONSTRAINT studio_project_pages_project_id_format_key UNIQUE (project_id, format);


--
-- Name: studio_project_versions studio_project_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_versions
    ADD CONSTRAINT studio_project_versions_pkey PRIMARY KEY (id);


--
-- Name: studio_project_versions studio_project_versions_project_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_versions
    ADD CONSTRAINT studio_project_versions_project_id_version_number_key UNIQUE (project_id, version_number);


--
-- Name: studio_projects studio_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_projects
    ADD CONSTRAINT studio_projects_pkey PRIMARY KEY (id);


--
-- Name: studio_publish_queue studio_publish_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_publish_queue
    ADD CONSTRAINT studio_publish_queue_pkey PRIMARY KEY (id);


--
-- Name: studio_settings studio_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_settings
    ADD CONSTRAINT studio_settings_pkey PRIMARY KEY (business_id);


--
-- Name: studio_social_accounts studio_social_accounts_business_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_social_accounts
    ADD CONSTRAINT studio_social_accounts_business_id_provider_key UNIQUE (business_id, provider);


--
-- Name: studio_social_accounts studio_social_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_social_accounts
    ADD CONSTRAINT studio_social_accounts_pkey PRIMARY KEY (id);


--
-- Name: studio_templates studio_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_templates
    ADD CONSTRAINT studio_templates_pkey PRIMARY KEY (id);


--
-- Name: user_table_preferences user_table_preferences_business_id_user_id_table_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_table_preferences
    ADD CONSTRAINT user_table_preferences_business_id_user_id_table_key_key UNIQUE (business_id, user_id, table_key);


--
-- Name: user_table_preferences user_table_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_table_preferences
    ADD CONSTRAINT user_table_preferences_pkey PRIMARY KEY (id);


--
-- Name: website_pages website_pages_business_id_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_pages
    ADD CONSTRAINT website_pages_business_id_path_key UNIQUE (business_id, path);


--
-- Name: website_pages website_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_pages
    ADD CONSTRAINT website_pages_pkey PRIMARY KEY (id);


--
-- Name: workspace_memories workspace_memories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memories
    ADD CONSTRAINT workspace_memories_pkey PRIMARY KEY (business_id);


--
-- Name: workspace_memory_changes workspace_memory_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memory_changes
    ADD CONSTRAINT workspace_memory_changes_pkey PRIMARY KEY (id);


--
-- Name: zip_centroids zip_centroids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zip_centroids
    ADD CONSTRAINT zip_centroids_pkey PRIMARY KEY (zip);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: adobe_lightroom_connections_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX adobe_lightroom_connections_owner_idx ON public.adobe_lightroom_connections USING btree (owner_id);


--
-- Name: adobe_oauth_states_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX adobe_oauth_states_expires_idx ON public.adobe_oauth_states USING btree (expires_at);


--
-- Name: ask_hubly_activity_feed_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ask_hubly_activity_feed_business_idx ON public.ask_hubly_activity_feed USING btree (business_id, created_at DESC);


--
-- Name: ask_hubly_ai_actions_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ask_hubly_ai_actions_business_idx ON public.ask_hubly_ai_actions USING btree (business_id, created_at DESC);


--
-- Name: ask_hubly_conversations_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ask_hubly_conversations_business_idx ON public.ask_hubly_conversations USING btree (business_id, updated_at DESC);


--
-- Name: ask_hubly_insights_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ask_hubly_insights_business_idx ON public.ask_hubly_insights USING btree (business_id, created_at DESC);


--
-- Name: ask_hubly_messages_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ask_hubly_messages_conversation_idx ON public.ask_hubly_messages USING btree (conversation_id, created_at);


--
-- Name: booking_requests_stripe_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_requests_stripe_session_idx ON public.booking_requests USING btree (stripe_checkout_session_id) WHERE (stripe_checkout_session_id IS NOT NULL);


--
-- Name: business_dna_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_dna_updated_at_idx ON public.business_dna USING btree (updated_at DESC);


--
-- Name: business_documents_latest_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_documents_latest_idx ON public.business_documents USING btree (business_id, tag, version DESC);


--
-- Name: business_memories_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_memories_updated_at_idx ON public.business_memories USING btree (updated_at DESC);


--
-- Name: business_memory_changes_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_memory_changes_business_idx ON public.business_memory_changes USING btree (business_id, created_at DESC);


--
-- Name: business_memory_changes_path_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_memory_changes_path_idx ON public.business_memory_changes USING btree (business_id, path);


--
-- Name: business_table_config_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_table_config_lookup_idx ON public.business_table_config USING btree (business_id, table_key);


--
-- Name: business_timeline_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_timeline_business_idx ON public.business_timeline_events USING btree (business_id, occurred_at DESC);


--
-- Name: businesses_geo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX businesses_geo_idx ON public.businesses USING btree (latitude, longitude) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));


--
-- Name: campaign_plans_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_plans_business_idx ON public.campaign_plans USING btree (business_id, created_at DESC);


--
-- Name: campaign_plans_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_plans_status_idx ON public.campaign_plans USING btree (business_id, status);


--
-- Name: campaign_playbooks_industry_goal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_playbooks_industry_goal_idx ON public.campaign_playbooks USING btree (industry_id, goal_id, priority DESC);


--
-- Name: campaign_seasonal_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_seasonal_month_idx ON public.campaign_seasonal_calendar USING btree (industry_id, month, priority DESC);


--
-- Name: chatbot_conversations_business_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chatbot_conversations_business_started_idx ON public.chatbot_conversations USING btree (business_id, started_at);


--
-- Name: commerce_cart_items_cart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_cart_items_cart_idx ON public.commerce_cart_items USING btree (cart_id);


--
-- Name: commerce_carts_business_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_carts_business_customer_idx ON public.commerce_carts USING btree (business_id, customer_id);


--
-- Name: commerce_carts_guest_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_carts_guest_idx ON public.commerce_carts USING btree (business_id, guest_token);


--
-- Name: commerce_documents_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_documents_business_idx ON public.commerce_documents USING btree (business_id);


--
-- Name: commerce_inventory_logs_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_inventory_logs_product_idx ON public.commerce_inventory_logs USING btree (product_id, created_at DESC);


--
-- Name: commerce_order_items_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_order_items_order_idx ON public.commerce_order_items USING btree (order_id);


--
-- Name: commerce_orders_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_orders_business_idx ON public.commerce_orders USING btree (business_id, created_at DESC);


--
-- Name: commerce_orders_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_orders_customer_idx ON public.commerce_orders USING btree (business_id, customer_id);


--
-- Name: commerce_orders_stripe_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_orders_stripe_session_idx ON public.commerce_orders USING btree (stripe_checkout_session_id);


--
-- Name: commerce_product_images_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_product_images_product_idx ON public.commerce_product_images USING btree (product_id);


--
-- Name: commerce_product_variants_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_product_variants_product_idx ON public.commerce_product_variants USING btree (product_id);


--
-- Name: commerce_products_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_products_business_idx ON public.commerce_products USING btree (business_id);


--
-- Name: commerce_products_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_products_sku_idx ON public.commerce_products USING btree (business_id, sku);


--
-- Name: commerce_products_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_products_status_idx ON public.commerce_products USING btree (business_id, status);


--
-- Name: commerce_shipping_profiles_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_shipping_profiles_business_idx ON public.commerce_shipping_profiles USING btree (business_id);


--
-- Name: customer_memories_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_memories_owner_idx ON public.customer_memories USING btree (owner_user_id, updated_at DESC);


--
-- Name: customer_memories_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_memories_session_idx ON public.customer_memories USING btree (session_key, updated_at DESC);


--
-- Name: customer_profiles_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_profiles_owner_idx ON public.customer_profiles USING btree (owner_user_id, updated_at DESC);


--
-- Name: customer_profiles_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_profiles_session_idx ON public.customer_profiles USING btree (session_key, updated_at DESC);


--
-- Name: document_build_jobs_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_build_jobs_business_idx ON public.document_build_jobs USING btree (business_id, tag, started_at DESC);


--
-- Name: document_build_jobs_running_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_build_jobs_running_idx ON public.document_build_jobs USING btree (expected_by) WHERE (status = 'running'::text);


--
-- Name: document_vocabulary_rejections_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_vocabulary_rejections_created_idx ON public.document_vocabulary_rejections USING btree (created_at DESC);


--
-- Name: draft_claims_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX draft_claims_business_idx ON public.draft_claims USING btree (business_id);


--
-- Name: draft_claims_email_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX draft_claims_email_open_idx ON public.draft_claims USING btree (lower(email)) WHERE (claimed_at IS NULL);


--
-- Name: google_calendar_connections_inbound_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX google_calendar_connections_inbound_idx ON public.google_calendar_connections USING btree (last_inbound_at NULLS FIRST);


--
-- Name: google_calendar_connections_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX google_calendar_connections_owner_idx ON public.google_calendar_connections USING btree (owner_id);


--
-- Name: google_calendar_connections_watch_channel_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX google_calendar_connections_watch_channel_uidx ON public.google_calendar_connections USING btree (watch_channel_id) WHERE (watch_channel_id IS NOT NULL);


--
-- Name: google_calendar_connections_watch_exp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX google_calendar_connections_watch_exp_idx ON public.google_calendar_connections USING btree (watch_expiration) WHERE (watch_expiration IS NOT NULL);


--
-- Name: google_calendar_events_business_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX google_calendar_events_business_date_idx ON public.google_calendar_events USING btree (business_id, local_date);


--
-- Name: google_calendar_events_business_start_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX google_calendar_events_business_start_idx ON public.google_calendar_events USING btree (business_id, start_at);


--
-- Name: google_calendar_oauth_states_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX google_calendar_oauth_states_expires_idx ON public.google_calendar_oauth_states USING btree (expires_at);


--
-- Name: hubly_app_connections_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hubly_app_connections_business_idx ON public.hubly_app_connections USING btree (business_id);


--
-- Name: hubly_brain_executions_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hubly_brain_executions_business_idx ON public.hubly_brain_executions USING btree (business_id, created_at DESC);


--
-- Name: hubly_brain_executions_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hubly_brain_executions_created_idx ON public.hubly_brain_executions USING btree (created_at DESC);


--
-- Name: hubly_conversation_memories_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hubly_conversation_memories_business_idx ON public.hubly_conversation_memories USING btree (business_id, updated_at DESC);


--
-- Name: hubly_execution_runs_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hubly_execution_runs_business_id_idx ON public.hubly_execution_runs USING btree (business_id, started_at DESC);


--
-- Name: hubly_execution_runs_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hubly_execution_runs_started_at_idx ON public.hubly_execution_runs USING btree (started_at DESC);


--
-- Name: hubly_reasoning_events_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hubly_reasoning_events_business_idx ON public.hubly_reasoning_events USING btree (business_id, created_at DESC);


--
-- Name: idx_jobs_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_customer_id ON public.jobs USING btree (customer_id);


--
-- Name: jobs_booking_request_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_booking_request_id_idx ON public.jobs USING btree (booking_request_id) WHERE (booking_request_id IS NOT NULL);


--
-- Name: jobs_booking_request_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX jobs_booking_request_id_unique ON public.jobs USING btree (booking_request_id) WHERE (booking_request_id IS NOT NULL);


--
-- Name: jobs_business_google_event_id_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX jobs_business_google_event_id_uidx ON public.jobs USING btree (business_id, google_event_id) WHERE (google_event_id IS NOT NULL);


--
-- Name: jobs_hubly_job_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_hubly_job_id_idx ON public.jobs USING btree (hubly_job_id);


--
-- Name: jobs_recurring_schedule_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_recurring_schedule_id_idx ON public.jobs USING btree (recurring_schedule_id);


--
-- Name: jobs_sync_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_sync_status_idx ON public.jobs USING btree (business_id, sync_status);


--
-- Name: marketplace_bookings_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_bookings_business_idx ON public.marketplace_bookings USING btree (business_id, created_at DESC);


--
-- Name: marketplace_bookings_confirmation_code_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX marketplace_bookings_confirmation_code_uidx ON public.marketplace_bookings USING btree (confirmation_code) WHERE (confirmation_code IS NOT NULL);


--
-- Name: marketplace_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_bookings_provider_idx ON public.marketplace_bookings USING btree (provider_id, created_at DESC);


--
-- Name: marketplace_bookings_starts_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_bookings_starts_at_idx ON public.marketplace_bookings USING btree (business_id, starts_at) WHERE ((starts_at IS NOT NULL) AND (status = ANY (ARRAY['requested'::text, 'confirmed'::text, 'in_progress'::text])));


--
-- Name: marketplace_conversations_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_conversations_booking_idx ON public.marketplace_conversations USING btree (booking_id) WHERE (booking_id IS NOT NULL);


--
-- Name: marketplace_customers_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_customers_business_idx ON public.marketplace_customers USING btree (business_id, created_at DESC);


--
-- Name: marketplace_customers_crm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_customers_crm_idx ON public.marketplace_customers USING btree (crm_customer_id) WHERE (crm_customer_id IS NOT NULL);


--
-- Name: marketplace_customers_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_customers_email_idx ON public.marketplace_customers USING btree (business_id, lower(email)) WHERE (email IS NOT NULL);


--
-- Name: marketplace_messages_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_messages_business_idx ON public.marketplace_messages USING btree (business_id, created_at DESC);


--
-- Name: marketplace_messages_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_messages_conversation_idx ON public.marketplace_messages USING btree (conversation_id, created_at);


--
-- Name: marketplace_ops_flags_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_ops_flags_status_idx ON public.marketplace_ops_flags USING btree (status, created_at DESC);


--
-- Name: marketplace_ops_notes_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_ops_notes_provider_idx ON public.marketplace_ops_notes USING btree (provider_id, created_at DESC);


--
-- Name: marketplace_providers_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_providers_category_idx ON public.marketplace_providers USING btree (category) WHERE (category IS NOT NULL);


--
-- Name: marketplace_providers_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_providers_owner_idx ON public.marketplace_providers USING btree (owner_id);


--
-- Name: marketplace_providers_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_providers_public_idx ON public.marketplace_providers USING btree (marketplace_status, marketplace_score DESC) WHERE (marketplace_status = 'verified'::text);


--
-- Name: marketplace_providers_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_providers_score_idx ON public.marketplace_providers USING btree (marketplace_score DESC);


--
-- Name: marketplace_requests_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketplace_requests_provider_idx ON public.marketplace_requests USING btree (provider_id, created_at DESC);


--
-- Name: memberships_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memberships_business_id_idx ON public.memberships USING btree (business_id);


--
-- Name: memberships_customer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memberships_customer_id_idx ON public.memberships USING btree (customer_id);


--
-- Name: photography_project_activity_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_project_activity_project_idx ON public.photography_project_activity USING btree (project_id, created_at DESC);


--
-- Name: photography_project_contracts_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_project_contracts_project_idx ON public.photography_project_contracts USING btree (project_id);


--
-- Name: photography_project_deliverables_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_project_deliverables_project_idx ON public.photography_project_deliverables USING btree (project_id);


--
-- Name: photography_project_galleries_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_project_galleries_project_idx ON public.photography_project_galleries USING btree (project_id);


--
-- Name: photography_project_invoices_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_project_invoices_project_idx ON public.photography_project_invoices USING btree (project_id);


--
-- Name: photography_project_marketing_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_project_marketing_project_idx ON public.photography_project_marketing USING btree (project_id);


--
-- Name: photography_project_questionnaires_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_project_questionnaires_project_idx ON public.photography_project_questionnaires USING btree (project_id);


--
-- Name: photography_project_team_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_project_team_project_idx ON public.photography_project_team USING btree (project_id);


--
-- Name: photography_project_timeline_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_project_timeline_project_idx ON public.photography_project_timeline USING btree (project_id, sort_order);


--
-- Name: photography_project_workspaces_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_project_workspaces_project_idx ON public.photography_project_workspaces USING btree (project_id);


--
-- Name: photography_project_workspaces_project_provider_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX photography_project_workspaces_project_provider_uidx ON public.photography_project_workspaces USING btree (project_id, provider);


--
-- Name: photography_project_workspaces_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_project_workspaces_provider_idx ON public.photography_project_workspaces USING btree (business_id, provider);


--
-- Name: photography_projects_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_projects_business_id_idx ON public.photography_projects USING btree (business_id);


--
-- Name: photography_projects_shoot_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_projects_shoot_date_idx ON public.photography_projects USING btree (business_id, shoot_date);


--
-- Name: photography_projects_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photography_projects_status_idx ON public.photography_projects USING btree (business_id, status);


--
-- Name: photography_projects_twin_key_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX photography_projects_twin_key_uidx ON public.photography_projects USING btree (business_id, twin_key) WHERE (twin_key IS NOT NULL);


--
-- Name: portal_access_tokens_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX portal_access_tokens_business_id_idx ON public.portal_access_tokens USING btree (business_id);


--
-- Name: portal_access_tokens_customer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX portal_access_tokens_customer_id_idx ON public.portal_access_tokens USING btree (customer_id);


--
-- Name: recurring_schedules_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recurring_schedules_business_id_idx ON public.recurring_schedules USING btree (business_id);


--
-- Name: recurring_schedules_customer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recurring_schedules_customer_id_idx ON public.recurring_schedules USING btree (customer_id);


--
-- Name: stripe_connect_accounts_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stripe_connect_accounts_owner_idx ON public.stripe_connect_accounts USING btree (owner_id);


--
-- Name: studio_analytics_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_analytics_business_idx ON public.studio_analytics_snapshots USING btree (business_id, captured_at DESC);


--
-- Name: studio_assets_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_assets_business_idx ON public.studio_assets USING btree (business_id, created_at DESC);


--
-- Name: studio_project_exports_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_project_exports_project_idx ON public.studio_project_exports USING btree (project_id, created_at DESC);


--
-- Name: studio_project_pages_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_project_pages_project_idx ON public.studio_project_pages USING btree (project_id, sort_order);


--
-- Name: studio_project_versions_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_project_versions_project_idx ON public.studio_project_versions USING btree (project_id, version_number DESC);


--
-- Name: studio_projects_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_projects_business_idx ON public.studio_projects USING btree (business_id, last_edited_at DESC);


--
-- Name: studio_projects_canva_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_projects_canva_idx ON public.studio_projects USING btree (business_id, canva_design_id) WHERE (canva_design_id IS NOT NULL);


--
-- Name: studio_projects_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_projects_status_idx ON public.studio_projects USING btree (business_id, status);


--
-- Name: studio_publish_queue_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_publish_queue_business_idx ON public.studio_publish_queue USING btree (business_id, scheduled_at);


--
-- Name: studio_templates_cat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_templates_cat_idx ON public.studio_templates USING btree (category, featured DESC, sort_order);


--
-- Name: user_table_preferences_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_table_preferences_lookup_idx ON public.user_table_preferences USING btree (business_id, user_id, table_key);


--
-- Name: website_pages_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX website_pages_business_idx ON public.website_pages USING btree (business_id);


--
-- Name: workspace_memories_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_memories_updated_at_idx ON public.workspace_memories USING btree (updated_at DESC);


--
-- Name: workspace_memory_changes_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_memory_changes_business_idx ON public.workspace_memory_changes USING btree (business_id, created_at DESC);


--
-- Name: workspace_memory_changes_path_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_memory_changes_path_idx ON public.workspace_memory_changes USING btree (business_id, path);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: businesses protect_business_tier; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_business_tier BEFORE INSERT OR UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public._protect_business_tier();


--
-- Name: businesses trg_businesses_ensure_marketplace_provider; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_businesses_ensure_marketplace_provider AFTER INSERT ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.ensure_marketplace_provider_for_business();


--
-- Name: businesses trg_businesses_ensure_marketplace_provider_claim; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_businesses_ensure_marketplace_provider_claim AFTER UPDATE OF owner_id ON public.businesses FOR EACH ROW WHEN (((old.owner_id IS NULL) AND (new.owner_id IS NOT NULL))) EXECUTE FUNCTION public.ensure_marketplace_provider_for_business();


--
-- Name: jobs trg_jobs_sync_metadata_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_jobs_sync_metadata_touch BEFORE INSERT OR UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.jobs_sync_metadata_touch();


--
-- Name: booking_requests trg_supersede_abandoned_booking; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_supersede_abandoned_booking AFTER INSERT ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.supersede_abandoned_booking_on_resume();


--
-- Name: marketplace_providers trg_sync_business_marketplace_capability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_business_marketplace_capability AFTER INSERT OR UPDATE OF marketplace_enabled, provider_kind ON public.marketplace_providers FOR EACH ROW EXECUTE FUNCTION public.sync_business_marketplace_capability();


--
-- Name: business_dna trg_touch_business_dna_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_business_dna_updated_at BEFORE UPDATE ON public.business_dna FOR EACH ROW EXECUTE FUNCTION public.touch_business_dna_updated_at();


--
-- Name: business_memories trg_touch_business_memories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_business_memories_updated_at BEFORE UPDATE ON public.business_memories FOR EACH ROW EXECUTE FUNCTION public.touch_business_memories_updated_at();


--
-- Name: business_table_config trg_touch_business_table_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_business_table_config_updated_at BEFORE UPDATE ON public.business_table_config FOR EACH ROW EXECUTE FUNCTION public.touch_business_table_config_updated_at();


--
-- Name: commerce_bundles trg_touch_commerce_bundles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_commerce_bundles BEFORE UPDATE ON public.commerce_bundles FOR EACH ROW EXECUTE FUNCTION public.touch_commerce_updated_at();


--
-- Name: commerce_cart_items trg_touch_commerce_cart_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_commerce_cart_items BEFORE UPDATE ON public.commerce_cart_items FOR EACH ROW EXECUTE FUNCTION public.touch_commerce_updated_at();


--
-- Name: commerce_carts trg_touch_commerce_carts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_commerce_carts BEFORE UPDATE ON public.commerce_carts FOR EACH ROW EXECUTE FUNCTION public.touch_commerce_updated_at();


--
-- Name: commerce_collections trg_touch_commerce_collections; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_commerce_collections BEFORE UPDATE ON public.commerce_collections FOR EACH ROW EXECUTE FUNCTION public.touch_commerce_updated_at();


--
-- Name: commerce_discounts trg_touch_commerce_discounts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_commerce_discounts BEFORE UPDATE ON public.commerce_discounts FOR EACH ROW EXECUTE FUNCTION public.touch_commerce_updated_at();


--
-- Name: commerce_documents trg_touch_commerce_documents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_commerce_documents BEFORE UPDATE ON public.commerce_documents FOR EACH ROW EXECUTE FUNCTION public.touch_commerce_updated_at();


--
-- Name: commerce_gift_cards trg_touch_commerce_gift_cards; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_commerce_gift_cards BEFORE UPDATE ON public.commerce_gift_cards FOR EACH ROW EXECUTE FUNCTION public.touch_commerce_updated_at();


--
-- Name: commerce_orders trg_touch_commerce_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_commerce_orders BEFORE UPDATE ON public.commerce_orders FOR EACH ROW EXECUTE FUNCTION public.touch_commerce_updated_at();


--
-- Name: commerce_product_variants trg_touch_commerce_product_variants; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_commerce_product_variants BEFORE UPDATE ON public.commerce_product_variants FOR EACH ROW EXECUTE FUNCTION public.touch_commerce_updated_at();


--
-- Name: commerce_products trg_touch_commerce_products; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_commerce_products BEFORE UPDATE ON public.commerce_products FOR EACH ROW EXECUTE FUNCTION public.touch_commerce_updated_at();


--
-- Name: commerce_shipping_profiles trg_touch_commerce_shipping_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_commerce_shipping_profiles BEFORE UPDATE ON public.commerce_shipping_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_commerce_updated_at();


--
-- Name: commerce_store_settings trg_touch_commerce_store_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_commerce_store_settings BEFORE UPDATE ON public.commerce_store_settings FOR EACH ROW EXECUTE FUNCTION public.touch_commerce_updated_at();


--
-- Name: hubly_app_connections trg_touch_hubly_app_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_hubly_app_connections_updated_at BEFORE UPDATE ON public.hubly_app_connections FOR EACH ROW EXECUTE FUNCTION public.touch_hubly_app_connections_updated_at();


--
-- Name: hubly_conversation_memories trg_touch_hubly_conversation_memories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_hubly_conversation_memories_updated_at BEFORE UPDATE ON public.hubly_conversation_memories FOR EACH ROW EXECUTE FUNCTION public.touch_hubly_conversation_memories_updated_at();


--
-- Name: photography_project_workspaces trg_touch_photography_project_workspaces_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_photography_project_workspaces_updated_at BEFORE UPDATE ON public.photography_project_workspaces FOR EACH ROW EXECUTE FUNCTION public.touch_photography_project_workspaces_updated_at();


--
-- Name: photography_projects trg_touch_photography_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_photography_projects_updated_at BEFORE UPDATE ON public.photography_projects FOR EACH ROW EXECUTE FUNCTION public.touch_photography_projects_updated_at();


--
-- Name: user_table_preferences trg_touch_user_table_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_user_table_preferences_updated_at BEFORE UPDATE ON public.user_table_preferences FOR EACH ROW EXECUTE FUNCTION public.touch_user_table_preferences_updated_at();


--
-- Name: workspace_memories trg_touch_workspace_memories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_workspace_memories_updated_at BEFORE UPDATE ON public.workspace_memories FOR EACH ROW EXECUTE FUNCTION public.touch_workspace_memories_updated_at();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: addons addons_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addons
    ADD CONSTRAINT addons_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: adobe_lightroom_connections adobe_lightroom_connections_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adobe_lightroom_connections
    ADD CONSTRAINT adobe_lightroom_connections_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: adobe_lightroom_connections adobe_lightroom_connections_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adobe_lightroom_connections
    ADD CONSTRAINT adobe_lightroom_connections_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: adobe_oauth_states adobe_oauth_states_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adobe_oauth_states
    ADD CONSTRAINT adobe_oauth_states_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: adobe_oauth_states adobe_oauth_states_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adobe_oauth_states
    ADD CONSTRAINT adobe_oauth_states_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ask_hubly_activity_feed ask_hubly_activity_feed_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_activity_feed
    ADD CONSTRAINT ask_hubly_activity_feed_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: ask_hubly_ai_actions ask_hubly_ai_actions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_ai_actions
    ADD CONSTRAINT ask_hubly_ai_actions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: ask_hubly_ai_actions ask_hubly_ai_actions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_ai_actions
    ADD CONSTRAINT ask_hubly_ai_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ask_hubly_conversations ask_hubly_conversations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_conversations
    ADD CONSTRAINT ask_hubly_conversations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: ask_hubly_conversations ask_hubly_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_conversations
    ADD CONSTRAINT ask_hubly_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ask_hubly_insights ask_hubly_insights_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_insights
    ADD CONSTRAINT ask_hubly_insights_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: ask_hubly_messages ask_hubly_messages_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_messages
    ADD CONSTRAINT ask_hubly_messages_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: ask_hubly_messages ask_hubly_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ask_hubly_messages
    ADD CONSTRAINT ask_hubly_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ask_hubly_conversations(id) ON DELETE CASCADE;


--
-- Name: booking_requests booking_requests_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: booking_requests booking_requests_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.booking_requests(id);


--
-- Name: business_dna business_dna_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_dna
    ADD CONSTRAINT business_dna_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_documents business_documents_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_documents
    ADD CONSTRAINT business_documents_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_memories business_memories_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_memories
    ADD CONSTRAINT business_memories_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_memory_changes business_memory_changes_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_memory_changes
    ADD CONSTRAINT business_memory_changes_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_table_config business_table_config_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_table_config
    ADD CONSTRAINT business_table_config_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_timeline_events business_timeline_events_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_timeline_events
    ADD CONSTRAINT business_timeline_events_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: businesses businesses_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: campaign_plans campaign_plans_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_plans
    ADD CONSTRAINT campaign_plans_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: campaign_plans campaign_plans_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_plans
    ADD CONSTRAINT campaign_plans_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.campaign_goals(id) ON DELETE SET NULL;


--
-- Name: campaign_plans campaign_plans_industry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_plans
    ADD CONSTRAINT campaign_plans_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES public.campaign_industries(id) ON DELETE SET NULL;


--
-- Name: campaign_plans campaign_plans_playbook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_plans
    ADD CONSTRAINT campaign_plans_playbook_id_fkey FOREIGN KEY (playbook_id) REFERENCES public.campaign_playbooks(id) ON DELETE SET NULL;


--
-- Name: campaign_plans campaign_plans_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_plans
    ADD CONSTRAINT campaign_plans_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_projects(id) ON DELETE SET NULL;


--
-- Name: campaign_playbook_assets campaign_playbook_assets_playbook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_playbook_assets
    ADD CONSTRAINT campaign_playbook_assets_playbook_id_fkey FOREIGN KEY (playbook_id) REFERENCES public.campaign_playbooks(id) ON DELETE CASCADE;


--
-- Name: campaign_playbooks campaign_playbooks_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_playbooks
    ADD CONSTRAINT campaign_playbooks_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.campaign_goals(id) ON DELETE RESTRICT;


--
-- Name: campaign_playbooks campaign_playbooks_industry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_playbooks
    ADD CONSTRAINT campaign_playbooks_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES public.campaign_industries(id) ON DELETE CASCADE;


--
-- Name: campaign_seasonal_calendar campaign_seasonal_calendar_industry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_seasonal_calendar
    ADD CONSTRAINT campaign_seasonal_calendar_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES public.campaign_industries(id) ON DELETE CASCADE;


--
-- Name: campaign_seasonal_calendar campaign_seasonal_calendar_playbook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_seasonal_calendar
    ADD CONSTRAINT campaign_seasonal_calendar_playbook_id_fkey FOREIGN KEY (playbook_id) REFERENCES public.campaign_playbooks(id) ON DELETE CASCADE;


--
-- Name: campaign_triggers campaign_triggers_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_triggers
    ADD CONSTRAINT campaign_triggers_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.campaign_goals(id) ON DELETE SET NULL;


--
-- Name: campaign_triggers campaign_triggers_industry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_triggers
    ADD CONSTRAINT campaign_triggers_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES public.campaign_industries(id) ON DELETE CASCADE;


--
-- Name: campaign_triggers campaign_triggers_playbook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_triggers
    ADD CONSTRAINT campaign_triggers_playbook_id_fkey FOREIGN KEY (playbook_id) REFERENCES public.campaign_playbooks(id) ON DELETE SET NULL;


--
-- Name: chatbot_conversations chatbot_conversations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_conversations
    ADD CONSTRAINT chatbot_conversations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: chatbot_messages chatbot_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_messages
    ADD CONSTRAINT chatbot_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE;


--
-- Name: commerce_bundle_products commerce_bundle_products_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_bundle_products
    ADD CONSTRAINT commerce_bundle_products_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.commerce_bundles(id) ON DELETE CASCADE;


--
-- Name: commerce_bundle_products commerce_bundle_products_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_bundle_products
    ADD CONSTRAINT commerce_bundle_products_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_bundle_products commerce_bundle_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_bundle_products
    ADD CONSTRAINT commerce_bundle_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.commerce_products(id) ON DELETE CASCADE;


--
-- Name: commerce_bundles commerce_bundles_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_bundles
    ADD CONSTRAINT commerce_bundles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_cart_items commerce_cart_items_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_cart_items
    ADD CONSTRAINT commerce_cart_items_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.commerce_bundles(id) ON DELETE SET NULL;


--
-- Name: commerce_cart_items commerce_cart_items_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_cart_items
    ADD CONSTRAINT commerce_cart_items_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_cart_items commerce_cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_cart_items
    ADD CONSTRAINT commerce_cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.commerce_carts(id) ON DELETE CASCADE;


--
-- Name: commerce_cart_items commerce_cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_cart_items
    ADD CONSTRAINT commerce_cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.commerce_products(id) ON DELETE SET NULL;


--
-- Name: commerce_cart_items commerce_cart_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_cart_items
    ADD CONSTRAINT commerce_cart_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.commerce_product_variants(id) ON DELETE SET NULL;


--
-- Name: commerce_carts commerce_carts_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_carts
    ADD CONSTRAINT commerce_carts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_collection_products commerce_collection_products_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_collection_products
    ADD CONSTRAINT commerce_collection_products_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_collection_products commerce_collection_products_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_collection_products
    ADD CONSTRAINT commerce_collection_products_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.commerce_collections(id) ON DELETE CASCADE;


--
-- Name: commerce_collection_products commerce_collection_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_collection_products
    ADD CONSTRAINT commerce_collection_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.commerce_products(id) ON DELETE CASCADE;


--
-- Name: commerce_collections commerce_collections_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_collections
    ADD CONSTRAINT commerce_collections_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_discounts commerce_discounts_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_discounts
    ADD CONSTRAINT commerce_discounts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_documents commerce_documents_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_documents
    ADD CONSTRAINT commerce_documents_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_documents commerce_documents_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_documents
    ADD CONSTRAINT commerce_documents_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.commerce_products(id) ON DELETE SET NULL;


--
-- Name: commerce_gift_cards commerce_gift_cards_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_gift_cards
    ADD CONSTRAINT commerce_gift_cards_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_inventory_logs commerce_inventory_logs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_inventory_logs
    ADD CONSTRAINT commerce_inventory_logs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_inventory_logs commerce_inventory_logs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_inventory_logs
    ADD CONSTRAINT commerce_inventory_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.commerce_orders(id) ON DELETE SET NULL;


--
-- Name: commerce_inventory_logs commerce_inventory_logs_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_inventory_logs
    ADD CONSTRAINT commerce_inventory_logs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.commerce_products(id) ON DELETE CASCADE;


--
-- Name: commerce_inventory_logs commerce_inventory_logs_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_inventory_logs
    ADD CONSTRAINT commerce_inventory_logs_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.commerce_product_variants(id) ON DELETE SET NULL;


--
-- Name: commerce_merchandising_recs commerce_merchandising_recs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_merchandising_recs
    ADD CONSTRAINT commerce_merchandising_recs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_merchandising_recs commerce_merchandising_recs_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_merchandising_recs
    ADD CONSTRAINT commerce_merchandising_recs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.commerce_products(id) ON DELETE CASCADE;


--
-- Name: commerce_order_items commerce_order_items_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_items
    ADD CONSTRAINT commerce_order_items_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_order_items commerce_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_items
    ADD CONSTRAINT commerce_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.commerce_orders(id) ON DELETE CASCADE;


--
-- Name: commerce_orders commerce_orders_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_orders
    ADD CONSTRAINT commerce_orders_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_product_images commerce_product_images_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_product_images
    ADD CONSTRAINT commerce_product_images_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_product_images commerce_product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_product_images
    ADD CONSTRAINT commerce_product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.commerce_products(id) ON DELETE CASCADE;


--
-- Name: commerce_product_variants commerce_product_variants_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_product_variants
    ADD CONSTRAINT commerce_product_variants_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_product_variants commerce_product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_product_variants
    ADD CONSTRAINT commerce_product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.commerce_products(id) ON DELETE CASCADE;


--
-- Name: commerce_products commerce_products_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_products
    ADD CONSTRAINT commerce_products_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_shipping_profiles commerce_shipping_profiles_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_shipping_profiles
    ADD CONSTRAINT commerce_shipping_profiles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commerce_store_settings commerce_store_settings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_store_settings
    ADD CONSTRAINT commerce_store_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: customer_memories customer_memories_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_memories
    ADD CONSTRAINT customer_memories_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: customer_profiles customer_profiles_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: customers customers_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: document_build_jobs document_build_jobs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_build_jobs
    ADD CONSTRAINT document_build_jobs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: draft_claims draft_claims_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_claims
    ADD CONSTRAINT draft_claims_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: gallery_items gallery_items_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_items
    ADD CONSTRAINT gallery_items_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: gallery_items gallery_items_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_items
    ADD CONSTRAINT gallery_items_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;


--
-- Name: google_calendar_connections google_calendar_connections_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: google_calendar_connections google_calendar_connections_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: google_calendar_events google_calendar_events_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_events
    ADD CONSTRAINT google_calendar_events_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: google_calendar_oauth_states google_calendar_oauth_states_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_oauth_states
    ADD CONSTRAINT google_calendar_oauth_states_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: google_calendar_oauth_states google_calendar_oauth_states_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_oauth_states
    ADD CONSTRAINT google_calendar_oauth_states_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: hubly_app_connections hubly_app_connections_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubly_app_connections
    ADD CONSTRAINT hubly_app_connections_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: hubly_brain_executions hubly_brain_executions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubly_brain_executions
    ADD CONSTRAINT hubly_brain_executions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: hubly_conversation_memories hubly_conversation_memories_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubly_conversation_memories
    ADD CONSTRAINT hubly_conversation_memories_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: hubly_execution_runs hubly_execution_runs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubly_execution_runs
    ADD CONSTRAINT hubly_execution_runs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: hubly_reasoning_events hubly_reasoning_events_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubly_reasoning_events
    ADD CONSTRAINT hubly_reasoning_events_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_booking_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_booking_request_id_fkey FOREIGN KEY (booking_request_id) REFERENCES public.booking_requests(id) ON DELETE SET NULL;


--
-- Name: jobs jobs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: jobs jobs_recurring_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_recurring_schedule_id_fkey FOREIGN KEY (recurring_schedule_id) REFERENCES public.recurring_schedules(id) ON DELETE SET NULL;


--
-- Name: marketplace_bookings marketplace_bookings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_bookings
    ADD CONSTRAINT marketplace_bookings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: marketplace_bookings marketplace_bookings_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_bookings
    ADD CONSTRAINT marketplace_bookings_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.marketplace_conversations(id) ON DELETE SET NULL;


--
-- Name: marketplace_bookings marketplace_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_bookings
    ADD CONSTRAINT marketplace_bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.marketplace_customers(id) ON DELETE SET NULL;


--
-- Name: marketplace_bookings marketplace_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_bookings
    ADD CONSTRAINT marketplace_bookings_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.marketplace_providers(id) ON DELETE CASCADE;


--
-- Name: marketplace_conversations marketplace_conversations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_conversations
    ADD CONSTRAINT marketplace_conversations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: marketplace_conversations marketplace_conversations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_conversations
    ADD CONSTRAINT marketplace_conversations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.marketplace_customers(id) ON DELETE SET NULL;


--
-- Name: marketplace_conversations marketplace_conversations_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_conversations
    ADD CONSTRAINT marketplace_conversations_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.marketplace_providers(id) ON DELETE SET NULL;


--
-- Name: marketplace_customers marketplace_customers_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_customers
    ADD CONSTRAINT marketplace_customers_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: marketplace_customers marketplace_customers_crm_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_customers
    ADD CONSTRAINT marketplace_customers_crm_customer_id_fkey FOREIGN KEY (crm_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: marketplace_messages marketplace_messages_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_messages
    ADD CONSTRAINT marketplace_messages_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.marketplace_bookings(id) ON DELETE SET NULL;


--
-- Name: marketplace_messages marketplace_messages_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_messages
    ADD CONSTRAINT marketplace_messages_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: marketplace_messages marketplace_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_messages
    ADD CONSTRAINT marketplace_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.marketplace_conversations(id) ON DELETE CASCADE;


--
-- Name: marketplace_ops_flags marketplace_ops_flags_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_ops_flags
    ADD CONSTRAINT marketplace_ops_flags_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.marketplace_bookings(id) ON DELETE SET NULL;


--
-- Name: marketplace_ops_flags marketplace_ops_flags_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_ops_flags
    ADD CONSTRAINT marketplace_ops_flags_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: marketplace_ops_flags marketplace_ops_flags_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_ops_flags
    ADD CONSTRAINT marketplace_ops_flags_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.marketplace_providers(id) ON DELETE CASCADE;


--
-- Name: marketplace_ops_notes marketplace_ops_notes_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_ops_notes
    ADD CONSTRAINT marketplace_ops_notes_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: marketplace_ops_notes marketplace_ops_notes_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_ops_notes
    ADD CONSTRAINT marketplace_ops_notes_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.marketplace_providers(id) ON DELETE CASCADE;


--
-- Name: marketplace_providers marketplace_providers_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_providers
    ADD CONSTRAINT marketplace_providers_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: marketplace_providers marketplace_providers_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_providers
    ADD CONSTRAINT marketplace_providers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: marketplace_requests marketplace_requests_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_requests
    ADD CONSTRAINT marketplace_requests_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: marketplace_requests marketplace_requests_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_requests
    ADD CONSTRAINT marketplace_requests_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.marketplace_providers(id) ON DELETE CASCADE;


--
-- Name: photography_project_activity photography_project_activity_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_activity
    ADD CONSTRAINT photography_project_activity_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: photography_project_activity photography_project_activity_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_activity
    ADD CONSTRAINT photography_project_activity_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.photography_projects(id) ON DELETE CASCADE;


--
-- Name: photography_project_contracts photography_project_contracts_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_contracts
    ADD CONSTRAINT photography_project_contracts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: photography_project_contracts photography_project_contracts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_contracts
    ADD CONSTRAINT photography_project_contracts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.photography_projects(id) ON DELETE CASCADE;


--
-- Name: photography_project_deliverables photography_project_deliverables_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_deliverables
    ADD CONSTRAINT photography_project_deliverables_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: photography_project_deliverables photography_project_deliverables_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_deliverables
    ADD CONSTRAINT photography_project_deliverables_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.photography_projects(id) ON DELETE CASCADE;


--
-- Name: photography_project_galleries photography_project_galleries_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_galleries
    ADD CONSTRAINT photography_project_galleries_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: photography_project_galleries photography_project_galleries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_galleries
    ADD CONSTRAINT photography_project_galleries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.photography_projects(id) ON DELETE CASCADE;


--
-- Name: photography_project_invoices photography_project_invoices_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_invoices
    ADD CONSTRAINT photography_project_invoices_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: photography_project_invoices photography_project_invoices_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_invoices
    ADD CONSTRAINT photography_project_invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.photography_projects(id) ON DELETE CASCADE;


--
-- Name: photography_project_lightroom photography_project_lightroom_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_lightroom
    ADD CONSTRAINT photography_project_lightroom_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: photography_project_lightroom photography_project_lightroom_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_lightroom
    ADD CONSTRAINT photography_project_lightroom_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.photography_projects(id) ON DELETE CASCADE;


--
-- Name: photography_project_marketing photography_project_marketing_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_marketing
    ADD CONSTRAINT photography_project_marketing_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: photography_project_marketing photography_project_marketing_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_marketing
    ADD CONSTRAINT photography_project_marketing_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.photography_projects(id) ON DELETE CASCADE;


--
-- Name: photography_project_questionnaires photography_project_questionnaires_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_questionnaires
    ADD CONSTRAINT photography_project_questionnaires_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: photography_project_questionnaires photography_project_questionnaires_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_questionnaires
    ADD CONSTRAINT photography_project_questionnaires_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.photography_projects(id) ON DELETE CASCADE;


--
-- Name: photography_project_team photography_project_team_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_team
    ADD CONSTRAINT photography_project_team_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: photography_project_team photography_project_team_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_team
    ADD CONSTRAINT photography_project_team_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.photography_projects(id) ON DELETE CASCADE;


--
-- Name: photography_project_timeline photography_project_timeline_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_timeline
    ADD CONSTRAINT photography_project_timeline_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: photography_project_timeline photography_project_timeline_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_timeline
    ADD CONSTRAINT photography_project_timeline_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.photography_projects(id) ON DELETE CASCADE;


--
-- Name: photography_project_workspaces photography_project_workspaces_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_workspaces
    ADD CONSTRAINT photography_project_workspaces_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: photography_project_workspaces photography_project_workspaces_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_project_workspaces
    ADD CONSTRAINT photography_project_workspaces_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.photography_projects(id) ON DELETE CASCADE;


--
-- Name: photography_projects photography_projects_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photography_projects
    ADD CONSTRAINT photography_projects_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: portfolio_photos portfolio_photos_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_photos
    ADD CONSTRAINT portfolio_photos_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: recurring_schedules recurring_schedules_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_schedules
    ADD CONSTRAINT recurring_schedules_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: review_submissions review_submissions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_submissions
    ADD CONSTRAINT review_submissions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: review_submissions review_submissions_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_submissions
    ADD CONSTRAINT review_submissions_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: service_photos service_photos_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_photos
    ADD CONSTRAINT service_photos_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: services services_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_ai settings_ai_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_ai
    ADD CONSTRAINT settings_ai_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_api_keys settings_api_keys_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_api_keys
    ADD CONSTRAINT settings_api_keys_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_audit_logs settings_audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_audit_logs
    ADD CONSTRAINT settings_audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: settings_audit_logs settings_audit_logs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_audit_logs
    ADD CONSTRAINT settings_audit_logs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_billing settings_billing_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_billing
    ADD CONSTRAINT settings_billing_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_branding settings_branding_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_branding
    ADD CONSTRAINT settings_branding_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_business settings_business_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_business
    ADD CONSTRAINT settings_business_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_business_hours settings_business_hours_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_business_hours
    ADD CONSTRAINT settings_business_hours_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_integrations settings_integrations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_integrations
    ADD CONSTRAINT settings_integrations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_notifications settings_notifications_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_notifications
    ADD CONSTRAINT settings_notifications_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_oauth_tokens settings_oauth_tokens_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_oauth_tokens
    ADD CONSTRAINT settings_oauth_tokens_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_organization settings_organization_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_organization
    ADD CONSTRAINT settings_organization_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_permissions settings_permissions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_permissions
    ADD CONSTRAINT settings_permissions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_permissions settings_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_permissions
    ADD CONSTRAINT settings_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.settings_roles(id) ON DELETE CASCADE;


--
-- Name: settings_roles settings_roles_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_roles
    ADD CONSTRAINT settings_roles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_security settings_security_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_security
    ADD CONSTRAINT settings_security_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_subscriptions settings_subscriptions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_subscriptions
    ADD CONSTRAINT settings_subscriptions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_team_members settings_team_members_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_team_members
    ADD CONSTRAINT settings_team_members_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: settings_team_members settings_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_team_members
    ADD CONSTRAINT settings_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: stripe_connect_accounts stripe_connect_accounts_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_connect_accounts
    ADD CONSTRAINT stripe_connect_accounts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: stripe_connect_accounts stripe_connect_accounts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_connect_accounts
    ADD CONSTRAINT stripe_connect_accounts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: studio_analytics_snapshots studio_analytics_snapshots_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_analytics_snapshots
    ADD CONSTRAINT studio_analytics_snapshots_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: studio_assets studio_assets_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_assets
    ADD CONSTRAINT studio_assets_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: studio_brand_kit studio_brand_kit_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_brand_kit
    ADD CONSTRAINT studio_brand_kit_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: studio_project_exports studio_project_exports_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_exports
    ADD CONSTRAINT studio_project_exports_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: studio_project_exports studio_project_exports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_exports
    ADD CONSTRAINT studio_project_exports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_projects(id) ON DELETE CASCADE;


--
-- Name: studio_project_pages studio_project_pages_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_pages
    ADD CONSTRAINT studio_project_pages_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: studio_project_pages studio_project_pages_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_pages
    ADD CONSTRAINT studio_project_pages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_projects(id) ON DELETE CASCADE;


--
-- Name: studio_project_versions studio_project_versions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_versions
    ADD CONSTRAINT studio_project_versions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: studio_project_versions studio_project_versions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_versions
    ADD CONSTRAINT studio_project_versions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_projects(id) ON DELETE CASCADE;


--
-- Name: studio_projects studio_projects_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_projects
    ADD CONSTRAINT studio_projects_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: studio_projects studio_projects_campaign_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_projects
    ADD CONSTRAINT studio_projects_campaign_plan_id_fkey FOREIGN KEY (campaign_plan_id) REFERENCES public.campaign_plans(id) ON DELETE SET NULL;


--
-- Name: studio_publish_queue studio_publish_queue_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_publish_queue
    ADD CONSTRAINT studio_publish_queue_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: studio_publish_queue studio_publish_queue_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_publish_queue
    ADD CONSTRAINT studio_publish_queue_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.studio_projects(id) ON DELETE SET NULL;


--
-- Name: studio_settings studio_settings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_settings
    ADD CONSTRAINT studio_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: studio_social_accounts studio_social_accounts_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_social_accounts
    ADD CONSTRAINT studio_social_accounts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: studio_templates studio_templates_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_templates
    ADD CONSTRAINT studio_templates_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: user_table_preferences user_table_preferences_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_table_preferences
    ADD CONSTRAINT user_table_preferences_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: user_table_preferences user_table_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_table_preferences
    ADD CONSTRAINT user_table_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: website_pages website_pages_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_pages
    ADD CONSTRAINT website_pages_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: workspace_memories workspace_memories_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memories
    ADD CONSTRAINT workspace_memories_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: workspace_memory_changes workspace_memory_changes_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memory_changes
    ADD CONSTRAINT workspace_memory_changes_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: review_submissions Owners can approve or reject their own review submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can approve or reject their own review submissions" ON public.review_submissions FOR UPDATE TO authenticated USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: businesses Owners can insert their own business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can insert their own business" ON public.businesses FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: google_calendar_events Owners can read their google calendar events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can read their google calendar events" ON public.google_calendar_events FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = google_calendar_events.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: business_documents Owners can read their own business documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can read their own business documents" ON public.business_documents FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = business_documents.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: businesses Owners can select their own business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can select their own business" ON public.businesses FOR SELECT TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: businesses Owners can update their own business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update their own business" ON public.businesses FOR UPDATE TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: review_submissions Owners can view their own review submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view their own review submissions" ON public.review_submissions FOR SELECT TO authenticated USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: addons Public can read addons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read addons" ON public.addons FOR SELECT TO anon USING (true);


--
-- Name: businesses Public can read business slugs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read business slugs" ON public.businesses FOR SELECT TO anon USING (true);


--
-- Name: portfolio_photos Public can read portfolio_photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read portfolio_photos" ON public.portfolio_photos FOR SELECT TO anon USING (true);


--
-- Name: services Public can read services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read services" ON public.services FOR SELECT TO anon USING (true);


--
-- Name: review_submissions Public can submit reviews for a real requested job; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can submit reviews for a real requested job" ON public.review_submissions FOR INSERT WITH CHECK (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM public.jobs
  WHERE ((jobs.id = review_submissions.job_id) AND (jobs.business_id = review_submissions.business_id) AND (jobs.review_requested_at IS NOT NULL))))));


--
-- Name: addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

--
-- Name: adobe_lightroom_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adobe_lightroom_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: adobe_oauth_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adobe_oauth_states ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_requests anyone can submit booking request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anyone can submit booking request" ON public.booking_requests FOR INSERT WITH CHECK (true);


--
-- Name: ask_hubly_activity_feed; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ask_hubly_activity_feed ENABLE ROW LEVEL SECURITY;

--
-- Name: ask_hubly_activity_feed ask_hubly_activity_feed_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ask_hubly_activity_feed_insert_owner ON public.ask_hubly_activity_feed FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: ask_hubly_activity_feed ask_hubly_activity_feed_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ask_hubly_activity_feed_select_owner ON public.ask_hubly_activity_feed FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: ask_hubly_ai_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ask_hubly_ai_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: ask_hubly_ai_actions ask_hubly_ai_actions_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ask_hubly_ai_actions_insert_owner ON public.ask_hubly_ai_actions FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: ask_hubly_ai_actions ask_hubly_ai_actions_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ask_hubly_ai_actions_select_owner ON public.ask_hubly_ai_actions FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: ask_hubly_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ask_hubly_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: ask_hubly_conversations ask_hubly_conversations_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ask_hubly_conversations_insert_owner ON public.ask_hubly_conversations FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: ask_hubly_conversations ask_hubly_conversations_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ask_hubly_conversations_select_owner ON public.ask_hubly_conversations FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: ask_hubly_conversations ask_hubly_conversations_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ask_hubly_conversations_update_owner ON public.ask_hubly_conversations FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: ask_hubly_insights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ask_hubly_insights ENABLE ROW LEVEL SECURITY;

--
-- Name: ask_hubly_insights ask_hubly_insights_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ask_hubly_insights_insert_owner ON public.ask_hubly_insights FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: ask_hubly_insights ask_hubly_insights_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ask_hubly_insights_select_owner ON public.ask_hubly_insights FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: ask_hubly_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ask_hubly_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: ask_hubly_messages ask_hubly_messages_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ask_hubly_messages_insert_owner ON public.ask_hubly_messages FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: ask_hubly_messages ask_hubly_messages_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ask_hubly_messages_select_owner ON public.ask_hubly_messages FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: booking_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: business_dna; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_dna ENABLE ROW LEVEL SECURITY;

--
-- Name: business_dna business_dna_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_dna_delete_owner ON public.business_dna FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: business_dna business_dna_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_dna_insert_owner ON public.business_dna FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: business_dna business_dna_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_dna_select_owner ON public.business_dna FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: business_dna business_dna_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_dna_update_owner ON public.business_dna FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: business_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: business_memories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_memories ENABLE ROW LEVEL SECURITY;

--
-- Name: business_memories business_memories_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_memories_delete_owner ON public.business_memories FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: business_memories business_memories_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_memories_insert_owner ON public.business_memories FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: business_memories business_memories_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_memories_select_owner ON public.business_memories FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: business_memories business_memories_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_memories_update_owner ON public.business_memories FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: business_memory_changes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_memory_changes ENABLE ROW LEVEL SECURITY;

--
-- Name: business_memory_changes business_memory_changes_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_memory_changes_insert_owner ON public.business_memory_changes FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: business_memory_changes business_memory_changes_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_memory_changes_select_owner ON public.business_memory_changes FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: business_table_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_table_config ENABLE ROW LEVEL SECURITY;

--
-- Name: business_table_config business_table_config_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_table_config_owner_all ON public.business_table_config USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = business_table_config.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = business_table_config.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: business_timeline_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_timeline_events ENABLE ROW LEVEL SECURITY;

--
-- Name: business_timeline_events business_timeline_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_timeline_owner_all ON public.business_timeline_events USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: businesses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_goals campaign_goals_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_goals_read ON public.campaign_goals FOR SELECT TO authenticated USING ((active = true));


--
-- Name: campaign_industries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_industries ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_industries campaign_industries_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_industries_read ON public.campaign_industries FOR SELECT TO authenticated USING ((active = true));


--
-- Name: campaign_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_plans campaign_plans_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_plans_owner_all ON public.campaign_plans USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: campaign_playbook_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_playbook_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_playbook_assets campaign_playbook_assets_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_playbook_assets_read ON public.campaign_playbook_assets FOR SELECT TO authenticated USING (true);


--
-- Name: campaign_playbooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_playbooks ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_playbooks campaign_playbooks_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_playbooks_read ON public.campaign_playbooks FOR SELECT TO authenticated USING ((active = true));


--
-- Name: campaign_seasonal_calendar; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_seasonal_calendar ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_seasonal_calendar campaign_seasonal_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_seasonal_read ON public.campaign_seasonal_calendar FOR SELECT TO authenticated USING (true);


--
-- Name: campaign_triggers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_triggers ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_triggers campaign_triggers_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campaign_triggers_read ON public.campaign_triggers FOR SELECT TO authenticated USING ((active = true));


--
-- Name: chatbot_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: chatbot_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_bundle_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_bundle_products ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_bundle_products commerce_bundle_products_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_bundle_products_owner_all ON public.commerce_bundle_products USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_bundles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_bundles ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_bundles commerce_bundles_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_bundles_owner_all ON public.commerce_bundles USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_bundles commerce_bundles_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_bundles_public_read ON public.commerce_bundles FOR SELECT USING ((status = 'active'::text));


--
-- Name: commerce_cart_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_cart_items ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_cart_items commerce_cart_items_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_cart_items_owner_all ON public.commerce_cart_items USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_carts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_carts ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_carts commerce_carts_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_carts_owner_all ON public.commerce_carts USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_collection_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_collection_products ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_collection_products commerce_collection_products_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_collection_products_owner_all ON public.commerce_collection_products USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_collections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_collections ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_collections commerce_collections_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_collections_owner_all ON public.commerce_collections USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_collections commerce_collections_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_collections_public_read ON public.commerce_collections FOR SELECT USING ((published = true));


--
-- Name: commerce_discounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_discounts ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_discounts commerce_discounts_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_discounts_owner_all ON public.commerce_discounts USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_documents commerce_documents_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_documents_owner_all ON public.commerce_documents USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_gift_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_gift_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_gift_cards commerce_gift_cards_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_gift_cards_owner_all ON public.commerce_gift_cards USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_inventory_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_inventory_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_inventory_logs commerce_inventory_logs_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_inventory_logs_owner_all ON public.commerce_inventory_logs USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_merchandising_recs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_merchandising_recs ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_merchandising_recs commerce_merchandising_recs_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_merchandising_recs_owner_all ON public.commerce_merchandising_recs USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_order_items commerce_order_items_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_order_items_owner_all ON public.commerce_order_items USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_orders commerce_orders_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_orders_owner_all ON public.commerce_orders USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_product_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_product_images ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_product_images commerce_product_images_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_product_images_owner_all ON public.commerce_product_images USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_product_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_product_variants commerce_product_variants_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_product_variants_owner_all ON public.commerce_product_variants USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_products ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_products commerce_products_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_products_owner_all ON public.commerce_products USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_products commerce_products_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_products_public_read ON public.commerce_products FOR SELECT USING (((status = 'active'::text) AND (COALESCE(((visibility ->> 'website'::text))::boolean, true) = true)));


--
-- Name: commerce_shipping_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_shipping_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_shipping_profiles commerce_shipping_profiles_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_shipping_profiles_owner_all ON public.commerce_shipping_profiles USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: commerce_store_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_store_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_store_settings commerce_store_settings_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commerce_store_settings_owner_all ON public.commerce_store_settings USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: customer_memories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_memories ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_memories customer_memories_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_memories_owner_all ON public.customer_memories USING ((owner_user_id = auth.uid())) WITH CHECK ((owner_user_id = auth.uid()));


--
-- Name: customer_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_profiles customer_profiles_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_profiles_owner_all ON public.customer_profiles USING ((owner_user_id = auth.uid())) WITH CHECK ((owner_user_id = auth.uid()));


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: document_build_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_build_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: document_vocabulary_rejections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_vocabulary_rejections ENABLE ROW LEVEL SECURITY;

--
-- Name: document_vocabulary_rejections document_vocabulary_rejections_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_vocabulary_rejections_read ON public.document_vocabulary_rejections FOR SELECT TO authenticated, anon USING (true);


--
-- Name: draft_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.draft_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: gallery_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

--
-- Name: google_calendar_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: google_calendar_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_calendar_events ENABLE ROW LEVEL SECURITY;

--
-- Name: google_calendar_oauth_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_calendar_oauth_states ENABLE ROW LEVEL SECURITY;

--
-- Name: hubly_app_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hubly_app_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: hubly_app_connections hubly_app_connections_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_app_connections_delete_owner ON public.hubly_app_connections FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: hubly_app_connections hubly_app_connections_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_app_connections_insert_owner ON public.hubly_app_connections FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: hubly_app_connections hubly_app_connections_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_app_connections_select_owner ON public.hubly_app_connections FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: hubly_app_connections hubly_app_connections_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_app_connections_update_owner ON public.hubly_app_connections FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: hubly_brain_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hubly_brain_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: hubly_brain_executions hubly_brain_executions_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_brain_executions_insert_owner ON public.hubly_brain_executions FOR INSERT WITH CHECK (((business_id IS NULL) OR (business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))));


--
-- Name: hubly_brain_executions hubly_brain_executions_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_brain_executions_select_owner ON public.hubly_brain_executions FOR SELECT USING (((business_id IS NULL) OR (business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))));


--
-- Name: hubly_conversation_memories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hubly_conversation_memories ENABLE ROW LEVEL SECURITY;

--
-- Name: hubly_conversation_memories hubly_conversation_memories_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_conversation_memories_delete_owner ON public.hubly_conversation_memories FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: hubly_conversation_memories hubly_conversation_memories_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_conversation_memories_insert_owner ON public.hubly_conversation_memories FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: hubly_conversation_memories hubly_conversation_memories_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_conversation_memories_select_owner ON public.hubly_conversation_memories FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: hubly_conversation_memories hubly_conversation_memories_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_conversation_memories_update_owner ON public.hubly_conversation_memories FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: hubly_execution_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hubly_execution_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: hubly_execution_runs hubly_execution_runs_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_execution_runs_insert_owner ON public.hubly_execution_runs FOR INSERT WITH CHECK (((business_id IS NULL) OR (business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))));


--
-- Name: hubly_execution_runs hubly_execution_runs_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_execution_runs_select_owner ON public.hubly_execution_runs FOR SELECT USING (((business_id IS NULL) OR (business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))));


--
-- Name: hubly_execution_runs hubly_execution_runs_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_execution_runs_update_owner ON public.hubly_execution_runs FOR UPDATE USING (((business_id IS NULL) OR (business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))))) WITH CHECK (((business_id IS NULL) OR (business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))));


--
-- Name: hubly_reasoning_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hubly_reasoning_events ENABLE ROW LEVEL SECURITY;

--
-- Name: hubly_reasoning_events hubly_reasoning_events_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_reasoning_events_insert_owner ON public.hubly_reasoning_events FOR INSERT WITH CHECK (((business_id IS NULL) OR (business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))));


--
-- Name: hubly_reasoning_events hubly_reasoning_events_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hubly_reasoning_events_select_owner ON public.hubly_reasoning_events FOR SELECT USING (((business_id IS NULL) OR (business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))));


--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_bookings marketplace_bookings_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketplace_bookings_owner_select ON public.marketplace_bookings FOR SELECT TO authenticated USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: marketplace_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_conversations marketplace_conversations_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketplace_conversations_owner_select ON public.marketplace_conversations FOR SELECT TO authenticated USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: marketplace_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_customers marketplace_customers_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketplace_customers_owner_select ON public.marketplace_customers FOR SELECT TO authenticated USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: marketplace_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_messages marketplace_messages_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketplace_messages_owner_select ON public.marketplace_messages FOR SELECT TO authenticated USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: marketplace_ops_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_ops_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_ops_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_ops_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_providers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_providers marketplace_providers_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketplace_providers_owner_insert ON public.marketplace_providers FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: marketplace_providers marketplace_providers_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketplace_providers_owner_select ON public.marketplace_providers FOR SELECT TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: marketplace_providers marketplace_providers_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketplace_providers_owner_update ON public.marketplace_providers FOR UPDATE TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: marketplace_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_requests marketplace_requests_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketplace_requests_owner_select ON public.marketplace_requests FOR SELECT TO authenticated USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_requests owner can delete booking requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can delete booking requests" ON public.booking_requests FOR DELETE USING (public.owns_business(business_id));


--
-- Name: addons owner can manage addons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can manage addons" ON public.addons USING (public.owns_business(business_id));


--
-- Name: customers owner can manage customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can manage customers" ON public.customers USING (public.owns_business(business_id));


--
-- Name: gallery_items owner can manage gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can manage gallery" ON public.gallery_items USING (public.owns_business(business_id));


--
-- Name: jobs owner can manage jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can manage jobs" ON public.jobs USING (public.owns_business(business_id));


--
-- Name: memberships owner can manage memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can manage memberships" ON public.memberships TO authenticated USING (public.owns_business(business_id)) WITH CHECK (public.owns_business(business_id));


--
-- Name: portfolio_photos owner can manage portfolio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can manage portfolio" ON public.portfolio_photos USING (public.owns_business(business_id));


--
-- Name: recurring_schedules owner can manage recurring schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can manage recurring schedules" ON public.recurring_schedules TO authenticated USING (public.owns_business(business_id)) WITH CHECK (public.owns_business(business_id));


--
-- Name: service_photos owner can manage service photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can manage service photos" ON public.service_photos USING ((service_id IN ( SELECT services.id
   FROM public.services
  WHERE public.owns_business(services.business_id))));


--
-- Name: services owner can manage services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can manage services" ON public.services USING (public.owns_business(business_id));


--
-- Name: businesses owner can manage their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can manage their business" ON public.businesses USING ((owner_id = auth.uid()));


--
-- Name: booking_requests owner can read booking requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can read booking requests" ON public.booking_requests FOR SELECT USING (public.owns_business(business_id));


--
-- Name: booking_requests owner can update booking requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner can update booking requests" ON public.booking_requests FOR UPDATE USING (public.owns_business(business_id));


--
-- Name: photography_project_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photography_project_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_project_activity photography_project_activity_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_activity_delete_owner ON public.photography_project_activity FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_activity photography_project_activity_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_activity_insert_owner ON public.photography_project_activity FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_activity photography_project_activity_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_activity_select_owner ON public.photography_project_activity FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_activity photography_project_activity_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_activity_update_owner ON public.photography_project_activity FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photography_project_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_project_contracts photography_project_contracts_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_contracts_delete_owner ON public.photography_project_contracts FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_contracts photography_project_contracts_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_contracts_insert_owner ON public.photography_project_contracts FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_contracts photography_project_contracts_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_contracts_select_owner ON public.photography_project_contracts FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_contracts photography_project_contracts_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_contracts_update_owner ON public.photography_project_contracts FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_deliverables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photography_project_deliverables ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_project_deliverables photography_project_deliverables_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_deliverables_delete_owner ON public.photography_project_deliverables FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_deliverables photography_project_deliverables_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_deliverables_insert_owner ON public.photography_project_deliverables FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_deliverables photography_project_deliverables_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_deliverables_select_owner ON public.photography_project_deliverables FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_deliverables photography_project_deliverables_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_deliverables_update_owner ON public.photography_project_deliverables FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_galleries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photography_project_galleries ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_project_galleries photography_project_galleries_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_galleries_delete_owner ON public.photography_project_galleries FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_galleries photography_project_galleries_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_galleries_insert_owner ON public.photography_project_galleries FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_galleries photography_project_galleries_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_galleries_select_owner ON public.photography_project_galleries FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_galleries photography_project_galleries_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_galleries_update_owner ON public.photography_project_galleries FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photography_project_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_project_invoices photography_project_invoices_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_invoices_delete_owner ON public.photography_project_invoices FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_invoices photography_project_invoices_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_invoices_insert_owner ON public.photography_project_invoices FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_invoices photography_project_invoices_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_invoices_select_owner ON public.photography_project_invoices FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_invoices photography_project_invoices_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_invoices_update_owner ON public.photography_project_invoices FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_lightroom; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photography_project_lightroom ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_project_lightroom photography_project_lightroom_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_lightroom_delete_owner ON public.photography_project_lightroom FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_lightroom photography_project_lightroom_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_lightroom_insert_owner ON public.photography_project_lightroom FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_lightroom photography_project_lightroom_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_lightroom_select_owner ON public.photography_project_lightroom FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_lightroom photography_project_lightroom_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_lightroom_update_owner ON public.photography_project_lightroom FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_marketing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photography_project_marketing ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_project_marketing photography_project_marketing_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_marketing_delete_owner ON public.photography_project_marketing FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_marketing photography_project_marketing_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_marketing_insert_owner ON public.photography_project_marketing FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_marketing photography_project_marketing_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_marketing_select_owner ON public.photography_project_marketing FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_marketing photography_project_marketing_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_marketing_update_owner ON public.photography_project_marketing FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_questionnaires; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photography_project_questionnaires ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_project_questionnaires photography_project_questionnaires_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_questionnaires_delete_owner ON public.photography_project_questionnaires FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_questionnaires photography_project_questionnaires_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_questionnaires_insert_owner ON public.photography_project_questionnaires FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_questionnaires photography_project_questionnaires_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_questionnaires_select_owner ON public.photography_project_questionnaires FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_questionnaires photography_project_questionnaires_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_questionnaires_update_owner ON public.photography_project_questionnaires FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_team; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photography_project_team ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_project_team photography_project_team_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_team_delete_owner ON public.photography_project_team FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_team photography_project_team_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_team_insert_owner ON public.photography_project_team FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_team photography_project_team_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_team_select_owner ON public.photography_project_team FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_team photography_project_team_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_team_update_owner ON public.photography_project_team FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_timeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photography_project_timeline ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_project_timeline photography_project_timeline_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_timeline_delete_owner ON public.photography_project_timeline FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_timeline photography_project_timeline_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_timeline_insert_owner ON public.photography_project_timeline FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_timeline photography_project_timeline_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_timeline_select_owner ON public.photography_project_timeline FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_timeline photography_project_timeline_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_timeline_update_owner ON public.photography_project_timeline FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photography_project_workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_project_workspaces photography_project_workspaces_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_workspaces_delete_owner ON public.photography_project_workspaces FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_workspaces photography_project_workspaces_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_workspaces_insert_owner ON public.photography_project_workspaces FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_workspaces photography_project_workspaces_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_workspaces_select_owner ON public.photography_project_workspaces FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_project_workspaces photography_project_workspaces_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_project_workspaces_update_owner ON public.photography_project_workspaces FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photography_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_projects photography_projects_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_projects_delete_owner ON public.photography_projects FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_projects photography_projects_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_projects_insert_owner ON public.photography_projects FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_projects photography_projects_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_projects_select_owner ON public.photography_projects FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: photography_projects photography_projects_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photography_projects_update_owner ON public.photography_projects FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: portal_access_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_access_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: portfolio_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portfolio_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: customers public can create customers for a business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public can create customers for a business" ON public.customers FOR INSERT WITH CHECK ((business_id IS NOT NULL));


--
-- Name: gallery_items public can read gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public can read gallery" ON public.gallery_items FOR SELECT USING (true);


--
-- Name: service_photos public can read service photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public can read service photos" ON public.service_photos FOR SELECT USING (true);


--
-- Name: recurring_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: review_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.review_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: service_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_ai; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_ai ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_ai settings_ai_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_ai_owner_all ON public.settings_ai USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_ai.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_ai.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_api_keys settings_api_keys_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_api_keys_owner_all ON public.settings_api_keys USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_api_keys.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_api_keys.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_audit_logs settings_audit_logs_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_audit_logs_owner_all ON public.settings_audit_logs USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_audit_logs.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_audit_logs.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_billing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_billing ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_billing settings_billing_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_billing_owner_all ON public.settings_billing USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_billing.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_billing.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_branding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_branding ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_branding settings_branding_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_branding_owner_all ON public.settings_branding USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_branding.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_branding.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_business; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_business ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_business_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_business_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_business_hours settings_business_hours_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_business_hours_owner_all ON public.settings_business_hours USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_business_hours.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_business_hours.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_business settings_business_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_business_owner_all ON public.settings_business USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_business.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_business.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_integrations settings_integrations_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_integrations_owner_all ON public.settings_integrations USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_integrations.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_integrations.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_notifications settings_notifications_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_notifications_owner_all ON public.settings_notifications USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_notifications.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_notifications.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_oauth_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_oauth_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_oauth_tokens settings_oauth_tokens_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_oauth_tokens_owner_all ON public.settings_oauth_tokens USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_oauth_tokens.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_oauth_tokens.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_organization; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_organization ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_organization settings_organization_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_organization_owner_all ON public.settings_organization USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_organization.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_organization.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_permissions settings_permissions_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_permissions_owner_all ON public.settings_permissions USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_permissions.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_permissions.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_roles settings_roles_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_roles_owner_all ON public.settings_roles USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_roles.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_roles.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_security; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_security ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_security settings_security_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_security_owner_all ON public.settings_security USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_security.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_security.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_subscriptions settings_subscriptions_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_subscriptions_owner_all ON public.settings_subscriptions USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_subscriptions.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_subscriptions.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: settings_team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_team_members settings_team_members_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_team_members_owner_all ON public.settings_team_members USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_team_members.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = settings_team_members.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: stripe_connect_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_analytics_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_analytics_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_analytics_snapshots studio_analytics_snapshots_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_analytics_snapshots_owner_all ON public.studio_analytics_snapshots USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: studio_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_assets studio_assets_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_assets_owner_all ON public.studio_assets USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: studio_brand_kit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_brand_kit ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_brand_kit studio_brand_kit_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_brand_kit_owner_all ON public.studio_brand_kit USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: studio_project_exports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_project_exports ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_project_exports studio_project_exports_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_project_exports_owner_all ON public.studio_project_exports USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: studio_project_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_project_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_project_pages studio_project_pages_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_project_pages_owner_all ON public.studio_project_pages USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: studio_project_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_project_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_project_versions studio_project_versions_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_project_versions_owner_all ON public.studio_project_versions USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: studio_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_projects studio_projects_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_projects_owner_all ON public.studio_projects USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: studio_publish_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_publish_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_publish_queue studio_publish_queue_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_publish_queue_owner_all ON public.studio_publish_queue USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: studio_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_settings studio_settings_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_settings_owner_all ON public.studio_settings USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: studio_social_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_social_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_social_accounts studio_social_accounts_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_social_accounts_owner_all ON public.studio_social_accounts USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: studio_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_templates studio_templates_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_templates_owner_all ON public.studio_templates USING (((business_id IS NULL) OR (business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))))) WITH CHECK (((business_id IS NULL) OR (business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))));


--
-- Name: studio_templates studio_templates_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_templates_public_read ON public.studio_templates FOR SELECT USING (((published = true) AND (business_id IS NULL)));


--
-- Name: user_table_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_table_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_table_preferences user_table_preferences_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_table_preferences_owner_all ON public.user_table_preferences USING (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = user_table_preferences.business_id) AND (b.owner_id = auth.uid())))))) WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = user_table_preferences.business_id) AND (b.owner_id = auth.uid()))))));


--
-- Name: website_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: website_pages website_pages_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY website_pages_owner_all ON public.website_pages USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: website_pages website_pages_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY website_pages_public_read ON public.website_pages FOR SELECT USING ((published = true));


--
-- Name: workspace_memories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_memories ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_memories workspace_memories_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memories_delete_owner ON public.workspace_memories FOR DELETE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: workspace_memories workspace_memories_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memories_insert_owner ON public.workspace_memories FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: workspace_memories workspace_memories_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memories_select_owner ON public.workspace_memories FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: workspace_memories workspace_memories_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memories_update_owner ON public.workspace_memories FOR UPDATE USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid())))) WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: workspace_memory_changes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_memory_changes ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_memory_changes workspace_memory_changes_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memory_changes_insert_owner ON public.workspace_memory_changes FOR INSERT WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: workspace_memory_changes workspace_memory_changes_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memory_changes_select_owner ON public.workspace_memory_changes FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: zip_centroids; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zip_centroids ENABLE ROW LEVEL SECURITY;

--
-- Name: objects brand_assets_owner_delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY brand_assets_owner_delete ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'brand-assets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects brand_assets_owner_insert; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY brand_assets_owner_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'brand-assets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects brand_assets_owner_update; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY brand_assets_owner_update ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'brand-assets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'brand-assets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: objects business_assets_owner_delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY business_assets_owner_delete ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'business-assets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects business_assets_owner_insert; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY business_assets_owner_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'business-assets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects business_assets_owner_update; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY business_assets_owner_update ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'business-assets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'business-assets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: objects site_media_owner_delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY site_media_owner_delete ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'site-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects site_media_owner_insert; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY site_media_owner_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'site-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects site_media_owner_update; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY site_media_owner_update ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'site-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'site-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict Gz6Z4KmKu0ohe4dLPRKMDRKX0nAh5kbCoghPekbzUbHnZbfusoY7xKZJ2M5bvqv

