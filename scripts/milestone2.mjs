#!/usr/bin/env node
/**
 * Milestone 2 — The Hubly Experience (Release Gate runner)
 *
 * Nothing new unless it improves the customer experience.
 * Epic 0 first — visible Hubly Identity & Personality.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const verbose = !!process.env.MILESTONE2_VERBOSE;

const EPICS = [
  { n: 0, title: 'Hubly Identity & Personality', script: 'scripts/check-experience-epic0.mjs', unlocked: true },
  { n: 1, title: 'Welcome to Hubly', script: null, unlocked: false },
  { n: 2, title: 'Business Discovery Conversation', script: null, unlocked: false },
  { n: 3, title: 'Hubly Thinks Out Loud', script: null, unlocked: false },
  { n: 4, title: 'Creative Build Session', script: null, unlocked: false },
  { n: 5, title: 'The Reveal', script: null, unlocked: false },
  { n: 6, title: 'Delayed Account Creation', script: null, unlocked: false },
  { n: 7, title: 'Business Launch Celebration', script: null, unlocked: false },
  { n: 8, title: 'Business Home', script: null, unlocked: false },
  { n: 9, title: 'Creative Workspace', script: null, unlocked: false },
  { n: 10, title: 'Hubly Daily', script: null, unlocked: false },
  { n: 11, title: 'Living Business', script: null, unlocked: false },
  { n: 12, title: 'Polish', script: null, unlocked: false },
];

console.log('\n🏔️  Milestone 2 — The Hubly Experience Release Gate\n');

const results = [];
for (const e of EPICS) {
  const label = `Epic ${String(e.n).padStart(2, '0')} — ${e.title}`;
  if (!e.unlocked || !e.script) {
    console.log(`${label.padEnd(48)} 🔒`);
    results.push({ n: e.n, title: e.title, status: 'locked', script: e.script });
    continue;
  }
  const r = spawnSync(process.execPath, [e.script], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  const ok = r.status === 0;
  console.log(`${label.padEnd(48)} ${ok ? '✅' : '❌'}`);
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
  milestone: '2',
  name: 'The Hubly Experience',
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
  path.join(root, 'docs/MILESTONE2_RELEASE_GATE.json'),
  JSON.stringify(gate, null, 2) + '\n',
);

process.exit(unlockedGreen ? 0 : 1);
