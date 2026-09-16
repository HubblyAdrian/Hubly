#!/usr/bin/env node
/**
 * A TURN THAT SUCCEEDED DOES NOT GET CALLED A FAILURE ONE LINE LATER.
 *
 *   node scripts/check-no-contradicting-reask.mjs
 *
 * WHAT HAPPENED. Adrian's walk, 2026-09-16. Two assistant rows written in the same
 * hcFlushPersist batch, identical to the microsecond (02:27:32.467109Z):
 *
 *   seq 44  "Window washing is saved for September 17 at 8:00 PM."
 *   seq 45  "I didn't get those down — say them again?"
 *
 * The job row was created at 02:27:29.951946Z. The write landed, Hubly said so, and then Hubly
 * said the opposite. `capture_miss_events` dates the second sentence to 02:27:31.905919Z and
 * names what it thought it had missed: asked_for = 'services'.
 *
 * THE DECISION THAT WAS WRONG. The guard filtered the turn's actions down to the ones that
 * write the fact it was watching (setServices), found none, and read that empty list as "the
 * server never tried, so the extraction missed it". The turn had run addJob. An empty filtered
 * list means "nothing I know how to look for" — never "nothing happened". That is the empty
 * reader telling you about itself, one level down inside a guard.
 *
 * THE RULE THIS ASSERTS. A voluntary re-ask may not contradict a turn that really changed
 * something. The gate is not a longer list of action names — the next capability added would be
 * missing from it too — it is the closed set on the other side: a turn with no real change
 * cannot have consumed his answer.
 *
 * AND THE SILENCE IT CREATES IS COUNTED, not assumed harmless. Lesson 89: the direction that
 * reads as "this is fine" is the one nobody investigates, so it gets a row (outcome 'quiet')
 * rather than a judgement made once in a comment.
 *
 * SIMULATED AND SAID SO: no session, no model, no network. The page is the shipping
 * public/platform-home.html and the guard executed is the shipping hcCheckCaptureMiss; only the
 * turn's response and the fetch it would make are declared fakes.
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

// Runs the REAL guard against one declared turn and reports what it actually did: whether it
// spoke, what reached the thread, and what it recorded. The recording is observed by watching
// the page's own fetch, not by re-deriving what it "would have" sent.
const run = (owner, actions, tries) => rig.page.evaluate(({ owner, actions, tries }) => {
  const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
  t.innerHTML = "";
  const calls = [];
  const realFetch = window.fetch;
  window.fetch = function (url, opt) {
    if (String(url).includes("record_capture_miss")) {
      try { calls.push(JSON.parse(opt.body)); } catch (_e) { calls.push({ unparsed: true }); }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
    }
    return realFetch.apply(this, arguments);
  };
  window.hublyCaptureUI.withBusiness("00000000-0000-0000-0000-000000000001");
  window.hublyCaptureUI.saidByOwner(owner);
  const spoke = window.hublyCaptureUI.check({ askedFor: "services", tries: tries || 0 }, { actions });
  window.fetch = realFetch;
  return { spoke, text: t.innerText.replace(/\s+/g, " ").trim(), calls };
}, { owner, actions, tries });

try {
  console.log("SIMULATED — no session, no model, no network. The guard is the product's.\n");
  await rig.load(PAGE);
  const seam = await rig.page.evaluate(() => !!(window.hublyCaptureUI && window.hublyCaptureUI.check && window.hublyCaptureUI.saidByOwner && window.hublyCaptureUI.withBusiness));
  if (!seam) { console.error("CANNOT RUN — window.hublyCaptureUI is not exposed."); await rig.close(); process.exit(2); }

  // ── 1. THE WALK, REPRODUCED. "i meant 8" answers a services ask that is still armed; the
  //       turn's real work is a JOB. The guard must not call that turn a failure. ───────────
  const walk = await run("i meant 8", [{ capability: "business", capabilityAction: "addJob", ok: true, real: true }], 0);
  say("1 a turn whose real work was a job is not told the answer went missing",
    walk.spoke === false && !/didn.t get those down/i.test(walk.text),
    JSON.stringify(walk.text.slice(0, 80)) || "(nothing said)");
  say("2 and the miss it saw is recorded as a silence, not thrown away",
    walk.calls.length === 1 && walk.calls[0].p_outcome === "quiet" && walk.calls[0].p_asked_for === "services",
    JSON.stringify(walk.calls));

  // ── 3. THE GUARD STILL DOES ITS JOB. A turn that changed NOTHING and left the fact
  //       unrecorded is exactly what it was built for, and it must still speak. ─────────────
  await rig.load(PAGE);
  const real = await run("mow $45, trim $30", [], 0);
  say("3 a turn that changed nothing still owns the miss and asks again",
    real.spoke === true && /didn.t get those down/i.test(real.text), JSON.stringify(real.text.slice(0, 80)));
  say("4 and that one is recorded as a re-ask",
    real.calls.length === 1 && real.calls[0].p_outcome === "reasked", JSON.stringify(real.calls));

  // ── 5. ok WITHOUT real IS NOT A CHANGE. proposeServices publishes nothing on purpose, so it
  //       must not buy silence — that would be the unearned green wearing the other hat. ────
  await rig.load(PAGE);
  const proposed = await run("mow $45, trim $30", [{ capability: "business", capabilityAction: "proposeServices", ok: true, real: false }], 0);
  say("5 an action that changed nothing real does not buy the guard's silence",
    proposed.spoke === true && /didn.t get those down/i.test(proposed.text), JSON.stringify(proposed.text.slice(0, 80)));

  // ── 6. THE CAP IS A SILENCE TOO, AND IT USED TO BE AN UNRECORDED ONE. A third miss is not
  //       spoken (it would be a loop) — and before today it left no row at all. ─────────────
  await rig.load(PAGE);
  const capped = await run("mow $45, trim $30", [], 2);
  say("6 the capped third miss stays quiet AND leaves a row behind it",
    capped.spoke === false && capped.calls.length === 1 && capped.calls[0].p_outcome === "quiet",
    JSON.stringify(capped.calls));

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nNo turn is told it failed while its write stands, and every miss leaves a row.");
process.exit(failed ? 1 : 0);
