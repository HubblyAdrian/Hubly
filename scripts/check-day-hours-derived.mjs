#!/usr/bin/env node
/**
 * EVERY HOUR IN THE RENDERED RANGE HAS A ROW. THE SEQUENCE IS DERIVED, NEVER TRANSCRIBED.
 *
 *   node scripts/check-day-hours-derived.mjs
 *
 * WHY THIS EXISTS. `docs/design/my-day-2026-09-16-final.png` is the approved current design, and
 * its calendar column reads 6 AM … 4 PM, 5 PM, **7 PM**, 8 PM — FOURTEEN labels across a
 * FIFTEEN-hour span. **6 PM is missing.** It is a slip in the drawing, found by opening the image
 * rather than reading its description.
 *
 * Adrian's ruling, 2026-09-16: *"DERIVE THE HOURS. Do not transcribe fourteen labels off a
 * picture — that IS the hand-maintained-set disease wearing a design costume."* A transcribed
 * list is a hand-kept set: it drifts from the data the first time an item lands on the hour
 * nobody typed, and the item silently has nowhere to go.
 *
 * So `hcDayHourRange` GENERATES the sequence with a loop. There is no list to omit an hour from,
 * and the range WIDENS to hold anything outside the default 6 AM - 8 PM window — the design file
 * already warns that "an item at 5 AM or 9 PM must be visible without scrolling past an empty
 * band", and we have shipped the day-window version of that defect once already.
 *
 * RED-PROOFED IN THE DIRECTION THAT SAYS "THIS IS FINE" FIRST (Lesson 89): the failure here is
 * silent. A missing hour does not throw, does not warn, and does not look wrong — the column
 * simply has no row and the 6 PM job is nowhere. So the legs are coverage legs, not presence
 * legs, and they were seen RED against a transcribed list before being reported green.
 *
 * SIMULATED AND SAID SO: no session, no network. The renderer, the range and the labels are the
 * shipping product's; the jobs are declared fakes.
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

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Hubly Classic Fixture", url: "https://hubly-classic-fixture.myhubly.app" };
const today = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TODAY = iso(today);

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

/** Renders the REAL My Day into a detached node and reports the hour rows it produced.
 *  The backend is REINSTALLED with these jobs first — an earlier version set a global the fake
 *  never read, so the "wide" case rendered the default window and the leg passed on the wrong
 *  thing. A fixture the product cannot see is not a fixture. */
const renderHours = async (jobs) => {
  // A FRESH PAGE PER FIXTURE. authGetClient CACHES the client it was handed, so reinstalling the
  // fake after a render leaves the product holding the previous backend — the "wide" case
  // rendered the default window and the leg passed on the wrong thing until this was found.
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "Adrian",
    tables: { jobs, tasks: [] },
  });
  return rig.page.evaluate(async ({ biz }) => {
  const host = document.createElement("div");
  host.className = "hc-inthread-day";
  document.body.appendChild(host);
  await window.hublyDayUI.render(host, biz);
  const rows = [...host.querySelectorAll(".hcmd-calrow")].map((r) => Number(r.getAttribute("data-hour")));
  const labels = [...host.querySelectorAll(".hcmd-calh")].map((e) => e.textContent.trim());
  host.remove();
  return { rows, labels };
  }, { biz: BIZ });
};

