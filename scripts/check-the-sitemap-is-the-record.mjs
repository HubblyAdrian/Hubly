#!/usr/bin/env node
/**
 * [RULE] THE SITEMAP IS EXACTLY THE CLAIMED, NON-TEST BUSINESSES — AND IS ACTUALLY SERVED AS XML.
 *
 *   node scripts/check-the-sitemap-is-the-record.mjs
 *
 * ══ WHY ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Adrian established in Search Console on 2026-09-18 that graefs-autocare.myhubly.app has NEVER
 * been fetched by Google — every crawl field N/A, "URL is unknown to Google" — while a Live Test on
 * the same URL renders his real site and says "Page can be indexed". Rendering was never the
 * problem. DISCOVERY was: no sitemap, no referring pages.
 *
 * Two distinct things can go wrong with the fix, and they fail in opposite directions:
 *
 *   TOO FEW   a claimed customer is missing, so Google is never told his page exists. Silent.
 *   TOO MANY  an unclaimed draft or a test account is submitted for indexing. Also silent, and
 *             worse — it publishes a page whose own <meta robots> says noindex, which is us
 *             telling Google two contradictory things about the same URL.
 *
 * ══ AND THE ROUTE IS HALF THE FEATURE ═══════════════════════════════════════════════════════
 *
 * Before this, /sitemap.xml returned HTTP 200 with 3,091,125 bytes of text/html — the catch-all
 * answering it. NOTHING 404'd. Perfect XML behind a missing route is worth nothing, so leg 3
 * asserts the route exists AND precedes the catch-all, by INDEX and not by presence: a route after
 * the catch-all is present and unreachable.
 *
 * ══ WHAT IS COMPARED AGAINST WHAT ═══════════════════════════════════════════════════════════
 *
 * The generator derives membership from `get_public_business()`'s own output (so the sitemap and the
 * page cannot disagree). This check deliberately derives the expected set from the **table** —
 * `owner_id is not null and account_kind <> 'test'` — so the two halves are independent. If they
 * ever diverge, that divergence is the finding, and a check that re-asked the same function would
 * be comparing it with itself.
 *
 * SCOPED, and the limits are real:
 *   · a sitemap makes a URL DISCOVERABLE. It does not make a page rank, and it creates no inbound
 *     links. No leg here claims otherwise.
 *   · leg 6 is the only leg about PRODUCTION, and no repo edit can move it; it carries its
 *     hand-proof rather than a declared break.
 *   · it does not assert Google fetched anything. That is Search Console's to report, and it needs
 *     a person (docs/OWNER_VERIFICATIONS.md).
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require_ = createRequire(import.meta.url);
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* ── THE EXPECTED SET, FROM THE TABLE ──────────────────────────────────────────────────────── */
let expected = null, expErr = null;
try {
  const out = execFileSync("supabase", ["db", "query", "--linked",
    "select coalesce(string_agg(slug, ',' order by slug), '') as slugs, count(*) as n from businesses " +
    // RULED BY ADRIAN 2026-09-18: internal accounts come out. Spelled here as the TABLE predicate
    // on purpose -- the generator derives from business_is_indexable(), and this half must stay an
    // independent statement of the same rule or the check is comparing the rule with itself.
    "where owner_id is not null and coalesce(account_kind,'') not in ('test','internal')"],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 90000 });
  const m = out.match(/"slugs":\s*"([^"]*)"/);
  if (m) expected = new Set(m[1].split(",").filter(Boolean));
} catch (e) { expErr = e.message.split("\n")[0]; }
if (!expected) { console.error("CANNOT RUN — could not read the expected set from the record: " + (expErr || "no rows")); process.exit(2); }

