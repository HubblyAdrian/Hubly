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
let failed = false;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');

  const isEditor = html.match(/function isEditorViewOpen\(\)\{[\s\S]*?\n\}/);
  if (!isEditor) {
    console.error(`FAIL ${file}: isEditorViewOpen missing`);
    failed = true;
    continue;
  }
  if (!isEditor[0].includes('S.ownerPreview')) {
    console.error(`FAIL ${file}: isEditorViewOpen must short-circuit on ownerPreview`);
    failed = true;
  }
  if (!isEditor[0].includes("p-app") || !isEditor[0].includes('active')) {
    console.error(`FAIL ${file}: isEditorViewOpen must require active #p-app`);
    failed = true;
  }

  const preview = html.match(/function previewProfile\(\)\{[\s\S]*?\n\}/);
  if (!preview) {
    console.error(`FAIL ${file}: previewProfile missing`);
    failed = true;
  } else {
    for (const call of ['unmountEdChrome', 'closeEdSheet', 'closeWsPePop', "classList.add('hidden')"]) {
      if (!preview[0].includes(call)) {
        console.error(`FAIL ${file}: previewProfile should call/include ${call}`);
        failed = true;
      }
    }
  }

  const setOp = html.match(/function setOwnerPreview\(on\)\{[\s\S]*?\n\}/);
  if (!setOp || !setOp[0].includes('ed-owner-preview-open')) {
    console.error(`FAIL ${file}: setOwnerPreview should toggle ed-owner-preview-open`);
    failed = true;
  }

  // [RULE] the editor's reorder controls are hidden while the owner is previewing his own page.
  // THE CONTAINER'S NAME IS NOT THE RULE: this required `#p-storefront`, which the product renamed
  // to `#p-classic-site`. Matched on the class that does the work, with the id left open, so the
  // next rename does not produce a false defect.
  if (!/body\.ed-owner-preview-open\s+#[a-z-]+\s+\.ws-re-btns/.test(html)) {
    console.error(`FAIL ${file}: missing CSS hide for editor reorder controls in owner preview`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('OK owner preview click checks passed');
