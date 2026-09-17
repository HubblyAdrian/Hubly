#!/usr/bin/env node
import fs from 'fs';

// ══ THE FILE LIST IS DERIVED, NOT TRANSCRIBED (2026-09-17) ═══════════════════════════════════
// This read `hubly.html` at the repo root. That file has not existed for a long time — the shell
// is public/hubly.html — so the check CRASHED on ENOENT before its first assertion and had been
// reporting nothing at all. It was one of SIX in exactly this state: red for months, red for a
// reason that had nothing to do with the product, and therefore never read.
// A LIST OF PATHS IS A HAND-MAINTAINED SET. It is filtered by what is actually on disk, and it
// refuses rather than passing vacuously if the filtering leaves nothing.
const files = ['hubly.html', 'public/hubly.html'].filter((f) => fs.existsSync(f));
if (!files.length) { console.error('CANNOT RUN — none of the candidate files exist'); process.exit(2); }
// ══ [RULE] AN OFF-CANVAS DRAWER WITH A WAY IN AND A WAY OUT — NOT WHICH SIDE IT COMES FROM ═══
//
// This demanded `transform:translateX(105%)` (a drawer entering from the RIGHT) and the literal
// comment string "hamburger + slide-out drawer". The drawer was deliberately moved to the LEFT so
// it opens from the same side as the hamburger, and the comment was reworded — so the check went
// red because the product got better, which is Lesson 92 exactly: it was encoding a SHAPE and the
// check is what was wrong.
//
// What it protects is real and survives: on a phone the app navigation is a DRAWER that can be
// opened and closed, and it is NOT a bottom tab bar. Which edge it slides from is a design choice
// and this file has no business having an opinion about it.
const required = [
  'nav-menu-btn',        // the way in
  'nav-drawer-close',    // the way out
  'app-nav-backdrop',    // and the tap-outside way out
  'openMobileNav',
  'closeMobileNav',
  'toggleMobileNav',
  'isMobileNavLayout',
];
const forbidden = [
  'bottom tab bar instead of side nav',
  'flex-direction:row;align-items:stretch;justify-content:space-around',
];
/** [RULE] It is OFF-CANVAS: parked outside the viewport and slid in. Either edge. */
const OFF_CANVAS = /transform:\s*translateX\(-?10[0-9]%\)/;
let failed = false;
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  for (const needle of required) {
    if (!html.includes(needle)) {
      console.error(`FAIL ${file}: missing ${needle}`);
      failed = true;
    }
  }
  for (const needle of forbidden) {
    if (html.includes(needle)) {
      console.error(`FAIL ${file}: still has bottom-tab pattern: ${needle}`);
      failed = true;
    }
  }
  // [RULE] parked off-canvas and slid in — from whichever edge the design chose.
  if (!OFF_CANVAS.test(html)) {
    console.error(`FAIL ${file}: the drawer is not parked off-canvas (no translateX(±10x%))`);
    failed = true;
  }
  if (!html.includes('onclick="toggleMobileNav()"')) {
    console.error(`FAIL ${file}: hamburger not wired`);
    failed = true;
  }
  if (!html.includes('try{closeMobileNav();}catch(e){}')) {
    console.error(`FAIL ${file}: switchV should close drawer`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('OK mobile nav drawer checks passed');
