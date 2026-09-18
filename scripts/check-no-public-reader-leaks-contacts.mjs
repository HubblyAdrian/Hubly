#!/usr/bin/env node
/**
 * [RULE] AN ANON-READABLE READER MAY NOT RETURN A THIRD PARTY'S CONTACT DETAILS.
 *
 *   node scripts/check-no-public-reader-leaks-contacts.mjs
 *
 * ══ STATE WHAT WOULD MAKE THIS WRONG, BEFORE THE NUMBER ═════════════════════════════════════
 *
 * This check reports that a public reader exposes people's names, phone numbers and email addresses.
 * That is the kind of finding that gets acted on immediately, so the things that would make it wrong
 * come first:
 *
 *  1. IT HOLDS ONLY IF `anon` CAN ACTUALLY INVOKE THE FUNCTION. That is read from
 *     `has_function_privilege('anon', oid, 'EXECUTE')` and from the function body, which is
 *     conclusive about what the function RETURNS. **It is NOT an executed anon request**: making one
 *     needs the anon key, and a key may never reach a command line. So the last link — an actual
 *     unauthenticated HTTP call returning those bytes — is UNVERIFIED here and is Adrian's to close.
 *  2. IT HOLDS ONLY FOR A CLAIMED BUSINESS. `get_public_business` requires `owner_id is not null`, so
 *     an unclaimed draft returns nothing whatever its meta holds.
 *  3. THE RECORDS MUST BE REAL PEOPLE. A row is not evidence of a person. This check counts records
 *     and says which business they belong to; whether each is a customer, a family member or a test
 *     entry is not something it can determine, and it does not claim to.
 *  4. SOME OF `meta` IS MEANT TO BE PUBLIC — the classic page renders from it. The finding is about
 *     ONE SUBTREE inside a column that is otherwise legitimately served.
 *
 * ══ WHAT IT CHECKS ══════════════════════════════════════════════════════════════════════════
 *
 * `get_public_business` is `select to_jsonb(b) - 'draft_token' from businesses b` — the WHOLE ROW,
 * EXECUTE granted to anon. Anything anyone ever puts in any column of `businesses` is therefore
 * public, including columns added later for something else entirely. `meta.pipeline.manual` is a lead
 * list, and it is inside that row.
 *
 * A CONTACT RECORD COLLECTION IS DETECTED BY SHAPE, never by key name: an array of objects each
 * carrying a name plus a phone or an email. A key-name list would be a hand-maintained set and would
 * miss the next one, which is how this went unnoticed in the first place.
 *
 * NO VALUE IS EVER PRINTED. Counts, paths and slugs only — a check that leaks the details it is
 * complaining about has made the problem worse, and a transcript is a place data goes to stay.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { declareBreak, ROOT } from "./lib/redproof.mjs";

const q = (sql) => {
  const out = execFileSync("supabase", ["db", "query", "--linked", sql],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 1024 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
};
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* ── WHICH READERS ARE PUBLIC, AND WHICH RETURN A WHOLE ROW ─────────────────────────────────── */
let fns;
try {
  fns = q(`select p.proname,
                  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
                  pg_get_functiondef(p.oid) as def
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'get\\_public%'`);
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

const anonReaders = fns.filter((f) => f.anon_exec);
const wholeRow = anonReaders.filter((f) => /to_jsonb\s*\(\s*[a-z_]+\s*\)/i.test(String(f.def)));
// EVERY anon reader is CALLED, not only the whole-row ones: after the allowlist landed,
// get_public_business no longer matches `to_jsonb(b)` — and a check that only examined whole-row
// readers would have gone green by losing its subject rather than by the leak being closed.
const wholeRowOrNot = anonReaders.filter((f) => /\(p_slug text\)/.test(String(f.def)));
console.log(`${fns.length} get_public_* reader(s) · ${anonReaders.length} EXECUTE-granted to anon · ` +
  `${wholeRow.length} return a WHOLE ROW\n`);

declareBreak({
  leg: "every anon reader hands back an explicit field list",
  // THE BREAK IS THE REGRESSION BEING GUARDED AGAINST, which is what Adrian asked for: not a planted
  // row, but the allowlist reverting to `to_jsonb(b)`. A green check nobody can break is where this
  // whole round started, and the thing that would undo this fix is one careless `create or replace`.
  //
  // FUNCTION-ONLY, so redproof-run may apply it: `create or replace function` and nothing else. No
  // insert, update, delete or grant, in the break OR the restore — the runner checks both and refuses
  // anything that could write a row. graefs-autocare's records are never touched by either statement.
  why: "revert get_public_business to `to_jsonb(b) - 'draft_token'` — the whole-row shape — which is " +
       "exactly the regression this leg exists to catch",
  sql: "create or replace function public.get_public_business(p_slug text)\n" +
       "returns jsonb language sql stable security definer set search_path = public as $fn$\n" +
       "  select to_jsonb(b) - 'draft_token' from public.businesses b\n" +
       "   where b.slug = p_slug and b.owner_id is not null limit 1;\n$fn$;",
  // THE RESTORE IS THE MIGRATION'S OWN BODY, inlined by a generator rather than retyped, so the
  // restore and the shipped function cannot drift — a restore that differs from what is deployed
  // would leave the database subtly wrong after every red-proof run.
  restore: "create or replace function public.get_public_business(p_slug text)\nreturns jsonb\nlanguage sql\nstable\nsecurity definer\nset search_path = public\nas $fn$\n  select jsonb_build_object(\n           'about', b.about,\n           'banner_url', b.banner_url,\n           'bg_color', b.bg_color,\n           'brand_color', b.brand_color,\n           'buffer_after_min', b.buffer_after_min,\n           'buffer_before_min', b.buffer_before_min,\n           'capabilities', b.capabilities,\n           'city', b.city,\n           'deposit_message', b.deposit_message,\n           'email', b.email,\n           'gen_hero_headline', b.gen_hero_headline,\n           'id', b.id,\n           'logo_url', b.logo_url,\n           'name', b.name,\n           'owner_id', b.owner_id,\n           'payment_setting', b.payment_setting,\n           'phone', b.phone,\n           'service_area_cities', b.service_area_cities,\n           'slug', b.slug,\n           'state', b.state,\n           'tagline', b.tagline,\n           'tier', b.tier,\n           'timezone', b.timezone\n         )\n         || jsonb_build_object('meta',\n              case when b.meta is null then null\n                   else (select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)\n                           from jsonb_each(b.meta::jsonb) as e(k, v)\n                          where e.k in (\n                                'bannerUrl', 'bkBannerColor', 'bkBannerUrl', 'bkBgColor', 'bkLogoUrl',\n                                'bookingMode', 'bookingWizard', 'bookingWizardDone', 'businessProfile', 'businessSpecialties',\n                                'businessSpecialty', 'businessStage', 'businessType', 'ctaText', 'depositCollect',\n                                'depositMessage', 'depositType', 'depositUnit', 'depositVal', 'dirtySurcharge',\n                                'editorAddons', 'editorSvcs', 'experienceHome', 'font', 'galleryPairs',\n                                'gradientKey', 'headerMode', 'hero', 'hours', 'logoScale',\n                                'logoUrl', 'm2Experience', 'onboardingPriority', 'onboardingPriorityLabel', 'ownerUploadedMedia',\n                                'paymentSetting', 'portfolioUrls', 'pricingVisibility', 'profileBgColor', 'promoCodes',\n                                'quoteConfig', 'reviewEmbedCode', 'serviceAreaRadiusMiles', 'serviceAreaStates', 'service_catalog',\n                                'services', 'servicesDraft', 'servicesMode', 'storeOs', 'storefront',\n                                'storefrontDraft', 'studioOs', 'travelsToCustomers', 'useBkBranding', 'website',\n                                'workLove'\n                                ))\n              end)\n    from public.businesses b\n   where b.slug = p_slug\n     and b.owner_id is not null   -- a public address requires an owner\n   limit 1;\n$fn$;",
});

/* ── THE DATA, BY SHAPE, WITHOUT PRINTING ANY OF IT ─────────────────────────────────────────── */
const isContactRecords = (v) =>
  Array.isArray(v) && v.length > 0 &&
  v.every((e) => e && typeof e === "object" && !Array.isArray(e) &&
    typeof e.name === "string" && (typeof e.phone === "string" || typeof e.email === "string"));

/* ══ IT MUST WALK WHAT THE FUNCTION RETURNS, NOT WHAT THE COLUMN HOLDS ═══════════════════════════
 *
 * TWO WRONG VERSIONS OF THIS CHECK, BOTH SILENT:
 *
 *  1. It filtered candidate columns by `data_type in ('jsonb','json')`. **`businesses.meta` is TEXT.**
 *     So it selected no columns, read no rows, and reported "0 collections reachable" — while its own
 *     detail line said "1 whole-row anon reader examined", which was true and measured the wrong
 *     thing. Its positive clause counted READERS, not DATA.
 *  2. Fixed, it then read the COLUMN — so it stayed red after the allowlist shipped, and the declared
 *     break could not move it. A leg that says "no reader RETURNS X" while inspecting the table is
 *     measuring the wrong side of the function: it can neither be fixed by fixing the function nor
 *     broken by breaking it, which makes it unfalsifiable in the direction that matters.
 *
 * So it CALLS the reader, per claimed business, and walks the result. That is the only measurement the
 * leg's own words describe, and it is the one the break can move. */
let colsExamined = 0, rowsExamined = 0;
const findings = [];
for (const f of wholeRowOrNot) {
  // ONE QUERY PER READER, not one per business. The first version issued 41 x 4 round trips and had to
  // be killed at two minutes — the same mistake as the orphan sweep's per-table `git log`, and the same
  // fix: ask the database once.
  let rows2;
  try { rows2 = q(`select b.slug, b.account_kind, public.${f.proname}(b.slug)::text as j
                     from businesses b where b.owner_id is not null order by b.slug`); }
  catch (_) { continue; }
  for (const r of rows2) {
    const out = r.j;
    if (!out) continue;
    let o; try { o = JSON.parse(out); } catch (_) { continue; }
    if (!o || typeof o !== "object") continue;
    rowsExamined++;
    const walk = (v, path) => {
      // A nested JSON STRING is still returned to the caller, so it is walked too — `meta` is a TEXT
      // column and the old whole-row shape handed it back as a string.
      if (typeof v === "string" && /^\s*[{[]/.test(v)) {
        let inner; try { inner = JSON.parse(v); } catch (_) { return; }
        return walk(inner, path + "(parsed)");
      }
      if (isContactRecords(v)) {
        findings.push({ fn: f.proname, path, slug: r.slug, kind: r.account_kind, n: v.length,
                        fields: [...new Set(v.flatMap((e) => Object.keys(e)))].sort() });
        return;
      }
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === "object") { colsExamined++; Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`)); }
    };
    walk(o, f.proname + "()");
  }
}

/* ══ TWO LEGS BECAME ONE, AND THE FIX IS WHAT SHOWED IT ══════════════════════════════════════════
 *
 * This file had a second leg asserting "the whole-row readers are NAMED, so the blast radius is
 * knowable" — `wholeRow.length > 0`. It was true while a whole-row reader existed, and the moment the
 * allowlist shipped it went red **because its subject had ceased to exist**, which is a leg measuring
 * the shape of the problem rather than the rule underneath it (Lesson 92).
 *
 * The rule underneath is one sentence: **an anon reader hands back an explicit field list, and nothing
 * that comes back is a collection of contact records.** Both halves fail together under one break —
 * reverting to `to_jsonb(b)` — so they are one claim, exactly as navigation legs 3 and 3b were, and
 * splitting them would mean neither half could be red-proofed alone. */
leg("RULE", "every anon reader hands back an explicit field list, and no contact records come back",
  wholeRowOrNot.length > 0 && rowsExamined > 0 && colsExamined > 0 &&
  wholeRow.length === 0 && findings.length === 0,
  `${wholeRowOrNot.length} anon reader(s) CALLED · ${rowsExamined} returned document(s) and ` +
  `${colsExamined} nested object(s) WALKED · ${wholeRow.length} still using to_jsonb(whole row) · ` +
  `${findings.length} contact-record collection(s) came back. The counts are half the assertion: the ` +
  `first version of this leg counted READERS, read no data at all, and passed; the second read the ` +
  `COLUMN instead of the function's return, so it could be moved neither by the fix nor by the break` +
  (findings.length ? ":\n" + findings.map((x) =>
    `          ${x.fn} -> ${x.path}  ·  ${x.slug} [${x.kind}]  ·  ${x.n} record(s) ` +
    `carrying ${x.fields.join(", ")}`).join("\n") : ""));

const bad = legs.filter((l) => !l.pass);
console.log(`\n${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
if (bad.length) {
  console.log(`\nNO VALUES WERE PRINTED. Counts, paths and field NAMES only.`);
  console.log(`UNVERIFIED, AND IT IS ADRIAN'S TO CLOSE: an actual unauthenticated HTTP call. This is`);
  console.log(`established from the EXECUTE grant and the function body, not from a request made with`);
  console.log(`an anon key — a key may never reach a command line.`);
}
process.exit(bad.length ? 1 : 0);
