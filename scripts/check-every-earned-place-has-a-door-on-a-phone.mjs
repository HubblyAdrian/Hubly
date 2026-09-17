#!/usr/bin/env node
/**
 * [RULE] EVERY PLACE HE EARNED CAN BE REACHED ON A PHONE.
 *
 *   node scripts/check-every-earned-place-has-a-door-on-a-phone.mjs
 *
 * ══ THE DEFECT, MEASURED AT 390px ON 2026-09-17 ═════════════════════════════════════════════
 *
 * The bottom bar holds four (prohibition 5, and the cap is right). The rail is not rendered below
 * 900px. So an owner with FIVE earned places could reach THREE of them plus Home — Customers and
 * Quotes had **no door at all**, and nothing anywhere said they existed. Earned, invisible, and
 * unmentioned, which is the interface changing shape silently.
 *
 * Adrian: *"CUSTOMERS AND QUOTES HAVE NO DOOR AT ALL ON A PHONE… That is worse than the design gap
 * it sits inside. Bring me the smallest honest fix."*
 *
 * THE FIX: the last slot becomes **More** when there are more places than fit, and it opens the
 * rest. The cap stays four. NOTHING REORDERS — the first three keep their positions and the
 * overflow keeps its own — so both halves of prohibition 5 hold.
 *
 * Every leg PRESSES a real control at a real 390px viewport. NOT VERIFIED ON A HANDSET: there is
 * no true phone viewport or soft keyboard here, and that limit is the standing rule.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake, fakeIntact } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srv = await servePublic(ROOT);
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture", name: "Fixture", hasPage: true };
/** Five earned places — the state the defect lives in. */
const PLACES = [
  { kind: "website", scope: "workspace", visible: true, sort_order: 10 },
  { kind: "planner", scope: "workspace", visible: true, sort_order: 20 },
  { kind: "jobs", scope: "workspace", visible: true, sort_order: 30 },
  { kind: "customers", scope: "workspace", visible: true, sort_order: 40 },
  { kind: "quotes", scope: "workspace", visible: true, sort_order: 50 },
];

let rig;
try { rig = await openRig({ width: 390, height: 844 }); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

try {
  console.log("SIMULATED OWNER at 390×844 — the desktop engine at phone width, NOT a handset.\n");
  await rig.load(srv.url("platform-home.html"));
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "o@example.com", displayName: "Adrian", places: PLACES,
    tables: { jobs: [], tasks: [], customers: [], events: [] },
  });
  await rig.page.evaluate(async ({ biz }) => {
    await window.hublyArrivalUI.simulate(biz, true, []);
    await new Promise((r) => setTimeout(r, 600));
  }, { biz: BIZ });
  const bad = await rig.page.evaluate(fakeIntact);
  if (bad) { console.error("CANNOT RUN — " + bad); await rig.close(); srv.close(); process.exit(2); }

  const shell = await rig.page.evaluate(() => {
    const vis = (el) => el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
    return {
      railVisible: vis(document.querySelector(".hc-rail")),
      bar: [...document.querySelectorAll(".hc-btab")].map((b) => b.textContent.trim()),
      earned: window.hublyNavUI ? Object.keys(window.hublyNavUI.surfaces).length : 0,
      places: (window.__rig.places || []).length,
    };
  });
  say("1 [SHAPE] on a phone the rail is not rendered — the bar IS the navigation",
      shell.railVisible === false, "the rail is display:none below 900px");
  say("2 [RULE] the bar keeps its cap — four items, never seven",
      shell.bar.length === 4, `bar: ${shell.bar.join(" · ")}`);
  say("3 [RULE] and the places that do not fit are behind a door that says so",
      /more/i.test(shell.bar[shell.bar.length - 1] || ""), `last slot: "${shell.bar[shell.bar.length - 1]}"`);

  const opened = await rig.page.evaluate(async () => {
    const more = [...document.querySelectorAll(".hc-btab")].filter((b) => b.getAttribute("data-hc-more"))[0];
    if (!more) return { pressed: false };
    more.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 300));
    const sheet = document.getElementById("hcMoreSheet");
    return { pressed: true, items: sheet ? [...sheet.querySelectorAll(".hc-more-item")].map((b) => b.textContent.trim()) : [],
             label: more.getAttribute("aria-label") };
  });
  say("4 [RULE] PRESSING More opens the places that did not fit — by name",
      opened.pressed && opened.items.length >= 2, `${opened.items.length} item(s): ${opened.items.join(", ")}`);
  say("5 [RULE] and it says how many are behind it, for someone who cannot see the dots",
      /\d+ more places/.test(opened.label || ""), JSON.stringify(opened.label));

  const went = await rig.page.evaluate(async () => {
    const item = [...document.querySelectorAll("#hcMoreSheet .hc-more-item")].filter((b) => /customer/i.test(b.textContent))[0];
    if (!item) return { pressed: false };
    item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 700));
    const vis = (el) => el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
    return { pressed: true, mode: document.getElementById("hcApp").getAttribute("data-mode"),
             sheetGone: !document.getElementById("hcMoreSheet"),
             roomVisible: vis(document.querySelector(".hc-app-right")) };
  });
  say("6 [RULE] choosing one goes there, and the room is actually on screen",
      went.pressed && went.mode === "customers" && went.roomVisible === true && went.sheetGone,
      `mode ${went.mode} · the room is visible: ${went.roomVisible}`);

  // ── AND THE CAP STILL HOLDS WHEN THERE IS NOTHING TO OVERFLOW ─────────────────────────
  await rig.load(srv.url("platform-home.html"));
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "o@example.com", displayName: "Adrian",
    places: PLACES.slice(0, 2), tables: { jobs: [], tasks: [] },
  });
  await rig.page.evaluate(async ({ biz }) => {
    await window.hublyArrivalUI.simulate(biz, true, []);
    await new Promise((r) => setTimeout(r, 600));
  }, { biz: BIZ });
  const few = await rig.page.evaluate(() => [...document.querySelectorAll(".hc-btab")].map((b) => b.textContent.trim()));
  say("7 [RULE] with nothing to overflow there is no More — a door to nowhere is worse than none",
      few.length === 3 && !few.some((t) => /more/i.test(t)), `bar: ${few.join(" · ")}`);

  // ── THE EXACT BOUNDARY: four destinations fit, so all four are places ─────────────────
  // Red-proofing found leg 7 could not see an off-by-one — with three destinations the overflow
  // is empty either way. At FOUR the two behaviours differ, which is the only place they can.
  await rig.load(srv.url("platform-home.html"));
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "o@example.com", displayName: "Adrian",
    places: PLACES.slice(0, 3), tables: { jobs: [], tasks: [] },
  });
  await rig.page.evaluate(async ({ biz }) => {
    await window.hublyArrivalUI.simulate(biz, true, []);
    await new Promise((r) => setTimeout(r, 600));
  }, { biz: BIZ });
  const exact = await rig.page.evaluate(() => [...document.querySelectorAll(".hc-btab")].map((b) => b.textContent.trim()));
  say("8 [RULE] four destinations fit, so all four ARE places — More costs a slot and only earns one when it saves two",
      exact.length === 4 && !exact.some((t) => /more/i.test(t)), `bar: ${exact.join(" · ")}`);
} finally { await rig.close(); srv.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nPASS — every earned place is reachable on a phone, and the bar still holds four.\n");
process.exit(failed ? 1 : 0);
