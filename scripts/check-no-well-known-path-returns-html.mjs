#!/usr/bin/env node
/**
 * [RULE] NO PATH ANSWERS WITH A 200 OF THE SPA'S HTML. A 404 IS A FINE ANSWER; THAT NEVER IS.
 *
 *   node scripts/check-no-well-known-path-returns-html.mjs
 *
 * ══ THE MEASUREMENT THIS EXISTS FOR ══════════════════════════════════════════════════════════
 *
 * 2026-09-18, live: **20 of 22** well-known paths returned HTTP 200 with 3,092,140 bytes of
 * `text/html`. /favicon.ico, /manifest.json, /ads.txt, /security.txt, /.well-known/security.txt,
 * /.well-known/assetlinks.json, /rss.xml, /browserconfig.xml, /.env (!), and a random nonce path all
 * answered with hubly.html and a 200. Only /robots.txt and /sitemap.xml were right, and only because
 * vercel.json routes those two by name.
 *
 * This is the third appearance of one defect: /contact-pick.js (a script that deployed and served
 * HTML, so everything it defined was `undefined` in both shells), then /sitemap.xml (200 HTML where
 * a crawler asked for a sitemap), now everything else. Each was fixed for the one filename that had
 * bitten us.
 *
 * ══ THE PATH LIST IS DERIVED. A HAND-WRITTEN ONE IS THE DISEASE ══════════════════════════════
 *
 * Three sources, none of them a list I typed:
 *
 *   FROM THE PRODUCT   every root-level file that exists in public/ — each must serve ITSELF, with
 *                      its own content type. This is the /contact-pick.js class stated as a rule:
 *                      read the real inventory off disk (CLAUDE.md).
 *   FROM THE PRODUCT   every path vercel.json routes by name — each must reach its own destination.
 *   STRUCTURAL         a path that provably does not exist must 404. Generated with a random nonce
 *                      each run, so it cannot be special-cased into passing and cannot go stale.
 *
 * ══ AND ONE HALF HONESTLY CANNOT BE DERIVED — SAID, NOT HIDDEN ═══════════════════════════════
 *
 * Which paths a browser, crawler or scanner requests unprompted is defined OUTSIDE this codebase
 * (IANA's well-known URI registry; browsers fetch /favicon.ico whether or not we mention it). No
 * derivation from our source can produce it, and pretending otherwise would be the worse error. So
 * that half is a declared SAMPLE, labelled as a sample, and it is not what the check rests on: the
 * structural leg covers the whole class, and the sample only demonstrates it on paths real clients
 * actually request. If a new well-known path appears in 2027 the structural rule already covers it.
 *
 * SCOPED: this tests the apex host over the real network. It does not test every business subdomain
 * (same router, one deploy), and it asserts nothing about whether any crawler or scanner has asked.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = process.env.HUBLY_ORIGIN || "https://myhubly.app";
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/** One request. Returns status, content-type, and whether the body is an HTML document. */
function probe(path) {
  try {
    const out = execFileSync("curl", ["-s", "--max-time", "30", "-o", "-", "-w",
      "\\n__HUBLY__%{http_code}|%{content_type}|%{size_download}", ORIGIN + path],
      { encoding: "utf8", timeout: 45000, maxBuffer: 64 * 1024 * 1024 });
    const i = out.lastIndexOf("\n__HUBLY__");
    const body = i < 0 ? out : out.slice(0, i);
    const [code, ctype, size] = (i < 0 ? "0||0" : out.slice(i + 10)).split("|");
    return { code: Number(code), ctype: ctype || "", size: Number(size) || 0,
             isHtmlDoc: /^\s*(<!DOCTYPE html|<html)/i.test(body.slice(0, 400)) };
  } catch (e) { return { code: 0, ctype: "", size: 0, isHtmlDoc: false, err: e.message.split("\n")[0] }; }
}

/* ── DERIVED SET A: root-level files that exist in public/ ──────────────────────────────────── */
const PUB = join(ROOT, "public");
// EVERY root-level file, with its SIZE — which is how "did it serve ITSELF" gets answered without
// guessing. Nothing is excluded by name: the two shells are real files too, and the previous version
// of this leg excluded them and then judged the rest by "is the body HTML", which failed
// /enter.html and /portal.html for being HTML documents when that is exactly what they are.
const onDisk = readdirSync(PUB)
  .filter((f) => /\.[^.]+$/.test(f))
  .map((f) => { try { const st = statSync(join(PUB, f)); return st.isFile() ? { f, size: st.size } : null; } catch { return null; } })
  .filter(Boolean);

