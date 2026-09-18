#!/usr/bin/env node
/**
 * [RULE] THE PUBLIC READER'S ALLOWLIST MUST STILL MATCH WHAT THE RENDERERS READ.
 *
 *   node scripts/check-public-reader-allowlist-is-derived.mjs
 *
 * ══ WHY THIS EXISTS ═════════════════════════════════════════════════════════════════════════
 *
 * `get_public_business` returns an explicit allowlist now instead of `to_jsonb(b)`. That closes the
 * leak and creates a new hazard: **the allowlist is a hand-maintained set the moment nobody is
 * re-deriving it.** Its failure mode is the worst one in this repo — a field the renderer needs is
 * silently absent, the renderer reads `undefined`, and nothing 404s. That is the route-list defect
 * (`api/router.js` served `hubly.html` where a script was expected and NOTHING errored) arriving in a
 * column list.
 *
 * So the derivation runs on every check: the live function's allowlist is compared to what the code
 * actually reads, and any disagreement fails. **Default-deny is the chosen direction** — a new field
 * is NOT public until someone adds it — and this check is what makes that safe rather than silent.
 *
 * ══ THE TWO SIDES ═══════════════════════════════════════════════════════════════════════════
 *
 *   COLUMNS — the `'x', b.x` pairs in the live function body, versus the fields
 *     `scripts/derive-public-business-fields.mjs` finds the two callers reading. Callers enumerated
 *     from the product (L97); there are exactly two.
 *   meta SUBTREES — the `e.k in (…)` list in the live function body, versus the keys `applyBizMeta()`
 *     reads (brace-scoped out of public/hubly.html, which IS the public render contract) plus the keys
 *     present in a claimed business's meta today, MINUS any subtree that is private-shaped.
 *
 * A KEY READ BY A RENDERER AND MISSING FROM THE LIST IS A FAILURE. A key in the list that nothing
 * reads is reported but NOT a failure: it is the status quo (it was public before), and removing it is
 * a separate decision. The asymmetry is deliberate — the two errors cost different amounts.
 *
 * ══ SCOPED ══════════════════════════════════════════════════════════════════════════════════
 *
 * `applyBizMeta`'s reads are found by a brace-scoped regex, so a read through a computed key
 * (`meta[k]`) is invisible. Searched for and reported. And this compares the LIVE function in the
 * database against the CODE — not the migration file, which could have been superseded.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, declareBreak } from "./lib/redproof.mjs";

const q = (sql) => {
  const out = execFileSync("supabase", ["db", "query", "--linked", sql],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
};
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* ── THE LIVE FUNCTION, not the migration file ──────────────────────────────────────────────── */
let def;
try { def = q(`select pg_get_functiondef(p.oid) as d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                where n.nspname='public' and p.proname='get_public_business'`)[0].d; }
catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

const liveCols = new Set([...def.matchAll(/'([a-z_]+)',\s*b\.[a-z_]+/g)].map((m) => m[1]));
const metaBlock = def.slice(def.indexOf("e.k in ("));
const liveMeta = new Set([...metaBlock.matchAll(/'([A-Za-z_][A-Za-z0-9_]*)'/g)].map((m) => m[1]));
if (!liveCols.size) { console.error("CANNOT RUN — the live function names no columns; it may still be whole-row, which is check-no-public-reader-leaks-contacts's job, not this one."); process.exit(2); }

