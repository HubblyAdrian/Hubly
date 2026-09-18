#!/usr/bin/env node
/**
 * [RULE] A PERSON CAN ACTUALLY ADD SOMETHING — PROVEN BY DISPATCHING THE REAL EVENT.
 *
 *   node scripts/check-day-controls-work.mjs
 *
 * ══ THE LESSON THIS FILE EXISTS FOR ══════════════════════════════════════════════════════════
 *
 * ADRIAN, 2026-09-17: "A CHECK THAT CALLS THE FUNCTION IS NOT A CHECK THAT THE CONTROL WORKS.
 * check-day-is-reachable passed. check-band-rule passed. 15 legs green. AND HE CANNOT ADD ANYTHING
 * BY DOUBLE-CLICKING. The checks drive hublyDayUI seams directly, so the mechanism is proven and
 * THE INTERACTION IS NOT."
 *
 * He was right, and the gap was total: **there was no `dblclick` handler anywhere in
 * platform-home.html.** The page said "Double-click to add something…" in three places and nothing
 * listened. Every existing day check passed, because every existing day check called
 * `window.hublyDayUI.add(...)` — the writer behind the control — and never touched the control.
 *
 * SO EVERY LEG BELOW DISPATCHES A REAL EVENT ON A REAL ELEMENT: `click` on the `+` button, `dblclick`
 * on the band, `click` and `Enter` on a calendar hour. Not one of them calls the function.
 *
 * ══ AND THE GESTURE ITSELF WAS WRONG ═════════════════════════════════════════════════════════
 *
 * Double-click does not exist on touch (a double-tap is zoom), means "open" not "create" on desktop,
 * and was taught only by the line of copy that named it. The `+` button was already rendered as a
 * real `<button>` and had no handler — a missing door, not a missing feature. Single click now
 * works, the calendar hour works and carries its time, and `dblclick` is still honoured so nobody
 * who learned it loses it.
 *
 * [RULE]: every leg is "a person touching this thing gets the form". None asserts a class name
 * beyond the identity of the control being touched.
 *
 * SIMULATED AND SAID SO: no session, no network. The bands, the calendar, the form and the handlers
 * are the shipping product's; the jobs and tasks are declared fakes.
 *
 * ══ RED-PROOFED PER LEG (the 2026-09-17 additions) ══════════════════════════════════════════
 *
 *   11b  the add line back to empty-bands-only        -> 11b
 *   12   the day controls not rendered                -> 12 (and the run dies, which is red)
 *   12,13 ‹ wired to nothing                          -> 12, 13
 *   15   Today never disabled                         -> 15
 *   16,17 the date field's change handler emptied     -> 16, 17
 *   17   the glance heading hardcoded to "Today"      -> 17
 *   18   the add form back to `new Date()`            -> 18
 *
 * TWO INSTRUMENT DEFECTS THIS FOUND IN ITSELF, both of the same family — measuring the control
 * instead of the surface:
 *   · `dayOf()` read the date FIELD's value, which is whatever was last typed into it, so a
 *     picker that moved nothing passed. It reads the date the day RENDERED now.
 *   · the day was drawn into a bare <div>, which hcRepaintDay does not know about, so every
 *     control that works by redrawing looked dead. It is drawn as a real `.hc-inthread-day`,
 *     and the check sets `draftClaimed` — the state this surface only ever exists in.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture", name: "Fixture" };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TODAY = iso(new Date());

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

/** Renders the REAL day into a node and returns a handle for touching things in it. */
const draw = async (jobs) => {
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "Adrian",
    tables: { jobs: jobs || [], tasks: [] },
  });
  await rig.page.evaluate((id) => { window.hublyCaptureUI.withBusiness(id); }, BIZ.id);
  // CLAIMED, BECAUSE THIS SURFACE ONLY EXISTS FOR A CLAIMED OWNER — and because hcRepaintDay
  // refuses to redraw anything when `draftClaimed` is false. Without it every control that works
  // by REDRAWING looks dead here while working in the product: the state the check runs in was
  // the thing under test, which is the "a green test on a draft proves nothing about a claimed
  // site" rule arriving inside a harness.
  await rig.page.evaluate((biz) => { window.__setClaimed(true); }, BIZ);
  return rig.page.evaluate(async ({ biz }) => {
    const host = document.createElement("div");
    host.id = "daytest";
    // A REAL LIVE DAY SURFACE, not a detached div. hcRepaintDay redraws the planner canvas and
    // every `.hc-inthread-day` — a bare node is neither, so every control that works by REDRAWING
    // (the day controls) would look dead here while working in the product. The in-thread day is
    // one of the two surfaces that actually ship; this is that one.
    host.className = "hc-inthread-day";
    document.body.appendChild(host);
    await window.hublyDayUI.render(host, biz);
    return { bands: host.querySelectorAll(".hcmd-band").length,
             addButtons: host.querySelectorAll('[data-hc-day="add-open"]').length,
             hours: host.querySelectorAll('[data-hc-day="cal-hour"]').length };
  }, { biz: BIZ });
};

