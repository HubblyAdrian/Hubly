#!/usr/bin/env node
/**
 * NO EDITOR CHROME IN A PAGE SERVED TO SOMEONE WHO IS NOT THE OWNER.
 *
 * `renderWebsite()` draws the "+ Add service" tile in the same pass as the cards, gated on
 * `wsEditingOn()` — /dashboard OR `?hcEditable=1`. That is the right shape (one renderer, one
 * output, nothing to reconcile) and it puts an owner-only control inside the function that
 * paints every visitor's page.
 *
 * **This assertion is worth more than the feature.** A stray "+" on a paying customer's live
 * site is the kind of thing he finds before we do, and the gate is one boolean away from being
 * wrong on a layout nobody checked.
 *
 * Checked on EVERY layout, as a visitor, with no edit parameters: default, neon-nights,
 * chrome-velocity, obsidian-gold — the three that carry their own `.ws-pe-add-tile` theming and
 * are therefore the three where somebody has already had to think about this tile.
 *
 *   node scripts/check-no-editor-chrome-in-public.mjs [slug …]
 *
 * Exit: 0 clean · 1 editor chrome reached a visitor · 2 cannot run.
 */
import { openRig } from "./lib/browser-rig.mjs";

// RED-PROOF WITHOUT SHIPPING A BROKEN GATE. `--redproof` appends the OWNER's own parameter to
// the visitor URL, which is the one condition that legitimately puts the tile on the page. The
// detector must then FAIL. That proves the detector detects, without a deploy whose whole
// purpose is to put an owner-only control on a paying customer's live site for thirty seconds.
const REDPROOF = process.argv.includes("--redproof");
const SLUGS = process.argv.slice(2).filter((a) => !a.startsWith("--")).length
  ? process.argv.slice(2).filter((a) => !a.startsWith("--"))
  : ["hubly-classic-fixture", "graefs-autocare"];
const LAYOUTS = ["", "neon-nights", "chrome-velocity", "obsidian-gold"];
// CONTROLS, NOT MARKERS — and the first version of this check got that wrong.
//
// It listed `[data-pe]` as chrome and failed all 8 combinations on the LIVE site, before any of
// tonight's changes. `data-pe` is an inert attribute marking an element as editable-in-the-
// editor; a visitor has no handler for it (`isWebsitePeEnabled()` gates those), it paints
// nothing, and it has been on every public page for months. Exactly like `data-hubly-service`.
//
// The distinction this check has to hold: a MARKER is an attribute a visitor cannot see or
// press; CHROME is something rendered or clickable. Only chrome is a leak. Markers are counted
// and printed so a future one cannot go unnoticed, but they are not a failure.
//
// Third time tonight a measurement was wrong rather than the product (the skip links, the rig's
// console, this). Worth saying out loud: when a brand-new check fails everything, suspect the
// check.
const CHROME = [".ws-pe-add-tile", "[data-hc-addsvc]", "[data-hc-editor]", ".ws-re-btns", ".ws-pe-pop", "#ws-pe-context-bar"];
const MARKERS = ["[data-pe]", "[data-hubly-service]", "[data-hc-wired]"];

let rig;
try { rig = await openRig({ quiet: true, width: 1440, height: 900 }); }
catch (e) { console.error(String(e.message)); process.exit(2); }

let failed = 0, checked = 0;
for (const slug of SLUGS) {
  for (const layout of LAYOUTS) {
    // A visitor's URL. No hcEdit, no hcEditable, nothing.
    const url = `https://${slug}.myhubly.app/?v=${Date.now()}${layout ? `&wslayout=${layout}` : ""}${REDPROOF ? "&hcEdit=1&hcEditable=1" : ""}`;
    await rig.load(url);
    await rig.settle(() => document.querySelectorAll("#p-classic-site .ws-svc-card").length, "cards", { quiet: true });
    const r = await rig.page.evaluate(({ chrome, markers }) => {
      const out = { cards: document.querySelectorAll("#p-classic-site .ws-svc-card").length, hits: {}, marks: {} };
      for (const s of chrome) out.hits[s] = document.querySelectorAll("#p-classic-site " + s).length;
      for (const s of markers) out.marks[s] = document.querySelectorAll("#p-classic-site " + s).length;
      return out;
    }, { chrome: CHROME, markers: MARKERS });
    checked++;
    const bad = Object.entries(r.hits).filter(([, n]) => n > 0);
    const tag = `${slug}${layout ? " · " + layout : " · default"}`;
    if (bad.length) {
      failed++;
      console.log(`FAIL  ${tag.padEnd(46)} cards=${r.cards}  ${bad.map(([s, n]) => `${s}×${n}`).join(" ")}`);
    } else {
      const mk = Object.entries(r.marks).filter(([, n]) => n > 0).map(([s, n]) => `${s}×${n}`).join(" ");
      console.log(`ok    ${tag.padEnd(46)} cards=${r.cards}  no chrome  ·  inert markers: ${mk || "none"}`);
    }
  }
}
await rig.close();
console.log(`\n${checked} page/layout combinations checked as a visitor · ${failed} leaking editor chrome`);
if (REDPROOF) {
  console.log(failed === checked
    ? `\nRED-PROOF PASSES — with the owner's own ?hcEditable=1 the detector fires on all ${checked}.`
    : `\nRED-PROOF FAILED — only ${failed} of ${checked} fired with editing ON. The detector is blind.`);
  process.exit(failed === checked ? 0 : 1);
}
if (failed) {
  console.error(`\nFAIL — an owner-only control is in a page served to a visitor. wsEditingOn() must be\nfalse without ?hcEditable=1 and outside /dashboard, on every layout.`);
  process.exit(1);
}
console.log("PASS — every layout serves a visitor a page with no editor chrome in it.");
