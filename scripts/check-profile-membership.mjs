/**
 * Regression: Profile layout must expose Membership as a tab type
 * (page sections are CSS-hidden on simple-profile).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['hubly.html', 'public/hubly.html'];
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
