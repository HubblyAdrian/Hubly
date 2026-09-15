#!/usr/bin/env node
/**
 * A TURN NEVER PRODUCES SILENCE.
 *
 *   node scripts/check-no-silent-turn.mjs
 *
 * WHAT HAPPENED. 2026-09-15: the owner typed "change the driveway job to 3 PM". He got
 * NOTHING back. He typed it again. He got nothing back again. Not a refusal, not an error —
 * no message at all.
 *
 * THE PATH, found rather than guessed. The model had no capability that could change a job
 * (update_business_job existed and appeared nowhere in supabase/functions), so it ran out of
 * useful moves and the server returned its internal filler:
 *
 *     "I've gathered what I can for now — what would you like to do next?"
 *
 * hcIsFallbackReply matches that string and suppresses it — CORRECTLY; it is machinery, not
 * something Hubly said, and it must never be shown or stored. But every other branch in the
 * response handler is conditional on there being something to show, so "nothing to show" fell
 * through all of them into silence.
 *
 * An operation that fails silently is indistinguishable from one that was never heard, and it
 * is the one failure mode a person cannot report usefully — "it did nothing" is all they have.
 * So the fix is a FLOOR, not another branch, and this check asserts the floor by FORCING the
 * failure that produced the silence.
 *
 * SIMULATED AND SAID SO: no session, no model. The page is the shipping
 * public/platform-home.html; the turn's response is a declared fake shaped exactly like the
 * one that produced the silence.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session, no model. The floor and its sentences are the product's.\n");
  await rig.load(PAGE);
  const seam = await rig.page.evaluate(() => !!(window.hublySilenceUI && window.hublySilenceUI.line && window.hublySilenceUI.ensure));
  if (!seam) { console.error("CANNOT RUN — window.hublySilenceUI is not exposed."); await rig.close(); process.exit(2); }

  // ── 1. THE FILLER IS STILL SUPPRESSED. The floor must not become an excuse to show it. ──
  const suppressed = await rig.page.evaluate(() => {
    const f = "I've gathered what I can for now — what would you like to do next?";
    // hcIsFallbackReply is not exposed; assert the OUTCOME instead — the floor's own sentence
    // must never be the filler, whatever the filler says.
    const lines = [
      window.hublySilenceUI.line([]),
      window.hublySilenceUI.line([{ capability: "business", capabilityAction: "updateJob", ok: false }]),
      window.hublySilenceUI.line(null),
    ];
    return { filler: f, lines };
  });
  say("1 the floor never speaks the internal filler back to the owner",
    suppressed.lines.every((l) => !/gathered what I can/i.test(l) && !/what would you like to do next/i.test(l)),
    JSON.stringify(suppressed.lines[0]));

  // ── 2. EVERY OUTCOME GETS A SENTENCE, AND THEY DIFFER. ──────────────────────────────────
  const lines = await rig.page.evaluate(() => {
    const L = window.hublySilenceUI.line;
    return {
      nothingRan: L([]),
      allFailed: L([{ capability: "business", capabilityAction: "updateJob", ok: false, real: false }]),
      someFailed: L([{ capability: "business", capabilityAction: "addJob", ok: true, real: true },
                     { capability: "business", capabilityAction: "setHours", ok: false, real: false }]),
      noReceipt: L(null),
    };
  });
  const all = Object.values(lines);
  say("2 every outcome says something", all.every((s) => s && s.length > 12), `${all.length} sentences`);
  say("3 a turn where everything failed says nothing changed",
    /nothing changed/i.test(lines.allFailed), JSON.stringify(lines.allFailed));
  say("4 a partly-failed turn does not claim to know which half",
    /can.t tell you which/i.test(lines.someFailed) && !/nothing changed/i.test(lines.someFailed),
    JSON.stringify(lines.someFailed));
  say("5 no sentence claims success", !all.some((s) => /\b(done|added|changed it|updated|saved)\b/i.test(s)),
    JSON.stringify(all.filter((s) => /\b(done|added|changed it|updated|saved)\b/i.test(s))));
  // AND IT MUST NOT SEND THEM ROUND A LOOP THAT CANNOT TERMINATE. "Tell me again" is what was
  // said about the seven-digit phone, and repeating it verbatim would have failed identically.
  say("6 it never asks for the same words back verbatim",
    !all.some((s) => /\b(send|say|type) it again\b/i.test(s)), "no 'say it again'");

  // ── 7. THE FLOOR ITSELF: force the exact failure and assert a sentence reaches the DOM. ──
  const forced = await rig.page.evaluate(() => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    t.innerHTML = "";
    // THE EXACT SHAPE THAT PRODUCED THE SILENCE: a turn that displayed nothing, whose reply was
    // the filler (so it was suppressed) and whose only action failed.
    const before = t.querySelectorAll(".hc-msg").length;
    const spoke = window.hublySilenceUI.ensure({
      reply: "I've gathered what I can for now — what would you like to do next?",
      actions: [{ capability: "business", capabilityAction: "updateJob", ok: false, real: false }],
    });
    return { before, after: t.querySelectorAll(".hc-msg").length, spoke, text: t.innerText.replace(/\s+/g, " ").trim() };
  });
  say("7 forcing the silence still puts a sentence in the thread",
    forced.spoke === true && forced.after === forced.before + 1 && forced.text.length > 12,
    `${forced.before} -> ${forced.after} msg(s): ${JSON.stringify(forced.text.slice(0, 120))}`);

  // ── 8. AND IT DOES NOT DOUBLE-SPEAK. A turn that already said something stays quiet. ────
  const quiet = await rig.page.evaluate(() => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    const before = t.querySelectorAll(".hc-msg").length;
    // hcTurn.said is now non-empty (the floor just spoke), so a second call must be a no-op.
    const spoke = window.hublySilenceUI.ensure({ actions: [] });
    return { before, after: t.querySelectorAll(".hc-msg").length, spoke };
  });
  say("8 a turn that has already spoken does not get a second sentence",
    quiet.spoke === false && quiet.after === quiet.before, `${quiet.before} -> ${quiet.after}`);

  // ── 9. THE DOOR THAT WAS MISSING IS OPEN. The model can reach the writer now. ───────────
  const { readFileSync } = await import("node:fs");
  const reg = readFileSync(resolve(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts"), "utf8");
  say("9 the model has a capability that changes an existing job",
    /name:\s*"updateJob"/.test(reg) && /update_business_job/.test(reg),
    "business.updateJob -> update_business_job");
  say("10 and it grounds what it writes, exactly as addJob does",
    /addressGrounded\(addr, userMessage\)/.test(reg) && /priceGrounded\(amount, userMessage\)/.test(reg),
    "address and price grounded in this message");
  // AMBIGUITY IS A QUESTION, NOT A COIN FLIP. Changing the wrong job is worse than asking.
  say("11 an ambiguous job name is refused with the candidates named",
    /error:\s*"ambiguous"/.test(reg) && /do not pick/i.test(reg),
    "refuses and names them");

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nEvery turn says something, and the job the owner asked to change can be changed.");
process.exit(failed ? 1 : 0);
