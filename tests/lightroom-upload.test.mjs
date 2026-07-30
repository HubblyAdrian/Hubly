import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Hubly → Lightroom upload pipeline', () => {
  it('ships official Create Asset / Master / album-link client methods', () => {
    const client = read('supabase/functions/_shared/adobe_lightroom_client.ts');
    const http = read('supabase/functions/_shared/adobe_http_client.ts');
    assert.match(client, /async createAsset\(/);
    assert.match(client, /async uploadMaster\(/);
    assert.match(client, /async addAssetToAlbum\(/);
    assert.match(client, /async addAssetsToAlbum\(/);
    assert.match(client, /async getAccount\(/);
    assert.match(client, /If-None-Match/);
    assert.match(client, /sha256/);
    assert.match(client, /Content-Range/);
    assert.match(client, /LR_MASTER_CONTENT_TYPES/);
    assert.match(http, /putBinary/);
    assert.match(http, /adobeRequestWithRetry/);
  });

  it('implements uploadPhotos instead of NOT_IMPLEMENTED stub', () => {
    const provider = read('supabase/functions/_shared/hubly_provider_lightroom.ts');
    const edge = read('supabase/functions/adobe-lightroom/index.ts');
    assert.match(provider, /async uploadPhotos\(/);
    assert.match(provider, /createAsset\(/);
    assert.match(provider, /uploadMaster\(/);
    assert.match(provider, /addAssetToAlbum\(/);
    assert.match(provider, /ADOBE_NOT_ENTITLED|entitlementStatus/);
    assert.match(provider, /already_uploaded/);
    assert.match(provider, /skipped_duplicate/);
    assert.match(provider, /lightroom_asset_id/);
    assert.doesNotMatch(
      provider,
      /Photo upload to Lightroom is deferred/,
    );
    assert.match(edge, /action === "uploadPhotos"/);
    assert.match(edge, /applyMediaPatches/);
    assert.match(edge, /loadProjectMedia/);
    assert.doesNotMatch(edge, /return jsonRes\(res, 400\);\s*\}\s*\n\s*return jsonRes\(\{\s*error: `Unknown action/);
  });

  it('matches sync media by Lightroom asset ID', () => {
    const provider = read('supabase/functions/_shared/hubly_provider_lightroom.ts');
    assert.match(provider, /byLrId/);
    assert.match(provider, /lightroom_asset_id/);
    assert.match(provider, /mediaPatches/);
    assert.match(provider, /Match Hubly media by stored Lightroom asset ID/);
  });

  it('requests partner scopes sufficient for upload', () => {
    const oauth = read('supabase/functions/_shared/adobe_oauth.ts');
    assert.match(oauth, /lr_partner_apis/);
    assert.match(oauth, /lr_partner_rendition_apis/);
    const doc = read('docs/architecture/ADOBE_LIGHTROOM_API_COMPATIBILITY.md');
    assert.match(doc, /Hubly → Lightroom/);
    assert.match(doc, /lr_partner_apis/);
  });

  it('exposes Upload to Lightroom UI with progress and auto-upload', () => {
    const projects = read('public/journey-os/photography-projects.js');
    const adobe = read('public/journey-os/adobe-lightroom-service.js');
    const hubly = read('public/hubly.html');
    const css = read('public/journey-os/photography-projects.css');
    assert.match(projects, /uploadProjectMediaToLightroom/);
    assert.match(projects, /Automatically upload new photos to Lightroom/);
    assert.match(projects, /auto_upload_to_lightroom/);
    assert.match(projects, /lrUploadProgress/);
    assert.match(projects, /applyLightroomMediaPatches/);
    assert.doesNotMatch(projects, /Upload to Lightroom \(soon\)/);
    assert.doesNotMatch(adobe, /Hubly→Lightroom upload is deferred/);
    assert.match(adobe, /ADOBE_UPLOAD_FAILED/);
    assert.match(css, /\.pp-lr-badge/);
    assert.match(hubly, /photography-projects\.js\?v=projects-16/);
    assert.match(hubly, /adobe-lightroom-service\.js\?v=projects-16/);
  });
});
