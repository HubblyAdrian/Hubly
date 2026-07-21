import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  applyLeadStageRole,
  leadStageDropRoute,
  normalizeLeadStageDef,
  normalizeLeadStageDefs,
  slugifyLeadStageId,
} from '../scripts/lib/lead-stage-destination.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hublySrc = readFileSync(join(root, 'public/hubly.html'), 'utf8');

describe('lead stage destinations', () => {
  it('persists role + convertsToJobs on custom stages', () => {
    const custom = normalizeLeadStageDef({ id: 'booked_out', label: 'Booked out', tone: 'blue', role: 'won' });
    assert.equal(custom.role, 'won');
    assert.equal(custom.convertsToJobs, true);
    const board = normalizeLeadStageDef({ id: 'follow_up', label: 'Follow up', role: 'open' });
    assert.equal(board.convertsToJobs, false);
    assert.equal(board.role, 'open');
  });

  it('routes drops by destination role, not label heuristics alone', () => {
    const stages = normalizeLeadStageDefs([
      { id: 'new', label: 'New', role: 'open' },
      { id: 'closed_won', label: 'Closed won', role: 'won' },
      { id: 'dead', label: 'Dead end', role: 'lost' },
    ]);
    assert.deepEqual(leadStageDropRoute('closed_won', stages).action, 'convert_to_jobs');
    assert.deepEqual(leadStageDropRoute('dead', stages).action, 'mark_lost');
    assert.deepEqual(leadStageDropRoute('new', stages).action, 'move_stage');
  });

  it('keeps a single won destination when applying roles', () => {
    const stages = normalizeLeadStageDefs([
      { id: 'won', label: 'Won → Jobs', role: 'won' },
      { id: 'vip', label: 'VIP win', role: 'open' },
      { id: 'lost', label: 'Lost', role: 'lost' },
    ]);
    const next = applyLeadStageRole(stages, 'vip', 'won');
    assert.equal(next.filter((s) => s.role === 'won').length, 1);
    assert.equal(next.find((s) => s.id === 'vip')?.role, 'won');
    assert.equal(next.find((s) => s.id === 'won')?.role, 'open');
  });

  it('slugifies unique stage ids', () => {
    assert.equal(slugifyLeadStageId('Follow up!', ['follow_up']), 'follow_up_2');
  });

  it('wires destination modal + routing into owner UI', () => {
    assert.match(hublySrc, /id="m-lead-stage"/);
    assert.match(hublySrc, /name="ls-role"/);
    assert.match(hublySrc, /function leadStageDropRoute/);
    assert.match(hublySrc, /function saveLeadStageModal/);
    assert.match(hublySrc, /role:'won'/);
    assert.match(hublySrc, /data-stage-role=/);
    assert.match(hublySrc, /Where should leads go from here\?/);
    assert.match(hublySrc, /route\.action==='convert_to_jobs'/);
  });
});
