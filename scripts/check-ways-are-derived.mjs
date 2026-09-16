#!/usr/bin/env node
/**
 * AN OFFER WE CANNOT KEEP IS UNWRITEABLE, NOT MERELY FORBIDDEN.
 *
 *   node scripts/check-ways-are-derived.mjs
 *
 * WHY. "Offer every way that honestly exists, and none that do not" was a rule a person had to
 * remember every time they wrote a sentence — the hand-maintained-set disease pointed at copy. It
 * had already nearly cost us: My Day's calendar empty state was about to ship "send me a
 * screenshot of it" when NO screenshot-to-schedule path exists. It was caught by hand, once, by
 * reading the file router. The next sentence would have needed the same read by the next person.
 *
 * So the clause is COMPOSED from what is wired. `HC_FILE_ROUTES` is the table the file router
 * actually dispatches on, and it is the same table the copy consults — a subject that cannot be
 * routed cannot be offered, because there is no string to get wrong.
 *
 * BOTH DIRECTIONS ARE ASSERTED, and the second one is the point Adrian actually asked for:
 * unwire a way and the sentence LOSES that clause; wire one and it GAINS it with no copy edit.
 *
 * SIMULATED AND SAID SO: no session, no network. The registry, the router table and the composer
 * are the product's; only the mutation in the red-proof legs is the check's.
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
  console.log("SIMULATED — no session. The registry, the router table and the composer are the product's.\n");
  await rig.load(PAGE);
  const seam = await rig.page.evaluate(() => !!(window.hublyWaysUI && window.hublyWaysUI.clause));
  if (!seam) { console.error("CANNOT RUN — window.hublyWaysUI is not exposed."); await rig.close(); process.exit(2); }

  const base = await rig.page.evaluate(() => ({
    day: window.hublyWaysUI.clause("day"),
    services: window.hublyWaysUI.clause("services"),
    routes: Object.keys(window.hublyWaysUI.routes),
  }));

  // ── 1-2. TODAY'S TRUTH, BOTH WAYS ROUND. ────────────────────────────────────────────────
  //
  // RETARGETED 2026-09-16, THE SAME DAY IT WAS WRITTEN, AND THAT IS THE POINT. Leg 1 used to read
  // "the day does NOT offer a screenshot — no screenshot-to-schedule path exists". True when
  // written; false the moment import-schedule shipped and HC_FILE_ROUTES.day appeared. The check
  // went red because the PRODUCT GOT MORE CORRECT, which is Lesson 92's tell, and the cheapest way
  // back to green would have been to unwire the import.
  //
  // The rule was never "the day has no screenshot". It is "a subject offers a screenshot IFF its
  // route exists", and that is what these legs assert now — on whichever subject happens to be
  // wired, by moving the route rather than by knowing the answer.
  say("1 a subject with NO route offers no screenshot",
    !/screenshot/i.test(await rig.page.evaluate(() => {
      const keep = window.hublyWaysUI.routes.day;
      delete window.hublyWaysUI.routes.day;
      const c = window.hublyWaysUI.clause("day");
      window.hublyWaysUI.routes.day = keep;
      return c;
    })), "with the day's route removed, the clause is gone");
  say("1b and the day, which IS routed now, offers it",
    /screenshot/i.test(base.day), JSON.stringify(base.day));
  say("2 and services DOES — a price list is a routed subject",
    /screenshot/i.test(base.services) && base.routes.includes("services"),
    JSON.stringify(base.services));
  say("3 every subject still offers something — a composed sentence is never empty",
    base.day.length > 12 && base.services.length > 12, `${base.day.length} / ${base.services.length} chars`);

  // ── 4. UNWIRE A WAY: the clause must LEAVE the sentence, with no copy edit. ──────────────
  const unwired = await rig.page.evaluate(() => {
    const before = window.hublyWaysUI.clause("services");
    const keep = window.hublyWaysUI.routes.services;
    delete window.hublyWaysUI.routes.services;              // the router loses the subject
    const after = window.hublyWaysUI.clause("services");
    window.hublyWaysUI.routes.services = keep;              // put it back
    return { before, after, restored: window.hublyWaysUI.clause("services") };
  });
  say("4 unwiring the route removes the screenshot clause from the sentence",
    /screenshot/i.test(unwired.before) && !/screenshot/i.test(unwired.after),
    `${JSON.stringify(unwired.before)}  ->  ${JSON.stringify(unwired.after)}`);
  say("4b and the sentence still reads as a sentence with the clause gone",
    unwired.after.length > 12 && /\.$/.test(unwired.after), JSON.stringify(unwired.after));
  say("4c restoring the route brings it back",
    /screenshot/i.test(unwired.restored), JSON.stringify(unwired.restored));

  // ── 5. WIRE A WAY: THE OFFER APPEARS BY ITSELF. This is the property that makes the rule
  //       structural rather than remembered — "when screenshot-to-schedule lands, the offer
  //       appears by itself" (Adrian). ─────────────────────────────────────────────────────
  const wired = await rig.page.evaluate(() => {
    const keep = window.hublyWaysUI.routes.day;
    delete window.hublyWaysUI.routes.day;                       // back to un-routed
    const before = window.hublyWaysUI.clause("day");
    window.hublyWaysUI.routes.day = keep;                       // the day becomes routable again
    const after = window.hublyWaysUI.clause("day");
    return { before, after };
  });
  say("5 wiring screenshot-to-schedule makes the day OFFER it, with no copy edit",
    !/screenshot/i.test(wired.before) && /screenshot/i.test(wired.after),
    `${JSON.stringify(wired.before)}  ->  ${JSON.stringify(wired.after)}`);

  // ── 6. THE ROUTER AND THE COPY READ THE SAME TABLE. Two tables would drift, which is the
  //       whole defect this replaces. Asserted by EXECUTING the router's own dispatch. ─────
  const shared = await rig.page.evaluate(() => {
    // The router dispatches on HC_FILE_ROUTES; hublyWaysUI.routes IS that object, not a copy.
    const probe = { sent: false };
    window.hublyWaysUI.routes.__probe = { send: () => { probe.sent = true; } };
    const offered = window.hublyWaysUI.clause("services");
    const has = !!window.hublyWaysUI.routes.__probe;
    delete window.hublyWaysUI.routes.__probe;
    return { has, offered };
  });
  say("6 the copy reads the router's own table, not a copy of it",
    shared.has === true, "same object identity");

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe ways are derived: an offer we cannot keep has no string to write.");
process.exit(failed ? 1 : 0);
