-- == THE ANON READER STOPS RETURNING THE WHOLE ROW ===========================================
--
-- RULED BY ADRIAN, 2026-09-18: "replace to_jsonb(b) with an explicit column allowlist. Do it now,
-- before anything else."
--
-- WHAT WAS WRONG. get_public_business(slug) is SECURITY DEFINER with EXECUTE granted to anon, and its
-- body was  select to_jsonb(b) - 'draft_token'  -- EVERY COLUMN of businesses. Inside meta sits
-- pipeline.manual: a lead list. Measured 2026-09-18, counts only, no values: graefs-autocare (market,
-- claimed) 3 records, adrians-lawn-service (test, claimed) 2 -- each carrying name, phone, email,
-- address, MESSAGES, lastMessage, notes, notesList, activity, appointments, tasks, estimate and 16
-- more. That is a business's whole CRM record for those people, behind an anonymous reader.
--
-- WHAT WOULD MAKE THAT WRONG, said before the claim: it is established from the EXECUTE GRANT and
-- this function body, NOT from an executed unauthenticated request -- that needs the anon key, and a
-- key may never reach a command line. Adrian is closing that link himself from an incognito session.
--
-- == THE TWO ALLOWLISTS ARE DERIVED, NOT PICKED ==============================================
--
-- A hand-picked list is the hand-maintained-set disease, and its failure mode is the worst one this
-- repo has: a field silently absent, a renderer reading undefined, and nothing 404ing.
--
--   COLUMNS (23 + meta) -- every field the two callers actually read off the returned object, derived
--     by scripts/derive-public-business-fields.mjs. The callers, enumerated from the product (L97),
--     are exactly two: loadPublicProfile in public/hubly.html and hcLoadIdentity in
--     public/platform-home.html. Nothing else calls this function.
--
--   meta SUBTREES (56) -- the union of (a) every key applyBizMeta() reads, brace-scoped out of
--     public/hubly.html, which IS the public render contract, and (b) every top-level meta key
--     present in a claimed business today -- MINUS the one private-shaped subtree. The two sources
--     reconcile exactly: nothing applyBizMeta reads is missing from the data, and the only data keys
--     it does not read are experienceHome and m2Experience, both kept.
--
-- DEFAULT-DENY ON BOTH LEVELS, and that is the point rather than a side effect. A column or a subtree
-- added next month is NOT public until someone adds it, and
-- scripts/check-public-reader-allowlist-is-derived.mjs fails loudly if a renderer reads something the
-- list omits. The alternative -- meta minus 'pipeline' -- fails the other way: a new private subtree
-- would be exposed until someone noticed. For a public reader the leak direction is the worse one.
--
-- == NOTHING HERE TOUCHES ANY BUSINESS'S ROWS ================================================
--
-- This replaces a FUNCTION. There is no INSERT, UPDATE or DELETE in this file. graefs-autocare is
-- read-only and is not written to; the function that serves him changes, his records do not.
--
-- AND THE OWNER IS UNAFFECTED, verified rather than assumed: the owner's own shell reads its business
-- through db.from('businesses').select('*').eq('owner_id', currentUser.id) -- a direct PostgREST
-- select under RLS (public/hubly.html, loadBusiness) -- never through this function. So S.pipeline
-- still fills for the owner. On a PUBLIC page applyBizMeta will now leave S.pipeline empty, which is
-- correct: a visitor has no CRM surface to render it into.

create or replace function public.get_public_business(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
           'about', b.about,
           'banner_url', b.banner_url,
           'bg_color', b.bg_color,
           'brand_color', b.brand_color,
           'buffer_after_min', b.buffer_after_min,
           'buffer_before_min', b.buffer_before_min,
           'capabilities', b.capabilities,
           'city', b.city,
           'deposit_message', b.deposit_message,
           'email', b.email,
           'gen_hero_headline', b.gen_hero_headline,
           'id', b.id,
           'logo_url', b.logo_url,
           'name', b.name,
           'owner_id', b.owner_id,
           'payment_setting', b.payment_setting,
           'phone', b.phone,
           'service_area_cities', b.service_area_cities,
           'slug', b.slug,
           'state', b.state,
           'tagline', b.tagline,
           'tier', b.tier,
           'timezone', b.timezone
         )
         || jsonb_build_object('meta',
              case when b.meta is null then null
                   else (select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)
                           from jsonb_each(b.meta::jsonb) as e(k, v)
                          where e.k in (
                                'bannerUrl', 'bkBannerColor', 'bkBannerUrl', 'bkBgColor', 'bkLogoUrl',
                                'bookingMode', 'bookingWizard', 'bookingWizardDone', 'businessProfile', 'businessSpecialties',
                                'businessSpecialty', 'businessStage', 'businessType', 'ctaText', 'depositCollect',
                                'depositMessage', 'depositType', 'depositUnit', 'depositVal', 'dirtySurcharge',
                                'editorAddons', 'editorSvcs', 'experienceHome', 'font', 'galleryPairs',
                                'gradientKey', 'headerMode', 'hero', 'hours', 'logoScale',
                                'logoUrl', 'm2Experience', 'onboardingPriority', 'onboardingPriorityLabel', 'ownerUploadedMedia',
                                'paymentSetting', 'portfolioUrls', 'pricingVisibility', 'profileBgColor', 'promoCodes',
                                'quoteConfig', 'reviewEmbedCode', 'serviceAreaRadiusMiles', 'serviceAreaStates', 'service_catalog',
                                'services', 'servicesDraft', 'servicesMode', 'storeOs', 'storefront',
                                'storefrontDraft', 'studioOs', 'travelsToCustomers', 'useBkBranding', 'website',
                                'workLove'
                                ))
              end)
    from public.businesses b
   where b.slug = p_slug
     and b.owner_id is not null   -- a public address requires an owner
   limit 1;
$fn$;

-- The grant is unchanged: anon may still call it. What changed is what it hands back.
