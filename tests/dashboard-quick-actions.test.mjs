import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hublySrc = readFileSync(join(root, 'public/hubly.html'), 'utf8');

function quickActionsBlock(src) {
  const m = src.match(/data-i18n="quickActions">Quick actions[\s\S]*?<\/div>\s*<\/div>\s*<div class="sc">/);
  assert.ok(m, 'expected Quick actions section');
  return m[0];
}

describe('Dashboard quick actions', () => {
  it('keeps Quick Quote and drops nav-duplicate shortcuts', () => {
    const block = quickActionsBlock(hublySrc);
    assert.match(block, /onclick="openSmartQuote\(\)"/);
    assert.match(block, />Quick Quote</);
    assert.doesNotMatch(block, /scheduleJob/);
    assert.doesNotMatch(block, /Schedule job/);
    assert.doesNotMatch(block, /viewMoney/);
    assert.doesNotMatch(block, /View revenue/);
    assert.doesNotMatch(block, /Edit website/);
    assert.doesNotMatch(block, /data-v=money/);
    assert.doesNotMatch(block, /data-v=editor/);
    assert.doesNotMatch(block, /openM\('m-new-job'\)/);
  });
});
