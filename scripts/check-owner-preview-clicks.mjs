#!/usr/bin/env node
import fs from 'fs';

const files = ['hubly.html', 'public/hubly.html'];
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
    for (const call of ['unmountEdChrome', 'closeEdSheet', 'closeWsPePop']) {
      if (!preview[0].includes(call)) {
        console.error(`FAIL ${file}: previewProfile should call ${call}`);
        failed = true;
      }
    }
  }

  const setOp = html.match(/function setOwnerPreview\(on\)\{[\s\S]*?\n\}/);
  if (!setOp || !setOp[0].includes('ed-owner-preview-open')) {
    console.error(`FAIL ${file}: setOwnerPreview should toggle ed-owner-preview-open`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('OK owner preview click checks passed');
