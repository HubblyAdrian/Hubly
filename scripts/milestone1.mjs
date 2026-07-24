#!/usr/bin/env node
/**
 * Milestone 1 release gate — runs Section 1–18 proof scripts.
 * Milestone 2 is blocked until every section passes.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = process.cwd();

const SECTIONS = [
  { n: 1, title: 'Hubly Brain', script: 'scripts/check-section1-hubly-brain.mjs' },
  { n: 2, title: 'Experience Director', script: 'scripts/check-section2-experience-director.mjs' },
  { n: 3, title: 'AI Expert Framework', script: 'scripts/check-section3-expert-framework.mjs' },
  { n: 4, title: 'Initial Experts', script: 'scripts/check-section4-initial-experts.mjs' },
  { n: 5, title: 'Business Memory', script: 'scripts/check-section5-business-memory.mjs' },
  { n: 6, title: 'Workspace Memory', script: 'scripts/check-section6-workspace-memory.mjs' },
  { n: 7, title: 'Business DNA', script: 'scripts/check-section7-business-dna.mjs' },
  { n: 8, title: 'Reasoning Engine', script: 'scripts/check-section8-reasoning-engine.mjs' },
  { n: 9, title: 'AI Decision & Confidence Engine', script: 'scripts/check-section9-decision-engine.mjs' },
  { n: 10, title: 'Conversation Intelligence', script: 'scripts/check-section10-conversation-intelligence.mjs' },
  { n: 11, title: 'AI Capability Registry & Tool Registry', script: 'scripts/check-section11-registries.mjs' },
  { n: 12, title: 'Hubly Mission Control', script: 'scripts/check-section12-mission-control.mjs' },
  { n: 13, title: 'Hubly Identity System', script: 'scripts/check-section13-identity-system.mjs' },
  { n: 14, title: 'Performance, Reliability & Resilience', script: 'scripts/check-section14-reliability.mjs' },
  { n: 15, title: 'Platform Extensibility', script: 'scripts/check-section15-platform-extensibility.mjs' },
  { n: 16, title: 'Tests', script: 'scripts/check-section16-tests.mjs' },
  { n: 17, title: 'Documentation', script: 'scripts/check-section17-documentation.mjs' },
  { n: 18, title: 'Founder Demo', script: 'scripts/check-section18-founder-demo.mjs' },
];

const results = [];

console.log('\n🏔️  Milestone 1 — Release Gate\n');

for (const s of SECTIONS) {
  const scriptPath = path.join(root, s.script);
  let status = 'missing';
  let code = 1;
  if (!fs.existsSync(scriptPath)) {
    status = 'missing';
    code = 1;
    console.log(`Section ${String(s.n).padStart(2, '0')} — ${s.title.padEnd(24)} ❌  (script missing)`);
  } else {
    const r = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, MILESTONE1_QUIET: '1' },
    });
    code = r.status == null ? 1 : r.status;
    status = code === 0 ? 'pass' : 'fail';
    const mark = code === 0 ? '✅' : '❌';
    console.log(`Section ${String(s.n).padStart(2, '0')} — ${s.title.padEnd(24)} ${mark}`);
    if (code !== 0 && process.env.MILESTONE1_VERBOSE === '1') {
      if (r.stdout) console.log(r.stdout);
      if (r.stderr) console.error(r.stderr);
    }
  }
  results.push({ ...s, status, code });
}

const passed = results.filter((r) => r.code === 0).length;
const total = results.length;
const pct = Math.round((passed / total) * 100);
const ready = passed === total;

console.log('\nOverall');
console.log(`${pct}%`);
console.log(ready ? 'Ready' : 'Not Ready');
console.log(`(${passed}/${total} sections proven)\n`);

const summary = {
  milestone: 1,
  passed,
  total,
  percent: pct,
  ready,
  checkedAt: new Date().toISOString(),
  sections: results.map((r) => ({
    n: r.n,
    title: r.title,
    status: r.status,
    script: r.script,
  })),
};
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs/MILESTONE1_RELEASE_GATE.json'),
  JSON.stringify(summary, null, 2) + '\n',
);

process.exit(ready ? 0 : 1);
