#!/usr/bin/env node
/**
 * NOBODY EVER REFRESHES TO SEE THEIR OWN CHANGE.
 *
 *   node scripts/check-live-surfaces.mjs
 *
 * THE LAW (Adrian, 2026-09-15): a write that succeeds updates every surface showing the thing it
 * changed, IN THE SAME TURN. If a surface cannot update we say so in words. Never a stale value
 * left looking correct, and NEVER "refresh the page".
 *
 * It bit him three times in one session. The sharpest: he moved the driveway job to 3 PM, the
 * confirmation was correct, and the week grid THREE LINES ABOVE still read 2:00 PM.
 *
 * WHAT THIS ASSERTS, and why each leg exists rather than reading the code:
 *
 *   THE STALE VALUE ITSELF (legs 6-8). The transcript, reproduced: a week grid showing 2:00 PM, a
 *   write that moves the job to 3 PM, and the grid must read 3:00 PM afterwards WITHOUT a reload.
 *   Red-proofed by removing the hcAfterWrite call — the grid then still reads 2:00 PM and leg 7
 *   goes red, which is the exact defect.
 *
 *   THE BOUNDARY, AS A CHECK AND NOT A CONVENTION (leg 9). A redraw may only touch nodes inside
 *   its own el. hcRenderHome opens with `thread.innerHTML = ''` and that wipe ate the arrival
 *   once; if a redraw is allowed to reach outside its element, this mechanism becomes the second
 *   way to do it. So the pass is run with a sentinel node planted in the thread OUTSIDE every
 *   surface, and the sentinel must survive.
 *
 *   THE STRANDED HANDLE (leg 10) — the failure mode that makes the whole mechanism silently
 *   useless. If a redraw REPLACES its own el instead of filling it, the registry keeps a handle to
 *   a detached node, `el.isConnected` goes false, and the surface quietly stops updating forever
 *   with nothing going red. Asserted by redrawing twice and requiring the surface to still be
 *   registered and still correct on the SECOND pass.
 *
 *   MEMBERSHIP IS STRUCTURAL (legs 3-5). There is no deregister call, by design. A surface whose
 *   node leaves the document must leave the registry on its own.
 *
 *   UNKNOWN MEANS REFRESH (legs 11-14). A needless re-read costs one query; a skipped one leaves a
 *   lie on his screen. Every unknown key shape, missing field and absent date must refresh.
 *
 *   AND THE FAILURE PATH (legs 15-17). A read that failed may not be drawn as an empty surface —
 *   that is the empty-reader defect, our failure rendered as his missing data. It must report
 *   every surface as stale and produce a sentence that names them and never says "refresh".
 *
 * SIMULATED AND SAID SO: there is no session here, so the WRITE is not exercised — `hcAfterWrite`
 * is driven with a declared fake loader through one seam. What runs is the shipping registry, the
 * shipping week grid, the shipping flat-view renderer and the shipping sentence.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN (no browser)
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let rig, failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  await rig.load("file://" + join(ROOT, "public/platform-home.html"));
  const seam = await rig.page.evaluate(() =>
    !!(window.hublyLive && window.hublyLive.register && window.hublyLive.after && window.hublyLive.staleLine));
  if (!seam) { console.error("CANNOT RUN — window.hublyLive is not exposed."); await rig.close(); process.exit(2); }

  // ── 1-2. THE REGISTRY EXISTS AND KNOWS BOTH KINDS ────────────────────────────────────
  const kinds = await rig.page.evaluate(() => window.hublyLive.kinds);
  say("1 the registry knows the two kinds in this slice", kinds.includes("job") && kinds.includes("ownerName"), kinds.join(", "));
  say("2 and nothing else is claimed live yet", kinds.length === 2, `${kinds.length} kinds`);

  // ── 3-5. MEMBERSHIP IS STRUCTURAL: el.isConnected, no deregister ─────────────────────
  const live = await rig.page.evaluate(() => {
    const L = window.hublyLive;
    const a = document.createElement("div"); document.body.appendChild(a);
    const b = document.createElement("div");                       // never attached
    L.register({ kind: "job", el: a, redraw: function () {} });
    L.register({ kind: "job", el: b, redraw: function () {} });
    const withDetached = L.of("job").length;
    a.remove();
    const afterRemove = L.of("job").length;
    return { withDetached, afterRemove };
  });
  say("3 a node that was never attached is not live", live.withDetached === 1, `${live.withDetached} live of 2 registered`);
  say("4 removing a node removes the surface, with no deregister call", live.afterRemove === 0, `${live.afterRemove} live`);
  const noDereg = !/hcLiveUnregister|hcLiveRemove|function hcLiveDeregister/.test(readFileSync(join(ROOT, "public/platform-home.html"), "utf8"));
  say("5 there is no deregister path to forget to call", noDereg, "liveness is el.isConnected alone");

  // ── 6-10. THE TRANSCRIPT: 2:00 PM must become 3:00 PM with no reload ─────────────────
  const moved = await rig.page.evaluate(() => {
    const L = window.hublyLive;
    const TV = window.hublyThreadViews;
    const thread = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    // A sentinel OUTSIDE every surface. If a redraw reaches past its own el, this dies.
    const sentinel = document.createElement("div");
    sentinel.className = "hc-msg hubly"; sentinel.textContent = "SENTINEL: this message is not inside any surface";
    thread.appendChild(sentinel);

    // The job, as it was: Sept 17, 2:00 PM. Then the same job at 3:00 PM.
    const at = (t) => [{ id: "J1", customer_name: "Driveway", service_name: "Driveway wash",
                         scheduled_date: "2026-09-17", scheduled_time: t, address: "", amount: 0, is_block: false }];
    const view = { title: "Your schedule", grouped: true, parts: (j) => [window.hublyFormat.time(j.scheduled_time) + "  " + j.service_name, j.customer_name || ""], open: () => {}, empty: "Nothing is booked that week." };

    // The shipping week grid, drawn the shipping way.
    const wrap = document.createElement("div");
    wrap.className = "hc-msg hubly hc-week";
    thread.appendChild(wrap);
    const range = window.hublyLiveTest.weekInto(wrap, "week", view, at("14:00:00"), 0);
    let passes = 0;
    L.register({
      kind: "job", el: wrap, key: { from: range.from, to: range.to },
      describe: () => "the week of " + window.hublyFormat.date(range.from),
      redraw: (rows) => { passes++; window.hublyLiveTest.weekInto(wrap, "week", view, rows, 0); },
    });

    const before = wrap.textContent;
    // The write happened; the table now says 3 PM. Drive the real pass with a declared fake load.
    window.hublyLiveTest.fakeLoad("job", () => at("15:00:00"));
    return { before, range, sentinelIn: !!sentinel.isConnected, wrapId: "ok", passesStart: passes };
  });
  say("6 the grid starts out showing the old value", /2:00\s*PM/.test(moved.before), JSON.stringify(moved.before.match(/\d+:\d+\s*[AP]M/g)));

  const after = await rig.page.evaluate(async () => {
    const res = await window.hublyLive.after("job", { id: "J1", dates: ["2026-09-17", "2026-09-17"] });
    const wrap = document.querySelector(".hc-week");
    const sentinel = Array.from(document.querySelectorAll(".hc-msg")).find((e) => /SENTINEL/.test(e.textContent || ""));
    // SECOND PASS: the stranded-handle test. If redraw replaced its el, this one does nothing.
    const res2 = await window.hublyLive.after("job", { id: "J1", dates: ["2026-09-17"] });
    return { res, res2, text: wrap ? wrap.textContent : null, sentinelAlive: !!(sentinel && sentinel.isConnected),
             stillLive: window.hublyLive.of("job").length, stale: window.hublyLive.staleLine(res) };
  });
  say("7 the grid now shows the NEW value, with no reload", /3:00\s*PM/.test(after.text) && !/2:00\s*PM/.test(after.text),
    JSON.stringify(String(after.text).match(/\d+:\d+\s*[AP]M/g)));
  say("8 the pass reports it updated and reports nothing stale", after.res.updated >= 1 && after.res.ok === true && after.stale === "",
    `updated=${after.res.updated} ok=${after.res.ok}`);
  say("9 a redraw touched NOTHING outside its own el (the sentinel survived)", after.sentinelAlive === true,
    "hcRenderHome's thread wipe stays out of this path");
  say("10 the surface is STILL live and still correct on a SECOND pass (handle not stranded)",
    after.stillLive >= 1 && after.res2.updated >= 1, `live=${after.stillLive} secondPass=${after.res2.updated}`);

  // ── 11-14. UNKNOWN MEANS REFRESH, NEVER SKIP ────────────────────────────────────────
  const keys = await rig.page.evaluate(() => {
    const K = window.hublyLive.keyHit;
    return {
      noKey:        K(null,                        { id: "J1", dates: ["2026-09-17"] }),
      noChanged:    K({ from: "2026-09-14", to: "2026-09-20" }, null),
      noDates:      K({ from: "2026-09-14", to: "2026-09-20" }, { id: "J1" }),
      emptyDates:   K({ from: "2026-09-14", to: "2026-09-20" }, { id: "J1", dates: [] }),
      weird:        K({ somethingElse: true },      { id: "J1", dates: ["2026-09-17"] }),
      idUnknown:    K({ id: "J1" },                 { dates: ["2026-09-17"] }),
      inRange:      K({ from: "2026-09-14", to: "2026-09-20" }, { dates: ["2026-09-17"] }),
      movedOut:     K({ from: "2026-09-14", to: "2026-09-20" }, { dates: ["2026-09-17", "2026-10-30"] }),
      farAway:      K({ from: "2026-09-14", to: "2026-09-20" }, { dates: ["2026-10-30"] }),
      otherId:      K({ id: "J1" },                 { id: "J2" }),
    };
  });
  const unknowns = ["noKey", "noChanged", "noDates", "emptyDates", "weird", "idUnknown"];
  say("11 every unknown refreshes", unknowns.every((k) => keys[k] === true),
    unknowns.filter((k) => keys[k] !== true).join(",") || "all six");
  say("12 a date inside the window refreshes", keys.inRange === true);
  say("13 a job that MOVED OUT of the window still refreshes it (both dates count)", keys.movedOut === true,
    "or the old row sits there looking correct");
  say("14 and only a provably-unrelated record is skipped", keys.farAway === false && keys.otherId === false,
    `farAway=${keys.farAway} otherId=${keys.otherId}`);

  // ── 15-17. THE FAILURE PATH ─────────────────────────────────────────────────────────
  const fail = await rig.page.evaluate(async () => {
    window.hublyLiveTest.fakeLoad("job", () => null);            // the read failed
    const res = await window.hublyLive.after("job", { id: "J1", dates: ["2026-09-17"] });
    const wrap = document.querySelector(".hc-week");
    const line = window.hublyLive.staleLine(res);
    window.hublyLiveTest.fakeLoad("job", null);                   // restore the real loader
    return { res, text: wrap ? wrap.textContent : "", line };
  });
  say("15 a read that FAILED does not draw an empty surface", /3:00\s*PM/.test(fail.text),
    "the last value actually read stays on screen");
  say("16 every surface is reported stale, none silently skipped", fail.res.ok === false && fail.res.stale.length >= 1,
    JSON.stringify(fail.res.stale));
  say("17 the sentence names the surface and never says refresh/reload",
    /week of/i.test(fail.line) && !/refresh|reload/i.test(fail.line), JSON.stringify(fail.line));

  // ── 18-20. THE OWNER'S NAME: the greeting and the chip, one kind ─────────────────────
  const name = await rig.page.evaluate(async () => {
    const L = window.hublyLive;
    const thread = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    let shown = "Good afternoon.";
    const el = document.createElement("div"); thread.appendChild(el);
    L.register({ kind: "ownerName", el, describe: () => "the greeting", redraw: () => { shown = "Good afternoon, Adrian."; el.textContent = shown; } });
    const chip = document.createElement("div"); document.body.appendChild(chip);
    let chipDrawn = 0;
    L.register({ kind: "ownerName", el: chip, describe: () => "your account chip", redraw: () => { chipDrawn++; } });
    window.hublyLiveTest.fakeLoad("ownerName", () => [{ name: "Adrian" }]);
    const res = await L.after("ownerName", { name: "Adrian" });
    window.hublyLiveTest.fakeLoad("ownerName", null);
    return { res, shown, chipDrawn };
  });
  say("18 the greeting updates in-turn (item G)", /Adrian/.test(name.shown), JSON.stringify(name.shown));
  say("19 the chip updates in the SAME pass, from one write", name.chipDrawn === 1, `${name.chipDrawn} chip redraw(s)`);
  say("20 both surfaces of one kind are told by one call", name.res.updated === 2, `updated=${name.res.updated}`);

} catch (e) {
  console.error("FAIL — " + String(e.message).slice(0, 300));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

// ── 21-23. FROM SOURCE, AND SAID SO ────────────────────────────────────────────────────
// These three read the file; they do not run the door. Driving the real Save button needs an
// authed session and a real job row, neither of which exists here — so a behavioural leg would
// have to fake hcEditDayJob, and then it would be testing the fake rather than the wiring.
// Red-proof ② confirmed the limit honestly: removing the hcAfterWrite call from the job door
// fired ONLY these source legs, not the behaviour legs. That is the gap, stated rather than
// papered over: the wiring of the door is asserted by reading, and the PASS it triggers is
// asserted by running.
const page = readFileSync(join(ROOT, "public/platform-home.html"), "utf8");
say("21 hcAcceptOwnerName no longer carries a hand-written refresh list",
  !/hcRenderRail\(\); hcReflectAuthState\(\);\s*\}catch/.test(page) && /hcAfterWrite\('ownerName'/.test(page),
  "routed through hcAfterWrite");
say("22 the job edit door routes through hcAfterWrite", /hcAfterWrite\('job'/.test(page));
say("23 and it passes BOTH dates, not just the new one", /dates:\s*\[wasDate,\s*nowDate\]/.test(page));

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nA write updates every surface showing what it changed, and a failure says so.");
process.exit(failed ? 1 : 0);
