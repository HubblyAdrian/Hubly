import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const hublySrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'public/hubly.html'),
  'utf8'
);

describe('Mobile action feedback', () => {
  it('lifts toasts above the bottom nav on mobile', () => {
    assert.match(hublySrc, /#toast\{[^}]*z-index:10050/);
    assert.match(hublySrc, /#toast\{[\s\S]*?bottom:calc\(72px \+ env\(safe-area-inset-bottom\)\)/);
    assert.match(hublySrc, /function notifyDone\(/);
    assert.match(hublySrc, /function toast\(msg,opts\)/);
  });

  it('shows a clear done state after Google early-access request', () => {
    assert.match(hublySrc, /id="ed-gcal-early-done"/);
    assert.match(hublySrc, /Request sent ✓/);
    assert.match(hublySrc, /function showGcalAccessRequestedUI/);
    assert.match(hublySrc, /markGcalAccessRequested\(\)/);
    assert.match(hublySrc, /notifyDone\('Request sent ✓/);
    assert.match(hublySrc, /is-requested/);
  });
});
