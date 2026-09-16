#!/usr/bin/env node
/**
 * A PERSON CAN REACH "NEW JOB" WITHOUT DEV TOOLS.
 *
 *   node scripts/check-job-door-open.mjs
 *
 * WHY. `ead44be` (2026-07-27) hid the Jobs-tab New Job button with `hidden aria-hidden="true"`,
 * because the header CTA duplicated it — *"Keep New Job in the page header only."* Correct
 * de-duplication. That header CTA is `.jos-legacy-bar`, which the Journey OS pixel redesign later
 * set to `display:none !important` as legacy chrome. Also defensible alone.
 *
 * DOORS CLOSED BY MUTUAL ASSUMPTION: two entrances to a working feature, each removed because the
 * other existed. `openJobsNew()` still worked and its only caller was the hidden button.
 *
 * AND THE THIRD DOOR WAS WORSE THAN NO DOOR. The one surviving entrance was `+ Add a job` inside
 * the dashboard's EMPTY-bookings state (`if(!pending.length)`), so the only way to add a job by
 * hand vanished the moment the owner had a pending booking — exactly when they are busy enough to
 * need it. A door open only while the business is idle is a tutorial, not a door.
 *
 * THIS CHECK EXISTS BECAUSE A DOOR WE OPEN TODAY AND NOTHING GUARDS CLOSES AGAIN NEXT JULY, for a
 * reason that sounds good at the time. It asserts VISIBILITY AS THE BROWSER COMPUTES IT, not the
 * presence of a rule: six CSS rules and an HTML attribute hid this button between them, and any
 * source-level assertion would have had to know about all seven.
 *
 * RED-PROOFED IN THE DIRECTION THAT SAYS "THIS IS FINE": the failure is silence — a hidden button
 * throws nothing and looks like nothing. So the legs assert the control is THERE, is VISIBLE, has
 * a real size, and that its handler is reachable.
 *
 * SIMULATED AND SAID SO: no session, no network. The markup, the stylesheet and the class the app
 * sets on `#p-app` are the product's; nothing about the button is faked.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { openRig } from "./lib/browser-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ══ SERVED OVER HTTP, AND THAT IS NOT A CONVENIENCE ══════════════════════════════════════
//
// The first version of this check loaded the page over file:// and PASSED VACUOUSLY. hubly.html
// links its stylesheets root-absolutely (`/journey-os/operate-pixel.css`), which under file://
// resolves to `file:///journey-os/...` and never loads. So the SIX rules that hid this button were
// never applied, and "the browser paints it" was true of a page with no stylesheet.
//
// That is the same defect as measuring an app whose backend is a stranger: the surface looked
// right because the thing under test was absent. A static server makes the real cascade run.
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
               ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent((req.url || "/").split("?")[0]);
    const buf = await readFile(join(ROOT, "public", rel));
    res.writeHead(200, { "content-type": MIME[extname(rel)] || "application/octet-stream" });
    res.end(buf);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PAGE = `http://127.0.0.1:${server.address().port}/hubly.html`;
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session, no network. The markup and the stylesheet are the product's.\n");
  await rig.load(PAGE);

  // ── LEG 0 FOR THE HARNESS: the stylesheet under test must actually be loaded. ──────────
  //
  // Without this the check is an elaborate way of confirming that an unstyled button is visible.
  // It refuses to report rather than measure a page whose CSS never arrived.
  const sheet = await rig.page.evaluate(() => {
    for (const s of document.styleSheets) {
      if (!String(s.href || "").includes("operate-pixel")) continue;
      try { return { href: s.href, rules: s.cssRules.length }; }
      catch { return { href: s.href, rules: "BLOCKED" }; }
    }
    return null;
  });
  if (!sheet || sheet.rules === "BLOCKED" || !(sheet.rules > 100)) {
    console.error("CANNOT RUN — operate-pixel.css did not load (" + JSON.stringify(sheet) + "); "
      + "every rule that hides this button lives in it, so a clean result would be meaningless.");
    await rig.close(); server.close(); process.exit(2);
  }
  console.log(`  operate-pixel.css loaded: ${sheet.rules} rules\n`);

  // THE STATE A REAL OWNER IS IN when they are looking at their jobs: the app shell, the pixel
  // redesign (the app adds `jos-pixel` unconditionally when it shows #p-app), the rail expanded,
  // Jobs selected. Every class below is one the shipping code sets on itself.
  const probe = await rig.page.evaluate(() => {
    const app = document.getElementById("p-app");
    if (!app) return { missing: "#p-app" };
    document.body.classList.add("jos-pixel");
    app.classList.add("jos-pixel", "jos-nav-expanded", "jos-jobs-mode");
    app.classList.remove("hidden");
    app.style.display = "block";
    const btn = document.querySelector(".nav-jobs-new");
    if (!btn) return { missing: ".nav-jobs-new" };
    const cs = getComputedStyle(btn);
    const r = btn.getBoundingClientRect();
    return {
      hiddenAttr: btn.hasAttribute("hidden"),
      ariaHidden: btn.getAttribute("aria-hidden"),
      display: cs.display, visibility: cs.visibility,
      w: Math.round(r.width), h: Math.round(r.height),
      text: (btn.textContent || "").trim(),
      handler: btn.getAttribute("onclick"),
      fnExists: typeof window.openJobsNew === "function",
    };
  });
  if (probe.missing) { console.error("CANNOT RUN — " + probe.missing + " not found."); await rig.close(); process.exit(2); }

  say("1 the button carries no `hidden` attribute",
    probe.hiddenAttr === false && probe.ariaHidden !== "true",
    `hidden=${probe.hiddenAttr} aria-hidden=${probe.ariaHidden}`);
  // THE ONE THAT MATTERS: what the browser computed, after every rule in the stylesheet.
  say("2 and the browser actually paints it in the Jobs view",
    probe.display !== "none" && probe.visibility !== "hidden",
    `display=${probe.display} visibility=${probe.visibility}`);
  say("3 with a real size — a 0x0 control is not reachable either",
    probe.w > 20 && probe.h > 10, `${probe.w}x${probe.h}`);
  say("4 it says what it does", /new job/i.test(probe.text), JSON.stringify(probe.text));
  say("5 and its handler exists, so the door leads somewhere",
    /openJobsNew\(\)/.test(probe.handler || "") && probe.fnExists === true,
    `${probe.handler} · defined=${probe.fnExists}`);

  // ── 6. THE DOOR IS NOT CONDITIONAL ON BEING IDLE. The dashboard's "+ Add a job" only renders
  //       inside `if(!pending.length)`; this one must not inherit that. ──────────────────────
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(resolve(ROOT, "public/hubly.html"), "utf8");
  const dashDoor = /if\(!pending\.length\)\{[\s\S]{0,400}?openDashNewJob\(\)/.test(src);
  say("6 the dashboard's job door is still the empty-state-only one, and this is NOT that",
    dashDoor === true, dashDoor ? "confirmed: openDashNewJob is inside if(!pending.length)" : "the empty-state door moved — re-read the sweep");

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
  try { server.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nNew Job is reachable in the Jobs view, and the browser agrees.");
process.exit(failed ? 1 : 0);
