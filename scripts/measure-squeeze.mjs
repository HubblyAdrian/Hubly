#!/usr/bin/env node
/**
 * WHAT RENDERS SQUEEZED, AT THE NARROWEST WIDTH EACH SURFACE CAN ACTUALLY REACH.
 *
 *   node scripts/measure-squeeze.mjs
 *
 * ADRIAN'S RULING, 2026-09-15: "the check my sales edit my website things on this view are too
 * squeezed. i know those things will be fixed because they are not supposed to be there, but we
 * should not have squeezed things like that, it doesn't look good."
 *
 * He is not asking for those two cards to be fixed. NOTHING IN HUBLY RENDERS SQUEEZED: at every
 * width a surface can reach, text does not break inside a word, labels do not crush, controls do
 * not overlap, nothing clips. A thing that cannot be shown properly at a width changes SHAPE —
 * stacks, truncates at a word boundary, or is not shown — but it is never rendered mangled.
 *
 * THIS MEASURES. It does not fix, and it is deliberately run before anything is fixed, because
 * the two cards in the screenshot are unlikely to be the whole list.
 *
 * SIMULATED AND SAID SO: no session; the backend is scripts/lib/owner-rig.mjs's declared fake.
 * The layout, the CSS and the widths are the product's.
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake, squeezeProbe } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Hubly Classic Fixture", url: "https://hubly-classic-fixture.myhubly.app", hasPage: true };
const iso = (d) => { const x = new Date(Date.now() + d * 864e5);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };

/** A FULL account, so every card and chip is offered and therefore measured. Measuring an empty
 *  account would hide exactly the cards Adrian screenshotted. */
const FULL = {
  uid: "f3f11707", email: "adriansmithee+ever@gmail.com", displayName: "Adrian",
  places: [
    { kind: "website", scope: "workspace", visible: true, sort_order: 10 },
    { kind: "planner", scope: "workspace", visible: true, sort_order: 20 },
    { kind: "jobs", scope: "workspace", visible: true, sort_order: 30 },
    { kind: "customers", scope: "workspace", visible: true, sort_order: 40 },
  ],
  hours: [{ weekday: 1, open: "08:00", close: "17:00", closed: false }],
  tables: {
    jobs: [
      { id: "b1", business_id: BIZ.id, service_name: "doctor’s appointment", scheduled_date: iso(1), scheduled_time: "07:00:00",
        duration_hours: 2, amount: null, status: "scheduled", address: null, is_block: true, paid: false },
      { id: "j1", business_id: BIZ.id, customer_name: "Bob Jones", service_name: "driveway", scheduled_date: iso(2),
        scheduled_time: "14:00:00", amount: 180, status: "scheduled", address: "14 Maple St", is_block: false, paid: true },
    ],
    customers: [{ id: "c1", name: "Bob Jones", phone: "8015550134", email: null, jobs_count: 2 }],
    booking_requests: [{ id: "r1", business_id: BIZ.id, service_name: "driveway", status: "pending" }],
    services: [{ id: "s1", business_id: BIZ.id, name: "driveway", price: 180 }],
  },
};

let rig;
try { rig = await openRig({ width: 1440, height: 900 }); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

const findings = [];
try {
  console.log("SIMULATED — no session. The widths, the CSS and the layout are the product's.\n");
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, FULL);
  await rig.page.evaluate((b) => { window.hublyArrivalUI.simulate(b, true); }, BIZ);
  await rig.settle(() => document.querySelectorAll("[data-promise]").length, "furniture", { stableMs: 800, ceilingMs: 9000 });

  // ── 1. THE REAL WIDTH RANGE, MEASURED FROM THE RENDERED BOXES. ───────────────────────
  console.log("── the widths each surface actually reaches ──\n");
  const modes = ["home", "website", "planner", "jobs", "customers"];
  const widths = [];
  for (const mode of modes) {
    // Three viewports: a wide desktop, a 13" laptop, and the narrowest before the mobile
    // breakpoint at 900px takes over.
    for (const vw of [1440, 1280, 1024, 920]) {
      await rig.page.setViewportSize({ width: vw, height: 900 });
      await rig.page.evaluate((m) => { try { window.hublyThreadViews; document.getElementById("hcApp").setAttribute("data-mode", m); } catch (_) {} }, mode);
      await rig.page.waitForTimeout(120);
      // THE MODE ATTRIBUTE ALONE IS NOT THE MODE. data-mode drives the CSS, but the pane only
      // exists once the shell is revealed and the canvas rendered — hcOpenWorkspace does both.
      const w = await rig.page.evaluate(() => {
        const g = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 ? Math.round(r.width) : null; };
        return { left: g(".hc-app-left"), right: g(".hc-app-right"), rail: g(".hc-rail"), thread: g("#hcThread") };
      });
      widths.push({ mode, vw, ...w });
    }
  }
  const byMode = {};
  for (const w of widths) { if (w.thread != null) { byMode[w.mode] = byMode[w.mode] || []; byMode[w.mode].push(w); } }
  console.log(`${"mode".padEnd(11)}${"viewport".padEnd(10)}${"rail".padEnd(7)}${"left pane".padEnd(11)}${"thread".padEnd(9)}right`);
  for (const w of widths) {
    console.log(`${w.mode.padEnd(11)}${String(w.vw).padEnd(10)}${String(w.rail ?? "-").padEnd(7)}${String(w.left ?? "-").padEnd(11)}${String(w.thread ?? "-").padEnd(9)}${w.right ?? "-"}`);
  }
  const narrowest = {};
  for (const [m, list] of Object.entries(byMode)) {
    narrowest[m] = list.reduce((a, b) => (b.thread < a.thread ? b : a));
  }
  console.log("\nnarrowest thread width per mode:",
    Object.entries(narrowest).map(([m, w]) => `${m}=${w.thread}px @${w.vw}`).join("  "));

  // ── 2. AT THE NARROWEST OF EACH, WHAT BREAKS. ───────────────────────────────────────
  console.log("\n── what renders squeezed at the narrowest reachable width ──\n");
  for (const [mode, w] of Object.entries(narrowest)) {
    await rig.page.setViewportSize({ width: w.vw, height: 900 });
    await rig.page.evaluate((m) => { try { document.getElementById("hcApp").setAttribute("data-mode", m); } catch (_) {} }, mode);
    await rig.page.waitForTimeout(150);
    const r = await rig.page.evaluate(squeezeProbe);
    const n = r.brokenWords.length + r.clipped.length;
    console.log(`${mode}  (thread ${w.thread}px @ viewport ${w.vw})  — ${n === 0 ? "clean" : n + " problem(s)"}`);
    for (const b of r.brokenWords) {
      console.log(`    BREAKS MID-WORD  ${b.where.padEnd(28)} "${b.word}"   in: ${JSON.stringify(b.text)}`);
      findings.push({ mode, kind: "mid-word", ...b });
    }
    for (const c of r.clipped) {
      console.log(`    CLIPPED          ${c.where.padEnd(28)} by ${c.over}   ${JSON.stringify(c.text)}`);
      findings.push({ mode, kind: "clipped", ...c });
    }
  }
} catch (e) {
  console.error("MEASUREMENT FAILED — " + String(e.stack || e.message).slice(0, 400));
  process.exit(2);
} finally { try { await rig.close(); } catch (_) {} }

console.log(`\n${findings.length} finding(s) total.`);
console.log("This measures only. Nothing was fixed; see docs/SQUEEZE_AUDIT.md for what to do with it.");
