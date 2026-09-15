#!/usr/bin/env node
/**
 * MY DAY: IT RENDERS WHAT THE TABLES HOLD, IT CAN BE CHANGED BY HAND, AND A SENTENCE REACHES IT.
 *
 *   node scripts/check-day-is-reachable.mjs
 *
 * THE THREE THINGS THAT WERE BROKEN, 2026-09-15, on a real walk:
 *
 *   (b) THE DAY DID NOT SHOW WHAT WAS ON IT. Measured on hubly-classic-fixture, the business he
 *       actually walked: `jobs` holds 2 rows — a block, "doctor's appointment", 2026-09-16
 *       07:00, 2 hours; and a job, "driveway", 2026-09-17 14:00, 14 Maple St, $180. `tasks`
 *       holds 0. The window was today..tomorrow, so THE DRIVEWAY JOB WAS INVISIBLE — and Hubly
 *       had already told him "you also have the driveway job Thursday at 2:00". The room broke a
 *       promise Hubly made two messages earlier.
 *
 *   (c) NOTHING ON THE DAY COULD BE CHANGED. "on the job change it instead of drive way change
 *       it" -> "I can't change an existing job from here yet." True: create_business_job only
 *       inserted. update_business_job (20260915040000) is the writer; the panel is its hand door.
 *
 *   the door: "take me to my schedule" -> "I can't take you to the schedule from here yet."
 *       The Planner room was built, rendered, and unreachable from a sentence. A missing door,
 *       not a missing feature — the fourth time that diagnosis has been the right one.
 *
 * SIMULATED AND SAID SO: no session. `window.supabase` is a declared fake returning the two REAL
 * rows measured above, and the renderers, the room, the sentences and the door are the shipping
 * code in public/platform-home.html. The WRITE itself was exercised against the live database
 * separately and is recorded in the commit message (not_owner, no_job and no_change all refused;
 * a real time+address change read back from the table by a separate select, then restored).
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

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Hubly Classic Fixture", url: "https://hubly-classic-fixture.myhubly.app", hasPage: true };

/** THE TWO REAL ROWS, dated relative to "today" so the check does not rot the moment the
 *  calendar moves past 2026-09-17. The SHAPE is the measured shape: one block tomorrow at
 *  07:00 for two hours, one priced job two days out at 14:00 with an address. */
