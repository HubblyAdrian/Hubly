/**
 * Smoke test — AdobeLightroomService surface + photography projects module presence.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Photography Projects module', () => {
  it('ships migration for independent project tables', () => {
    const mig = join(root, 'supabase/migrations/20260728040000_photography_projects.sql');
    assert.equal(existsSync(mig), true);
    const sql = readFileSync(mig, 'utf8');
    for (const table of [
      'photography_projects',
      'photography_project_timeline',
      'photography_project_deliverables',
      'photography_project_galleries',
      'photography_project_contracts',
      'photography_project_invoices',
      'photography_project_questionnaires',
      'photography_project_team',
      'photography_project_lightroom',
      'photography_project_marketing',
      'photography_project_activity',
    ]) {
      assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    }
    assert.match(sql, /Lightroom is optional/i);
  });

  it('defines AdobeLightroomService methods without implementing Adobe APIs', () => {
    const path = join(root, 'supabase/functions/_shared/hubly_provider_lightroom.ts');
    const src = readFileSync(path, 'utf8');
    assert.match(src, /export class AdobeLightroomService/);
    for (const method of [
      'connect',
      'disconnect',
      'refreshToken',
      'createAlbum',
      'renameAlbum',
      'listAlbums',
      'syncProject',
      'uploadPhotos',
      'downloadEditedPhotos',
      'listAssets',
      'getFavorites',
      'publishGallery',
      'archiveProject',
    ]) {
      assert.match(src, new RegExp(`${method}\\(`));
    }
    assert.match(src, /PROVIDER_NOT_CONFIGURED|providerNotConfigured/);
    assert.match(src, /adobeRequired: false/);
    assert.doesNotMatch(src, /api\.adobe\.com/);
  });

  it('exposes client AdobeLightroomService facade for UI', () => {
    const src = readFileSync(join(root, 'public/journey-os/adobe-lightroom-service.js'), 'utf8');
    assert.match(src, /AdobeLightroomService/);
    assert.match(src, /connect:/);
    assert.match(src, /syncProject:/);
    assert.match(src, /adobeRequired: false/);
  });

  it('wires photography nav and view shells', () => {
    const html = readFileSync(join(root, 'public/hubly.html'), 'utf8');
    assert.match(html, /data-v="photo-projects"/);
    assert.match(html, /id="v-photo-projects"/);
    assert.match(html, /jos-photo-projects-root/);
    assert.match(html, /photography-projects\.js/);
    assert.match(html, /adobe-lightroom-service\.js/);
    assert.match(html, /syncPhotographyProjectsNav/);
  });

  it('builds dashboard, wizard, and command-center UI without requiring Adobe', () => {
    const src = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    assert.match(src, /Photography Projects/);
    assert.match(src, /New Project/);
    assert.match(src, /Connect Adobe/);
    assert.match(src, /Continue without Adobe/);
    assert.match(src, /Hubly works with Adobe Lightroom/);
    for (const status of ['Lead', 'Booked', 'Scheduled', 'Shooting', 'Editing', 'Proofing', 'Delivered', 'Archived']) {
      assert.match(src, new RegExp(`'${status}'`));
    }
    for (const tab of [
      'overview', 'timeline', 'lightroom', 'gallery', 'contracts',
      'invoices', 'questionnaire', 'deliverables', 'marketing', 'notes', 'activity',
    ]) {
      assert.match(src, new RegExp(`\\['${tab}'`));
    }
  });
});
