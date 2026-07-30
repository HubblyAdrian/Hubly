/**
 * Smoke test — Hubly Media (visual asset manager) + Connected Apps / Creative Engine.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Hubly Media module', () => {
  it('ships ProjectWorkspace (Connected Apps project links) migration', () => {
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

  it('ships Hubly Core hubly_app_connections migration', () => {
    const mig = join(root, 'supabase/migrations/20260728070000_hubly_connected_apps_core.sql');
    assert.equal(existsSync(mig), true);
    const sql = readFileSync(mig, 'utf8');
    assert.match(sql, /hubly_app_connections/);
    assert.match(sql, /business_id/);
    assert.match(sql, /provider text not null/);
    assert.match(sql, /canva/);
    assert.match(sql, /meta/);
    assert.match(sql, /google_business/);
    assert.match(sql, /Connected Apps/i);
  });

  it('defines ConnectedAppProvider + Creative Engine + CanvaProvider', () => {
    const core = readFileSync(join(root, 'supabase/functions/_shared/hubly_connected_apps.ts'), 'utf8');
    const creative = readFileSync(join(root, 'supabase/functions/_shared/hubly_creative_engine.ts'), 'utf8');
    const canva = readFileSync(join(root, 'supabase/functions/_shared/hubly_provider_canva.ts'), 'utf8');
    const adobe = readFileSync(join(root, 'supabase/functions/_shared/hubly_provider_lightroom.ts'), 'utf8');
    const types = readFileSync(join(root, 'supabase/functions/_shared/hubly_project_workspace.ts'), 'utf8');

    assert.match(core, /interface ConnectedAppProvider/);
    assert.match(core, /registerConnectedApp/);
    assert.match(core, /capabilities\(\)/);
    assert.match(creative, /createMarketingAsset/);
    assert.match(creative, /HublyCreativeEngine/);
    assert.match(canva, /class CanvaProvider implements ConnectedAppProvider/);
    assert.match(canva, /createDesign/);
    assert.match(adobe, /implements LightroomProvider, ExternalWorkspaceProvider, ConnectedAppProvider/);
    assert.match(types, /export type ProjectWorkspace/);
    assert.match(types, /Connected Apps/);
  });

  it('product UI keeps Connected Apps language for Apps page, not project tabs', () => {
    const js = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    const clientApps = readFileSync(join(root, 'public/journey-os/connected-apps.js'), 'utf8');
    const canvaClient = readFileSync(join(root, 'public/journey-os/canva-connected-app.js'), 'utf8');
    assert.match(js, /from\('photography_projects'\)/);
    assert.match(js, /from\('photography_project_workspaces'\)/);
    assert.match(js, /upsertExternalWorkspace/);
    assert.match(js, /hubly_pp_ui_prefs_/);
    assert.doesNotMatch(js, /twin_key|twin_status|twinKey\(/);
    assert.doesNotMatch(js, /digital twin/i);
    assert.doesNotMatch(js, /External Workspace/);
    assert.match(js, /renderCreativeTab/);
    assert.match(js, /creative-create/);
    assert.match(js, /canva-connect/);
    assert.match(js, /\['creative', 'Creative'\]/);
    assert.match(js, /renderMediaTab/);
    assert.match(js, /pp-dropzone/);
    assert.match(clientApps, /HublyConnectedApps/);
    assert.match(clientApps, /createMarketingAsset/);
    assert.match(clientApps, /relevantApps/);
    assert.match(canvaClient, /CanvaConnectedApp/);
  });

  it('loads Connected Apps + Canva scripts from hubly.html', () => {
    const html = readFileSync(join(root, 'public/hubly.html'), 'utf8');
    assert.match(html, /connected-apps\.js/);
    assert.match(html, /canva-connected-app\.js/);
    assert.match(html, /photography-projects\.js/);
  });

  it('Media is a core module; Lightroom is feature-gated', () => {
    const html = readFileSync(join(root, 'public/hubly.html'), 'utf8');
    const js = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    assert.match(html, /function hasBusinessCapability/);
    assert.match(html, /if\(key==='projects'\)return true/);
    assert.match(html, /ni-lbl">Media</);
    assert.match(js, /hasProjectsCapability\(\) \{\s*return true;/);
    assert.match(js, /hasLightroomCapability/);
    assert.match(js, /projectWorkspaceProfile/);
    assert.match(js, /global\.HublyProjects/);
    assert.doesNotMatch(js, /Photography Projects/);
    assert.doesNotMatch(js, /Photography Agreement/);
  });

  it('uses media-first center-of-work tabs (no Connected Apps tab)', () => {
    const js = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    assert.match(js, /\['overview', 'Overview'\]/);
    assert.match(js, /\['media', 'Media'\]/);
    assert.match(js, /\['client', 'Client'\]/);
    assert.match(js, /\['creative', 'Creative'\]/);
    assert.match(js, /\['lightroom', 'Lightroom'\]/);
    assert.match(js, /\['deliverables', 'Deliverables'\]/);
    assert.match(js, /\['timeline', 'Timeline'\]/);
    assert.match(js, /\['activity', 'Activity'\]/);
    assert.match(js, /\['assistant', 'AI Assistant'\]/);
    assert.doesNotMatch(js, /\['apps', 'Connected Apps'\]/);
    assert.doesNotMatch(js, /\['files', 'Files'\]/);
    assert.match(js, /renderMediaTab/);
    assert.match(js, /renderLightroomTab/);
    assert.match(js, /renderAiAssistantTab/);
    assert.match(js, /st\.tab = 'media'/);
    assert.match(js, /Math\.min\(3,/);
  });

  it('exposes Hubly Lightroom Actions in Media (not Adobe jargon)', () => {
    const js = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    const svc = readFileSync(join(root, 'public/journey-os/adobe-lightroom-service.js'), 'utf8');
    const edge = readFileSync(join(root, 'supabase/functions/adobe-lightroom/index.ts'), 'utf8');
    assert.match(js, /Export Final Photos|lr-export/);
    assert.match(js, /Browse Photos|lr-browse-photos/);
    assert.match(js, /Open Lightroom Project/);
    assert.match(js, /Connect Adobe \(optional\)|Connect Adobe Account|Connect Adobe/);
    assert.match(svc, /connectAccount/);
    assert.match(svc, /browsePhotos/);
    assert.match(svc, /exportFinalPhotos/);
    assert.match(svc, /openLightroomProject/);
    assert.match(edge, /browsePhotos/);
    assert.match(edge, /exportFinalPhotos/);
    assert.match(edge, /unlinkAlbum/);
    assert.match(edge, /linkAlbum/);
  });

  it('ships dashboard metrics, Media upload, Creative tab, and Quick add', () => {
    const js = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    const journey = readFileSync(join(root, 'public/journey-os/journey.js'), 'utf8');
    const apps = readFileSync(join(root, 'public/journey-os/app-marketplace.js'), 'utf8');
    assert.match(js, /Awaiting Delivery/);
    assert.match(js, /Drag &amp; drop here/);
    assert.match(js, /Create Marketing/);
    assert.match(js, /Quick add/);
    assert.match(js, /Create job|Create Project/);
    assert.match(journey, /photo-quick/);
    assert.match(js, /var profile = projectWorkspaceProfile\(\)/);
    assert.match(js, /profile\.teamFilterLabel/);
    assert.match(js, /title: 'Media'/);
    assert.match(apps, /Connect the tools you already use/);
    assert.match(apps, /What happens after you connect/);
    assert.match(apps, /Business apps/);
    assert.match(apps, /Creative & media apps|Creative & project apps/);
  });

  it('enables projects + lightroom on photography blueprint', () => {
    const bp = JSON.parse(readFileSync(join(root, 'public/business-blueprints/photography.json'), 'utf8'));
    assert.equal(bp.capabilities.projects, true);
    assert.equal(bp.capabilities.lightroom, true);
  });
});
