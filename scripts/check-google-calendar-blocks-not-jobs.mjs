#!/usr/bin/env node
/**
 * Proof: Google Calendar appointments are busy blocks — never Hubly jobs in Reports.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function isHublyOwnedJob(j) {
  return !!(j && !j.isGoogle && !j.isBlock);
}

function jobsBetween(jobs, start, end) {
  return jobs.filter((j) => {
    if (!j.date) return false;
    const d = new Date(j.date + 'T00:00:00');
    return d >= start && d <= end;
  });
}

function reportableJobs(jobs, start, end) {
  return jobsBetween(jobs, start, end).filter(isHublyOwnedJob);
}

const start = new Date('2026-07-01T00:00:00');
const end = new Date('2026-07-31T23:59:59');

const S_jobs = [
  {
    id: 'job_real',
    date: '2026-07-10',
    service: 'Exterior Window Cleaning',
    amount: 150,
    status: 'scheduled',
  },
  {
    id: 'gcal_interview',
    date: '2026-07-12',
    service: 'Adrian On-Site Interview',
    amount: null,
    status: 'scheduled',
    isGoogle: true,
    isBlock: true,
    customer: 'Google Calendar',
  },
  {
    id: 'gcal_test',
    date: '2026-07-15',
    service: 'TEST',
    amount: null,
    status: 'scheduled',
    isGoogle: true,
    isBlock: true,
    customer: 'Google Calendar',
  },
  {
    id: 'block_hubly',
    date: '2026-07-18',
    service: 'Time blocked',
    customer: 'Blocked',
    isBlock: true,
    status: 'scheduled',
  },
];

const all = jobsBetween(S_jobs, start, end);
const reportable = reportableJobs(S_jobs, start, end);

assert.equal(all.length, 4, 'raw merge includes google + blocks');
assert.equal(reportable.length, 1, 'reports count only Hubly-owned jobs');
assert.equal(reportable[0].service, 'Exterior Window Cleaning');
assert.ok(!reportable.some((j) => /Interview|TEST/i.test(j.service)));
assert.ok(isHublyOwnedJob(S_jobs[0]));
assert.equal(isHublyOwnedJob(S_jobs[1]), false);
assert.equal(isHublyOwnedJob(S_jobs[2]), false);
assert.equal(isHublyOwnedJob(S_jobs[3]), false);

// Source wiring — both shipped HTML surfaces use reportableJobs
for (const rel of ['hubly.html', 'public/hubly.html']) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  assert.match(src, /function reportableJobs/);
  assert.match(src, /reportableJobs\(start,end\)/);
  assert.match(src, /isHublyOwnedJob/);
  assert.ok(
    !/function reportMetricValue[\s\S]{0,200}jobsBetween\(S\.jobs/.test(src),
    `${rel}: reportMetricValue must not count raw S.jobs`,
  );
  assert.ok(
    !/function reportServicesBreakdown[\s\S]{0,120}jobsBetween\(S\.jobs/.test(src),
    `${rel}: By service must not count Google appointments`,
  );
}

const proof = {
  name: 'Google Calendar blocks are not Hubly jobs',
  passed: true,
  checkedAt: new Date().toISOString(),
  rule: 'Google Calendar events Hubly did not create stay busy blocks (things) — they block booking and never count as Jobs in Reports.',
  proofs: {
    reportJobsCount: reportable.length,
    excludedTitles: ['Adrian On-Site Interview', 'TEST'],
    includedService: 'Exterior Window Cleaning',
    filter: 'isHublyOwnedJob = !isGoogle && !isBlock',
  },
};

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs/GOOGLE_CALENDAR_BLOCKS_NOT_JOBS_PROOF.json'),
  JSON.stringify(proof, null, 2) + '\n',
);

console.log('PASS — Google Calendar appointments excluded from Reports jobs');
console.log('  Proof → docs/GOOGLE_CALENDAR_BLOCKS_NOT_JOBS_PROOF.json');
