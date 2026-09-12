#!/usr/bin/env node
/**
 * WHAT WE KNOW vs WHAT THE PAGE SHOWS — a record-based contradiction census.
 *
 *   HUBLY_T5_CORPUS=/path/to/t5.json node scripts/measure-record-page-divergence.mjs
 *
 * T5 came out of Adrian's ironwood-fence walk: a page that says it has no prices while
 * the record holds prices. The FIRST version of this detector enumerated absence
 * PHRASES — "no price list", "call for hours", "quote-only" — and that is the failure
 * this repo has now paid for four times (CLAUDE.md: the anchor count, the price scan, the
 * hours detector, the extraction gate). A phrase list can only find the wordings someone
 * already thought of, and the model invents a new one every build.
 *
 * So this asks a question with no phrasing in it: THE RECORD HOLDS A VALUE — is that
 * VALUE anywhere on the page? A page that does not show a fact we hold is a contradiction
 * whether it says so out loud or just quietly omits it, and the owner told us either way.
 *
 * WHAT EACH NUMBER COUNTS, stated because a heuristic counts a FORM and not a fact:
 *   phone     the record's last 10 digits, found in the page's digits (text + tel: hrefs)
 *   email     the address, case-insensitively, in text or a mailto:
 *   service   the service NAME as a normalised substring of the visible text
 *   price     the amount as a token: 180, $180, 180.00, $180.00, 1,800 — with or without
 *             the dollar sign, because a priced service often renders without one
 *   hours     the open time in any of 9:00 / 9am / 9 am / 09:00 / 9:00am, or, for a day
 *             the record marks closed, the word "closed" — this is the weakest of the
 *             five and is reported as a floor, not a count
 * Every one of these can MISS (a page rendering a fact in a form not listed reads as a
 * contradiction when it is not), and every miss inflates the divergence. The direction of
 * the error is stated with the number, and the worst cases are printed so they can be read
 * rather than trusted.
 *
 * MEASUREMENT ONLY. It fixes nothing and gates nothing.
 */
import { readFileSync } from "node:fs";

const CORPUS = process.env.HUBLY_T5_CORPUS;
if (!CORPUS) { console.error("CANNOT RUN — set HUBLY_T5_CORPUS to the exported record+page json"); process.exit(2); }
let rows;
try { rows = JSON.parse(readFileSync(CORPUS, "utf8")); }
catch (e) { console.error("CANNOT RUN — corpus unreadable: " + e.message); process.exit(2); }
if (!Array.isArray(rows) || !rows.length) { console.error("CANNOT RUN — corpus empty"); process.exit(2); }

const visibleText = (html) => html
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const digitsOf = (s) => String(s || "").replace(/[^0-9]/g, "");

