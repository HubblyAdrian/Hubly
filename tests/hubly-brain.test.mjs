import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(script) {
  return spawnSync(process.execPath, [path.join(root, script)], {
    cwd: root,
    encoding: 'utf8',
  });
}

test('Section 1 — Hubly Brain gate is proven', () => {
  const r = run('scripts/check-section1-hubly-brain.mjs');
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
});

test('Section 2 — Experience Director is proven with behavioral fixtures', () => {
  const r = run('scripts/check-section2-experience-director.mjs');
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, r.stderr || r.stdout || 'Section 2 incomplete');
  const proof = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION2_PROOF.json'), 'utf8'),
  );
  assert.equal(proof.passed, true);
  assert.equal(proof.section, 2);
  assert.equal(proof.version, '1.2.0');
  assert.ok(proof.evidence?.fixtures?.length >= 5);
  assert.ok(proof.evidence?.interceptionLogs?.length >= 1);
  const a = proof.evidence.fixtures.find((f) => f.id === 'A_reduce_questions_10_to_3');
  assert.equal(a.after.questionCount, 3);
  assert.equal(a.before.questionCount, 10);
  assert.equal(a.interception.modified, true);
  const b = proof.evidence.fixtures.find((f) => f.id === 'B_settings_to_conversation');
  assert.equal(b.after.vetoed, true);
  assert.equal(b.after.settingCount, 0);
  assert.equal(proof.evidence.releaseGate.enforcesOneHublyPersonality, true);
});

test('Section 3 — AI Expert Framework is proven with Demo Expert lifecycle', () => {
  const r = run('scripts/check-section3-expert-framework.mjs');
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, r.stderr || r.stdout || 'Section 3 incomplete');
  const proof = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION3_PROOF.json'), 'utf8'),
  );
  assert.equal(proof.passed, true);
  assert.equal(proof.section, 3);
  assert.equal(proof.evidence.demoLifecycle.executed, true);
  assert.equal(proof.evidence.demoLifecycle.unregistered, true);
  assert.equal(proof.evidence.demoLifecycle.brainFilesModifiedToAddDemo, false);
  assert.equal(proof.evidence.releaseGate.newExpertsWithoutBrainChanges, true);
});

test('Section 4 — Initial Experts are proven with pressure-washing demo', () => {
  const r = run('scripts/check-section4-initial-experts.mjs');
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, r.stderr || r.stdout || 'Section 4 incomplete');
  const proof = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION4_PROOF.json'), 'utf8'),
  );
  assert.equal(proof.passed, true);
  assert.equal(proof.section, 4);
  assert.equal(proof.evidence.demoRequest, "I'm starting a pressure washing company.");
  assert.ok(proof.evidence.executionOrder.includes('research'));
  assert.ok(proof.evidence.executionOrder.includes('experience_director'));
  assert.equal(proof.evidence.expertTranscript.customerVisible, false);
  assert.equal(proof.evidence.releaseGate.brainOrchestratesAll, true);
  assert.equal(proof.evidence.releaseGate.expertTranscriptInternal, true);
});

test('Section 5 — Business Memory is proven with multi-conversation scenario', () => {
  const r = run('scripts/check-section5-business-memory.mjs');
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, r.stderr || r.stdout || 'Section 5 incomplete');
  const proof = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION5_PROOF.json'), 'utf8'),
  );
  assert.equal(proof.passed, true);
  assert.equal(proof.section, 5);
  assert.equal(proof.architectureSummary.owner, 'hubly_brain');
  assert.ok(proof.evidence.retrievalExamples?.length >= 3);
  assert.equal(proof.evidence.retrievalExamples[0].usedChatHistory, false);
  assert.equal(proof.evidence.persistence.loaded, true);
  assert.equal(proof.evidence.releaseGate.retrievesFromMemoryNotChat, true);
  assert.equal(proof.evidence.releaseGate.memoryImportance, true);
});

test('Section 6 — Workspace Memory is proven with owner preference scenario', () => {
  const r = run('scripts/check-section6-workspace-memory.mjs');
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, r.stderr || r.stdout || 'Section 6 incomplete');
  const proof = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION6_PROOF.json'), 'utf8'),
  );
  assert.equal(proof.passed, true);
  assert.equal(proof.section, 6);
  assert.equal(proof.architectureSummary.owner, 'hubly_brain');
  assert.equal(proof.evidence.separationFromBusinessMemory.businessMemoryHasSidebar, false);
  assert.ok(proof.evidence.retrievalExamples?.length >= 2);
  assert.equal(proof.evidence.persistence.loaded, true);
  assert.equal(proof.evidence.releaseGate.notCrmPersonalization, true);
  assert.equal(proof.evidence.releaseGate.foundationForWorkspaceExpert, true);
});

test('Section 7 — Business DNA is proven with Salt Lake City pressure washing demo', () => {
  const r = run('scripts/check-section7-business-dna.mjs');
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, r.stderr || r.stdout || 'Section 7 incomplete');
  const proof = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION7_PROOF.json'), 'utf8'),
  );
  assert.equal(proof.passed, true);
  assert.equal(proof.section, 7);
  assert.match(proof.demoRequest, /Salt Lake City/);
  assert.equal(proof.evidence.expertUsage.research.dnaUsed, true);
  assert.equal(proof.evidence.expertUsage.strategy.dnaUsed, true);
  assert.equal(proof.evidence.communityLearning.automaticLearning, false);
  assert.ok(proof.evidence.evidenceLoaded.every((e) => e.source && e.lastReviewed));
  assert.equal(proof.evidence.releaseGate.evidenceQuality, true);
});

test('Milestone 1 gate reports partial progress (not ready until 18/18)', () => {
  const r = run('scripts/milestone1.mjs');
  assert.notEqual(r.status, 0);
  const gate = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/MILESTONE1_RELEASE_GATE.json'), 'utf8'),
  );
  assert.equal(gate.milestone, 1);
  assert.equal(gate.ready, false);
  assert.ok(gate.passed >= 3);
  assert.equal(gate.total, 18);
  assert.equal(gate.sections.find((s) => s.n === 1).status, 'pass');
  assert.equal(gate.sections.find((s) => s.n === 2).status, 'pass');
  assert.equal(gate.sections.find((s) => s.n === 3).status, 'pass');
});