try {
  console.log("SIMULATED — no session, no network. The range, the labels and the renderer are the product's.\n");
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "Adrian",
    tables: { jobs: [], tasks: [] },
  });
  // The fake has to still BE the fake when we measure (leg-0 discipline, owner-rig.mjs).
  const intact = await rig.page.evaluate(() => !!(window.__rigFake && window.__rigFake.intact()));
  if (!intact) { console.error("CANNOT RUN — the rig's createClient was replaced before measuring."); await rig.close(); process.exit(2); }
  const seam = await rig.page.evaluate(() => !!(window.hublyDayUI && window.hublyDayUI.hours && window.hublyDayUI.render));
  if (!seam) { console.error("CANNOT RUN — window.hublyDayUI is not exposed."); await rig.close(); process.exit(2); }

  // ── 1. THE RANGE FUNCTION, EXECUTED. Contiguous, by construction. ───────────────────────
  const ranges = await rig.page.evaluate(() => ({
    empty: window.hublyDayUI.hours([]),
    early: window.hublyDayUI.hours(["05:00"]),
    late: window.hublyDayUI.hours(["21:30"]),
    both: window.hublyDayUI.hours(["05:00", "21:30"]),
    midday: window.hublyDayUI.hours(["18:00"]),
  }));
  const contiguous = (a) => a.every((h, i) => i === 0 || h === a[i - 1] + 1);
  say("1 the default window is the drawing's 6 AM - 8 PM and it is contiguous",
    ranges.empty[0] === 6 && ranges.empty[ranges.empty.length - 1] === 20 && contiguous(ranges.empty),
    `${ranges.empty.length} hours, ${ranges.empty[0]}..${ranges.empty[ranges.empty.length - 1]}`);
  // THE HOUR THE IMAGE OMITS. A transcribed list is missing exactly this one.
  say("2 6 PM (18) is in the default window",
    ranges.empty.includes(18), `hours: ${ranges.empty.join(",")}`);
  say("3 an item before the window widens it, with no gap",
    ranges.early[0] === 5 && contiguous(ranges.early), `${ranges.early[0]}..${ranges.early[ranges.early.length - 1]}`);
  say("4 an item after the window widens it, with no gap",
    ranges.late[ranges.late.length - 1] === 21 && contiguous(ranges.late), `${ranges.late[0]}..${ranges.late[ranges.late.length - 1]}`);
  say("5 both at once, still contiguous end to end",
    ranges.both[0] === 5 && ranges.both[ranges.both.length - 1] === 21
      && ranges.both.length === 17 && contiguous(ranges.both),
    `${ranges.both.length} hours, ${ranges.both[0]}..${ranges.both[ranges.both.length - 1]}`);

  // ── 6. THE RENDERED COLUMN. Not the function — the DOM a person looks at. ───────────────
  const plain = await renderHours([]);
  say("6 the rendered column has a row for EVERY hour in its range, none missing",
    plain.rows.length > 0 && contiguous(plain.rows)
      && plain.rows.length === (plain.rows[plain.rows.length - 1] - plain.rows[0] + 1),
    `${plain.rows.length} rows, ${plain.rows[0]}..${plain.rows[plain.rows.length - 1]}`);
  say("6b including 6 PM, the hour the approved image leaves out",
    plain.rows.includes(18) && plain.labels.includes("6 PM"),
    `labels: ${plain.labels.join(" ")}`);

  // ── 7. AN ITEM OUTSIDE THE DEFAULT WINDOW GETS A ROW TO LAND ON. ────────────────────────
  const wide = await renderHours([
    { id: "j1", business_id: BIZ.id, service_name: "early start", scheduled_date: TODAY, scheduled_time: "05:00:00", address: null, amount: null, is_block: false, customer_name: "Dawn" },
    { id: "j2", business_id: BIZ.id, service_name: "late finish", scheduled_date: TODAY, scheduled_time: "21:00:00", address: null, amount: null, is_block: false, customer_name: "Dusk" },
  ]);
  say("7 a 5 AM and a 9 PM item both have an hour row, and nothing between them is missing",
    wide.rows.includes(5) && wide.rows.includes(21) && contiguous(wide.rows),
    `${wide.rows[0]}..${wide.rows[wide.rows.length - 1]} (${wide.rows.length} rows)`);

  // ── 8. THE LABELS ARE DERIVED TOO — 12 is the trap in both directions. ──────────────────
  const labels = await rig.page.evaluate(() => [0, 1, 11, 12, 13, 18, 23].map((h) => window.hublyDayUI.label(h)));
  say("8 midnight is 12 AM and noon is 12 PM, never 0 or 24",
    labels[0] === "12 AM" && labels[3] === "12 PM" && labels[6] === "11 PM" && labels[5] === "6 PM",
    labels.join(" · "));

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nEvery hour in the rendered range has a row, and the sequence is generated.");
process.exit(failed ? 1 : 0);