/* ── RUN THE REAL HANDLER, LOCALLY, AGAINST THE REAL RECORD ────────────────────────────────── */
const handler = require_(join(ROOT, "api", "sitemap.js"));
async function invoke(method = "GET") {
  let status = 0, body = "", headers = {};
  const res = { set statusCode(v) { status = v; }, get statusCode() { return status; },
    setHeader: (k, v) => { headers[k.toLowerCase()] = String(v); },
    end: (b) => { body = b == null ? "" : String(b); return res; } };
  await handler({ method, headers: {} }, res);
  return { status, body, headers };
}
let local;
try { local = await invoke(); }
catch (e) { console.error("CANNOT RUN — the handler threw: " + e.message); process.exit(2); }
const locs = [...local.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
const slugOf = (u) => { const m = u.match(/^https:\/\/([^.]+)\.myhubly\.app\/$/); return m ? m[1] : null; };
const got = new Set(locs.map(slugOf).filter(Boolean));
console.log(`  expected from the TABLE: ${expected.size}   ·   the handler generated: ${locs.length} <loc> (${got.size} parsed as slugs)`);
console.log(`  status ${local.status} · ${local.headers["content-type"]} · count header ${local.headers["x-hubly-sitemap-count"]}\n`);

/* ── LEG 1 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 every claimed market business is in the sitemap",
  why: "lose one business on the way from the record to the XML. Nothing errors and the sitemap " +
       "still looks exactly like a sitemap; it is quietly shorter by one, and the customer it drops " +
       "is never submitted to Google. THE BREAK IS AIMED AT api/sitemap.js AND NOT AT THE MIGRATION " +
       "ON PURPOSE: the first version of this declaration edited the SQL file and came back NOT RED, " +
       "because this check reads the LIVE function and a file on disk is not the database. A break " +
       "must land on code the check actually RUNS (Lesson 100, pointed at a red-proof).",
  file: "api/sitemap.js",
  find: "  const urls = rows.map((row) => {",
  with: "  const urls = rows.slice(1).map((row) => {",
});
const missing = [...expected].filter((s) => !got.has(s)).sort();
leg("RULE", "1 every claimed market business is in the sitemap",
  missing.length === 0 && expected.size > 0,
  missing.length ? `MISSING from the sitemap: ${missing.join(" ")} — Google is never told these exist`
    : `all ${expected.size} claimed market business(es) are present. The count is part of the claim, ` +
      `because "every one is present" is trivially true of none.`);

/* ── LEG 2 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 nothing else is in the sitemap — no unclaimed draft, no test, no internal",
  why: "put a URL in the sitemap that the record does not contain — the shape of submitting an " +
       "unclaimed draft. Every unclaimed page stamps its own <meta robots> noindex, so this is us " +
       "telling Google two contradictory things about one URL, and publishing the existence of a " +
       "draft nobody claimed. Aimed at api/sitemap.js for the same reason as leg 1.",
  file: "api/sitemap.js",
  find: "  const urls = rows.map((row) => {",
  with: "  const urls = rows.concat([{ slug: 'zz-not-in-the-record' }]).map((row) => {",
});
const extra = [...got].filter((s) => !expected.has(s)).sort();
leg("RULE", "2 nothing else is in the sitemap — no unclaimed draft, no test, no internal",
  extra.length === 0,
  extra.length ? `PRESENT but should not be: ${extra.join(" ")}`
    : `0 extras. Checked as a set difference against the table, so this covers unclaimed drafts, test AND internal accounts together rather than testing for the two shapes I happened to think of.`);

/* ── LEG 3 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 /sitemap.xml has a route, and it precedes the catch-all",
  why: "move the route AFTER the catch-all. It is still present, still correct, and completely " +
       "unreachable — /sitemap.xml goes back to answering with 3MB of hubly.html and a 200, which " +
       "is the state this whole change exists to end. Presence is not reachability.",
  file: "vercel.json",
  find: '    {\n      "src": "/sitemap.xml$",\n      "dest": "/api/sitemap.js"\n    },\n    {\n      "src": "/(.*)",\n      "dest": "/api/router.js"\n    }',
  with: '    {\n      "src": "/(.*)",\n      "dest": "/api/router.js"\n    },\n    {\n      "src": "/sitemap.xml$",\n      "dest": "/api/sitemap.js"\n    }',
});
const routes = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")).routes || [];
const iSite = routes.findIndex((r) => /sitemap\.xml/.test(r.src || ""));
const iCatch = routes.findIndex((r) => (r.src || "") === "/(.*)");
leg("RULE", "3 /sitemap.xml has a route, and it precedes the catch-all",
  iSite >= 0 && iCatch >= 0 && iSite < iCatch,
  iSite < 0 ? `no route matches /sitemap.xml — the catch-all will answer it with hubly.html and a 200`
    : iSite > iCatch ? `the route is at index ${iSite}, AFTER the catch-all at ${iCatch} — present and unreachable`
    : `route at index ${iSite}, catch-all at ${iCatch}. Asserted by INDEX, not by presence, because a ` +
      `route after the catch-all exists and never runs — and its failure is a 200, not an error.`);

/* ── LEG 4 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "4 robots.txt names the sitemap",
  why: "remove the Sitemap: line. The sitemap still serves perfectly and nothing references it, so " +
       "Google only finds it if someone submits it by hand — and this file is served on every " +
       "business subdomain, so the line is also the cross-submission that lets one sitemap carry " +
       "URLs across all those hosts.",
  file: "public/robots.txt",
  find: "Sitemap: https://myhubly.app/sitemap.xml",
  with: "# (no sitemap)",
});
const robots = readFileSync(join(ROOT, "public", "robots.txt"), "utf8");
const smLines = robots.split("\n").filter((l) => /^\s*sitemap\s*:/i.test(l));
leg("RULE", "4 robots.txt names the sitemap",
  smLines.length === 1 && /https:\/\/myhubly\.app\/sitemap\.xml/.test(smLines[0]),
  smLines.length === 0 ? `no Sitemap: line in public/robots.txt`
    : `${smLines.length} Sitemap: line — ${JSON.stringify(smLines[0].trim())}. One file serves the apex ` +
      `and every business subdomain, so this single line is the cross-submission for all of them.`);

/* ── LEG 5 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "5 a FAILED read serves no sitemap, never an empty one",
  why: "answer a failed read with a valid empty <urlset> and a 200 — the shape every empty-reader " +
       "defect takes. It would be a confident 'there are no business pages' composed out of our own " +
       "outage, aimed at Google instead of at an owner, and it would deindex every customer.",
  file: "api/sitemap.js",
  find: "    res.statusCode = 503;\n    res.setHeader('Content-Type', 'text/plain; charset=utf-8');\n    res.setHeader('Cache-Control', 'no-store');\n    return res.end('sitemap unavailable: could not read the business record\\n');",
  with: "    res.statusCode = 200;\n    res.setHeader('Content-Type', 'application/xml; charset=utf-8');\n    return res.end('<?xml version=\"1.0\" encoding=\"UTF-8\"?>\\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\\n</urlset>\\n');",
});
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("simulated outage"); };
let onFail;
try { onFail = await invoke(); } finally { globalThis.fetch = realFetch; }
leg("RULE", "5 a FAILED read serves no sitemap, never an empty one",
  onFail.status >= 500 && !/<urlset/.test(onFail.body),
  `with the read forced to throw: status ${onFail.status}, body ${JSON.stringify(onFail.body.slice(0, 60))}. ` +
  `Both halves asserted — a 5xx AND no <urlset> — because a 200 carrying an empty urlset and a 503 ` +
  `carrying one are different bugs and only one of them is caught by a status check.`);

/* ── LEG 6 — the only leg about PRODUCTION ─────────────────────────────────────────────────── */
declareBreak({
  leg: "6 [SHAPE] the SERVED bytes are this XML, not the catch-all's HTML",
  why: "NO REPO EDIT CAN MOVE THIS LEG — it reads what production serves, and production does not " +
       "change until a git push. PROVEN BY HAND on 2026-09-18 instead, and the proof is that it was " +
       "observed RED and then GREEN across one deploy: before the push /sitemap.xml returned " +
       "http=200 size=3091125 type=text/html (the catch-all), and the first fetch AFTER the push " +
       "still returned exactly that, then the next returned http=200 size=1498 " +
       "type=application/xml with 13 <loc> and x-hubly-sitemap-count: 13. That transition is the " +
       "assertion failing and passing for the reason it claims to catch.",
  provenBy: "Observed RED then GREEN across one deploy on 2026-09-18: before the push /sitemap.xml " +
            "returned http=200 size=3091125 type=text/html (the catch-all serving hubly.html); the " +
            "first fetch after the push returned exactly that again, and the next returned http=200 " +
            "size=1498 type=application/xml with 13 <loc> and x-hubly-sitemap-count: 13.",
});
let served = null, servedErr = null;
try {
  served = execFileSync("curl", ["-sL", "--max-time", "30", "https://myhubly.app/sitemap.xml",
    "-w", "\\n%{http_code} %{content_type}"], { encoding: "utf8", timeout: 45000 });
} catch (e) { servedErr = e.message.split("\n")[0]; }
const sLocs = served ? [...served.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]) : [];
const sTail = served ? served.trim().split("\n").pop() : "";
// SCOPED TO THE ROUTE, NOT TO MEMBERSHIP. It used to also compare the served count against the
// locally generated one, which made every break aimed at the generator fire this leg too — a
// COMPOUND that proves nothing about either (L98). Membership is legs 1 and 2's claim.
leg("SHAPE", "6 [SHAPE] the SERVED bytes are this XML, not the catch-all's HTML",
  !!served && /application\/xml/.test(sTail) && !/<!DOCTYPE/i.test(served) && sLocs.length > 0,
  !served ? `could not fetch: ${servedErr}`
    : `served: ${sTail.trim()} · ${sLocs.length} <loc> · no <!DOCTYPE present. The DOCTYPE test is ` +
      `there because the failure mode is a 200 full of HTML, which a status check calls success. ` +
      `This leg says nothing about WHICH businesses are listed — that is legs 1 and 2.`);

