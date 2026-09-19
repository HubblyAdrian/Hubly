#!/usr/bin/env node
/**
 * [RULE] HOME IS ONE CENTRED BLOCK UNTIL A TURN EXISTS, THEN IT IS A THREAD.
 *
 *   node scripts/check-home-centres-until-you-write.mjs
 *
 * ══ WHAT ADRIAN SAW ══════════════════════════════════════════════════════════════════════════
 *
 * *"greeting top-left, the what's-new line under it, the Edit-my-website card, four chips — then
 * roughly 500px of empty beige — then the composer pinned at the bottom. A dashboard header and a chat
 * footer with a hole between them."*
 *
 * Measured: `.hc-thread-inner` is a flex column with NO `justify-content`, so the top-alignment was
 * never a decision — children simply stacked. And Home had exactly ONE layout. His framing was that
 * state B needed building; the opposite is true and he said so: **state B exists and always has; state
 * A was never built.** One container holds both the greeting block and the transcript, which is why
 * this is a conditional property rather than a restructure.
 *
 * ══ MEASURED GEOMETRY, NOT THE PRESENCE OF A CLASS ═══════════════════════════════════════════
 *
 * Adrian: *"Legs from MEASURED GEOMETRY, not the presence of a class — a class can be present and
 * centre nothing."* So every leg here reads real `getBoundingClientRect()` positions: the gap above the
 * block, the gap below it, and whether those gaps are within a few px of each other. A leg asserting
 * `classList.contains('hc-home-centred')` would pass with the CSS deleted.
 *
 * THE PREDICATE IS THE OTHER HALF. It counts turns in the DOM (`.hc-msg:not([data-hc-arrival])`), so a
 * voluntary line, a conversation loaded from the record, and a turn that arrives while the owner is on
 * another tab all move it — none of which a submit-handler flag would see. Leg 3 drives the real
 * append path and measures the layout AFTER it, which is the only thing that shows the transition.
 *
 * SCOPED: this drives the real shell with a SIMULATED owner (no session, no network). It is evidence
 * about layout and about the predicate, NOT about what the composer sends or what the server returns.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake, fakeIntact } from "./lib/owner-rig.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Fixture Detailing", hasPage: true, url: "https://hubly-classic-fixture.myhubly.app" };
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

const srv = await servePublic(ROOT);
let rig, A = null, B = null;
try { rig = await openRig({ width: 1440, height: 900, quiet: true }); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

/** The real geometry of the thread and the block inside it. */
const GEO = () => {
  const scroller = document.getElementById("hcThread");
  const inner = document.getElementById("hcThreadBody");
  if (!scroller || !inner) return { missing: true };
  const s = scroller.getBoundingClientRect();
  const kids = [...inner.children].filter((k) => k.getClientRects().length);
  if (!kids.length) return { missing: true, why: "the thread has no visible children" };
  const first = kids[0].getBoundingClientRect();
  const last = kids[kids.length - 1].getBoundingClientRect();
  return {
    scrollerTop: s.top, scrollerBottom: s.bottom, scrollerH: s.height,
    gapAbove: first.top - s.top,
    gapBelow: s.bottom - last.bottom,
    blockH: last.bottom - first.top,
    kids: kids.length,
    // THE SAME SELECTOR THE PREDICATE USES. The first version left out :not([data-hc-furniture]),
    // so it reported 4 "turns" on an untouched Home while the predicate correctly said none — an
    // instrument disagreeing with the thing it was measuring, in its own output.
    turns: inner.querySelectorAll(".hc-msg:not([data-hc-arrival]):not([data-hc-furniture])").length,
    centredClass: !!document.querySelector(".hc-app.hc-home-centred"),
    predicate: !!(window.hublyHomeLayoutUI && window.hublyHomeLayoutUI.started()),
    scrolls: scroller.scrollHeight > scroller.clientHeight + 1,
  };
};

try {
  await rig.load(srv.url("platform-home.html"));
  await rig.page.evaluate(installOwnerFake, { uid: "sim", email: "o@e.test", displayName: "Adrian",
    places: [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }],
    tables: { jobs: [], tasks: [], customers: [], events: [] } });
  const bad = await rig.page.evaluate(fakeIntact);
  if (bad && !/never took a client/.test(bad)) { console.error("CANNOT RUN — " + bad); await rig.close(); srv.close(); process.exit(2); }
  await rig.page.evaluate(async ({ biz }) => {
    await window.hublyArrivalUI.simulate(biz, true, []);
    await new Promise((r) => setTimeout(r, 900));
  }, { biz: BIZ });
  A = await rig.page.evaluate(GEO);
  // THE TRANSITION, through the real append path — not by setting a class.
  B = await rig.page.evaluate(async (geoSrc) => {
    // THROUGH THE REAL APPEND PATH — window.hublyComposer.append IS hcAppendMessage. The first
    // version fell back to insertAdjacentHTML when a seam was missing, which BYPASSES the append and
    // therefore the sync: state B never arrived and the leg would have reported the PRODUCT broken
    // when the PROBE was. A missing seam is now CANNOT RUN, not a quieter test.
    if (!(window.hublyComposer && typeof window.hublyComposer.append === "function")) return { missing: true, why: "no hublyComposer.append seam" };
    window.hublyComposer.append("user", "make my prices bigger");
    await new Promise((r) => setTimeout(r, 400));
    return (new Function("return (" + geoSrc + ")"))()();
  }, GEO.toString());
} catch (e) { console.error("CANNOT RUN — " + e.message); await rig.close(); srv.close(); process.exit(2); }
await rig.close(); srv.close();

