#!/usr/bin/env node
/**
 * [RULE] A PLACEHOLDER IN THE MARKUP MUST HAVE SOMETHING THAT WRITES OVER IT.
 *
 *   node scripts/check-no-unwritten-placeholder.mjs
 *
 * ══ THE DEFECT THIS WAS WRITTEN FOR, 2026-09-17 ═════════════════════════════════════════════
 *
 * On every live booking page, the SMS consent sentence read:
 *
 *   "By checking this box I agree to receive SMS from **Your Business** about scheduling…"
 *
 * `#bk-biz-consent` was substituted by `syncStorefront()` — an OWNER-side function that does not
 * run for a member of the public — so the placeholder was on screen, ticked, and then STORED:
 * `bkSmsConsentText()` records the live label into `booking_requests.sms_consent_text`, and its
 * own comment says why that matters ("'SMS from Everlasting' is materially different from 'SMS
 * from Your Business' as a record of what was agreed to"). One stored row already carried it.
 *
 * ══ WHY A CHECK AND NOT A FIX ═══════════════════════════════════════════════════════════════
 *
 * The fix was one line. The CLASS is "a placeholder that nothing writes over", and the file holds
 * twelve more of them; the live one differed only in being on a surface a customer reaches. So the
 * question is asked structurally: for every element whose text IS a placeholder, is there anything
 * in the same file that writes to that id?
 *
 * DERIVED, NOT A LIST OF IDS. The ids come out of the markup; the writers come out of the source.
 * A new placeholder is covered the day it is added, and a renamed id cannot slip past.
 *
 * WHAT IT CANNOT SEE, SAID PLAINLY: it proves a WRITER EXISTS, not that the writer RUNS on the
 * path where the placeholder is visible — which is exactly how the consent line was broken
 * (syncStorefront exists and is never called for a public visitor). A green here means "nothing is
 * obviously stranded"; it does not mean every surface substitutes. Only rendering does that.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["public/hubly.html", "public/platform-home.html"].filter((f) => existsSync(join(ROOT, f)));
if (!FILES.length) { console.error("CANNOT RUN — no shell files on disk"); process.exit(2); }

/** Text that is a stand-in for a real business's own words. Kept small and obvious on purpose. */
const PLACEHOLDER = /^(Your Business|Your business|Business Name|Your Name|Your Company|Company Name)$/;

let failed = 0, scanned = 0;
for (const f of FILES) {
  const src = readFileSync(join(ROOT, f), "utf8");
  // <tag … id="x" …>PLACEHOLDER</tag> — the whole text node, nothing else inside it.
  const hits = [...src.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>([^<]{1,40})<\/\1>/gi)]
    .map((m) => ({ tag: m[1], id: m[2], text: m[3].trim(), at: src.slice(0, m.index).split("\n").length }))
    .filter((h) => PLACEHOLDER.test(h.text));
  scanned += hits.length;
  for (const h of hits) {
    // Anything that writes to this id: a direct getElementById, or an id used in a map of ids
    // (renderBookingLanding's idMap shape), or a querySelector on it.
    const idRe = new RegExp(`(getElementById\\(['"\`]${h.id}['"\`]\\)|querySelector\\(['"\`]#${h.id}['"\`]\\)|['"\`]${h.id}['"\`]\\s*[,}\\]])`);
    const writes = idRe.test(src);
    if (!writes) {
      console.error(`FAIL  ${f}:${h.at}  #${h.id} renders "${h.text}" and nothing in this file writes to it`);
      failed++;
    } else {
      console.log(`ok    ${f}:${h.at}  #${h.id} — "${h.text}" is written by something in this file`);
    }
  }
}

console.log(`\n${scanned} placeholder element(s) found by scanning the markup, not from a list.`);
if (failed) {
  console.error(`\nFAIL — ${failed} placeholder(s) with no writer at all.`);
  console.error(`A stand-in nobody overwrites is a fact about a business that nobody stated,`);
  console.error(`and on a public surface it is also a record of what a customer agreed to.`);
  process.exit(1);
}
console.log("PASS — every placeholder in the markup has something that writes over it.\n");
