import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

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

test('Section 1 — Hubly Brain gate is proven', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/check-hubly-brain-section1.mjs')], {
    cwd: root,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, r.stderr || r.stdout || 'Section 1 incomplete');
  const proof = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION1_PROOF.json'), 'utf8'),
  );
  assert.equal(proof.passed, true);
  assert.equal(proof.section, 1);
  assert.ok(proof.proofs.length >= 10);
});
