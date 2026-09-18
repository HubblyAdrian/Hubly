-- == ONE PREDICATE FOR "SHOULD GOOGLE INDEX THIS PAGE" ========================================
--
-- ADRIAN'S RULING, 2026-09-18: "Internal accounts come out. Those are ours. They should not be in
-- Google's index, and they should not be in a file that tells Google what our customers' pages are."
-- And: "the fix belongs in the shared predicate, not in the sitemap."
--
-- Before this the question was asked in TWO places with TWO different spellings:
--
--   hubly.html   !hcRowIsClaimed(row) || row.account_kind === 'test'      -> stamps <meta robots>
--   SQL          g.pub is not null and ->>'account_kind' <> 'test'        -> sitemap membership
--
-- Both were correct and both would have needed editing to add 'internal'. Two spellings of one fact
-- is how the account chip came to show a login as a name, and it is what made the seven-field
-- regression invisible. So the predicate becomes a FUNCTION, called once, and both consumers read
-- its ANSWER rather than restating its logic:
--
--   business_is_indexable(owner_id, account_kind)   the predicate. The only place the rule is written.
--   get_public_business  -> 'is_indexable'          the page reads this key. hcNoIndex asks nothing else.
--   get_indexable_business_slugs                    the sitemap filters on that same returned key.
--
-- WHY THE CLIENT GETS A BOOLEAN AND NOT THE INGREDIENTS. A renderer handed owner_id and account_kind
-- has to reconstruct the rule, and a reconstruction is a second opinion that drifts. It also cannot
-- see a WHERE clause. Handing it the verdict means adding a fourth excluded kind tomorrow is one
-- edit here and zero edits in 3MB of JavaScript.
--
-- AND THE ABSENT CASE IS NOT LEFT TO `!`. get_draft_business returns the whole businesses row and
-- therefore NO is_indexable. The client tests `row.is_indexable === true`, so an absent field is
-- NOT-indexable explicitly rather than by the accident of `!undefined` being true -- which is the
-- accident that put <meta robots="noindex"> on every public page for 1h39m last night (Lesson 101).
-- A draft is always unclaimed and therefore never indexable, so that is also the right answer.
--
-- == THE SHAPE OF THE RULE, STATED IN WORDS SO IT CAN BE ARGUED WITH =========================
--
--   indexable  <=>  the address has an owner  AND  account_kind is neither 'test' nor 'internal'
--
-- account_kind has exactly three values (test, internal, market -- CLAUDE.md), so after this ruling
-- indexable means MARKET AND CLAIMED. It is written as "not in (test, internal)" rather than
-- "= market" deliberately: a fourth kind added later should default to NOT indexable, because the
-- honest default for a category describing who someone is must never be the flattering one.
--
-- == NO ROW IS WRITTEN =======================================================================
--
-- Three CREATE OR REPLACE FUNCTION. Zero INSERT/UPDATE/DELETE. graefs-autocare untouched.

create or replace function public.business_is_indexable(p_owner uuid, p_kind text)
returns boolean
language sql
immutable
as $p$
  select p_owner is not null
     and coalesce(p_kind, '') not in ('test', 'internal')
$p$;

grant execute on function public.business_is_indexable(uuid, text) to anon, authenticated;

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
         -- THE INDEXABILITY VERDICT, COMPUTED BY THE ONE PREDICATE. The page cannot see a SQL
         -- clause and must not re-derive this: hcNoIndex() reads THIS key and nothing else.
         || jsonb_build_object('is_indexable', public.business_is_indexable(b.owner_id, b.account_kind))
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

-- == THE SITEMAP'S MEMBERSHIP, NOW READING THE VERDICT ========================================
--
-- Unchanged in shape from 20260918180000: it still asks get_public_business() rather than the table,
-- so the sitemap and the page cannot disagree. What changed is WHICH key it reads -- 'is_indexable'
-- instead of re-testing account_kind here, which is the duplicate spelling this migration removes.
-- `is not true` rather than `= false`: a NULL verdict is not indexable.

create or replace function public.get_indexable_business_slugs()
returns table (slug text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.slug, b.updated_at
    from public.businesses b
    cross join lateral (select public.get_public_business(b.slug) as pub) g
   where g.pub is not null
     and (g.pub -> 'is_indexable')::boolean is true
   order by b.slug
$fn$;

grant execute on function public.get_indexable_business_slugs() to anon, authenticated;
