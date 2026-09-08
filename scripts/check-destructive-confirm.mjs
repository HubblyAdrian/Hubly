#!/usr/bin/env node
/**
 * A SAFETY CHECK MUST MEASURE WHAT THE USER LOSES, NOT WHAT THE SYSTEM OVERWRITES.
 *
 *   node scripts/check-destructive-confirm.mjs
 *
 * THE CLASS, stated once because it is a class and not an incident:
 *
 *   A safety check that measures what the SYSTEM OVERWRITES rather than what the
 *   USER LOSES will fail precisely on the users who have the most to lose — because
 *   those are the ones whose value lives outside the system's own model of itself.
 *
 * The incident that produced it (2026-09-08). `website.newPage` has a `confirm`
 * parameter and a confirmation step. The step asks: is there a business_documents
 * row to overwrite? For a business on the CLASSIC render path there is none, so it
 * read "nothing to lose" and skipped the warning — while what the owner actually
 * lost was their entire live site: 8 services, a gallery, reviews, why-cards,
 * memberships, 137 images, replaced by a one-screen stub with the reply "Here's a
 * completely new page." The richest business in the corpus was the MOST exposed,
 * for exactly the reason the check was blind to it: his content was hand-built, so
 * none of it was in the table the check looked at.
 *
 * The same shape has now appeared three times in this codebase:
 *   - the freeform ANCHOR count (counted headings; a service was a <li><span>)
 *   - the PRICE scan (counted `$`; missed every priced service without the symbol)
 *   - this (counted documents; missed every page that was not a document)
 * Each measured the representation the system happens to store, not the thing that
 * matters. See also CLAUDE.md, "ENUMERATE THE HARMLESS SIDE — never the valuable one."
 *
 * WHAT THIS CHECKS. A destructive website action must not decide "nothing to lose"
 * from the presence of a stored document alone. Every action that can replace a
 * page must consult refuseIfClassicSite() — the gate that asks whether a LIVE PAGE
 * exists, by any representation — before it runs.
 *
 * WHERE IT STOPS. It is structural: it proves the gate is CALLED, never that the
 * gate is correct. And it knows only the four actions named below; a fifth
 * destructive action added tomorrow is invisible until it is added here. That is a
 * real limit and the reason the rule above is written out in full rather than
 * left implicit in a list.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = path.join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts");

let failures = 0;
const fail = (m) => { failures++; console.error("FAIL  " + m); };

const src = fs.readFileSync(REGISTRY, "utf8");

// Actions that can replace or rewrite what a visitor sees.
const DESTRUCTIVE = ["generateDocument", "newPage", "patchDocument", "setChrome"];
const GATE = "refuseIfClassicSite";

if (!new RegExp(`(async )?function ${GATE}\\s*\\(`).test(src)) {
  fail(`${GATE}() is not defined. The gate that asks "is there a live page to lose"\n` +
       `      has been removed or renamed; every check below is meaningless without it.`);
}

// The gate must consult a LIVE-PAGE signal, not only the document table. If it ever
// stops reading owner/slug and reads only business_documents, it has collapsed back
// into "what the system overwrites".
const gateAt = src.indexOf(`function ${GATE}`);
const gateBody = gateAt >= 0 ? src.slice(gateAt, gateAt + 2000) : "";
if (gateAt >= 0 && !/owner_id/.test(gateBody)) {
  fail(`${GATE}() no longer reads owner_id. It has to distinguish an UNCLAIMED draft\n` +
       `      (no document is normal, generation must work) from a CLAIMED business with a\n` +
       `      live hand-built page. Without that it either breaks signup or stops protecting.`);
}

let called = 0;
for (const action of DESTRUCTIVE) {
  const at = src.indexOf(`name: "${action}"`);
  if (at < 0) { fail(`action "${action}" not found in the registry — this check has gone blind to it.`); continue; }
  const next = DESTRUCTIVE.map((a) => src.indexOf(`name: "${a}"`, at + 10)).filter((i) => i > at);
  const end = next.length ? Math.min(...next) : Math.min(at + 6000, src.length);
  const span = src.slice(at, end);
  if (span.includes(`${GATE}(`)) { called++; continue; }

  // FOLLOW ONE LEVEL OF DELEGATION. generateDocument's handler is a one-line delegate
  // to runDocumentGeneration(), where the gate actually lives. Reporting that as a
  // violation would be a checker misreading a VALID form as a defect — the failure
  // that produced duplicate p_owner_id keys and TS1117 earlier in this codebase. So
  // resolve the delegate and check its body; a gate anywhere on the path counts.
  const delegate = span.match(/handler:\s*async \([^)]*\)\s*=>\s*\n?\s*([A-Za-z_$][\w$]*)\s*\(/);
  if (delegate) {
    const fnAt = src.search(new RegExp(`(async )?function ${delegate[1]}\\s*\\(`));
    if (fnAt >= 0 && src.slice(fnAt, fnAt + 8000).includes(`${GATE}(`)) {
      called++;
      console.log(`  note: website.${action} reaches the gate via ${delegate[1]}()`);
      continue;
    }
  }
  fail(`website.${action} can replace a live page but never calls ${GATE}().\n` +
       `      It will decide "nothing to lose" from the absence of a stored document, which is\n` +
       `      exactly the blindness that replaced a real customer's site with a stub on 2026-09-08.`);
}

console.log(`destructive website actions checked : ${DESTRUCTIVE.length}`);
console.log(`  consulting ${GATE}()          : ${called} (must be ${DESTRUCTIVE.length})`);

if (failures) { console.error(`\n${failures} failure(s).`); process.exit(1); }
console.log("\nPASS — every destructive website action asks what the OWNER would lose.");
