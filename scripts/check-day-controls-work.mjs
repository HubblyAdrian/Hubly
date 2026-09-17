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
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";

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
  return rig.page.evaluate(async ({ biz }) => {
    const host = document.createElement("div");
    host.id = "daytest";
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
  say("2 the page no longer instructs a gesture that does not exist on touch",
      !/double[- ]?click/i.test(copy.line) && !/double[- ]?click/i.test(copy.onPage),
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
  say("11 touching three hours moves ONE form and re-seeds it — never three stacked",
      once.forms === 1 && once.time === String(once.lastHour).padStart(2, "0") + ":00",
      `${once.forms} form(s), seeded ${once.time} from hour ${once.lastHour}`);
} finally { await rig.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — the + button, the double-click and the calendar hour all open the form, by real events.\n");
process.exit(failed ? 1 : 0);
