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
import { declareBreak } from "./lib/redproof.mjs";

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
  /* ══ L98 — SEVEN LEGS IN THIS FILE SHARED ONE FAILURE MODE ═══════════════════════════════════
   * Every one was `<derived list>.length === 0`, and every one of those derived lists comes from ONE
   * registry read. If that read returns nothing — a renamed seam, a shell that did not boot, a
   * `window.hublyNavUI` that is not published yet — all seven pass at once and the file reports the
   * whole navigation contract upheld having examined nothing. The positive clause on each leg is
   * that ITS OWN input was non-empty, inside the assertion that makes the claim rather than in a
   * neighbour. */
  declareBreak({
    leg: "1 the surface registry was read",
    // RENAMING THE KEY WAS NOT NARROW ENOUGH: `plannerBROKEN` is then a room with no surface, so
    // leg 2 fired too and the pair proved nothing (L98). Removing `quotes` DELETES a renderer
    // without inventing an unreachable one, and nothing else in this file reads `quotes`.
    why: "delete the `quotes` renderer from HC_ROOMS, so a place that can appear in the rail has " +
         "nothing to render it — a rail row that opens an empty canvas",
    file: "public/platform-home.html",
    find: "leads: hcRoomFromView('leads'), quotes: hcRoomFromView('quotes') };",
    with: "leads: hcRoomFromView('leads') };",
  });
  say("1 the surface registry was read, and every place that can appear in the rail has something that renders it",
    reg.surfaces.length > 0 && noRoom.length === 0,
    noRoom.length ? `no renderer for: ${noRoom.join(", ")}`
      : `${reg.surfaces.length} surface(s) read — a zero would satisfy "none lacks a renderer" while ` +
        `reading nothing — and every one has a renderer`);

  // ── 2. AND THE OTHER SIDE: nothing renders a room the rail can never reach. Guard both
  //       sides — a room with no surface is built and doorless, which is the diagnosis that
  //       has been right four times this month. ────────────────────────────────────────────
  const noSurface = reg.rooms.filter((k) => !reg.surfaces.includes(k));
  declareBreak({
    leg: "2 the room registry was read",
    why: "add a room nothing can reach — a renderer for `store`, which is not a surface, so it is " +
         "built and doorless: the diagnosis that has been right four times this month",
    file: "public/platform-home.html",
    find: "  var HC_ROOMS = { planner:",
    with: "  var HC_ROOMS = { store: function(){ return null; }, planner:",
  });
  say("2 the room registry was read, and nothing renders a room that can never appear in the rail",
    reg.rooms.length > 0 && noSurface.length === 0,
    noSurface.length ? `no surface for: ${noSurface.join(", ")}` : `${reg.rooms.length} room(s) read, every one reachable`);

  // ── 3. A SENTENCE CANNOT OFFER A PLACE THAT OPENS NOTHING. ──────────────────────────────
  //
  // THIS LEG USED TO ASSERT SOMETHING WRONG, and it is worth saying why rather than quietly
  // editing it. It read "every place a sentence can take someone to is a real SURFACE" — which
  // was true only while every destination was a rail row. On 2026-09-16 Adrian ruled that MY DAY
  // IS NOT A RAIL ROW; My Day is what Home renders. `planner` is still a destination a sentence
  // may ask for, and it now opens HOME. The old leg would have failed a correct product and, far
  // worse, the obvious way to "fix" it is to put My Day back in the rail — the check would have
  // argued for the bug. A check that encodes yesterday's layout as a law does that.
  //
  // So it asserts the thing that actually matters: a destination OPENS SOMETHING. It executes
  // the product's own resolver rather than knowing where planner goes.
  const resolved = await rig.page.evaluate((ks) => ks.map((k) => [k, window.hublyNavUI.resolve(k)]), reg.goPlaces);
  const deadDoors = resolved.filter(([, to]) => to !== "home" && !reg.surfaces.includes(to)).map(([k, to]) => `${k}->${to}`);
  /* ══ 3 AND 3b WERE ONE CLAIM IN TWO HALVES, AND THE LEDGER IS WHAT SAID SO ═══════════════════
   *
   * Leg 3 asserted "a destination opens a surface, OR Home"; leg 3b asserted "and nothing is routed
   * to Home". Together that is one sentence: **a destination opens its own surface.** Split in two,
   * neither half was independently red-proofable with a single edit — leg 3 can only fail if a
   * destination is missing a surface AND the resolver stops falling back to Home, which is two
   * changes, so every single-edit break on it came back NOT RED or fired its neighbour. Merged, one
   * edit fires it.
   *
   * [SHAPE], DECLARED: today ZERO destinations fall through to Home, because My Day got its own
   * surface. If a destination legitimately lands on Home in future, this leg goes red and the leg is
   * what changes — that is the shape moving, not a defect (Lesson 92). The RULE underneath is
   * unchanged: nothing may be routed to a screen that cannot answer for it. */
  const toHome = resolved.filter(([k, to]) => to === "home" && k !== "home").map(([k]) => k);
  declareBreak({
    leg: "3 [SHAPE] the destinations were resolved",
    why: "route an existing destination to Home instead of to its own surface, so something lands " +
         "on a screen that cannot answer for it",
    file: "public/platform-home.html",
    find: "  function hcResolvePlace(id){",
    with: "  function hcResolvePlace(id){ if(String(id) === 'customers') return 'home';",
  });
  say("3 [SHAPE] the destinations were resolved, and every destination opens its OWN surface",
    resolved.length > 0 && deadDoors.length === 0 && toHome.length === 0,
    deadDoors.length ? `opens nothing: ${deadDoors.join(", ")}`
      : toHome.length ? `falls through to Home: ${toHome.join(", ")}`
      : `${resolved.length} destination(s), each opening its own surface: ` +
        resolved.map(([k, t]) => `${k}->${t}`).join(", "));

  // ── 4. AND EVERY DOOR CAN COUNT ITS ROOM BEFORE IT MOVES ANYONE. This is the leg that
  //       catches "your schedule isn't set up" said about a room with two jobs on it: the
  //       door counts by a DIFFERENT key than it navigates by (planner -> day). ────────────
  const uncountable = reg.countKeys
    .filter(([k]) => k !== reg.canvas)
    .filter(([, c]) => !reg.threadViews.includes(c))
    .map(([k, c]) => `${k}->${c}`);
  declareBreak({
    leg: "4 the count keys were read",
    why: "make the planner door count by a key no thread view answers — `planner->planner` instead " +
         "of `planner->day`. THIS IS THE EXACT SHAPE of 'your schedule isn\u2019t set up' said about a " +
         "room with two jobs on it: the door counts by a different key than it navigates by",
    file: "public/platform-home.html",
    find: "    countKeyFor: function(kind){ return kind === 'planner' ? 'day' : kind; },",
    with: "    countKeyFor: function(kind){ return kind; },",
  });
  say("4 the count keys were read, and every door can count what is in the room before offering it",
    reg.countKeys.length > 0 && uncountable.length === 0,
    uncountable.length ? `no countable view for: ${uncountable.join(", ")}`
      : `${reg.countKeys.length} door(s): ` + reg.countKeys.map(([k, c]) => `${k}->${c}`).join(", "));

  // ── 5. WHAT A NEW BUSINESS IS OFFERED IS A SUBSET OF WHAT EXISTS. ───────────────────────
  const badDefault = reg.railDefault.filter((k) => !reg.surfaces.includes(k));
  declareBreak({
    leg: "5 the default rail was read",
    why: "offer a place by default that no surface renders — `store: true` in HC_RAIL_DEFAULT, so " +
         "every new business is given a rail row that opens nothing",
    file: "public/platform-home.html",
    find: "  var HC_RAIL_DEFAULT = { website: true };",
    with: "  var HC_RAIL_DEFAULT = { website: true, store: true };",
  });
  say("5 the default rail was read, and nothing is offered by default that is not a surface",
    reg.railDefault.length > 0 && badDefault.length === 0,
    badDefault.length ? `defaulted but unknown: ${badDefault.join(", ")}`
      : `${reg.railDefault.length} default(s): ` + reg.railDefault.join(", "));

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

  // ══ AND THE RAIL TAB IS A CONTROL, SO IT IS PRESSED. Added 2026-09-17. ════════════════════
  //
  // Every leg above asks the REGISTRIES whether a destination resolves. None of them touched the
  // thing a person touches. Adrian, after finding a page that instructed a gesture with no handler
  // anywhere behind it: "A CHECK THAT CALLS THE FUNCTION IS NOT A CHECK THAT THE CONTROL WORKS."
  const tabbed = await rig.page.evaluate(async () => {
    // THE RAIL ONLY EXISTS FOR A CLAIMED OWNER — hcRenderRail returns early otherwise, which is
    // correct and is why the first version of this leg found no tabs to press. The claimed state is
    // set through the seam the product already publishes, and the rail is rendered by the product.
    try { window.__setClaimed(true); } catch (e) {}
    try { window.hublyCaptureUI.withBusiness("5ebedc20-1061-46b9-b393-a6ef57225910"); } catch (e) {}
    try { window.hublyNavUI.renderRail(); } catch (e) {}
    await new Promise((r) => setTimeout(r, 200));
    const tabs = [...document.querySelectorAll(".hc-rail-tab")].map((b) => b.getAttribute("data-tab"));
    const target = tabs.filter((t) => t && t !== "home")[0] || null;
    if (!target) return { tabs, target: null };
    const btn = document.querySelector(`.hc-rail-tab[data-tab="${target}"]`);
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 400));
    return { tabs, target, mode: document.getElementById("hcApp").getAttribute("data-mode"),
             onTab: !!document.querySelector(`.hc-rail-tab[data-tab="${target}"].is-on`) };
  });
  say("9 a rail tab is a control a person can PRESS, and pressing it moves the shell",
      !!tabbed.target && tabbed.mode === tabbed.target && tabbed.onTab === true,
      tabbed.target ? `clicked "${tabbed.target}" -> data-mode=${tabbed.mode}, marked on=${tabbed.onTab}`
                    : `NO non-home tab in the rail (${tabbed.tabs.join(",") || "none"}) — nothing to press`);

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nEvery destination has a place, and every place has a destination.");
process.exit(failed ? 1 : 0);
