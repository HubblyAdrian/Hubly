#!/usr/bin/env node
/**
 * MY DAY, FLOOR (a): A PERSON CAN TYPE INTO THEIR DAY BY HAND.
 *
 *   node scripts/check-day-add-by-hand.mjs
 *
 * MEASURED FIRST, and it was the shape we predicted: `tasks` holds ZERO rows across every
 * business, while `create_task`, `get_business_tasks`, `set_task_status` and `roll_task` have
 * existed the whole time and the client has never called the writer. Zero is not "nobody wants
 * a planner" — it is what a missing door looks like from the database, the same diagnosis as
 * 255 jobs with no creator earlier the same day.
 *
 * This asserts the DOOR, in the product's own page: the add row exists in every state of the
 * room (including the empty one, which is the state every business is in), it is real controls
 * rather than a description of them, and the composer refuses to say "added" for anything that
 * was not written AND read back from the table.
 *
 * SIMULATED AND SAID SO: there is no session, so the WRITE itself is exercised against the
 * live database separately (see the commit message: created, read back from the table,
 * not_owner and no_title both refused). What runs here is the room, the controls and the
 * sentences — the shipping code, through one declared seam.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN (no browser)
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let rig, failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  await rig.load("file://" + join(ROOT, "public/platform-home.html"));
  // THE DECLARED FAKE. Leg 6 presses the real button, and a real button needs a backend to write
  // through — without one the press would be measuring a rejection, not the control.
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "Adrian", tables: { jobs: [], tasks: [] },
  });
  const seam = await rig.page.evaluate(() => !!(window.hublyDayUI && window.hublyDayUI.add && window.hublyDayUI.line));
  if (!seam) { console.error("CANNOT RUN — window.hublyDayUI is not exposed."); await rig.close(); process.exit(2); }

  // ── THE SENTENCES, RUN. Only a write that read back may say "added". ──────────────
  const lines = await rig.page.evaluate(() => {
    const L = window.hublyDayUI.line;
    return {
      ok: L({ ok: true, task: { title: "Order glass cleaner", due_date: "2026-09-15", due_time: "14:30:00" } }),
      noTitle: L({ ok: false, error: "no_title" }),
      signedOut: L({ ok: false, error: "not_signed_in" }),
      unreadable: L({ ok: false, error: "not_readable_back" }),
      unknown: L({ ok: false, error: "something_else" }),
      nothing: L(null),
    };
  });
  const CLAIMS = /\badded\b|\bon your day\b|\bsaved\b/i;
  say("1 a real write names the thing and when it is", /Order glass cleaner/.test(lines.ok) && /14:30|2:30/.test(lines.ok), JSON.stringify(lines.ok));
  say("2 every failure says something", [lines.noTitle, lines.signedOut, lines.unreadable, lines.unknown, lines.nothing].every((s) => s && s.length > 8), "five outcomes, five sentences");
  say("3 no failure claims it was added", ![lines.noTitle, lines.signedOut, lines.unknown, lines.nothing].some((s) => /\badded\b/i.test(s)),
    JSON.stringify([lines.noTitle, lines.signedOut, lines.unknown, lines.nothing]).slice(0, 150));
  // THE SHARP ONE: written but not readable back is NOT a success. A writer's own word is not
  // the record (prohibition 3), and the sentence must not borrow its confidence.
  say("4 a write that could not be read back does not claim the day has it",
    !/\badded\b/i.test(lines.unreadable) && /could not read it back/i.test(lines.unreadable), JSON.stringify(lines.unreadable));

  // ── THE ROOM, RENDERED. The add row is real controls, built by the product. ───────
  const room = await rig.page.evaluate(() => {
    const el = document.createElement("div");
    el.className = "hc-room";
    document.body.appendChild(el);
    const form = window.hublyDayUI.addRow(el, { id: "00000000-0000-0000-0000-000000000000" });
    const q = (n) => el.querySelector(`[data-hc-day="${n}"]`);
    const time = q("time"), what = q("what"), where = q("where"), add = q("add");
    return {
      inRoom: !!(form && form.parentNode === el),
      time: time ? time.tagName + ":" + time.type : null,
      what: what ? what.tagName + ":" + what.type : null,
      where: where ? where.tagName + ":" + where.type : null,
      add: add ? add.tagName : null,
      labelled: !!(time && time.getAttribute("aria-label") && what && what.getAttribute("aria-label")),
    };
  });
  say("5 the add row is real controls in the room, not a description of them",
    room.inRoom && room.time === "INPUT:time" && room.what === "INPUT:text" && room.where === "INPUT:text" && room.add === "BUTTON",
    `${room.time} · ${room.what} · ${room.where} · ${room.add}`);
  say("5b every control is named for someone who cannot see it", room.labelled === true, "aria-labels present");

  // ══ AND A PERSON CAN ACTUALLY PRESS IT. ═══════════════════════════════════════════════════
  //
  // ADDED 2026-09-17. Every leg above proves the form is BUILT; none of them proved it RESPONDS.
  // Adrian: "A CHECK THAT CALLS THE FUNCTION IS NOT A CHECK THAT THE CONTROL WORKS." This file
  // called `hublyDayUI.add(...)` for its outcome sentences and `hublyDayUI.addRow(...)` for its
  // markup, and never once pressed the button between them — which is exactly how a page came to
  // say "Double-click to add something" with no dblclick handler anywhere and every check green.
  //
  // So this leg types into the real inputs and SUBMITS the real form, and asserts the product said
  // something back on the form itself.
  const pressed = await rig.page.evaluate(async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    window.hublyCaptureUI.withBusiness("5ebedc20-1061-46b9-b393-a6ef57225910");
    const form = window.hublyDayUI.addRow(el, { id: "5ebedc20-1061-46b9-b393-a6ef57225910" });
    const q = (n) => el.querySelector(`[data-hc-day="${n}"]`);
    q("what").value = "order glass cleaner";
    q("time").value = "09:00";
    const before = (window.__rig.writes || []).filter((w) => w.name === "create_task").length;
    // THE REAL EVENT. A submit, on the real form, as a person pressing Add produces.
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 700));
    const after = (window.__rig.writes || []).filter((w) => w.name === "create_task");
    const msg = (q("msg") || {}).textContent || "";
    el.remove();
    return { wrote: after.length - before, title: after.length ? after[after.length - 1].args.p_title : null, msg };
  });
  say("6 SUBMITTING the real form writes — the control, not the writer behind it",
    pressed.wrote === 1 && pressed.title === "order glass cleaner",
    `${pressed.wrote} write(s), title ${JSON.stringify(pressed.title)}`);
  say("7 and it says what happened, on the form he pressed",
    pressed.msg.length > 5 && !/^\s*$/.test(pressed.msg), JSON.stringify(pressed.msg.slice(0, 80)));

} catch (e) {
  console.error("FAIL — " + String(e.message).slice(0, 240));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

// ── AND THE DAY OFFERS THE DOOR IN THE STATE EVERY BUSINESS IS IN: EMPTY ────────────────
//
// WAS: a source-order assertion inside hcRenderPlanner ("the add row comes before the empty-state
// return"). That room is deleted — it was the old day, unreachable since the 2026-09-17 reversal —
// so the leg was reading the source of a surface nobody could open. The RULE it was protecting is
// real and survives it: an empty day must still offer a way in, because empty is the state every
// business starts in. Asserted on the surface that ships, by rendering it with nothing on it.
import { openRig as openRig2 } from "./lib/browser-rig.mjs";
let rig2;
try { rig2 = await openRig2(); } catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }
try {
  await rig2.load("file://" + join(ROOT, "public/platform-home.html"));
  await rig2.page.evaluate(installOwnerFake, { uid: "sim-owner", email: "sim@example.com", tables: { jobs: [], tasks: [] } });
  const empty = await rig2.page.evaluate(async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await window.hublyDayUI.render(host, { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "x" });
    return { rows: host.querySelectorAll(".hcmd-row").length,
             doors: host.querySelectorAll('[data-hc-day="add-open"]').length,
             hours: host.querySelectorAll('[data-hc-day="cal-hour"]').length };
  });
  say("8 an EMPTY day still offers a way in — the state every business starts in",
    empty.rows === 0 && empty.doors >= 1 && empty.hours >= 1,
    `${empty.rows} rows · ${empty.doors} add door(s) · ${empty.hours} calendar hours`);
} finally { try { await rig2.close(); } catch (_) {} }

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nA person can type into their day, and only a write that read back says so.");
process.exit(failed ? 1 : 0);
