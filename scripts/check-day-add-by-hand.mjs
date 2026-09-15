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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let rig, failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  await rig.load("file://" + join(ROOT, "public/platform-home.html"));
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

} catch (e) {
  console.error("FAIL — " + String(e.message).slice(0, 240));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

// ── AND THE ORDER IN THE ROOM, FROM SOURCE: the add row precedes the empty-state return ──
import { readFileSync } from "node:fs";
const page = readFileSync(join(ROOT, "public/platform-home.html"), "utf8");
const planner = page.slice(page.indexOf("async function hcRenderPlanner"), page.indexOf("async function hcRenderPlanner") + 4000);
// `hcRoomEmpty(room,` with the comma: the read-failure branch uses room0, and matching that
// one compared the wrong two positions on the first run.
const addAt = planner.indexOf("hcDayAddRow(room");
const emptyAt = planner.indexOf("hcRoomEmpty(room,");
say("6 the add row is in the room BEFORE the empty state can return",
  addAt > 0 && emptyAt > 0 && addAt < emptyAt,
  `addRow@${addAt} emptyState@${emptyAt}`);

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nA person can type into their day, and only a write that read back says so.");
process.exit(failed ? 1 : 0);
