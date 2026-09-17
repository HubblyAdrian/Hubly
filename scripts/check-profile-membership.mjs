/**
 * Regression: Profile layout must expose Membership as a tab type
 * (page sections are CSS-hidden on simple-profile).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// ══ THE FILE LIST IS DERIVED, NOT TRANSCRIBED (2026-09-17) ═══════════════════════════════════
// This read `hubly.html` at the repo root. That file has not existed for a long time — the shell
// is public/hubly.html — so the check CRASHED on ENOENT before its first assertion and had been
// reporting nothing at all. It was one of SIX in exactly this state: red for months, red for a
// reason that had nothing to do with the product, and therefore never read.
// A LIST OF PATHS IS A HAND-MAINTAINED SET. It is filtered by what is actually on disk, and it
// refuses rather than passing vacuously if the filtering leaves nothing.
const files = ['hubly.html', 'public/hubly.html'].filter((f) => fs.existsSync(f));
if (!files.length) { console.error('CANNOT RUN — none of the candidate files exist'); process.exit(2); }
const required = [
  ['ensureProfileMembershipTab', 'injects Membership tab on profile layout'],
  ['type===\'membership\'', 'membership panel type branch'],
  ['ws-profile-memberships', 'membership slot id'],
  ['data-profile-slot="membership"', 'membership profile slot'],
  ['id="ed-membership"', 'settings accordion anchor'],
  ['body.ed-sheet-open #ed-ai-fab', 'FAB hidden while sheet open'],
  ['ws-pe-tab-type', 'tab type selector includes membership'],
];

let failed = false;
for (const rel of files) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  console.log('Checking', rel);
  if (!html.includes(".ws-layout-simple-profile .ws-page > .ws-section")) {
    // tolerate alternate selector variants
    if (!html.includes('ws-layout-simple-profile') || !html.includes('.ws-page>.ws-section')) {
      console.error('  MISS profile layout section hide CSS');
      failed = true;
    }
  }
  for (const [needle, why] of required) {
    if (!html.includes(needle)) {
      console.error('  MISS', why, '→', needle);
      failed = true;
    } else {
      console.log('  OK', why);
    }
  }
}
process.exit(failed ? 1 : 0);
