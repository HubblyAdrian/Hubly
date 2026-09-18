-- == is_claimed: THE FACT THE PAGE ACTUALLY NEEDED, WITHOUT THE USER ID ========================
--
-- MY OWN REGRESSION, SHIPPED, LIVE, AND CUSTOMER-FACING. 20260918140000 deliberately excluded
-- owner_id from the public reader ("an auth user id on a public endpoint is a gift to anyone
-- enumerating" — still right). In the same comment I wrote, about the one line that reads it:
--
--     `if(!data.owner_id || …)` … which this function makes impossible — it already requires
--     owner_id is not null, so the test is DEAD BY CONSTRUCTION.
--
-- The premise is true. The conclusion is backwards, and the gap between them is one evaluation:
--
--     !undefined === true
--
-- A field that is not RETURNED is not a field that is FALSE-and-irrelevant; it is `undefined`, and
-- `!undefined` is true. So the test did not go dead, it went ALWAYS TRUE, and
--
--     if(!data.owner_id || data.account_kind==='test') hcNoIndex();   -- hubly.html:18221, :18298
--
-- began stamping <meta name="robots" content="noindex, nofollow"> onto EVERY public Hubly page,
-- claimed market businesses included. Measured, not reasoned: loaded two live claimed market sites
-- in a real browser and both carried robots="noindex, nofollow" with our own data-hc-noindex stamp.
-- Ten market businesses are claimed. Nothing errored, nothing logged, and no page looked different
-- to a human — the whole cost is invisible and lands on whoever was going to find them in a search.
--
-- I had ALREADY named this line, reasoned about it, and written the reasoning down. Being wrong
-- while looking straight at it is the part worth keeping: "this condition can no longer matter" and
-- "this condition is now always true" read alike in prose and are opposite in effect, and prose is
-- where I checked it. (docs/CHECKER_LESSONS.md, Lesson 101.)
--
-- == WHAT THIS RETURNS AND WHY IT LEAKS NOTHING ===============================================
--
-- The page does not want a user id. It wants to know whether this address has an owner. That fact
-- is ALREADY implied by the row coming back at all — the WHERE clause is `b.owner_id is not null` —
-- so returning it as a boolean tells an anonymous caller exactly nothing it could not already infer
-- from a 200, and hands over no identifier. The raw owner_id stays out.
--
-- Everything else is BYTE-IDENTICAL to 20260918140000 because this file was GENERATED from it by
-- inserting one line — not retyped. The first draft of this migration WAS retyped from memory, and
-- the diff caught it hand-maintaining the meta subtree list wrong: 72 entries instead of 55, which
-- would have silently dropped ~30 subtrees off every public page. A worse regression than the one
-- being fixed, introduced by the fix, by transcribing a list that already existed. (CLAUDE.md:
-- wherever a LIST decides what is served, that list is a hand-maintained set.) Confirmed before
-- applying: the LIVE function and 20260918140000 agree exactly — 28 top-level keys, 55 meta
-- subtrees — so the file was a sound base to generate from.
--
-- == NO ROW IS WRITTEN ========================================================================
--
-- This replaces a FUNCTION. Zero INSERT/UPDATE/DELETE. graefs-autocare is read-only and untouched.

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
         -- THE ONE NEW KEY. True by construction of the WHERE clause at the bottom of this
         -- function; stated anyway, because a renderer cannot see a SQL predicate and an
         -- ABSENT field is not a false one — it is undefined, and !undefined is true.
         || jsonb_build_object('is_claimed', true)
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
