-- == THE PUBLIC READER'S ALLOWLIST, CORRECTED: SEVEN FIELDS THE FIRST VERSION DROPPED =========
--
-- WHAT THIS FIXES, AND IT IS MY OWN REGRESSION FROM AN HOUR EARLIER. 20260918120000 replaced
-- to_jsonb(b) with a derived 23-column allowlist. The derivation used a 60-LINE WINDOW after the call
-- site, and loadPublicProfile unpacks the row over ~180 lines. Seven fields it reads fell outside the
-- window and were silently dropped from every public page:
--
--   ig_handle, fb_url, tiktok_handle, google_url   hubly.html:18314 -> S.ig/S.fb/S.tk/S.gb
--                                                  THE SOCIAL LINKS ON EVERY PUBLIC PAGE
--   section_order                                  hubly.html:18326 -> applySectionOrderFromDb()
--                                                  THE ORDER THE SECTIONS RENDER IN
--   account_kind                                   hubly.html:18218 -> hcNoIndex() for test accounts
--                                                  TEST PAGES STOPPED BEING NOINDEXED
--
-- NOTHING ERRORED FOR ANY OF THEM. `undefined === 'test'` is false; `data.ig_handle || ''` is ''; a
-- missing section_order simply skips the call. That is the route-list failure mode -- the one where a
-- file deploys, does not serve, and everything it defined is silently undefined -- arriving through a
-- WINDOW PARAMETER in a derivation script. The window was printed with the result, which is why it was
-- findable; it was still wrong.
--
-- HOW IT WAS FOUND: Adrian asked whether any renderer needs owner_id. owner_id is read on the line
-- BESIDE account_kind. Widening the window to 250 lines and re-deriving surfaced all seven. His
-- incognito observation could not have found this -- it shows what IS returned, not what a renderer
-- needed and did not get. Both sources were required.
--
-- == TWO DELIBERATE EXCLUSIONS ===============================================================
--
--   owner_id   RULED OUT by Adrian: "an auth user id on a public endpoint is a gift to anyone
--              enumerating." Its only public-path read is `if(!data.owner_id || …)` at hubly.html:18218,
--              which this function makes impossible -- it already requires owner_id is not null, so the
--              test is dead by construction. ONE BEHAVIOUR CHANGE, named rather than hidden:
--              ensureDraftBusiness (hubly.html:18871) has a fast path
--              `currentBusiness.owner_id === currentUser.id` that will now always miss on a page loaded
--              through this function, and fall through to a select that finds the row anyway. An extra
--              query, not a wrong answer, and it is not a renderer.
--   user       NOT a column. `data.user` at hubly.html:18368 is an AUTH response (`currentUser=data.user`)
--              that the derivation's name-based scan cannot tell from a row field. Excluded by reading
--              the line, which is the only way to tell.
--
-- meta SUBTREES are unchanged from 20260918120000: the union of every key applyBizMeta() reads
-- (brace-scoped out of hubly.html, which IS the public render contract) and every top-level meta key
-- present in a claimed business, MINUS the one private-shaped subtree (pipeline). Verified this round:
-- Adrian's incognito response carried 40 meta keys and EVERY ONE is permitted by the live list; none
-- forbidden appeared. pipeline is in the COLUMN (3 records, 9 subkeys for graefs-autocare) and is NOT
-- returned -- 52 keys in the column, 51 on the wire, exactly one stripped.
--
-- == NO ROW IS WRITTEN =======================================================================
--
-- This replaces a FUNCTION. Zero INSERT/UPDATE/DELETE. graefs-autocare is read-only and his records
-- are untouched; the function that serves him changes, his rows do not.

create or replace function public.get_public_business(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
           'about', b.about,
           'account_kind', b.account_kind,
           'banner_url', b.banner_url,
           'bg_color', b.bg_color,
           'brand_color', b.brand_color,
           'buffer_after_min', b.buffer_after_min,
           'buffer_before_min', b.buffer_before_min,
           'capabilities', b.capabilities,
           'city', b.city,
           'deposit_message', b.deposit_message,
           'email', b.email,
           'fb_url', b.fb_url,
           'gen_hero_headline', b.gen_hero_headline,
           'google_url', b.google_url,
           'id', b.id,
           'ig_handle', b.ig_handle,
           'logo_url', b.logo_url,
           'name', b.name,
           'payment_setting', b.payment_setting,
           'phone', b.phone,
           'section_order', b.section_order,
           'service_area_cities', b.service_area_cities,
           'slug', b.slug,
           'state', b.state,
           'tagline', b.tagline,
           'tier', b.tier,
           'tiktok_handle', b.tiktok_handle,
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