function priceOnPage(html, text, amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return true;                 // nothing to look for
  const whole = Math.round(n);
  const forms = [String(whole), whole.toLocaleString("en-US"), n.toFixed(2), whole + ".00"];
  for (const f of new Set(forms)) {
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^0-9.,])\\$?${esc}([^0-9]|$)`).test(text)) return true;
  }
  return false;
}
function timeOnPage(text, hhmm) {
  if (!hhmm) return true;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm); if (!m) return true;
  let h = Number(m[1]); const mins = m[2];
  const h12 = ((h + 11) % 12) + 1;
  const ap = h < 12 ? "am" : "pm";
  const forms = [`${h}:${mins}`, `${String(h).padStart(2, "0")}:${mins}`, `${h12}:${mins}`,
    `${h12}${ap}`, `${h12} ${ap}`, `${h12}:${mins}${ap}`, `${h12}:${mins} ${ap}`];
  const t = text.toLowerCase().replace(/\s+/g, " ");
  return forms.some((f) => t.includes(f.toLowerCase()));
}

const FACTS = ["phone", "email", "service names", "prices", "hours"];
const held = Object.fromEntries(FACTS.map((f) => [f, 0]));
const missing = Object.fromEntries(FACTS.map((f) => [f, 0]));
const conflict = Object.fromEntries(FACTS.map((f) => [f, 0]));
const byKind = {};
const detail = [];

for (const r of rows) {
  const html = String(r.html || ""); if (!html) continue;
  const text = visibleText(html);
  const ntext = norm(text);
  const pageDigits = digitsOf(text + " " + (html.match(/tel:[^"']+/gi) || []).join(" "));
  const gaps = [];

  // ABSENT vs CONFLICTING. copperwick-kilns showed the difference: its page prints
  // 801-555-7420 while the record holds 801-555-9001. That is not an omission — it is
  // two answers to the same question, and a customer dials the one on the page. Which
  // side is stale cannot be told from here, so the census names it and assigns nothing.
  if (String(r.phone || "").trim()) {
    held.phone++;
    const d = digitsOf(r.phone).slice(-10);
    if (d.length === 10 && !pageDigits.includes(d)) {
      const onPage = [...text.matchAll(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g)].map((m) => digitsOf(m[0]).slice(-10));
      const other = onPage.find((x) => x.length === 10 && x !== d);
      if (other) { conflict.phone++; gaps.push(`CONFLICT phone — record ${r.phone}, page ${other}`); }
      else { missing.phone++; gaps.push(`phone ${r.phone} absent`); }
    }
  }
  if (String(r.email || "").trim()) {
    held.email++;
    const e = String(r.email).trim().toLowerCase();
    if (!text.toLowerCase().includes(e) && !html.toLowerCase().includes("mailto:" + e)) {
      const onPage = [...(text + " " + html).matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)].map((m) => m[0].toLowerCase())
        .filter((x) => !/\.(png|jpg|svg|webp)$/.test(x));
      const other = onPage.find((x) => x !== e);
      if (other) { conflict.email++; gaps.push(`CONFLICT email — record ${e}, page ${other}`); }
      else { missing.email++; gaps.push(`email ${e} absent`); }
    }
  }
  const svc = Array.isArray(r.svc) ? r.svc : [];
  if (svc.length) {
    held["service names"]++;
    const absent = svc.filter((s) => s && s.name && !ntext.includes(norm(s.name)));
    if (absent.length) { missing["service names"]++; gaps.push(`${absent.length}/${svc.length} service name(s) absent: ${absent.slice(0,3).map((s)=>s.name).join(", ")}`); }
  }
  const priced = svc.filter((s) => s && s.price != null && Number(s.price) > 0);
  if (priced.length) {
    held.prices++;
    const absent = priced.filter((s) => !priceOnPage(html, text, s.price));
    if (absent.length) { missing.prices++; gaps.push(`${absent.length}/${priced.length} price(s) absent: ${absent.slice(0,3).map((s)=>`${s.name} $${s.price}`).join(", ")}`); }
  }
  const hrs = Array.isArray(r.hours) ? r.hours : [];
  if (hrs.length) {
    held.hours++;
    const openDays = hrs.filter((h) => !h.x && h.o);
    const absent = openDays.filter((h) => !timeOnPage(text, h.o));
    const closedShown = hrs.some((h) => h.x) ? /closed/i.test(text) : true;
    if (absent.length === openDays.length && openDays.length && !closedShown) { missing.hours++; gaps.push(`no hour from the record appears on the page`); }
    else if (absent.length) { missing.hours++; gaps.push(`${absent.length}/${openDays.length} open time(s) absent`); }
  }

  if (gaps.length) {
    byKind[r.account_kind] = (byKind[r.account_kind] || 0) + 1;
    detail.push({ slug: r.slug, kind: r.account_kind, gaps });
  }
}

const heldAny = rows.filter((r) => String(r.phone||"").trim() || String(r.email||"").trim() || (Array.isArray(r.svc)&&r.svc.length) || (Array.isArray(r.hours)&&r.hours.length)).length;
console.log(`businesses with a stored page: ${rows.length}   holding at least one checkable fact: ${heldAny}`);
console.log(`\nPAGES THAT DO NOT SHOW A FACT THEIR OWN RECORD HOLDS: ${detail.length} of ${heldAny}` +
            ` (${Math.round(detail.length / heldAny * 100)}%)`);
console.log(`  by account_kind: ${JSON.stringify(byKind)}`);
console.log(`\nper fact — record holds it / page does not show it:`);
for (const f of FACTS) console.log(`  ${f.padEnd(14)} absent ${String(missing[f]).padStart(3)}` +
  (conflict[f] ? `   CONFLICTING ${String(conflict[f]).padStart(2)}` : "            ") +
  `   of ${String(held[f]).padStart(3)} held` +
  (held[f] ? `  (${Math.round((missing[f]+conflict[f])/held[f]*100)}%)` : ""));
const market = detail.filter((d) => d.kind === "market");
console.log(`\nMARKET pages, named — the denominator is ${rows.filter((r)=>r.account_kind==="market").length}, so no rate is quoted:`);
if (!market.length) console.log("  none");
for (const d of market) console.log(`  ${d.slug} — ${d.gaps.join(" · ")}`);
if (process.argv.includes("--slugs")) {
  console.log(`\nEVERY page that does not show a fact its record holds (${detail.length}):`);
  for (const d of detail) console.log(`  ${d.slug} [${d.kind}] — ${d.gaps.join(" · ")}`);
}
console.log(`\nworst 12 by number of gaps:`);
for (const d of detail.sort((a,b)=>b.gaps.length-a.gaps.length).slice(0,12)) console.log(`  ${d.slug} [${d.kind}] — ${d.gaps.join(" · ")}`);
