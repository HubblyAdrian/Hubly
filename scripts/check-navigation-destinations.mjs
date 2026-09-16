#!/usr/bin/env node
/**
 * EVERY DESTINATION HAS A PLACE, AND EVERY PLACE HAS A DESTINATION.
 *
 *   node scripts/check-navigation-destinations.mjs
 *
 * WHY THIS EXISTS. Four separate registries decide where a person can be sent in the claimed
 * shell, and none of them knows about the others:
 *
 *   HC_PLACE_SURFACES   what may appear as a row in the rail
 *   HC_RAIL_DEFAULT     what a new business is offered there without asking
 *   HC_ROOMS            what can actually be RENDERED when a row is clicked
 *   HC_GO_PLACES        where a SENTENCE can take someone ("take me to my schedule")
 *   HC_THREAD_VIEWS     what can be COUNTED, which hcGoToPlace does before it moves anyone
 *
 * A surface added to one and forgotten in another is not a cosmetic drift. Forgotten in
 * HC_ROOMS it is a row in the rail that opens nothing. Forgotten in HC_PLACE_SURFACES it is a
 * sentence offering a place the rail can never show. Forgotten in HC_THREAD_VIEWS the door
 * cannot count the room, and "I couldn't read your X just now" is said about a room that is
 * fine — our bookkeeping reported as his data, which is Lesson 86 and has already shipped once
 * here ("Your schedule isn't set up on this account yet", said to a man with two jobs on it).
 *
 * Prohibition 5 is the rule underneath: a place appears in navigation only once the business
 * has earned it, and positions are stable. A row that cannot open has not earned anything.
 *
 * `planner` answers to "day" in the counting registry. That rename is exactly the seam a
 * grep-based assertion walks straight past, which is why every leg here EXECUTES the shipping
 * objects and the shipping door instead of describing them.
 *
 * WHAT THIS DOES NOT DECIDE: whether My Day belongs in the rail at all. The 2026-09-16 approved
 * design draws Home · Website · Settings; the 2026-09-15 one drew Home · My Day · Website ·
 * Settings. That is Adrian's ruling and it is open. This check holds for either answer — it
 * asserts that whatever is in the rail opens, not what should be in it.
 *
 * SIMULATED AND SAID SO: no session, no network. The page is the shipping
 * public/platform-home.html and every registry and function below is the product's own.
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

try {
  console.log("SIMULATED — no session, no network. Every registry and door below is the product's.\n");
  await rig.load(PAGE);
  const ok = await rig.page.evaluate(() => !!(window.hublyNavUI && window.hublyNavUI.surfaces && window.hublyNavUI.goTo));
  if (!ok) { console.error("CANNOT RUN — window.hublyNavUI is not exposed."); await rig.close(); process.exit(2); }

  const reg = await rig.page.evaluate(() => {
    const N = window.hublyNavUI;
    const keys = (o) => Object.keys(o || {});
    return {
      surfaces: keys(N.surfaces),
      rooms: keys(N.rooms),
      goPlaces: keys(N.goPlaces),
      threadViews: keys(N.threadViews),
      railDefault: keys(N.railDefault).filter((k) => N.railDefault[k]),
      countKeys: keys(N.goPlaces).map((k) => [k, N.countKeyFor(k)]),
      // The canvas, not a room: the website is the pane itself and has no HC_ROOMS renderer.
      canvas: "website",
    };
  });
  console.log(`  surfaces: ${reg.surfaces.join(", ")}`);
  console.log(`  rooms:    ${reg.rooms.join(", ")}`);
  console.log(`  goPlaces: ${reg.goPlaces.join(", ")}`);
  console.log(`  views:    ${reg.threadViews.join(", ")}\n`);

  // ── 1. A ROW IN THE RAIL OPENS SOMETHING. ───────────────────────────────────────────────
  const noRoom = reg.surfaces.filter((k) => k !== reg.canvas && !reg.rooms.includes(k));
  say("1 every place that can appear in the rail has something that renders it",
    noRoom.length === 0, noRoom.length ? `no renderer for: ${noRoom.join(", ")}` : `${reg.surfaces.length} surfaces`);

  // ── 2. AND THE OTHER SIDE: nothing renders a room the rail can never reach. Guard both
  //       sides — a room with no surface is built and doorless, which is the diagnosis that
  //       has been right four times this month. ────────────────────────────────────────────
  const noSurface = reg.rooms.filter((k) => !reg.surfaces.includes(k));
  say("2 and nothing renders a room that can never appear in the rail",
    noSurface.length === 0, noSurface.length ? `no surface for: ${noSurface.join(", ")}` : `${reg.rooms.length} rooms`);

  // ── 3. A SENTENCE CANNOT OFFER A PLACE THE RAIL HAS NEVER HEARD OF. ─────────────────────
  const orphanDoors = reg.goPlaces.filter((k) => !reg.surfaces.includes(k));
  say("3 every place a sentence can take someone to is a real surface",
    orphanDoors.length === 0, orphanDoors.length ? `offered but not a surface: ${orphanDoors.join(", ")}` : `${reg.goPlaces.length} doors`);

  // ── 4. AND EVERY DOOR CAN COUNT ITS ROOM BEFORE IT MOVES ANYONE. This is the leg that
  //       catches "your schedule isn't set up" said about a room with two jobs on it: the
  //       door counts by a DIFFERENT key than it navigates by (planner -> day). ────────────
  const uncountable = reg.countKeys
    .filter(([k]) => k !== reg.canvas)
    .filter(([, c]) => !reg.threadViews.includes(c))
    .map(([k, c]) => `${k}->${c}`);
  say("4 every door can count what is in the room before offering it",
    uncountable.length === 0, uncountable.length ? `no countable view for: ${uncountable.join(", ")}` : reg.countKeys.map(([k, c]) => `${k}->${c}`).join(", "));

  // ── 5. WHAT A NEW BUSINESS IS OFFERED IS A SUBSET OF WHAT EXISTS. ───────────────────────
  const badDefault = reg.railDefault.filter((k) => !reg.surfaces.includes(k));
  say("5 nothing is offered by default that is not a surface",
    badDefault.length === 0, badDefault.length ? `defaulted but unknown: ${badDefault.join(", ")}` : reg.railDefault.join(", "));

  // ── 6. THE DOOR ITSELF, EXECUTED: an unknown place is REFUSED, never guessed at. ────────
  const refused = await rig.page.evaluate(async () => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    if (t) t.innerHTML = "";
    const r = await window.hublyNavUI.goTo("a-place-that-does-not-exist");
    return { r, text: t ? t.innerText.replace(/\s+/g, " ").trim() : "" };
  });
  say("6 a place that does not exist is refused, and says so",
    refused.r && refused.r.ok === false && refused.r.error === "unknown_place" && refused.text.length > 8,
    JSON.stringify(refused.text.slice(0, 80)));

  // ── 7. AND THE REFUSAL DOES NOT NAME A CONTROL. Hubly never points at what it cannot see. ─
  say("7 the refusal points at no button, tab or menu",
    !/\b(button|tab|menu|sidebar|click|tap|top right|left side)\b/i.test(refused.text),
    JSON.stringify(refused.text.slice(0, 80)));

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nEvery destination has a place, and every place has a destination.");
process.exit(failed ? 1 : 0);
