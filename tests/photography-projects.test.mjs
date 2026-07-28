/**
 * Smoke test — Photography Projects External Workspaces + Supabase SSOT.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Photography Projects module', () => {
  it('ships ProjectWorkspace (external workspaces) migration', () => {
    const mig = join(root, 'supabase/migrations/20260728060000_photography_project_workspaces.sql');
    assert.equal(existsSync(mig), true);
    const sql = readFileSync(mig, 'utf8');
    assert.match(sql, /photography_project_workspaces/);
    assert.match(sql, /provider text not null/);
    assert.match(sql, /external_id/);
    assert.match(sql, /sync_state/);
    assert.match(sql, /last_sync_at/);
    assert.match(sql, /adobe_lightroom/);
    assert.match(sql, /dropbox/);
    assert.match(sql, /google_drive/);
    assert.match(sql, /capture_one/);
    assert.match(sql, /A project may link one or more/i);
  });

  it('defines shared ProjectWorkspace types and Adobe as ExternalWorkspaceProvider', () => {
    const types = readFileSync(join(root, 'supabase/functions/_shared/hubly_project_workspace.ts'), 'utf8');
    const adobe = readFileSync(join(root, 'supabase/functions/_shared/hubly_provider_lightroom.ts'), 'utf8');
    assert.match(types, /export type ProjectWorkspace/);
    assert.match(types, /ExternalWorkspaceProvider/);
    assert.match(adobe, /implements LightroomProvider, ExternalWorkspaceProvider/);
    assert.match(adobe, /connectWorkspace/);
    assert.match(adobe, /syncWorkspace/);
    assert.match(adobe, /disconnectWorkspace/);
  });

  it('persists projects in Supabase and links External Workspaces', () => {
    const js = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    assert.match(js, /from\('photography_projects'\)/);
    assert.match(js, /from\('photography_project_workspaces'\)/);
    assert.match(js, /upsertExternalWorkspace/);
    assert.match(js, /hubly_pp_ui_prefs_/);
    assert.doesNotMatch(js, /twin_key|twin_status|twinKey\(/);
    assert.doesNotMatch(js, /digital twin/i);
    assert.match(js, /External Workspace/);
    assert.match(js, /Linked workspaces/);
  });

  it('gates Photography nav on capabilities.projects', () => {
    const html = readFileSync(join(root, 'public/hubly.html'), 'utf8');
    const js = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    assert.match(html, /function hasBusinessCapability/);
    assert.match(html, /hasBusinessCapability\('projects'\)/);
    assert.match(js, /hasCapability\('projects'\)|hasProjectsCapability/);
  });

  it('ships dashboard metrics, Lightroom workspace hero, and Quick Project', () => {
    const js = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    const journey = readFileSync(join(root, 'public/journey-os/journey.js'), 'utf8');
    assert.match(js, /Awaiting Delivery/);
    assert.match(js, /Lightroom Workspace/);
    assert.match(js, /What happens after connecting/);
    assert.match(js, /Quick Project/);
    assert.match(journey, /photo-quick/);
  });

  it('enables projects + lightroom on photography blueprint', () => {
    const bp = JSON.parse(readFileSync(join(root, 'public/business-blueprints/photography.json'), 'utf8'));
    assert.equal(bp.capabilities.projects, true);
    assert.equal(bp.capabilities.lightroom, true);
  });
});