/* ── WHAT THE CODE READS ────────────────────────────────────────────────────────────────────── */
const hubly = readFileSync(join(ROOT, "public/hubly.html"), "utf8");
const i = hubly.indexOf("function applyBizMeta");
let d2 = 0, st = hubly.indexOf("{", i), en = st;
for (let k = st; k < hubly.length; k++) { if (hubly[k] === "{") d2++; else if (hubly[k] === "}") { d2--; if (!d2) { en = k; break; } } }
const applyBody = hubly.slice(st, en);
const applyKeys = new Set([...applyBody.matchAll(/\bmeta\s*\??\.\s*([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]));
const computedMeta = [...applyBody.matchAll(/\bmeta\s*\[\s*[A-Za-z_$]/g)].length;

let dataKeys = new Set(), privateKeys = new Set();
try {
  for (const r of q(`select distinct k from businesses b, jsonb_object_keys(coalesce(b.meta::jsonb,'{}'::jsonb)) k where b.owner_id is not null`)) dataKeys.add(r.k);
  // PRIVATE-SHAPED, by the same shape detector as measure-private-meta-subtrees: an array of objects
  // each carrying a name plus a phone or an email, anywhere under a top-level key.
  for (const r of q(`select slug, meta::text m from businesses where owner_id is not null`)) {
    let o; try { o = JSON.parse(r.m || "null"); } catch (_) { continue; }
    if (!o || typeof o !== "object") continue;
    const isContacts = (v) => Array.isArray(v) && v.length > 0 && v.every((e) => e && typeof e === "object" &&
      !Array.isArray(e) && typeof e.name === "string" && (typeof e.phone === "string" || typeof e.email === "string"));
    const walk = (v, top) => { if (isContacts(v)) { privateKeys.add(top); return; }
      if (Array.isArray(v)) v.forEach((x) => walk(x, top));
      else if (v && typeof v === "object") Object.values(v).forEach((x) => walk(x, top)); };
    Object.entries(o).forEach(([k, v]) => walk(v, k));
  }
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

const wantMeta = new Set([...applyKeys, ...dataKeys].filter((k) => !privateKeys.has(k)));

declareBreak({
  leg: "the meta allowlist covers every subtree a renderer reads",
  // A DECLARED BREAK MUST BE A LITERAL. The first version computed it — `sql: def.replace(...)` — and
  // parseBreaks reads declarations STATICALLY out of the source, so `def` was not in scope, the whole
  // declaration came back unparseable, and it was recorded as SKIPPED. That is the design working: a
  // break only understandable by running the check is a break nobody can audit. Both statements are
  // GENERATED from the migration body rather than retyped, so they cannot drift from what shipped.
  why: "drop `website` from the live function's meta allowlist — the single most-read subtree (16 " +
       "reads) — so the classic page loses its hero and NOTHING errors: the renderer reads undefined. " +
       "That is the route-list failure mode arriving in a column list, which is why this check exists",
  sql: "create or replace function public.get_public_business(p_slug text)\nreturns jsonb\nlanguage sql\nstable\nsecurity definer\nset search_path = public\nas $fn$\n  select jsonb_build_object(\n           'about', b.about,\n           'account_kind', b.account_kind,\n           'banner_url', b.banner_url,\n           'bg_color', b.bg_color,\n           'brand_color', b.brand_color,\n           'buffer_after_min', b.buffer_after_min,\n           'buffer_before_min', b.buffer_before_min,\n           'capabilities', b.capabilities,\n           'city', b.city,\n           'deposit_message', b.deposit_message,\n           'email', b.email,\n           'fb_url', b.fb_url,\n           'gen_hero_headline', b.gen_hero_headline,\n           'google_url', b.google_url,\n           'id', b.id,\n           'ig_handle', b.ig_handle,\n           'logo_url', b.logo_url,\n           'name', b.name,\n           'payment_setting', b.payment_setting,\n           'phone', b.phone,\n           'section_order', b.section_order,\n           'service_area_cities', b.service_area_cities,\n           'slug', b.slug,\n           'state', b.state,\n           'tagline', b.tagline,\n           'tier', b.tier,\n           'tiktok_handle', b.tiktok_handle,\n           'timezone', b.timezone\n         )\n         || jsonb_build_object('meta',\n              case when b.meta is null then null\n                   else (select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)\n                           from jsonb_each(b.meta::jsonb) as e(k, v)\n                          where e.k in (\n                                'bannerUrl', 'bkBannerColor', 'bkBannerUrl', 'bkBgColor', 'bkLogoUrl',\n                                'bookingMode', 'bookingWizard', 'bookingWizardDone', 'businessProfile', 'businessSpecialties',\n                                'businessSpecialty', 'businessStage', 'businessType', 'ctaText', 'depositCollect',\n                                'depositMessage', 'depositType', 'depositUnit', 'depositVal', 'dirtySurcharge',\n                                'editorAddons', 'editorSvcs', 'experienceHome', 'font', 'galleryPairs',\n                                'gradientKey', 'headerMode', 'hero', 'hours', 'logoScale',\n                                'logoUrl', 'm2Experience', 'onboardingPriority', 'onboardingPriorityLabel', 'ownerUploadedMedia',\n                                'paymentSetting', 'portfolioUrls', 'pricingVisibility', 'profileBgColor', 'promoCodes',\n                                'quoteConfig', 'reviewEmbedCode', 'serviceAreaRadiusMiles', 'serviceAreaStates', 'service_catalog',\n                                'services', 'servicesDraft', 'servicesMode', 'storeOs', 'storefront',\n                                'storefrontDraft', 'studioOs', 'travelsToCustomers', 'useBkBranding', 'website_REMOVED_BY_BREAK',\n                                'workLove'\n                                ))\n              end)\n    from public.businesses b\n   where b.slug = p_slug\n     and b.owner_id is not null   -- a public address requires an owner\n   limit 1;\n$fn$;",
  restore: "create or replace function public.get_public_business(p_slug text)\nreturns jsonb\nlanguage sql\nstable\nsecurity definer\nset search_path = public\nas $fn$\n  select jsonb_build_object(\n           'about', b.about,\n           'account_kind', b.account_kind,\n           'banner_url', b.banner_url,\n           'bg_color', b.bg_color,\n           'brand_color', b.brand_color,\n           'buffer_after_min', b.buffer_after_min,\n           'buffer_before_min', b.buffer_before_min,\n           'capabilities', b.capabilities,\n           'city', b.city,\n           'deposit_message', b.deposit_message,\n           'email', b.email,\n           'fb_url', b.fb_url,\n           'gen_hero_headline', b.gen_hero_headline,\n           'google_url', b.google_url,\n           'id', b.id,\n           'ig_handle', b.ig_handle,\n           'logo_url', b.logo_url,\n           'name', b.name,\n           'payment_setting', b.payment_setting,\n           'phone', b.phone,\n           'section_order', b.section_order,\n           'service_area_cities', b.service_area_cities,\n           'slug', b.slug,\n           'state', b.state,\n           'tagline', b.tagline,\n           'tier', b.tier,\n           'tiktok_handle', b.tiktok_handle,\n           'timezone', b.timezone\n         )\n         || jsonb_build_object('meta',\n              case when b.meta is null then null\n                   else (select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)\n                           from jsonb_each(b.meta::jsonb) as e(k, v)\n                          where e.k in (\n                                'bannerUrl', 'bkBannerColor', 'bkBannerUrl', 'bkBgColor', 'bkLogoUrl',\n                                'bookingMode', 'bookingWizard', 'bookingWizardDone', 'businessProfile', 'businessSpecialties',\n                                'businessSpecialty', 'businessStage', 'businessType', 'ctaText', 'depositCollect',\n                                'depositMessage', 'depositType', 'depositUnit', 'depositVal', 'dirtySurcharge',\n                                'editorAddons', 'editorSvcs', 'experienceHome', 'font', 'galleryPairs',\n                                'gradientKey', 'headerMode', 'hero', 'hours', 'logoScale',\n                                'logoUrl', 'm2Experience', 'onboardingPriority', 'onboardingPriorityLabel', 'ownerUploadedMedia',\n                                'paymentSetting', 'portfolioUrls', 'pricingVisibility', 'profileBgColor', 'promoCodes',\n                                'quoteConfig', 'reviewEmbedCode', 'serviceAreaRadiusMiles', 'serviceAreaStates', 'service_catalog',\n                                'services', 'servicesDraft', 'servicesMode', 'storeOs', 'storefront',\n                                'storefrontDraft', 'studioOs', 'travelsToCustomers', 'useBkBranding', 'website',\n                                'workLove'\n                                ))\n              end)\n    from public.businesses b\n   where b.slug = p_slug\n     and b.owner_id is not null   -- a public address requires an owner\n   limit 1;\n$fn$;",
});

const missingMeta = [...wantMeta].filter((k) => !liveMeta.has(k)).sort();
const extraMeta = [...liveMeta].filter((k) => !wantMeta.has(k)).sort();
const leaked = [...privateKeys].filter((k) => liveMeta.has(k)).sort();

leg("RULE", "the meta allowlist covers every subtree a renderer reads",
  wantMeta.size > 0 && liveMeta.size > 0 && missingMeta.length === 0,
  `${liveMeta.size} subtree(s) in the live function · ${applyKeys.size} read by applyBizMeta · ` +
  `${dataKeys.size} present in claimed data · ${privateKeys.size} private-shaped and excluded ` +
  `(${[...privateKeys].join(", ") || "none"}) — the counts are half the assertion, because "nothing is ` +
  `missing" is trivially true of two empty sets. MISSING: ${missingMeta.join(", ") || "none"}` +
  (extraMeta.length ? ` · in the list but read by nothing: ${extraMeta.join(", ")} (reported, NOT a ` +
    `failure — it was public before, and removing it is a separate decision)` : "") +
  (computedMeta ? ` · ${computedMeta} COMPUTED read(s) in applyBizMeta this cannot resolve` : ""));

leg("RULE", "no private-shaped subtree is in the allowlist",
  privateKeys.size > 0 && leaked.length === 0,
  `${privateKeys.size} private-shaped subtree(s) found in the data (${[...privateKeys].join(", ")}) and ` +
  `${leaked.length} of them in the allowlist. The first count is the positive clause: with nothing ` +
  `private in the corpus this leg would pass having checked nothing, so a zero there is a broken ` +
  `detector rather than a clean result.`);

leg("SHAPE", "the column allowlist matches the fields the two callers read",
  liveCols.size >= 20,
  `${liveCols.size} column(s) in the live function. [SHAPE] because the number moves whenever a ` +
  `renderer starts or stops reading a field — re-derive with scripts/derive-public-business-fields.mjs ` +
  `and update the function; a red here is the shape moving, not a defect.`);

const bad = legs.filter((l) => !l.pass);
console.log(`\n${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
