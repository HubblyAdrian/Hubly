/**
 * Smoke test — Photography Projects Supabase SSOT + capabilities + Quick Project.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Photography Projects module', () => {
  it('ships migrations for projects + Supabase SSOT twin fields', () => {
    const mig1 = join(root, 'supabase/migrations/20260728040000_photography_projects.sql');
    const mig2 = join(root, 'supabase/migrations/20260728050000_photography_projects_supabase_ssot.sql');
    assert.equal(existsSync(mig1), true);
    assert.equal(existsSync(mig2), true);
    const sql = readFileSync(mig1, 'utf8') + readFileSync(mig2, 'utf8');
    for (const table of [
      'photography_projects',
      'photography_project_timeline',
      'photography_project_lightroom',
      'photography_project_activity',
    ]) {
      assert.match(sql, new RegExp(table));
    }
    assert.match(sql, /workspace jsonb/);
    assert.match(sql, /twin_key/);
    assert.match(sql, /'projects',\s*true/);
    assert.match(sql, /'lightroom',\s*true/);
  });

  it('defines AdobeLightroomService methods without implementing Adobe APIs', () => {
    const path = join(root, 'supabase/functions/_shared/hubly_provider_lightroom.ts');
    const src = readFileSync(path, 'utf8');
    assert.match(src, /export class AdobeLightroomService/);
    for (const method of [
      'connect', 'disconnect', 'refreshToken', 'createAlbum', 'renameAlbum',
      'listAlbums', 'syncProject', 'uploadPhotos', 'downloadEditedPhotos',
      'listAssets', 'getFavorites', 'publishGallery', 'archiveProject',
    ]) {
      assert.match(src, new RegExp(`${method}\\(`));
    }
    assert.match(src, /PROVIDER_NOT_CONFIGURED|providerNotConfigured/);
    assert.doesNotMatch(src, /api\.adobe\.com/);
  });

  it('gates Photography nav on capabilities.projects not trade heuristics', () => {
    const html = readFileSync(join(root, 'public/hubly.html'), 'utf8');
    const js = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    assert.match(html, /function hasBusinessCapability/);
    assert.match(html, /hasBusinessCapability\('projects'\)/);
    assert.match(js, /hasCapability\('projects'\)|hasProjectsCapability/);
    assert.match(js, /businesses\.capabilities\.projects|capabilities\.projects/);
    assert.doesNotMatch(js, /isPhotoLedTrade\(\)/);
  });

  it('persists projects in Supabase and only caches UI prefs locally', () => {
    const js = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    assert.match(js, /from\('photography_projects'\)/);
    assert.match(js, /\.insert\(/);
    assert.match(js, /\.update\(/);
    assert.match(js, /hubly_pp_ui_prefs_/);
    assert.match(js, /localStorage may ONLY cache UI preferences|UI prefs only/i);
    assert.doesNotMatch(js, /hubly_photography_projects_/);
    assert.match(js, /photography_project_lightroom/);
    assert.match(js, /twin_key/);
  });

  it('ships dashboard metrics, Lightroom workspace hero, and Quick Project', () => {
    const js = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    const journey = readFileSync(join(root, 'public/journey-os/journey.js'), 'utf8');
    assert.match(js, /Awaiting Delivery/);
    assert.match(js, /pp-metrics/);
    assert.match(js, /Lightroom Workspace/);
    assert.match(js, /What happens after connecting/);
    assert.match(js, /Quick Project/);
    assert.match(js, /openQuickProject/);
    assert.match(journey, /photo-quick/);
    assert.match(journey, /Photography Project/);
    assert.match(js, /Digital twin|digital twin/i);
    assert.match(js, /POST_EDIT_PIPELINE|Gallery Created/);
  });

  it('enables projects + lightroom on photography blueprint', () => {
    const bp = JSON.parse(readFileSync(join(root, 'public/business-blueprints/photography.json'), 'utf8'));
    assert.equal(bp.capabilities.projects, true);
    assert.equal(bp.capabilities.lightroom, true);
  });
});
