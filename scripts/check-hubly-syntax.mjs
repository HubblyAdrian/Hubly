#!/usr/bin/env node
/** Fail if hubly.html inline scripts have SyntaxErrors (blank Start Free boot). */
import fs from 'fs';
import vm from 'vm';

let failed = false;
function check(path) {
  const html = fs.readFileSync(path, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  let i = 0;
  while ((m = re.exec(html))) {
    const code = m[1];
    if (code.trim().length < 80) continue;
    try {
      new vm.Script(code, { filename: `${path}#inline-${i}` });
    } catch (e) {
      console.error('FAIL:', path, e.message);
      failed = true;
    }
    i++;
  }
  if (!failed) console.log('OK:', path, 'inline scripts parse');
}

check('public/hubly.html');
check('hubly.html');
if (/\/g=''/.test(fs.readFileSync('public/hubly.html', 'utf8'))) {
  console.error("FAIL: sms replace typo /g='' still present");
  failed = true;
}
if (failed) process.exit(1);
console.log('OK hubly syntax checks passed');