try {
  console.log("SIMULATED — no session, no network. The controls and their handlers are the product's.\n");
  const drawn = await draw([]);
  say("1 the day renders its bands, its + buttons and its calendar hours",
      drawn.bands >= 3 && drawn.addButtons >= 1 && drawn.hours >= 1,
      `${drawn.bands} bands · ${drawn.addButtons} + buttons · ${drawn.hours} calendar hours`);

  // ── THE COPY MUST NOT PROMISE A GESTURE IT CANNOT KEEP ────────────────────────────────
  const copy = await rig.page.evaluate(() => ({
    line: window.hublyDayUI.addLine,
    onPage: (document.getElementById("daytest") || document.body).textContent,
  }));
  /* ══ L98 — "NO DOUBLE-CLICK" IS TRUE OF AN EMPTY STRING ══════════════════════════════════════
   * `copy.line` is `window.hublyDayUI.addLine`. If the seam is gone, renamed, or the day never
   * rendered, `line` is undefined and `onPage` is "" — and both negations pass. **This is the leg
   * guarding the double-click scar**, one of the three-for-three: a check written against one
   * surface while the person was on another. A leg that passes when the surface is absent is the
   * same failure wearing a different coat. The positive clause is that there IS copy to inspect. */
  declareBreak({
    leg: "2 there IS add-copy",
    why: "put the dead gesture back in the add-row copy — instruct a double-click, which does not " +
         "exist on touch, on the surface Adrian was actually looking at",
    file: "public/platform-home.html",
    find: "  var HC_DAY_ADD_LINE = ",
    with: "  var HC_DAY_ADD_LINE = 'Double-click a slot to add something. ' + ",
  });
  say("2 there IS add-copy, and it does not instruct a gesture that does not exist on touch",
      typeof copy.line === "string" && copy.line.length > 0 &&
      !/double[- ]?click/i.test(copy.line) && !/double[- ]?click/i.test(copy.onPage),
      `${copy.line ? copy.line.length : 0} char(s) of add-copy were read — a zero means the seam or ` +
      `the render is gone, not that the gesture is absent — and it names no double-click: ` +
      JSON.stringify(copy.line));

  // ── A REAL CLICK ON THE + BUTTON ──────────────────────────────────────────────────────
  const plus = await rig.page.evaluate(async () => {
    const host = document.getElementById("daytest");
    const btn = host.querySelector('[data-hc-day="add-open"]');
    if (!btn) return { pressed: false };
    // THE REAL EVENT, ON THE REAL ELEMENT. Not hublyDayUI.openAdd(), not .addRow() — the thing a
    // person's finger lands on.
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 250));
    const form = host.querySelector("[data-hc-day-add]");
    return { pressed: true, form: !!form,
             fields: form ? [...form.querySelectorAll("[data-hc-day]")].map((e) => e.getAttribute("data-hc-day")) : [],
             focused: document.activeElement ? document.activeElement.getAttribute("data-hc-day") : null };
  });
  say("3 CLICKING the + button opens the add form — the control, not the function behind it",
      plus.pressed && plus.form === true, `form appeared=${plus.form}`);
  say("4 and the form is the real one, with the fields that write",
      ["time", "what", "where", "add"].every((f) => plus.fields.includes(f)), plus.fields.join(","));
  say("5 and it takes focus, so he is typing rather than hunting for it",
      plus.focused === "what", `focus is on ${JSON.stringify(plus.focused)}`);

  // ── A REAL DOUBLE-CLICK ON THE BAND ──────────────────────────────────────────────────
  await draw([]);
  const dbl = await rig.page.evaluate(async () => {
    const host = document.getElementById("daytest");
    const band = host.querySelector(".hcmd-band");
    band.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 250));
    return { form: !!host.querySelector("[data-hc-day-add]") };
  });
  say("6 DOUBLE-CLICKING a band opens it too — the gesture he was promised still works",
      dbl.form === true, "dblclick honoured");

  // ── A REAL CLICK ON A CALENDAR HOUR, WHICH IS ALSO THE TIME ──────────────────────────
  await draw([{ id: "j1", business_id: BIZ.id, scheduled_date: TODAY, scheduled_time: "14:00",
                customer_name: "Marcus", service_name: "Full Detail", is_block: false, amount: 85 }]);
  const hour = await rig.page.evaluate(async () => {
    const host = document.getElementById("daytest");
    const rows = [...host.querySelectorAll('[data-hc-day="cal-hour"]')];
    const two = rows.filter((r) => r.getAttribute("data-hour") === "14")[0] || rows[0];
    const label = two.getAttribute("aria-label");
    two.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 250));
    const form = host.querySelector("[data-hc-day-add]");
    return { hourTouched: two.getAttribute("data-hour"), label,
             form: !!form, time: form ? form.querySelector('[data-hc-day="time"]').value : null };
  });
  say("7 CLICKING 2 PM on the calendar opens the form — if he can see it he can change it from there",
      hour.form === true, `touched hour ${hour.hourTouched}`);
  say("8 and the hour he touched IS the time — touching 2 PM is the statement of when",
      hour.time === "14:00", `time field = ${JSON.stringify(hour.time)}`);
  say("9 the hour is a named, focusable control, not a clickable div a mouse alone can find",
      /add something at/i.test(hour.label || ""), JSON.stringify(hour.label));

  const key = await rig.page.evaluate(async () => {
    const host = document.getElementById("daytest");
    host.querySelectorAll("[data-hc-day-add]").forEach((e) => e.remove());
    const row = host.querySelector('[data-hc-day="cal-hour"]');
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 250));
    return { form: !!host.querySelector("[data-hc-day-add]") };
  });
  say("10 and ENTER opens it too — reachable without a mouse", key.form === true, "keyboard reaches it");

  // ── ONE FORM AT A TIME ───────────────────────────────────────────────────────────────
  const once = await rig.page.evaluate(async () => {
    const host = document.getElementById("daytest");
    const rows = [...host.querySelectorAll('[data-hc-day="cal-hour"]')].slice(0, 3);
    for (const r of rows) { r.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); await new Promise((x) => setTimeout(x, 120)); }
    const forms = host.querySelectorAll("[data-hc-day-add]");
    const t = forms.length ? forms[forms.length - 1].querySelector('[data-hc-day="time"]').value : null;
    return { forms: forms.length, time: t, lastHour: rows[rows.length - 1].getAttribute("data-hour") };
  });
  // ══ THE DOOR IS IN EVERY BAND, NOT ONLY AN EMPTY ONE ═══════════════════════════════════════
  //
  // The add line rendered only when a band was EMPTY, so on a day with something in every band
  // there was no + anywhere and the calendar hours were the only remaining door — which nothing
  // on screen announces. Asserted on a day that HAS things in it, because that is the state the
  // old behaviour was wrong in and the state a working owner is in.
  const full = await draw([
    { id: "f1", business_id: BIZ.id, customer_name: "Leslie", service_name: "Full Detail",
      scheduled_date: TODAY, scheduled_time: "12:00:00", duration_hours: 2, amount: 180,
      status: "scheduled", is_block: false },
  ]);
  const doors = await rig.page.evaluate(() => {
    const bands = [...document.querySelectorAll("#daytest .hcmd-band")];
    return bands.map((b) => ({
      band: b.getAttribute("data-band"),
      rows: b.querySelectorAll(".hcmd-row").length,
      doors: b.querySelectorAll('[data-hc-day="add-open"]').length,
    }));
  });
  say("11b EVERY band offers a way in — the ones with something in them too",
      doors.length >= 3 && doors.every((d) => d.doors >= 1) && doors.some((d) => d.rows > 0),
      doors.map((d) => `${d.band}: ${d.rows} row(s), ${d.doors} door(s)`).join(" · "));

  // ══ AND HE CAN LOOK AT ANOTHER DAY. Built 2026-09-17; the model had no controls. ═══════════
  //
  // `hc._dayISO` decided which day this surface drew from the day it was written, and nothing
  // could change it — no Today, no arrows, no picker, while the approved drawing has all four.
  // Every leg here PRESSES the control and reads the date the surface then draws.
  // READ WHAT THE SURFACE DREW, never the control the test just typed into. The date FIELD's
  // value is whatever was last set in it — including by this check — so asserting on it made a
  // picker that changed nothing look like it worked (caught on the first run of leg 16).
  const dayOf = () => rig.page.evaluate(() => {
    const el = document.querySelector("#daytest .hcmd-date");
    return el ? el.textContent.trim() : null;
  });
  const press = (sel) => rig.page.evaluate(async (sel) => {
    const el = document.querySelector("#daytest " + sel);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 400));
    return true;
  }, sel);

  const startDay = await dayOf();
  const okPrev = await press('[data-hc-day="prev"]');
  const afterPrev = await dayOf();
  const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  say("12 PRESSING ‹ moves the whole surface to the day before",
      okPrev && !!afterPrev && dayDiff(afterPrev, startDay) === 1, `${startDay} -> ${afterPrev}`);

  const okNext = await press('[data-hc-day="next"]');
  say("13 and › comes back", (await dayOf()) === startDay, `back to ${await dayOf()}`);

  await press('[data-hc-day="prev"]');
  const todayState = await rig.page.evaluate(() => {
    const b = document.querySelector('#daytest [data-hc-day="today"]');
    return { disabledOnAnotherDay: b.disabled };
  });
  const okToday = await press('[data-hc-day="today"]');
  const backHome = await dayOf();
  say("14 Today is pressable only when he is NOT on today, and it brings him back",
      todayState.disabledOnAnotherDay === false && okToday && backHome === startDay,
      `on another day it was enabled: ${!todayState.disabledOnAnotherDay} · landed on ${backHome}`);
  const onToday = await rig.page.evaluate(() => document.querySelector('#daytest [data-hc-day="today"]').disabled);
  say("15 and on today it says so by being unavailable, rather than doing nothing when pressed",
      onToday === true, "Today is disabled while he is on today");

  const picked = await rig.page.evaluate(async () => {
    const el = document.querySelector('#daytest .hcmd-navdate');
    const d = new Date(); d.setDate(d.getDate() + 9);
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    el.value = iso;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 450));
    // WHAT THE SURFACE DREW: the date line it rendered, and the glance heading beside it.
    const drew = document.querySelector('#daytest .hcmd-date');
    return { asked: iso, drew: drew ? drew.textContent.trim() : null,
             drewISO: (() => { const d = drew ? new Date(drew.textContent.trim()) : null;
               return d && !isNaN(d) ? d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") : null; })(),
             heading: (document.querySelector('#daytest .hcmd-cardh') || {}).textContent || "" };
  });
  say("16 a real date field takes him to a real date — and the SURFACE is what moved",
      picked.drewISO === picked.asked, `asked ${picked.asked} · the day drew "${picked.drew}"`);
  // A CARD CALLED "TODAY" BESIDE NEXT WEEK'S ROWS IS A FALSE STATEMENT ABOUT WHICH DAY HE IS ON.
  say("17 and the glance card stops calling it Today when it is not today",
      !/^today/i.test(picked.heading.trim()), JSON.stringify(picked.heading.trim()));

  // ══ THE SILENT WRONG-DATE WRITE, CAUGHT BY THE SAME CHANGE THAT COULD HAVE CAUSED IT ═══════
  //
  // The add form wrote `new Date()` unconditionally. That was harmless while the surface could
  // only ever draw today; the moment these controls existed it meant "add something while looking
  // at next Tuesday" would put it on TODAY and say it was added — a true-sounding sentence about
  // a thing that is not where he put it.
  const wrote = await rig.page.evaluate(async () => {
    const host = document.getElementById("daytest");
    host.querySelectorAll("[data-hc-day-add]").forEach((e) => e.remove());
    const btn = host.querySelector('[data-hc-day="add-open"]');
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 250));
    const form = host.querySelector("[data-hc-day-add]");
    form.querySelector('[data-hc-day="what"]').value = "sharpen the blades";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 600));
    const w = (window.__rig.writes || []).filter((x) => x.name === "create_task");
    const drew = document.querySelector('#daytest .hcmd-date');
    const d = drew ? new Date(drew.textContent.trim()) : null;
    return { date: w.length ? w[w.length - 1].args.p_due_date : null,
             shown: d && !isNaN(d) ? d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") : null };
  });
  say("18 adding something while looking at another day puts it on THAT day",
      wrote.date === wrote.shown, `wrote ${JSON.stringify(wrote.date)} while showing ${wrote.shown}`);

  say("11 touching three hours moves ONE form and re-seeds it — never three stacked",
      once.forms === 1 && once.time === String(once.lastHour).padStart(2, "0") + ":00",
      `${once.forms} form(s), seeded ${once.time} from hour ${once.lastHour}`);
} finally { await rig.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — the + button, the double-click and the calendar hour all open the form, by real events.\n");
process.exit(failed ? 1 : 0);
