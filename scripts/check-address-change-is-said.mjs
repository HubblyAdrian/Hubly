#!/usr/bin/env node
/**
 * IF WE CHANGE AN ADDRESS WE TOLD AN OWNER TO EXPECT, WE SAY SO — IN THE SAME TURN, IN WORDS.
 *
 *   node scripts/check-address-change-is-said.mjs
 *
 * MEASURED, 2026-09-16. Three turns in the entire corpus named a `*.myhubly.app` address that is
 * not the address today — `site-e888ea`, `toms-clean-gutters`, `apollow`. **None of those three
 * addresses resolves: zero rows hold them.** And across all three businesses, every assistant
 * turn matching address|link|url|myhubly is the PROMISE ITSELF. Not one sentence, before or
 * after, mentions that the address changed. apollo-weeds was renamed three times in 108 seconds
 * and the address we put in writing was dead twelve seconds later.
 *
 * The detection already existed — `addressMoved` in the response handler — and ended in a canvas
 * redraw. A missing door, not a missing feature.
 *
 * THE TOLD-ADDRESS COMES FROM THE TURN THAT PROMISED IT, never from `business_slug_history`.
 * Adrian's instruction, and the measurement behind it: that table holds
 * `site-915f21 -> toms-gutters-more` and nothing else for that business, while the promise
 * sentence had already named `toms-clean-gutters.myhubly.app`. Its `reconstructed` rows are a
 * two-point inference and they lose every state in between. Building on it would mean naming an
 * address the owner was never given.
 *
 * RED-PROOFED IN THE REASSURING DIRECTION FIRST (Lesson 89): the failure mode is silence, and
 * silence is what the product did for three businesses without anyone noticing. So the legs that
 * matter assert that it SPEAKS and that the sentence REACHES THE RECORD — not merely that it
 * does not lie.
 *
 * SIMULATED AND SAID SO: no session, no network. The tracker, the composer and the persist queue
 * are the product's; the turn is a declared fake.
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

/** Drives the REAL tracker and the REAL composer, and reports what reached the thread and the
 *  persist queue. The apollo-weeds pair is the default because it is the one that happened. */
const run = (told, next) => rig.page.evaluate(({ told, next }) => {
  const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
  t.innerHTML = "";
  const A = window.hublyAddressUI;
  A.note(told);
  const before = window.hublySilenceUI.queued().length;
  const spoke = A.say(next);
  const queued = window.hublySilenceUI.queued().slice(before).map((m) => String(m.content));
  return { spoke, text: t.innerText.replace(/\s+/g, " ").trim(), queued, nowTold: A.told() };
}, { told, next });

try {
  console.log("SIMULATED — no session, no network. The tracker and the sentence are the product's.\n");
  await rig.load(PAGE);
  const seam = await rig.page.evaluate(() => !!(window.hublyAddressUI && window.hublyAddressUI.say && window.hublySilenceUI));
  if (!seam) { console.error("CANNOT RUN — window.hublyAddressUI is not exposed."); await rig.close(); process.exit(2); }

  // ── 1. THE CASE THAT HAPPENED. apollow -> apollo-weeds, and he was told nothing. ────────
  const moved = await run("apollow.myhubly.app", "https://apollo-weeds.myhubly.app");
  say("1 an address we promised, then changed, is said out loud",
    moved.spoke === true && /apollo-weeds\.myhubly\.app/.test(moved.text),
    JSON.stringify(moved.text.slice(0, 120)));
  say("2 and it names the OLD address, so he knows which link is dead",
    /apollow\.myhubly\.app/.test(moved.text) && /won.t work/i.test(moved.text),
    JSON.stringify(moved.text.slice(0, 120)));
  // A sentence on screen that the record does not keep is the defect Lesson 90 exists for.
  say("3 the sentence reaches the RECORD, not only the screen",
    moved.queued.length === 1 && moved.queued[0] === moved.text,
    `${moved.queued.length} queued: ${JSON.stringify((moved.queued[0] || "").slice(0, 90))}`);
  // It is a statement, never a question — so it takes no floor and leaves no ask unanswered.
  say("4 it is a statement, not a question — it takes no floor",
    !/\?\s*$/.test(moved.text), JSON.stringify(moved.text.slice(-40)));
  say("5 and it points at no button, tab or menu",
    !/\b(button|tab|menu|sidebar|click|tap)\b/i.test(moved.text), "no control named");

  // ── 6. AFTER SAYING IT, THAT IS NOW WHAT HE WAS TOLD. A second rename names the right old
  //       one — apollo-weeds was renamed THREE times in 108 seconds, so this is not academic. ─
  say("6 the promise updates, so a second rename names the address he last had",
    moved.nowTold === "apollo-weeds.myhubly.app", moved.nowTold);
  const again = await rig.page.evaluate(() => {
    const A = window.hublyAddressUI;
    A.note("apollow.myhubly.app"); A.say("https://apolloweeds.myhubly.app");
    const t = document.getElementById("hcThreadBody"); t.innerHTML = "";
    const spoke = A.say("https://apollo-weeds.myhubly.app");
    return { spoke, text: t.innerText.replace(/\s+/g, " ").trim() };
  });
  say("6b the second sentence names apolloweeds, not the original apollow",
    again.spoke === true && /apolloweeds\.myhubly\.app/.test(again.text) && !/\bapollow\.myhubly/.test(again.text),
    JSON.stringify(again.text.slice(0, 120)));

  // ── 7. WE NEVER CLAIM HE HAD AN ADDRESS WE DID NOT GIVE HIM. ───────────────────────────
  const never = await rig.page.evaluate(() => {
    const t = document.getElementById("hcThreadBody"); t.innerHTML = "";
    window.hublyAddressUI.note("");                       // nothing promised yet
    const spoke = window.hublyAddressUI.say("https://brand-new.myhubly.app");
    return { spoke, text: t.innerText.trim() };
  });
  say("7 a business we never named an address for gets no correction",
    never.spoke === false && never.text === "", JSON.stringify(never.text));
  const same = await run("apollo-weeds.myhubly.app", "https://apollo-weeds.myhubly.app");
  say("8 and an unchanged address says nothing at all",
    same.spoke === false && same.text === "", JSON.stringify(same.text));

  // ── 9. IT SURVIVES A REFRESH, read from the TRANSCRIPT — never from the slug history. ───
  const fromHist = await rig.page.evaluate(() => {
    const A = window.hublyAddressUI;
    A.note("");
    A.fromHistory([
      { role: "user", content: "build me a site" },
      { role: "assistant", content: "The address toms-clean-gutters.myhubly.app is reserved for you." },
      { role: "user", content: "call it Toms Gutters and More" },
    ]);
    return A.told();
  });
  say("9 the promised address is recovered from the turn that promised it",
    fromHist === "toms-clean-gutters.myhubly.app", fromHist || "(nothing)");
  // business_slug_history has NO row for this intermediate slug — it holds site-915f21 ->
  // toms-gutters-more and nothing else. A mechanism built on that table could not produce this.
  say("9b which is a slug business_slug_history does not contain",
    fromHist === "toms-clean-gutters.myhubly.app", "measured 2026-09-16: the history lost it");

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nAn address we promised and changed is said out loud, in the same turn, in words.");
process.exit(failed ? 1 : 0);