if (!A || A.missing || !B || B.missing) {
  console.error("CANNOT RUN — " + ((A && A.why) || (B && B.why) || "the thread geometry could not be read"));
  process.exit(2);
}
console.log(`  STATE A  ${A.kids} child(ren), ${A.turns} turn(s) · gapAbove ${Math.round(A.gapAbove)} · gapBelow ${Math.round(A.gapBelow)} · block ${Math.round(A.blockH)} of ${Math.round(A.scrollerH)} · class=${A.centredClass} predicate=${A.predicate}`);
console.log(`  STATE B  ${B.kids} child(ren), ${B.turns} turn(s) · gapAbove ${Math.round(B.gapAbove)} · gapBelow ${Math.round(B.gapBelow)} · block ${Math.round(B.blockH)} of ${Math.round(B.scrollerH)} · class=${B.centredClass} predicate=${B.predicate}\n`);

/* ── LEG 1 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 [SHAPE] state A is CENTRED — measured, with no dead zone below",
  why: "delete the centring rule. The class still goes on, `hc-home-centred` is still in the DOM, and " +
       "the block goes straight back to the top with ~500px of beige under it — which is exactly why " +
       "this leg measures gaps and not a class name.",
  file: "public/platform-home.html",
  find: ".hc-app.hc-home-centred .hc-thread-inner{justify-content:center;min-height:100%}",
  with: "/* BREAK: centring removed */",
});
const balanced = Math.abs(A.gapAbove - A.gapBelow) <= 24;
const notTopped = A.gapAbove > 24;
leg("SHAPE", "1 [SHAPE] state A is CENTRED — measured, with no dead zone below",
  A.turns === 0 && balanced && notTopped,
  `with ${A.turns} turn(s): ${Math.round(A.gapAbove)}px above the block and ${Math.round(A.gapBelow)}px ` +
  `below, in a ${Math.round(A.scrollerH)}px thread — within 24px of each other, and the top gap is not ` +
  `~0. Gaps, not a class: a class can be present and centre nothing. The "dead zone" Adrian described ` +
  `IS this asymmetry — a block at the top and everything left over underneath.`);

/* ── LEG 2 WAS HERE, AND IT CANNOT BE RED-PROOFED INDEPENDENTLY ─────────────────────────────
 *
 * It asserted "the predicate reads the TRANSCRIPT, not a flag" — Adrian's requirement, and the right
 * one: *"A flag disagrees with the transcript the first time a message arrives from elsewhere, and
 * Home already has a late-render scar of exactly that shape."*
 *
 * But the predicate FEEDS the layout leg 3 measures, so every break that reaches this claim also
 * reaches leg 3 — it came back COMPOUND, and no narrower break exists that is not contrived: any
 * change that makes the predicate stop reading the DOM also changes what the DOM looks like
 * afterwards. Both candidate breaks (a stored flag, and `hc.messages.length`) fail both legs, because
 * hcAppendMessage does not touch hc.messages either.
 *
 * A leg that cannot fail independently of another cannot be red-proofed, and keeping it would add a
 * green that tests nothing — the same call as the second-edit check's control leg. So the property is
 * PRINTED and not asserted: the run above shows the seam's own predicate as false with 0 turns and
 * true with 1, and leg 3 proves end-to-end that it moves the layout. THE "NOT A FLAG" PROPERTY IS
 * THEREFORE HELD BY REVIEW AND BY LEG 3's BEHAVIOUR, NOT BY AN INDEPENDENT LEG — said here plainly so
 * nobody later reads a 2/2 as covering it. The predicate's source is four lines and one querySelectorAll. */

/* ── LEG 3 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 [SHAPE] writing moves A to B — the composer's turn un-centres Home",
  why: "stop recomputing when a turn lands. State A is still correct on entry and state B never " +
       "arrives: the owner writes, and their message is centred in the middle of the screen with the " +
       "composer below it. The layout is right exactly until it is used.",
  file: "public/platform-home.html",
  find: "    try{ hcSyncHomeLayout(); }catch(e){}\n    hcThreadScrollToEnd();\n    return div;",
  with: "    hcThreadScrollToEnd();\n    return div;",
});
const movedToThread = B.centredClass === false && B.gapAbove <= 24;
leg("SHAPE", "3 [SHAPE] writing moves A to B — the composer's turn un-centres Home",
  A.centredClass === true && movedToThread,
  `A: centred=${A.centredClass}, gapAbove ${Math.round(A.gapAbove)}px. After a REAL append through ` +
  `the shell's own path: centred=${B.centredClass}, gapAbove ${Math.round(B.gapAbove)}px — the block ` +
  `returned to the top, which is what a thread is. Driven through the append path rather than by ` +
  `toggling a class, because a class set by hand proves the CSS and nothing about the transition.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
