#!/usr/bin/env node
/**
 * [RULE] EVERY PUBLIC FUNCTION'S LIVE BODY MATCHES THE LAST MIGRATION THAT DEFINES IT.
 *
 *   node scripts/check-live-functions-match-their-migrations.mjs
 *
 * ══ WHY, AND THE EPISODE THAT ASKED FOR IT ══════════════════════════════════════════════════
 *
 * Adrian, 2026-09-18: *"If the live function does not match the migration that last defined it, that is
 * the finding, and it is bigger than this function. It would mean the database has been changed outside
 * the migration history and the repo no longer describes production. I would rather know the number
 * today than discover it one function at a time over six weeks."*
 *
 * On the occasion that prompted it there was NO divergence — the apparent one was a timeline: the live
 * body was `to_jsonb(b)` at 21:52, was replaced at 22:28, and was read from a browser after that. All
 * three readings were true. But the question is right and the answer needs a number, so this measures
 * it for every function rather than for the one that happened to come up.
 *
 * AND THIS IS THE ONE CHECK IN THE REPO THAT IS ABOUT THE REPO BEING TRUE. The migration ledger is
 * already known to have diverged once: thirty migrations are applied and unrecorded in
 * `supabase_migrations` (see the banner in docs/CHECKER_LESSONS.md). That is the ledger; this is the
 * BODIES, which is the half that decides whether reading a migration tells you what is deployed.
 *
 * ══ HOW IT COMPARES, AND WHAT IT DELIBERATELY IGNORES ═══════════════════════════════════════
 *
 * `pg_get_functiondef` reformats the HEADER (it uppercases keywords, reorders attributes) but preserves
 * the BODY between the dollar-quote markers verbatim. So only the body is compared, with whitespace
 * collapsed and SQL comments stripped — those are the differences that are certainly not behaviour.
 * Anything else is reported.
 *
 * SCOPED, and each of these is a reason a red here might not be a dashboard edit:
 *   · A function defined only by an OLD migration whose text was later edited in place would read as a
 *     divergence. The repo's own rule is one migration per change, so that should not happen; if it
 *     does, this check cannot tell it from a dashboard edit and says so.
 *   · A function with several `create or replace` statements across migrations: the LAST file by
 *     filename order wins, which is the order they were applied in.
 *   · A function defined by a migration that has NOT been applied yet reads as a divergence, correctly.
 *   · A function with no migration at all is reported separately — it is not a mismatch, it is an
 *     absence of provenance, and conflating the two would hide both.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, declareBreak } from "./lib/redproof.mjs";

const q = (sql) => {
  const out = execFileSync("supabase", ["db", "query", "--linked", sql],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 512 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
};
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* ── THE BODY OF A DOLLAR-QUOTED DEFINITION, whatever tag it uses ───────────────────────────── */
const bodyOf = (text) => {
  const m = text.match(/\$([A-Za-z_]*)\$([\s\S]*?)\$\1\$/);
  return m ? m[2] : null;
};
/* Only differences that are CERTAINLY not behaviour are normalised away. */
const norm = (b) => String(b || "")
  .replace(/--[^\n]*/g, " ")            // line comments
  .replace(/\/\*[\s\S]*?\*\//g, " ")    // block comments
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

let live;
try {
  live = q(`select p.proname, pg_get_functiondef(p.oid) as d, pg_get_function_identity_arguments(p.oid) as args
              from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.prokind='f' order by p.proname`);
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

const migs = readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()
  .map((f) => ({ f, text: readFileSync(join(ROOT, "supabase/migrations", f), "utf8") }));

const mismatched = [], noProvenance = [], matched = [];
for (const fn of live) {
  const rx = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${fn.proname}\\s*\\(`, "i");
  const defining = migs.filter((m) => rx.test(m.text));
  if (!defining.length) { noProvenance.push(fn.proname); continue; }
  const last = defining[defining.length - 1];
  // The statement in that file, from its `create … function <name>(` to the end of its dollar-quoted body.
  const at = last.text.search(rx);
  const stmt = last.text.slice(at);
  const migBody = bodyOf(stmt), liveBody = bodyOf(fn.d);
  if (!migBody || !liveBody) { mismatched.push({ fn: fn.proname, file: last.f, why: "could not extract a dollar-quoted body from one side" }); continue; }
  if (norm(migBody) === norm(liveBody)) { matched.push({ fn: fn.proname, file: last.f, defs: defining.length }); continue; }
  mismatched.push({ fn: fn.proname, file: last.f, defs: defining.length,
    why: `body differs (live ${norm(liveBody).length} chars vs migration ${norm(migBody).length}, comments and whitespace already normalised away)` });
}

console.log(`${live.length} public function(s) live · ${migs.length} migration file(s) searched\n`);

declareBreak({
  leg: "every public function's live body matches the last migration that defines it",
  // THE ONLY SAFE BREAK FOR THIS CHECK IS A NO-OP BODY CHANGE, and it has to be one. A break that
  // altered behaviour would be a real defect deployed to production for the length of a check run,
  // against a function ten market businesses are served by. Adding a COMMENT inside the body changes
  // the text (so this check sees a divergence) and changes nothing the function does — and because
  // `norm()` strips comments, an ordinary comment would NOT be seen. So the break adds a comment AND a
  // redundant `|| '{}'::jsonb` no-op, which survives normalisation while altering no result.
  //
  // Both statements are generated from the migration body rather than retyped, so the restore cannot
  // drift from what shipped, and both are `create or replace function` only — the runner refuses a db
  // break that could write a row.
  why: "add a behaviour-neutral expression to get_public_business's live body so it no longer matches " +
       "its migration — a stand-in for a dashboard edit, which is the thing this check exists to catch",
  sql: "create or replace function public.get_public_business(p_slug text)\nreturns jsonb\nlanguage sql\nstable\nsecurity definer\nset search_path = public\nas $fn$\n  select jsonb_build_object(\n           'about', b.about,\n           'account_kind', b.account_kind,\n           'banner_url', b.banner_url,\n           'bg_color', b.bg_color,\n           'brand_color', b.brand_color,\n           'buffer_after_min', b.buffer_after_min,\n           'buffer_before_min', b.buffer_before_min,\n           'capabilities', b.capabilities,\n           'city', b.city,\n           'deposit_message', b.deposit_message,\n           'email', b.email,\n           'fb_url', b.fb_url,\n           'gen_hero_headline', b.gen_hero_headline,\n           'google_url', b.google_url,\n           'id', b.id,\n           'ig_handle', b.ig_handle,\n           'logo_url', b.logo_url,\n           'name', b.name,\n           'payment_setting', b.payment_setting,\n           'phone', b.phone,\n           'section_order', b.section_order,\n           'service_area_cities', b.service_area_cities,\n           'slug', b.slug,\n           'state', b.state,\n           'tagline', b.tagline,\n           'tier', b.tier,\n           'tiktok_handle', b.tiktok_handle,\n           'timezone', b.timezone\n         )\n         || jsonb_build_object('meta',\n              case when b.meta is null then null\n                   else (select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)\n                           from jsonb_each(b.meta::jsonb) as e(k, v)\n                          where e.k in (\n                                'bannerUrl', 'bkBannerColor', 'bkBannerUrl', 'bkBgColor', 'bkLogoUrl',\n                                'bookingMode', 'bookingWizard', 'bookingWizardDone', 'businessProfile', 'businessSpecialties',\n                                'businessSpecialty', 'businessStage', 'businessType', 'ctaText', 'depositCollect',\n                                'depositMessage', 'depositType', 'depositUnit', 'depositVal', 'dirtySurcharge',\n                                'editorAddons', 'editorSvcs', 'experienceHome', 'font', 'galleryPairs',\n                                'gradientKey', 'headerMode', 'hero', 'hours', 'logoScale',\n                                'logoUrl', 'm2Experience', 'onboardingPriority', 'onboardingPriorityLabel', 'ownerUploadedMedia',\n                                'paymentSetting', 'portfolioUrls', 'pricingVisibility', 'profileBgColor', 'promoCodes',\n                                'quoteConfig', 'reviewEmbedCode', 'serviceAreaRadiusMiles', 'serviceAreaStates', 'service_catalog',\n                                'services', 'servicesDraft', 'servicesMode', 'storeOs', 'storefront',\n                                'storefrontDraft', 'studioOs', 'travelsToCustomers', 'useBkBranding', 'website',\n                                'workLove'\n                                ))\n              end)\n         || '{}'::jsonb\n    from public.businesses b\n   where b.slug = p_slug\n     and b.owner_id is not null   -- a public address requires an owner\n   limit 1;\n$fn$;",
  restore: "create or replace function public.get_public_business(p_slug text)\nreturns jsonb\nlanguage sql\nstable\nsecurity definer\nset search_path = public\nas $fn$\n  select jsonb_build_object(\n           'about', b.about,\n           'account_kind', b.account_kind,\n           'banner_url', b.banner_url,\n           'bg_color', b.bg_color,\n           'brand_color', b.brand_color,\n           'buffer_after_min', b.buffer_after_min,\n           'buffer_before_min', b.buffer_before_min,\n           'capabilities', b.capabilities,\n           'city', b.city,\n           'deposit_message', b.deposit_message,\n           'email', b.email,\n           'fb_url', b.fb_url,\n           'gen_hero_headline', b.gen_hero_headline,\n           'google_url', b.google_url,\n           'id', b.id,\n           'ig_handle', b.ig_handle,\n           'logo_url', b.logo_url,\n           'name', b.name,\n           'payment_setting', b.payment_setting,\n           'phone', b.phone,\n           'section_order', b.section_order,\n           'service_area_cities', b.service_area_cities,\n           'slug', b.slug,\n           'state', b.state,\n           'tagline', b.tagline,\n           'tier', b.tier,\n           'tiktok_handle', b.tiktok_handle,\n           'timezone', b.timezone\n         )\n         || jsonb_build_object('meta',\n              case when b.meta is null then null\n                   else (select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)\n                           from jsonb_each(b.meta::jsonb) as e(k, v)\n                          where e.k in (\n                                'bannerUrl', 'bkBannerColor', 'bkBannerUrl', 'bkBgColor', 'bkLogoUrl',\n                                'bookingMode', 'bookingWizard', 'bookingWizardDone', 'businessProfile', 'businessSpecialties',\n                                'businessSpecialty', 'businessStage', 'businessType', 'ctaText', 'depositCollect',\n                                'depositMessage', 'depositType', 'depositUnit', 'depositVal', 'dirtySurcharge',\n                                'editorAddons', 'editorSvcs', 'experienceHome', 'font', 'galleryPairs',\n                                'gradientKey', 'headerMode', 'hero', 'hours', 'logoScale',\n                                'logoUrl', 'm2Experience', 'onboardingPriority', 'onboardingPriorityLabel', 'ownerUploadedMedia',\n                                'paymentSetting', 'portfolioUrls', 'pricingVisibility', 'profileBgColor', 'promoCodes',\n                                'quoteConfig', 'reviewEmbedCode', 'serviceAreaRadiusMiles', 'serviceAreaStates', 'service_catalog',\n                                'services', 'servicesDraft', 'servicesMode', 'storeOs', 'storefront',\n                                'storefrontDraft', 'studioOs', 'travelsToCustomers', 'useBkBranding', 'website',\n                                'workLove'\n                                ))\n              end)\n    from public.businesses b\n   where b.slug = p_slug\n     and b.owner_id is not null   -- a public address requires an owner\n   limit 1;\n$fn$;",
});

leg("RULE", "every public function's live body matches the last migration that defines it",
  live.length > 0 && matched.length > 0 && mismatched.length === 0,
  `${live.length} live function(s) · ${matched.length} matched their last defining migration · ` +
  `${mismatched.length} differ · ${noProvenance.length} have NO defining migration at all. The matched ` +
  `count is part of the assertion: "nothing differs" is trivially true if nothing was compared` +
  (mismatched.length ? `.\n        DIVERGENT — the repo does not describe production for these:\n` +
    mismatched.map((m) => `          ${m.fn}  (last defined in ${m.file}${m.defs > 1 ? `, ${m.defs} migrations define it` : ""})\n              ${m.why}`).join("\n") : ""));

leg("SHAPE", "every live function has a migration that defines it",
  live.length > 0 && noProvenance.length === 0,
  `${noProvenance.length} live function(s) are defined by NO migration in the repo` +
  (noProvenance.length ? `: ${noProvenance.join(", ")}` : "") +
  `. [SHAPE]: this is an absence of PROVENANCE, not a mismatch — the two are reported separately ` +
  `because conflating them would hide both. A function with no migration cannot be compared to one, ` +
  `so it is not evidence either way about dashboard edits.`);

const bad = legs.filter((l) => !l.pass);
console.log(`\n${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
