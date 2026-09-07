#!/usr/bin/env node
/* Lift the functions under test out of public/hubly.html VERBATIM, so the
 * verifier can never drift from what actually ships. Regenerate, then run:
 *   node scripts/lift-editor-fixes.mjs && node scripts/verify-editor-fixes.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const h = readFileSync(path.join(ROOT, 'public/hubly.html'), 'utf8');
const grab = (a, b) => { const i = h.indexOf(a); const j = h.indexOf(b, i); if (i < 0 || j < 0) { console.error(`could not lift ${a.slice(0,40)}…`); process.exit(1); } return h.slice(i, j); };
const svc = h.match(/description:\('desc' in s\)\?[^\n]*/);
const add = h.match(/description:\('desc' in raw\)\?[^\n]*/);
if (!svc || !add) { console.error('could not find the description expressions — did the fix change shape?'); process.exit(1); }
writeFileSync(path.join(ROOT, 'scripts/.editor-fixes.generated.mjs'),
  'let TOASTS=[];\nconst toast=(m)=>TOASTS.push(m);\nconst normalizeBlueprintId=(x)=>x;\n' +
  grab('function stripDataUrlsDeep(v){', 'const SLIM_MAX_PORTFOLIO') +
  grab('const SLIM_MAX_PORTFOLIO', 'function ownerHasNamedPackages()') +
  `const svcDesc=(s)=>({${svc[0].replace(/,\s*$/, '')}}).description;\n` +
  `const addDesc=(raw)=>({${add[0].replace(/,\s*$/, '')}}).description;\n` +
  'export { slimBizPayload, svcDesc, addDesc, TOASTS, SLIM_MAX_PORTFOLIO, SLIM_MAX_ALBUM };\n');
console.log('lifted from public/hubly.html -> scripts/.editor-fixes.generated.mjs');