/* ── DERIVED SET B: paths vercel.json routes by name ────────────────────────────────────────── */
const routed = (JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")).routes || [])
  .map((r) => String(r.src || ""))
  .filter((src) => /^\/[A-Za-z0-9._-]+\$$/.test(src))     // a literal path, not a pattern
  .map((src) => src.slice(0, -1));

/* ── STRUCTURAL: a path that cannot exist ───────────────────────────────────────────────────── */
const nonce = `/hubly-check-${Math.random().toString(36).slice(2, 10)}-${Date.now()}.txt`;

/* ── DECLARED SAMPLE: what real clients request, from outside this codebase ─────────────────── */
const SAMPLE = ["/favicon.ico", "/apple-touch-icon.png", "/manifest.json", "/manifest.webmanifest",
  "/ads.txt", "/app-ads.txt", "/security.txt", "/.well-known/security.txt",
  "/.well-known/assetlinks.json", "/.well-known/apple-app-site-association",
  "/.well-known/change-password", "/sitemap_index.xml", "/rss.xml", "/atom.xml",
  "/browserconfig.xml", "/crossdomain.xml", "/humans.txt", "/.env"];

console.log(`  origin ${ORIGIN}`);
console.log(`  derived from public/:   ${onDisk.length} root file(s)  [${onDisk.map((d) => d.f).join(" ")}]`);
console.log(`  derived from vercel.json: ${routed.length} literal route(s)  [${routed.join(" ")}]`);
console.log(`  structural nonce path:  ${nonce}`);
console.log(`  declared SAMPLE of client-requested paths: ${SAMPLE.length}\n`);

const results = new Map();
for (const p of [...new Set([...onDisk.map((d) => "/" + d.f), ...routed, nonce, ...SAMPLE])])
  results.set(p, probe(p));
for (const [p, r] of results)
  console.log(`  ${p.padEnd(44)} ${String(r.code).padEnd(4)} ${String(r.size).padEnd(9)} ${r.ctype}` +
    (r.isHtmlDoc ? "   <<< HTML DOCUMENT" : ""));
console.log();

const reachable = [...results.values()].filter((r) => r.code > 0).length;
if (!reachable) { console.error("CANNOT RUN — no path answered at all; the network or the origin is unreachable"); process.exit(2); }

/* ── LEG 1 — the structural claim, and the one that covers the whole class ─────────────────── */
declareBreak({
  leg: "1 a path that does not exist returns 404, never a 200 of HTML",
  why: "remove the not-real guard from the router, restoring the measured state: every file-shaped " +
       "path falls through to the SPA and answers 200 with 3MB of hubly.html. Nothing 404s, nothing " +
       "errors, every page still works, and every consumer that trusts a status code is lied to.",
  file: "api/router.js",
  find: "      if (!real) {\n        // text/plain, so nothing downstream can mistake the body for a document.\n        res.setHeader('Content-Type', 'text/plain; charset=utf-8');\n        return res.status(404).send('Not found\\n');\n      }",
  with: "      if (false) {}",
  provenBy: "The router change is not deployed by this runner — public/ and api/ go live only by git " +
            "push — so the break edits the repo while the probe reads production. PROVEN BY HAND " +
            "instead, and observed RED then GREEN across one deploy on 2026-09-18: before the push " +
            "20 of 22 sampled paths returned 200 + 3,092,140 bytes of text/html (/.env and a random " +
            "nonce among them); after it, each returns 404 text/plain and only /robots.txt and " +
            "/sitemap.xml return 200 with their own content types.",
});
const nr = results.get(nonce);
leg("RULE", "1 a path that does not exist returns 404, never a 200 of HTML",
  !!nr && nr.code === 404 && !nr.isHtmlDoc,
  `${nonce} -> ${nr ? nr.code : "no answer"} ${nr ? nr.ctype : ""}. The path is generated fresh each ` +
  `run, so it cannot be special-cased into passing and cannot go stale. This is the leg that covers ` +
  `the CLASS; the sample below only demonstrates it on paths real clients actually request.`);

/* ── LEG 2 — the declared sample ───────────────────────────────────────────────────────────── */
const sampleHtml = SAMPLE.filter((p) => { const r = results.get(p); return r && r.code === 200 && r.isHtmlDoc; });
leg("RULE", "2 no client-requested well-known path answers 200 with an HTML document",
  sampleHtml.length === 0,
  sampleHtml.length ? `${sampleHtml.length} of ${SAMPLE.length} return 200 HTML: ${sampleHtml.join(" ")}`
    : `0 of ${SAMPLE.length}. This list is a DECLARED SAMPLE, not a derivation — which paths a browser ` +
      `or scanner requests unprompted is defined outside this codebase (IANA's well-known registry; ` +
      `browsers fetch /favicon.ico regardless). Leg 1 is what covers a path nobody has thought of.`);

/* ── LEG 3 — the /contact-pick.js class: a real file must serve ITSELF ─────────────────────── */
declareBreak({
  leg: "3 every root file in public/ serves itself, not the SPA",
  why: "make the not-real test always fail, so a file that DOES exist is 404'd instead of served — " +
       "the opposite error from leg 1 and the one a fix for leg 1 would plausibly introduce. " +
       "/status-words.js and /contact-pick.js would stop loading and both shells would lose what " +
       "they define, silently, exactly as in the September 16 incident.",
  file: "api/router.js",
  find: "      const real =\n        filePath.startsWith(publicRoot + path.sep) &&",
  with: "      const real = false && (\n        filePath.startsWith(publicRoot + path.sep) &&",
  provenBy: "Same reason as leg 1 — the probe reads production and the break edits the repo. The " +
            "September 16 incident IS this leg observed red in the wild: /contact-pick.js deployed, " +
            "was answered with hubly.html, and HublyContactPick was undefined in both shells with " +
            "no error anywhere. It reads 200 application/javascript today.",
});
// ══ "SERVED ITSELF" IS A BYTE COUNT, NOT A CONTENT TYPE ══════════════════════════════════════
//
// Judging by "is the response HTML" cannot work: /enter.html and /portal.html ARE HTML and are
// supposed to be, while /marketplace-landing.html was ALSO HTML and was the wrong HTML — 3,092,140
// bytes of hubly.html instead of its own 16,238. The two cases are indistinguishable by type and
// obvious by size, so the assertion is size: what came back is what is on disk.
const selfBad = onDisk.filter((d) => {
  const r = results.get("/" + d.f);
  return !r || r.code !== 200 || r.size !== d.size;
});
leg("RULE", "3 every root file in public/ serves ITSELF, byte for byte",
  onDisk.length > 0 && selfBad.length === 0,
  onDisk.length === 0 ? `no root-level files found in public/ — VACUOUS, not a pass`
    : selfBad.length ? `not serving themselves: ` + selfBad.map((d) => {
        const r = results.get("/" + d.f) || {};
        return `/${d.f} (${r.code}, ${r.size} bytes served vs ${d.size} on disk)`; }).join(" ")
    : `all ${onDisk.length} root file(s) in public/ returned 200 with EXACTLY their on-disk byte ` +
      `count. Asserted by size, not by content type: the failure mode is the right type and the ` +
      `wrong document, which no type check can see. Derived by reading the directory, so a file ` +
      `added tomorrow is covered without editing this check — the lesson of /contact-pick.js.`);

/* ── LEG 4 — the literal routes in vercel.json reach their own destination ─────────────────── */
declareBreak({
  leg: "4 every literal route in vercel.json reaches its own destination",
  why: "point the robots.txt route at the SPA. It still 200s, it still looks fine in a browser, and " +
       "crawlers silently get an HTML document where rules were expected — which is the state " +
       "public/robots.txt's own header comment says it was created to end.",
  file: "vercel.json",
  find: '      "src": "/robots.txt$",\n      "dest": "/robots.txt"',
  with: '      "src": "/robots.txt$",\n      "dest": "/api/router.js"',
  provenBy: "Production-side, same as legs 1 and 3. Observed in the wild for /sitemap.xml earlier " +
            "today: with no route it returned 200 with 3,091,125 bytes of text/html, and after the " +
            "route landed, 200 application/xml with 13 <loc>. That is this leg red then green.",
});
const badRoute = routed.filter((p) => { const r = results.get(p); return !r || r.code !== 200 || r.isHtmlDoc; });
leg("RULE", "4 every literal route in vercel.json reaches its own destination",
  routed.length > 0 && badRoute.length === 0,
  routed.length === 0 ? `vercel.json declares no literal path routes — VACUOUS, not a pass`
    : badRoute.length ? `routed but answering with HTML or a non-200: ${badRoute.join(" ")}`
    : `${routed.length} literal route(s), each 200 with its own content type: ` +
      `${routed.map((p) => `${p}=${(results.get(p) || {}).ctype}`).join(", ")}.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