/* ── LEG 7 — ADRIAN'S RULING, ASSERTED AGAINST THE LIVE PREDICATE ─────────────────────────── */
declareBreak({
  leg: "7 no internal business is indexable",
  provenBy: "NO REPO EDIT CAN MOVE THIS LEG — it reads the live predicate, and production does not " +
            "change until a migration is applied. Proven by the transition on 2026-09-18: BEFORE " +
            "20260918200000 the sitemap carried 13 URLs including cotter-aviation, lugnutz and " +
            "my-auto-detailing (all account_kind='internal'), and get_public_business('cotter-" +
            "aviation')->>'is_indexable' did not exist. AFTER: 10 URLs, none of the three present, " +
            "and that key reads 'false' for cotter-aviation while graefs-autocare reads 'true'. Leg " +
            "8 is the automated half — it fails if the repo and production disagree about the rule.",
});
let internals = null, intErr = null;
try {
  const out = execFileSync("supabase", ["db", "query", "--linked",
    "select coalesce(string_agg(slug || '=' || coalesce((public.get_public_business(slug)->>'is_indexable'),'absent'), ',' order by slug), '') as v " +
    "from businesses where owner_id is not null and account_kind = 'internal'"],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 90000 });
  const m = out.match(/"v":\s*"([^"]*)"/);
  if (m) internals = m[1].split(",").filter(Boolean);
} catch (e) { intErr = e.message.split("\n")[0]; }
const intBad = (internals || []).filter((x) => !/=false$/.test(x));
leg("RULE", "7 no internal business is indexable",
  Array.isArray(internals) && internals.length > 0 && intBad.length === 0 &&
    ![...got].some((sl) => internals.some((x) => x.startsWith(sl + "="))),
  internals === null ? `could not read the live predicate: ${intErr}`
    : internals.length === 0 ? `NO claimed internal business exists to test against — this leg is ` +
      `VACUOUS as written and must not be read as a pass; the ruling is untested until one exists`
    : intBad.length ? `internal business(es) still indexable: ${intBad.join(" ")}`
    : `${internals.length} claimed internal business(es), every one is_indexable=false, and none ` +
      `appears in the generated sitemap. The count is part of the claim: "none of them is indexable" ` +
      `is trivially true of none, which is why zero is reported as VACUOUS rather than as a pass.`);