function fakeBackend(opts) {
  const W = window;
  W.__dayRig = { updates: [] };
  const okData = (data) => Promise.resolve({ data, error: null });
  // THE FAKE HONOURS .eq, and it has to. The first version ignored it, so the read-back after
  // the hand edit fetched the FIRST job instead of the edited one and the product correctly
  // reported "the change did not take". An instrument that returns the wrong row manufactures a
  // product defect — the same shape as Lesson 69, one table over. If this check ever goes red on
  // a read-back, suspect the filter here before the writer.
  const q = (rows) => {
    let held = rows.slice();
    const t = {
      select: () => t, in: () => t, gte: () => t, lte: () => t, order: () => t, limit: () => t,
      eq: (col, val) => { held = held.filter((r) => String(r[col]) === String(val)); return t; },
      maybeSingle: () => okData(held[0] || null), single: () => okData(held[0] || null),
      then: (res, rej) => okData(held).then(res, rej),
    };
    return t;
  };
  const client = {
    auth: {
      getUser: () => okData({ user: { id: opts.uid } }),
      getSession: () => okData({ session: { access_token: "simulated.jwt.token", expires_at: Math.floor(Date.now() / 1000) + 3600 } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: (table) => q(table === "jobs" ? opts.jobs : []),
    rpc: (name, args) => {
      if (name === "get_owner_profile") return okData([{ display_name: "Adrian", name_source: "owner", welcomed_at: "2026-09-14T22:01:24Z" }]);
      if (name === "get_business_tasks") return okData(opts.tasks);
      if (name === "update_business_job") {
        W.__dayRig.updates.push(args);
        const j = opts.jobs.find((x) => x.id === args.p_job_id);
        if (!j) return okData([{ id: null, error: "no_job" }]);
        if (args.p_scheduled_time != null) j.scheduled_time = args.p_scheduled_time + ":00";
        if (args.p_address != null) j.address = args.p_address || null;
        return okData([{ ...j, error: null }]);
      }
      return okData(null);
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  };
  W.supabase = { createClient: () => client };
  try {
    localStorage.setItem("sb-rtwxxkxpkqdrhclkozma-auth-token",
      JSON.stringify({ access_token: "simulated.jwt.token", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  } catch (_) {}
  W.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null), text: () => Promise.resolve("") });
}

const iso = (offsetDays) => {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session. Two rows, the measured shape. Renderers are the product's.\n");
  const JOBS = [
    { id: "block-1", business_id: BIZ.id, customer_name: null, service_name: "doctor’s appointment", scheduled_date: iso(1),
      scheduled_time: "07:00:00", duration_hours: 2, amount: null, status: "scheduled", phone: null, email: null,
      address: null, vehicle: null, notes: null, is_block: true, paid: false },
    { id: "job-1", business_id: BIZ.id, customer_name: null, service_name: "driveway", scheduled_date: iso(2),
      scheduled_time: "14:00:00", duration_hours: null, amount: 180, status: "scheduled", phone: null, email: null,
      address: "14 Maple St", vehicle: null, notes: null, is_block: false, paid: false },
  ];

  await rig.load(PAGE);
  await rig.page.evaluate(fakeBackend, { uid: "f3f11707-783f-4cce-b4c3-dfdccfde2e57", jobs: JOBS, tasks: [] });
  const seams = await rig.page.evaluate(() => ({
    go: !!(window.hublyGoUI && window.hublyGoUI.go), edit: !!(window.hublyJobEditUI && window.hublyJobEditUI.edit),
    arrival: !!(window.hublyArrivalUI && window.hublyArrivalUI.simulate),
  }));
  if (!seams.go || !seams.edit || !seams.arrival) {
    console.error("CANNOT RUN — seams missing: " + JSON.stringify(seams)); await rig.close(); process.exit(2);
  }
  // Claim the business in the page world, then take the door the owner's sentence takes.
  await rig.page.evaluate((biz) => { window.hublyArrivalUI.simulate(biz, true); }, BIZ);
  await rig.settle(() => !!document.querySelector("#hcRail"), "rail", { stableMs: 500, ceilingMs: 6000 });

  // ── THE DOOR. "take me to my schedule" — the sentence, through the mechanism. ─────────
  const went = await rig.page.evaluate(() => window.hublyGoUI.go("planner"));
  say("1 the schedule door opens, and counts what it found",
    went && went.ok === true && went.place === "planner" && went.counted === 2,
    `ok=${went && went.ok} counted=${went && went.counted} (expected 2 rows)`);

  const afterGo = await rig.settle(() => {
    const cv = document.getElementById("hcCanvas");
    const th = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    return { room: cv ? cv.innerText.replace(/\s+/g, " ").trim() : "", said: th ? th.innerText.replace(/\s+/g, " ").trim().slice(-260) : "" };
  }, "day room", { stableMs: 700, ceilingMs: 8000 });

  // ── (b) WHAT THE TABLES HOLD IS ON IT. Both rows, including the one two days out. ─────
  say("2 the block Hubly put on his day is on the day", /doctor/i.test(afterGo.final.room) && /07:00/.test(afterGo.final.room),
    JSON.stringify(afterGo.final.room.slice(0, 160)));
  say("3 the job two days out is NOT invisible — the defect Adrian hit",
    /driveway/i.test(afterGo.final.room) && /\$180/.test(afterGo.final.room),
    /driveway/i.test(afterGo.final.room) ? "driveway present" : "DRIVEWAY MISSING (the today..tomorrow window)");
  say("4 anything past tomorrow is shown under its own name, not as today",
    /Later this week/i.test(afterGo.final.room), "'Later this week' group present");
  say("5 a block is marked as a block, never as a customer",
    /Blocked — not a customer/i.test(afterGo.final.room), "block labelled");
  say("6 the room is never empty while rows exist",
    !/Nothing booked in the next/i.test(afterGo.final.room), "no empty state over 2 rows");

  // ── WHAT IT SAID. Report, never predict — no "should", and no invented count. ─────────
  say("7 the sentence reports what is there and does not predict",
    /2 things on it/i.test(afterGo.final.said) && !/\bshould\b|\bought to\b|will probably/i.test(afterGo.final.said),
    JSON.stringify(afterGo.final.said.slice(-110)));

  // ── (c) A TIME AND A PLACE, CHANGED BY HAND. Real controls, then the write. ───────────
  const controls = await rig.page.evaluate(() => {
    const rows = document.querySelectorAll("#hcCanvas .hc-row");
    // The driveway row is the one carrying the price.
    let target = null;
    rows.forEach((r) => { if (/driveway/i.test(r.innerText)) target = r; });
    if (!target) return { opened: false };
    target.click();
    const p = document.getElementById("hcPanel") || document.querySelector(".hc-panel");
    const q = (n) => p && p.querySelector(`[data-hc-jobedit-field="${n}"]`);
    const t = q("time"), w = q("place"), s = q("save");
    return {
      opened: !!p,
      time: t ? t.tagName + ":" + t.type + ":" + t.value : null,
      place: w ? w.tagName + ":" + w.type + ":" + w.value : null,
      save: s ? s.tagName : null,
      labelled: !!(t && t.getAttribute("aria-label") && w && w.getAttribute("aria-label")),
    };
  });
  say("8 opening a day row gives real controls for the time and the place, prefilled",
    controls.opened && controls.time === "INPUT:time:14:00" && controls.place === "INPUT:text:14 Maple St" && controls.save === "BUTTON",
    `${controls.time} · ${controls.place} · ${controls.save}`);
  say("8b both controls are named for someone who cannot see them", controls.labelled === true, "aria-labels present");

  // Change the time and the place by hand, exactly as an owner would.
  const edited = await rig.page.evaluate(async () => {
    const p = document.getElementById("hcPanel") || document.querySelector(".hc-panel");
    const q = (n) => p.querySelector(`[data-hc-jobedit-field="${n}"]`);
    q("time").value = "15:30";
    q("place").value = "22 Elm Ave";
    q("save").click();
    // Poll for the sentence rather than waiting a fixed time.
    for (let i = 0; i < 60; i++) {
      const m = q("msg");
      if (m && m.textContent.trim()) return { msg: m.textContent.trim(), sent: window.__dayRig.updates.slice() };
      await new Promise((r) => setTimeout(r, 50));
    }
    return { msg: "", sent: window.__dayRig.updates.slice() };
  });
  say("9 the hand edit reaches the writer with what was typed, and nothing else",
    edited.sent.length === 1 && edited.sent[0].p_scheduled_time === "15:30" && edited.sent[0].p_address === "22 Elm Ave" &&
    edited.sent[0].p_scheduled_date === null && edited.sent[0].p_business_id === BIZ.id,
    JSON.stringify(edited.sent[0] || null));
  say("10 and it says so, naming the new time and the new place",
    /15:30|3:30/.test(edited.msg) && /22 Elm Ave/.test(edited.msg), JSON.stringify(edited.msg));

  // ── THE SENTENCES, ALL OF THEM. No failure may borrow the word "changed"/"now". ───────
  const lines = await rig.page.evaluate(() => {
    const L = window.hublyJobEditUI.line;
    return {
      noChange: L({ ok: false, error: "no_change" }),
      noJob: L({ ok: false, error: "no_job" }),
      signedOut: L({ ok: false, error: "not_signed_in" }),
      notOwner: L({ ok: false, error: "not_owner" }),
      unreadable: L({ ok: false, error: "not_readable_back" }),
      didNotTake: L({ ok: false, error: "did_not_take" }),
      unknown: L({ ok: false, error: "something_else" }),
      nothing: L(null),
    };
  });
  const all = Object.values(lines);
  say("11 every failure says something, and something different", all.every((s) => s && s.length > 8) && new Set(all).size === all.length,
    `${all.length} outcomes, ${new Set(all).size} distinct sentences`);
  say("12 no failure claims the job is now anything",
    !all.some((s) => / is now /i.test(s)), JSON.stringify(all.filter((s) => / is now /i.test(s))));
  // THE SHARP ONE: sent but not read back is NOT a success, and neither is read-back that
  // still holds the old value. A writer's own word is not the record (prohibition 3).
  say("13 a write that could not be read back does not claim it took",
    /could not read it back/i.test(lines.unreadable) && /did not take/i.test(lines.didNotTake),
    JSON.stringify([lines.unreadable, lines.didNotTake]));

  // ── THE DOOR REFUSES WHAT IT CANNOT DO, AND SAYS WHY. ────────────────────────────────
  const bad = await rig.page.evaluate(() => window.hublyGoUI.go("leads"));
  say("14 a place that does not exist is refused, not opened", bad && bad.ok === false && bad.error === "unknown_place",
    JSON.stringify(bad));
  const goLines = await rig.page.evaluate(() => {
    const L = window.hublyGoUI.line;
    return { none: L("planner", 0), one: L("planner", 1), many: L("planner", 5), unknown: L("planner", null), noPlace: L("nowhere", 3) };
  });
  say("15 a room it could not read is said to be unread, never reported as empty",
    /could not read/i.test(goLines.unknown) && !/nothing is on it/i.test(goLines.unknown) && /Nothing is on it/i.test(goLines.none),
    JSON.stringify([goLines.unknown, goLines.none]));
  say("16 no sentence from the door predicts our own behaviour",
    !Object.values(goLines).some((s) => /\bshould\b|\bought to\b|will probably/i.test(s)),
    "no should/ought/probably");

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 500));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe day shows what the tables hold, it can be changed by hand, and a sentence reaches it.");
process.exit(failed ? 1 : 0);
