import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Hubly Brain Milestone 1 structural checklist', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/check-hubly-brain.mjs')], {
    cwd: root,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, r.stderr || r.stdout || 'check-hubly-brain failed');
});
