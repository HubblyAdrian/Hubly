#!/usr/bin/env node
/**
 * WHAT THE OWNER CANNOT SEE, THE MODEL DOES NOT READ.
 *
 *   node scripts/check-model-sees-what-owner-sees.mjs
 *
 * THE DEFECT (found 2026-09-16 by asking "a guard on display is not a guard on the record — which
 * direction is each of our guards missing?"):
 *
 * The restore seeded `hc.messages` from EVERY stored row, and `hc.messages` is handed to the model
 * verbatim as `messages:`. Six lines below, the DISPLAY loop skipped the pre-account "reserved for
 * you — make an account" lines once the business was claimed, because they are a lie in the
 * history once there IS an account.
 *
 * So the owner could not see them and the model could. Hubly could reason about — and answer
 * from — messages the owner believes are gone, and AN OWNER CANNOT CORRECT A FACT THEY CANNOT
 * SEE. Same family as the phone scar: the model treating as known something the record does not
 * show the person.
 *
 * THE FIX IS ONE PREDICATE, NOT TWO CALL SITES THAT AGREE TODAY. hcHiddenFromOwner is consulted by
 * the history seed AND the render, so they cannot drift — which is exactly how this arose: one
 * rule, written once, applied in one of the two places that needed it.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let rig, failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };
try { rig = await openRig(); } catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  await rig.load("file://" + join(ROOT, "public/platform-home.html"));
  const seam = await rig.page.evaluate(() => !!(window.hublyHistoryUI && window.hublyHistoryUI.hidden));
  if (!seam) { console.error("CANNOT RUN — window.hublyHistoryUI is not exposed."); await rig.close(); process.exit(2); }

  // The real pre-account line, matched by content the way the product matches it.
  // The real matched content — hcIsPreAccountMsg matches "reserved for you", "goes live the
// moment you make an account", "that takes an account". Using a phrase it does not match would
// make legs 1-4 assert nothing, which is what the first draft did.
const PRE = "This site is reserved for you — make an account and it's yours.";
  const r = await rig.page.evaluate((PRE) => {
    const H = window.hublyHistoryUI.hidden;
    const out = {};
    // CLAIMED: the line is a lie in the history, so it is hidden from BOTH readers.
    window.__setClaimed(true);
    out.claimedAssistant = H("assistant", PRE);
    out.claimedUser = H("user", PRE);                  // never hide what the PERSON said
    out.claimedOrdinary = H("assistant", "Your Tuesday is clear now.");
    // UNCLAIMED: the offer is true, so nothing is hidden.
    window.__setClaimed(false);
    out.unclaimedAssistant = H("assistant", PRE);
    return out;
  }, PRE);
  say("1 a claimed owner's pre-account line is hidden", r.claimedAssistant === true);
  say("2 an ordinary assistant line is never hidden", r.claimedOrdinary === false);
  say("3 what the PERSON said is never hidden from anyone", r.claimedUser === false,
    "we do not edit their side of the conversation");
  say("4 before a claim, nothing is hidden — the offer is true then", r.unclaimedAssistant === false);

} catch (e) {
  console.error("FAIL — " + String(e.message).slice(0, 240)); failed++;
} finally { try { await rig.close(); } catch (_) {} }

// ── FROM SOURCE: one predicate, both readers ───────────────────────────────────────────
const page = readFileSync(join(ROOT, "public/platform-home.html"), "utf8");
const code = page.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
// A TIGHT WINDOW, AND HERE IS WHY. The first version searched 200 characters forward from
// `hc.messages = rows` for `hcHiddenFromOwner` — and the RENDER's call to it sits six lines below,
// inside that window. So removing the filter from the seed left the leg green: it was matching a
// different line entirely. A red-proof that produces no FAIL is not a pass (Lesson 87 addendum),
// and this one was caught by running it rather than by reading it.
//
// Now: the seed must call .filter(...) with the predicate BEFORE it reaches .map(, and the whole
// test lives inside that one expression.
const seedExpr = (code.match(/hc\.messages\s*=\s*rows[\s\S]{0,240}?\.map\(/) || [""])[0];
const seedsFiltered = /\.filter\(/.test(seedExpr) && /hcHiddenFromOwner/.test(seedExpr);
say("5 the history handed to the model is filtered by the predicate", seedsFiltered,
  seedsFiltered ? "hc.messages filters through hcHiddenFromOwner" : "hc.messages seeds from rows UNFILTERED");
// BOTH READERS CALL THE PREDICATE. The remaining direct hcIsPreAccountMsg uses are legitimate and
// different in KIND — re-attaching the account CTA for an UNclaimed visitor, and the supersede
// sweep — so counting call sites would fail for the wrong reason. What matters is that neither
// reader of the transcript decides hiding on its own.
const renderUses = /if\(hcHiddenFromOwner\(rows\[i\]\.role/.test(code);
say("6 the render decides hiding with the same predicate, not its own copy of the rule", renderUses,
  renderUses ? "one rule, two readers" : "the render has its own hcIsPreAccountMsg condition again");
// ANCHOR THE NEGATION. The first version of this leg matched
//   if(!hc.draftClaimed && rows[i].role !== 'user' && hcIsPreAccountMsg(txt)) hcAttachAccountCta(...)
// which is the UNCLAIMED CTA attach — the opposite condition, a different purpose, and correct.
// A leg that cannot tell `hc.draftClaimed` from `!hc.draftClaimed` is asserting on a shape, not a
// behaviour (Lesson 83). Only the POSITIVE hiding form must be gone.
const inlineHide = /[^!]hc\.draftClaimed && rows\[i\]\.role !== 'user' && hcIsPreAccountMsg/.test(code);
say("7 no reader re-implements the HIDING test inline (the negated CTA form is fine)", !inlineHide,
  inlineHide ? "an inline hiding condition is back" : "hiding is decided in one place only");

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe model reads exactly what the owner can see.");
process.exit(failed ? 1 : 0);
