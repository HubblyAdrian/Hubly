#!/usr/bin/env node
/**
 * Milestone 1.5 — Release Gate runner (Builder Engine epics).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const verbose = !!process.env.MILESTONE15_VERBOSE;

const EPICS = [
  { n: 1, title: 'Builder Expert', script: 'scripts/check-builder-epic1.mjs', unlocked: true },
  { n: 2, title: 'Change Plan DSL', script: 'scripts/check-builder-epic2.mjs', unlocked: true },
  { n: 3, title: 'Preview Engine', script: 'scripts/check-builder-epic3.mjs', unlocked: true },
  { n: 4, title: 'Collaboration & Approval', script: 'scripts/check-builder-epic4.mjs', unlocked: true },
  { n: 5, title: 'Version & Rollback', script: 'scripts/check-builder-epic5.mjs', unlocked: true },
  { n: 6, title: 'Website Builder', script: null, unlocked: false },
  { n: 7, title: 'Booking Builder', script: null, unlocked: false },
  { n: 8, title: 'CRM Builder', script: null, unlocked: false },
  { n: 9, title: 'Automation Builder', script: null, unlocked: false },
  { n: 10, title: 'Portfolio Builder', script: null, unlocked: false },
  { n: 11, title: 'Hubly Chat', script: null, unlocked: false },
  { n: 12, title: 'Builder Validation', script: null, unlocked: false },
];

console.log('\n🏔️  Milestone 1.5 — Builder Engine Release Gate\n');

const results = [];
for (const e of EPICS) {
  const label = `Epic ${String(e.n).padStart(2, '0')} — ${e.title}`;
  if (!e.unlocked || !e.script) {
    console.log(`${label.padEnd(42)} 🔒`);
    results.push({ n: e.n, title: e.title, status: 'locked', script: e.script });
    continue;
  }
  const r = spawnSync(process.execPath, [e.script], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  const ok = r.status === 0;
  console.log(`${label.padEnd(42)} ${ok ? '✅' : '❌'}`);
  if (!ok && verbose) {
    console.log(r.stdout || '');
    console.error(r.stderr || '');
  }
  results.push({
    n: e.n,
    title: e.title,
    status: ok ? 'pass' : 'fail',
    script: e.script,
  });
}

const unlocked = results.filter((r) => r.status !== 'locked');
const passed = unlocked.filter((r) => r.status === 'pass').length;
const failed = unlocked.filter((r) => r.status === 'fail').length;
const total = EPICS.length;
const unlockedTotal = unlocked.length;
const percent = Math.round((passed / total) * 100);
const ready = passed === total;
const unlockedGreen = failed === 0 && unlockedTotal > 0;

console.log('\nOverall');
console.log(`${percent}%`);
console.log(ready ? 'Ready' : 'Not Ready');
console.log(`(${passed}/${total} epics proven · ${unlockedTotal} unlocked)\n`);

const gate = {
  milestone: '1.5',
  passed,
  total,
  unlocked: unlockedTotal,
  percent,
  ready,
  checkedAt: new Date().toISOString(),
  epics: results,
};

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs/MILESTONE15_RELEASE_GATE.json'),
  JSON.stringify(gate, null, 2) + '\n',
);

process.exit(unlockedGreen ? 0 : 1);
