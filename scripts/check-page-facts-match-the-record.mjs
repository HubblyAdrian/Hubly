#!/usr/bin/env node
/**
 * [RULE] HIS NUMBER IS ON HIS PAGE. The positive form, not the absence of someone else's.
 *
 *   node scripts/check-page-facts-match-the-record.mjs
 *
 * ══ WHY THIS IS A DIFFERENT CHECK FROM THE ONE BESIDE IT ════════════════════════════════════
 *
 * `check-page-facts-are-this-business` asks "is another business's detail on this page" — a NEGATIVE,
 * and it passes on a page with no contact details at all. Three pages were found by it on 2026-09-18
 * and traced to three different entry routes (a patch that planted it, a generation that borrowed from
 * a same-named business, and one that was never wrong). They shared ONE property:
 *
 *   **THE BUSINESS'S OWN RECORDED PHONE HAD NEVER APPEARED ON ANY VERSION OF ITS PAGE**, and a wrong
 *   one survived a patch AND a regeneration with nothing noticing.
 *
 * Nothing re-derives a page's contact facts from the record. `syncFreeformFacts` swaps a value when
 * asked to, and nothing asks. So this is the positive check: **if the record has it, the page says
 * it.** That cannot pass on a blank page, which is the whole point (Lesson 98).
 *
 * ══ IT DOES NOT INVENT, AND THAT IS AN ASSERTION NOT A HABIT ═════════════════════════════════
 *
 * A business with no recorded phone is REPORTED, never guessed for — the same refusal built into
 * `patch-ground-contact-facts`. And a page that states the number in a form this check cannot read is
 * a FALSE POSITIVE, stated before the number: a phone needs a separator or a `tel:` href to be seen,
 * because a bare ten-digit run is also what an epoch-seconds timestamp looks like and reading one as
 * the other manufactured four contradictions on 2026-09-17.
 *
 * ══ BOTH STORES, DERIVED ════════════════════════════════════════════════════════════════════
 *
 * Read the same way `check-page-facts-are-this-business` derives them — a column a public reader
 * returns, carrying page-shaped content — because the four market businesses serve from the classic
 * store and a check that scans one store while claiming "his page" covers none of them (L97).
 *
 * AND CONTACT-RECORD COLLECTIONS ARE SKIPPED. A lead list inside `meta` is not the page (L99): the
 * near-miss that produced that lesson was this exact column being read as page content.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { ROOT, declareBreak } from "./lib/redproof.mjs";
import { rateLine, subsetLine, withoutFixtures } from "./lib/kind-split.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const hublySrc = readFileSync(join(ROOT, "public/hubly.html"), "utf8");

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

let rows;
try {
  rows = q(`select b.slug, b.account_kind, coalesce(b.phone,'') as phone, coalesce(b.email,'') as email,
                   b.meta::text as meta,
                   (select d.rendered_html from business_documents d where d.business_id=b.id
                     order by d.version desc limit 1) as html
              from businesses b`);
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

const digits = (s) => String(s || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
const isContactRecords = (v) => Array.isArray(v) && v.length > 0 &&
  v.every((e) => e && typeof e === "object" && !Array.isArray(e) &&
    typeof e.name === "string" && (typeof e.phone === "string" || typeof e.email === "string"));
/** Renderable text: JSON string values, contact-record collections skipped (L99). */
const renderable = (text) => {
  const t = String(text || "");
  if (!/^\s*[{[]/.test(t)) return t;
  let o; try { o = JSON.parse(t); } catch (_) { return t; }
  const out = [];
  const walk = (v) => { if (isContactRecords(v)) return;
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(o); return out.join("\n");
};
const phonesIn = (t) => new Set([
  ...[...t.matchAll(/\(?\d{3}\)?[ .\-]\d{3}[ .\-]\d{4}/g)].map((m) => digits(m[0])),
  ...[...t.matchAll(/tel:\+?([\d .()\-]{10,20})/gi)].map((m) => digits(m[1])),
].filter((d) => d.length === 10));

/* THE BREAK IS AIMED AT THE CLASSIC-INJECTION LEG, because that is the one that is GREEN and therefore
 * needs proving. The freeform leg is RED ON REAL DATA right now — three pages — so it has been observed
 * failing for the reason it claims to catch, which is a red-proof by observation; it will need a
 * planted break once those three are corrected.
 *
 * And this is the break that matters more: eleven businesses with a recorded phone have NO stored
 * document, so the hero pill and the footer row are the only places their number appears. Take the
 * injection away and eleven live pages silently stop showing a phone number, with nothing erroring —
 * the same shape as the mailto hero pill nobody could see in the stored bytes. */
declareBreak({
  leg: "the classic renderer still injects the recorded phone",
  why: "stop the classic hero pill building a tel: link from S.phone, so eleven live pages silently " +
       "lose the only phone number they show and nothing errors",
  file: "public/hubly.html",
  find: 'if(phone)pills.push(`<a class="ws-hero-contact-pill" href="tel:${escPeHtml(phone.replace(/[^\\d+]/g,\'\'))}">',
  with: 'if(phone)pills.push(`<a class="ws-hero-contact-pill-BROKEN" data-no-tel="${escPeHtml(phone.replace(/[^\\d+]/g,\'\'))}">',
});

const withPage = rows.filter((r) => r.html || (r.meta && r.meta !== "null"));
const withPhone = withPage.filter((r) => digits(r.phone).length === 10);
const noPhone = withPage.filter((r) => digits(r.phone).length !== 10);

/* ══ THE CLASSIC RENDERER INJECTS THE PHONE FROM THE COLUMN, SO STORED CONTENT CANNOT SHOW IT ════
 *
 * THE FIRST RUN OF THIS CHECK REPORTED 12 of 76, INCLUDING GRAEF'S — "page shows NO phone at all" for
 * the one business running real work through Hubly. That was the instrument, and it is the THIRD time
 * this exact trap has appeared: the classic page's contact details are built AT RENDER TIME from the
 * businesses row —
 *     hubly.html:18313  S.phone = data.phone
 *     hubly.html:40536  `<a class="ws-hero-contact-pill" href="tel:${phone…}">`   (the hero pill)
 *     hubly.html:41048  `<div class="ws-footer-contact-item"><a href="tel:${phone…}">`  (the footer)
 * — so the number is never IN `businesses.meta`, and a sweep over stored content cannot see it. The
 * same trap produced "classic ships zero mailto links", which was true of the stored pages and
 * misleading about what a visitor sees.
 *
 * SO THE TWO PATHS ARE ASKED DIFFERENT QUESTIONS, and which path a business is on is DERIVED from
 * whether it has a `business_documents` row:
 *
 *   FREEFORM (has a document)  the phone must be IN the stored document — nothing injects it.
 *   CLASSIC  (no document)     the RENDERER injects it from the column, so it agrees by construction.
 *                              What has to hold is that the injection still exists, which is asserted
 *                              against the source below rather than assumed.
 *
 * A check that asked one question of both paths would report every classic business as broken, which
 * is exactly what it did. */
const INJECTS_PHONE = /ws-hero-contact-pill" href="tel:\$\{/.test(hublySrc) &&
                      /ws-footer-contact-item"><a href="tel:\$\{/.test(hublySrc) &&
                      /S\.phone=data\.phone/.test(hublySrc);

const agree = [], missing = [], classicInjected = [];
for (const r of withPhone) {
  if (!r.html) {                                  // no document -> the classic renderer serves it
    classicInjected.push(r);
    continue;
  }
  const text = [String(r.html), r.meta ? renderable(r.meta) : ""].join("\n");
  const on = phonesIn(text);
  (on.has(digits(r.phone)) ? agree : missing).push({ ...r, sawInstead: [...on].slice(0, 3) });
}

console.log(`${rows.length} businesses · ${withPage.length} with a page in either store · ` +
  `${withPhone.length} of those have a 10-digit phone ON RECORD\n`);

leg("RULE", "the classic renderer still injects the recorded phone",
  INJECTS_PHONE,
  `hubly.html builds the hero pill and the footer row from S.phone, and S.phone comes from ` +
  `data.phone — the businesses row. ${classicInjected.length} business(es) with a recorded phone and ` +
  `NO document depend on that, so it is asserted against the source instead of assumed. If this leg ` +
  `goes red, every one of those pages has silently stopped showing a phone number.`);

leg("RULE", "every FREEFORM page whose record holds a phone states that phone",
  withPhone.length > 0 && (withPhone.length - classicInjected.length) > 0 && missing.length === 0,
  `${withPhone.length} business(es) have a recorded phone · ${classicInjected.length} are CLASSIC ` +
  `(the renderer injects it, see the leg above) · ${withPhone.length - classicInjected.length} have a ` +
  `stored document that must contain it — both counts are part of the assertion, because "none ` +
  `disagrees" is trivially true of an empty set — and ${missing.length} of those do NOT state it` +
  (missing.length ? `. Worst first:\n` + missing.slice(0, 12).map((m) =>
    `          ${m.slug.padEnd(38)} [${m.account_kind}]  record ${m.phone}  ·  page shows ` +
    `${m.sawInstead.length ? JSON.stringify(m.sawInstead) : "NO phone at all"}`).join("\n") : ""));

leg("RULE", "a business with no recorded phone is reported, never guessed for",
  true,
  `${noPhone.length} business(es) with a page and NO 10-digit phone on record. This check states them ` +
  `and asserts nothing about their pages: there is nothing to ground them in, and a pass that invented ` +
  `a number would be the fabricated-fact defect wearing a helpful face. They are EXCLUDED from the ` +
  `denominator above rather than counted as agreeing.`);

const base = withoutFixtures(withPhone.filter((r) => r.html));
const realMissing = missing.filter((m) => base.some((b) => b.slug === m.slug));
console.log(`\n${rateLine("FREEFORM pages omitting their own recorded phone", realMissing.length,
  base, realMissing.map((m) => ({ account_kind: m.account_kind })), { store: "both" })}`);
console.log(subsetLine("  of those, by account_kind", realMissing.map((m) => ({ account_kind: m.account_kind }))));
console.log(`\nSCOPED: a page stating the number WITHOUT a separator and WITHOUT a tel: href reads as ` +
  `"no phone" here. That is deliberate — a bare ten-digit run is also what an epoch-seconds timestamp ` +
  `looks like, and reading one as the other manufactured four contradictions on 2026-09-17.`);

const bad = legs.filter((l) => !l.pass);
console.log(`\n${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