/* ── LEG 8 — the predicate in the repo IS the predicate in production ──────────────────────── */
declareBreak({
  leg: "8 the live predicate is the one the shipping migration declares",
  why: "loosen the migration's predicate to exclude only 'test' — the state before Adrian's ruling. " +
       "Production still excludes internal, so the repo now DESCRIBES a rule production does not " +
       "apply. That divergence is invisible from either side alone, and it is the automated half of " +
       "leg 7: leg 7 reads production, this reads whether the repo still means it.",
  file: "supabase/migrations/20260918200000_one_indexable_predicate.sql",
  find: "     and coalesce(p_kind, '') not in ('test', 'internal')",
  with: "     and coalesce(p_kind, '') not in ('test')",
});
const norm = (t) => String(t).replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").replace(/[()'"]/g, "").toLowerCase().trim();
let liveDef = null, defErr = null;
try {
  const out = execFileSync("supabase", ["db", "query", "--linked",
    "select replace(pg_get_functiondef('public.business_is_indexable(uuid,text)'::regprocedure), chr(10), ' ') as d"],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 90000 });
  const m = out.match(/"d":\s*"([^"]*)"/);
  if (m) liveDef = m[1];
} catch (e) { defErr = e.message.split("\n")[0]; }
const migSrc = readFileSync(join(ROOT, "supabase", "migrations", "20260918200000_one_indexable_predicate.sql"), "utf8");
// THE DOLLAR-QUOTE TAG IS NOT PRESERVED. The migration writes $p$ and Postgres hands it back as
// $function$ — so matching on the tag I wrote found the migration's body and NOT production's, and
// the leg failed with "could not extract" rather than with a mismatch. An instrument that cannot
// parse one of its two inputs must say which one, which is why that detail line named live=false.
const dollarBody = (t) => { const m = String(t || "").match(/\$([A-Za-z_]*)\$([\s\S]*?)\$\1\$/); return m ? m[2] : null; };
const migPred = dollarBody(migSrc.slice(migSrc.indexOf("business_is_indexable")));
const liveBody = dollarBody(liveDef);
leg("RULE", "8 the live predicate is the one the shipping migration declares",
  !!liveBody && !!migPred && norm(liveBody) === norm(migPred),
  !liveDef ? `could not read the live function: ${defErr} — reported as FAILURE, not skipped, ` +
             `because this leg is what makes leg 7 a claim about the repo's intent as well`
    : !liveBody || !migPred ? `could not extract a predicate body (live=${!!liveBody} migration=${!!migPred})`
    : `live and migration agree, comparing bodies with comments and whitespace normalised away: ` +
      `${JSON.stringify(norm(migPred).slice(0, 96))}`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
