-- THE ASSISTANT CAN WRITE THE STORE THE CLASSIC PAGE ACTUALLY READS.
--
-- There are two website stores (docs/SETTLED.md #2). A freeform page is HTML in
-- business_documents; a CLASSIC page is rendered from businesses.meta — and its service cards
-- come from meta.service_catalog. The assistant's setServices writes the relational `services`
-- table, which a classic page never reads, so on 2026-09-13 the only paying customer had every
-- service he ever added stored, invisible, and reported as done.
--
-- service_engine.ts already writes that catalogue and is imported by marketplace,
-- chatbot-message, booking_job, marketplace_match and the context loader — but NOT by the
-- capability registry. Nobody wired it. This is the missing writer.
--
-- A PURE ADD. No table changes, no drops, no signature changes to anything that exists.
-- The alternative — adding a parameter to patch_business_in_progress — would be a
-- drop-and-recreate of a security-definer function with 31 call sites against a ledger with 56
-- unrecorded migrations, taken to avoid writing one new function. Ruled against.
--
-- THE AUTHORISATION PREDICATE IS COPIED VERBATIM from set_business_hours
-- (20260912210000_set_business_hours_draft_or_owner.sql), quoted here so a reader can compare
-- without opening that file, and so it is not reconstructed from memory:
--
--     if v_owner is null then
--       -- UNCLAIMED DRAFT: the token is the authorisation, exactly as every other draft
--       -- writer treats it. A null token on a tokenless row must never pass, so both sides
--       -- are required to be present and equal.
--       if p_draft_token is null or v_token is null or v_token is distinct from p_draft_token then
--         return -2;
--       end if;
--     else
--       -- CLAIMED: ownership only, through the one ownership predicate.
--       if p_owner_id is null or not public.hubly_owns_business(p_business_id, p_owner_id) then
--         return -1;
--       end if;
--     end if;
--
-- Return codes match set_business_hours so a caller learns one vocabulary:
--    -1  claimed, and p_owner_id is not its owner
--    -2  unclaimed draft, and p_draft_token does not match
--    -3  no such business
--   >=0  the number of services in the catalogue that was written
--
-- THE CALLER OWNS THE MERGE. This function REPLACES meta.service_catalog with what it is
-- given; it does not merge. That is deliberate: service_engine's
-- catalogFromOwnerServicesPayload already preserves prior services by id and registers
-- addons, and splitting merge logic across TypeScript and SQL would be two writers of one
-- fact — the defect this whole day has been about. The caller stamps the catalogue by
-- calling buildCatalogWritePayload() and sending its `service_catalog`, so version /
-- currency / updated_at / the ai slot are produced by the production function, not
-- reimplemented here.
--
-- THE ONE THING SQL DOES OWN is dropping the legacy mirrors (editorSvcs, editorAddons,
-- services). That is a property of this STORE, not of the catalogue: buildCatalogWritePayload
-- deletes them from the meta it returns, and since this function merges into the LIVE meta
-- rather than overwriting it, a mirror left behind would outlive the write and keep feeding
-- getCatalog()'s migrate-on-read path a stale service list.
create or replace function public.set_business_service_catalog(
  p_business_id uuid, p_owner_id uuid, p_catalog jsonb, p_draft_token uuid default null
) returns integer language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_token uuid; v_found boolean; v_meta jsonb; n integer := 0;
begin
  select owner_id, draft_token, true into v_owner, v_token, v_found
    from public.businesses where id = p_business_id;
  if not coalesce(v_found, false) then return -3; end if;

  if v_owner is null then
    -- UNCLAIMED DRAFT: the token is the authorisation, exactly as every other draft
    -- writer treats it. A null token on a tokenless row must never pass, so both sides
    -- are required to be present and equal.
    if p_draft_token is null or v_token is null or v_token is distinct from p_draft_token then
      return -2;
    end if;
  else
    -- CLAIMED: ownership only, through the one ownership predicate.
    if p_owner_id is null or not public.hubly_owns_business(p_business_id, p_owner_id) then
      return -1;
    end if;
  end if;

  if p_catalog is null or jsonb_typeof(p_catalog) <> 'object' then return 0; end if;
  if jsonb_typeof(p_catalog->'services') <> 'array' then return 0; end if;

  -- REFUSE AN EMPTY CATALOGUE. A replace-all writer handed [] would delete every service a
  -- business has, and the caller that sends it is far more likely to be broken than to mean
  -- it. The customer this exists for has 8 cards; over-deletion is the silent failure here.
  n := jsonb_array_length(p_catalog->'services');
  if n = 0 then return 0; end if;

  select coalesce(nullif(meta, '')::jsonb, '{}'::jsonb) into v_meta
    from public.businesses where id = p_business_id;

  update public.businesses
     set meta = (((v_meta - 'editorSvcs' - 'editorAddons' - 'services')
                 || jsonb_build_object('service_catalog', p_catalog)))::text,
         updated_at = now()
   where id = p_business_id;

  return n;
end;
$$;

revoke all on function public.set_business_service_catalog(uuid, uuid, jsonb, uuid) from public, anon;
grant execute on function public.set_business_service_catalog(uuid, uuid, jsonb, uuid) to authenticated, service_role;

comment on function public.set_business_service_catalog(uuid, uuid, jsonb, uuid) is
  'Writes businesses.meta.service_catalog — the store a CLASSIC page renders its service cards from. '
  'Authorises an unclaimed draft by p_draft_token and a claimed business by p_owner_id, the same '
  'predicate as set_business_hours. REPLACES the catalogue; the caller merges (service_engine). '
  'Refuses an empty services array. Returns the count written, or -1 not owner, -2 token mismatch, -3 no such business.';
