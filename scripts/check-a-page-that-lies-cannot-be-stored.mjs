#!/usr/bin/env node
/**
 * [RULE] A PAGE THAT LIES CANNOT BE STORED — and the middle category is THE DERIVATION HOLDS.
 *
 *   node scripts/check-a-page-that-lies-cannot-be-stored.mjs
 *
 * ══ ADRIAN'S TEST, VERBATIM ═════════════════════════════════════════════════════════════════
 *
 *   "a string is a CLAIM if a reasonable customer could be WRONG by acting on it.
 *    Quantity · credential word · availability or promise word · identifier.
 *    THE MIDDLE CATEGORY IS THE DERIVATION HOLDS, not 'a row exists' — 47 -> dozens holds,
 *    47 -> hundreds is a lie with a true row behind it.
 *    RED-PROOF WITH AN INFLATION. It runs where the page is validated, so a page that lies
 *    cannot be stored."
 *
 * Every leg runs the REAL validator (`validateHublyDocument`, through deno, the runtime the edge
 * function uses) on a document that differs only in the sentence under test. The inflation legs
 * are the point: the same true row, two sentences, one of which is a lie.
 *
 * WHAT IT DELIBERATELY DOES NOT DO, and this is a decision not an omission: a credential
 * ("licensed and insured") or a promise ("24/7") is NOT rejected. No column holds either, so a
 * rejection would be a threshold invented for something we have no evidence about — Adrian's (d).
 * They are reported as warnings, and leg 7 asserts that they are reported rather than swallowed.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const probe = `
  import { validateHublyDocument } from "${join(ROOT, "supabase/functions/_shared/hubly_document.ts")}";
  // 47 customers on record, founded 2019, the business's own number. One true set of rows.
  const FACTS = { customers: 47, reviews: 0, jobsCompleted: 120, foundedYear: 2019, phone: "801-555-2277" };
  const page = (sentence) => ({ root: { tag: "main", id: "root", children: [
    { tag: "section", id: "hero", children: [{ tag: "h1", id: "h", children: "Marlowe Detailing" }] },
    { tag: "section", id: "about", children: [
      { tag: "h2", id: "a", children: "About us" },
      { tag: "p", id: "p", children: sentence },
      { tag: "ul", id: "u", children: [
        { tag: "li", id: "l1", children: "Full detail $180" },
        { tag: "li", id: "l2", children: "Express wash $60" }] }] }] } });
  const run = (sentence, facts) => {
    const r = validateHublyDocument(page(sentence), { businessId: "b1", version: 1, generatedBy: "ai", facts });
    return { ok: r.ok, errors: (r.errors || []).map((e) => e.message),
             warnings: (r.warnings || []).map((w) => w.message) };
  };
  console.log(JSON.stringify({
    trueCount:      run("We have looked after 40 happy customers.", FACTS),
    inflatedCount:  run("We have looked after over 200 happy customers.", FACTS),
    vagueHolds:     run("We have looked after dozens of happy customers.", FACTS),
    vagueInflated:  run("We have looked after hundreds of happy customers.", FACTS),
    trueYears:      run("Serving the area for 5 years.", FACTS),
    inflatedYears:  run("Serving the area for 30 years.", FACTS),
    ownPhone:       run("Call us on 801-555-2277 today.", FACTS),
    someoneElse:    run("Call us on 801-555-9001 today.", FACTS),
    reviewsInvented: run("Read our 120 five-star reviews.", FACTS),
    credential:     run("We are licensed and insured, and we answer 24/7.", FACTS),
    noFacts:        run("We have looked after over 200 happy customers.", undefined),
  }));
`;
const tmp = join(ROOT, "scripts", ".claims-probe.ts");
writeFileSync(tmp, probe);
let out;
try { out = execFileSync("deno", ["run", "--allow-read", "--allow-env", tmp], { encoding: "utf8", cwd: ROOT }); }
catch (e) { console.error("CANNOT RUN — deno could not run the validator: " + String(e.message).slice(0, 300)); unlinkSync(tmp); process.exit(2); }
unlinkSync(tmp);
const r = JSON.parse(out.trim().split("\n").pop());
const lied = (x) => x.ok === false && x.errors.some((m) => /record contradicts/.test(m));

say("1 [RULE] a figure the record supports is stored", r.trueCount.ok === true,
    "40 claimed, 47 on record");
say("2 [RULE] AN INFLATION IS NOT — the same true row cannot support a bigger number",
    lied(r.inflatedCount), r.inflatedCount.errors[0] || "(no error)");
say("3 [RULE] the middle category is the DERIVATION, not the row: 47 -> \"dozens\" holds",
    r.vagueHolds.ok === true, "dozens accepted on 47");
say("4 [RULE] and 47 -> \"hundreds\" is a lie with a true row behind it",
    lied(r.vagueInflated), r.vagueInflated.errors[0] || "(no error)");
say("5 [RULE] years are derived from the founding year, not asserted",
    r.trueYears.ok === true && lied(r.inflatedYears),
    "5 years accepted, 30 years rejected against founded 2019");
say("6 [RULE] an identifier must be THIS business's own — the cross-business leak, caught at the gate",
    r.ownPhone.ok === true && lied(r.someoneElse),
    r.someoneElse.errors[0] || "(no error)");
say("7 [RULE] a count with no table behind it cannot be stored at all",
    lied(r.reviewsInvented), r.reviewsInvented.errors[0] || "(no error)");
say("8 [RULE] a credential or a promise is REPORTED, never rejected — no column holds either, and a rejection would be an invented threshold",
    r.credential.ok === true && r.credential.warnings.some((w) => /licensed/.test(w)) && r.credential.warnings.some((w) => /24\/7/.test(w)),
    `${r.credential.warnings.length} warning(s), page stored`);
say("9 [RULE] and with NO facts it says so rather than passing silently",
    r.noFacts.ok === true && r.noFacts.warnings.some((w) => /no business facts were supplied/.test(w)),
    "an empty reader tells you about itself");

// ══ AND THE GATE IS WIRED, NOT MERELY BUILT ═════════════════════════════════════════════════
//
// Every leg above passes `facts` itself. That proves the checker; it does not prove that anything
// in production ever supplies them — and a gate that is never given facts is a capability with no
// door, which is the pattern this repo keeps paying for. So: the real generator must pass them.
import { readFileSync } from "node:fs";
const reg = readFileSync(join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts"), "utf8");
say("10 [RULE] the real generation path hands the checker the record it wrote the page from",
    /generateAndValidateDocument\([^)]*factsFromRecord\(/s.test(reg.replace(/\n/g, " ")),
    "generateAndValidateDocument is called with factsFromRecord(record)");
say("11 [RULE] and those facts come from the record, not from a second read or a guess",
    /function factsFromRecord\(record: BusinessRecord/.test(reg) && !/selectOne\("businesses"[^)]*\)\s*;?\s*\/\/ facts/.test(reg),
    "built from the BusinessRecord the generation already loaded");

console.log(failed ? `\n${failed} FAILED\n` : "\nPASS — an inflated figure cannot be stored, and what cannot be judged is said out loud.\n");
process.exit(failed ? 1 : 0);
