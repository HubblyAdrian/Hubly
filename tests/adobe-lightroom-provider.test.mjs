/**
 * Adobe Lightroom Provider — architecture + API compatibility + live probes.
 *
 * Live calls:
 * - Always: GET https://lr.adobe.io/v2/health (no auth, real Adobe)
 * - When ADOBE_CLIENT_ID + ADOBE_CLIENT_SECRET + ADOBE_TEST_REFRESH_TOKEN:
 *   real token refresh + GET /v2/catalog (+ optional album create when ADOBE_INTEGRATION_WRITE=1)
 *
 * Never mocks successful Adobe responses.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const WHILE_ONE = /^while\s*\(\s*1\s*\)\s*\{\s*\}\s*/;

function stripAdobeWhileOne(text) {
  return String(text || '').replace(WHILE_ONE, '');
}

describe('Adobe Lightroom Provider architecture', () => {
  it('ships compatibility table mapped to official endpoints', () => {
    const doc = join(root, 'docs/architecture/ADOBE_LIGHTROOM_API_COMPATIBILITY.md');
    assert.equal(existsSync(doc), true);
    const md = read('docs/architecture/ADOBE_LIGHTROOM_API_COMPATIBILITY.md');
    assert.match(md, /listAlbums\(\)/);
    assert.match(md, /createAlbum\(\)/);
    assert.match(md, /renameAlbum\(\)/);
    assert.match(md, /listAssets\(\)/);
    assert.match(md, /getAsset\(\)/);
    assert.match(md, /downloadEditedAsset\(\)/);
    assert.match(md, /uploadPhotos\(\)/);
    assert.match(md, /GET \/v2\/catalogs\/\{catalog_id\}\/albums/);
    assert.match(md, /PUT \/v2\/catalogs\/\{catalog_id\}\/albums\/\{album_id\}/);
    assert.match(md, /POST \/v2\/catalogs\/\{catalog_id\}\/albums\/\{album_id\}/);
    assert.match(md, /UNSUPPORTED|Unsupported/i);
    assert.match(md, /AdobeOAuthService/);
    assert.match(md, /AdobeHttpClient/);
    assert.match(md, /AdobeLightroomClient/);
  });

  it('splits OAuth → HttpClient → LightroomClient → Provider', () => {
    assert.equal(existsSync(join(root, 'supabase/functions/_shared/adobe_oauth.ts')), true);
    assert.equal(existsSync(join(root, 'supabase/functions/_shared/adobe_http_client.ts')), true);
    assert.equal(existsSync(join(root, 'supabase/functions/_shared/adobe_lightroom_client.ts')), true);
    assert.equal(existsSync(join(root, 'supabase/functions/_shared/hubly_provider_lightroom.ts')), true);
    assert.equal(existsSync(join(root, 'supabase/functions/adobe-lightroom/index.ts')), true);

    const oauth = read('supabase/functions/_shared/adobe_oauth.ts');
    const http = read('supabase/functions/_shared/adobe_http_client.ts');
    const client = read('supabase/functions/_shared/adobe_lightroom_client.ts');
    const provider = read('supabase/functions/_shared/hubly_provider_lightroom.ts');
    const edge = read('supabase/functions/adobe-lightroom/index.ts');

    assert.match(oauth, /class AdobeOAuthService/);
    assert.match(oauth, /getValidAccessToken/);
    assert.match(http, /class AdobeHttpClient/);
    assert.match(http, /X-API-Key/);
    assert.match(http, /stripAdobeWhileOne|WHILE_ONE/);
    assert.match(http, /lr\.adobe\.io\/v2/);
    assert.match(client, /class AdobeLightroomClient/);
    assert.match(client, /\/catalog/);
    assert.match(client, /createProjectAlbum/);
    assert.match(client, /listAlbumAssets/);
    assert.match(client, /getRendition/);
    assert.match(provider, /createLightroomClient|AdobeLightroomClient/);
    assert.match(provider, /getAdobeOAuthService|AdobeOAuthService/);
    assert.match(provider, /UNSUPPORTED_OPERATION/);
    assert.match(provider, /NOT_IMPLEMENTED/);
    assert.match(provider, /hublySystemOfRecord|system of record/i);
    assert.match(edge, /action === "createAlbum"/);
    assert.match(edge, /action === "syncProject"/);
    assert.match(edge, /Never returns access/);
  });

  it('strips Adobe while(1){} JSON preface', () => {
    const raw = 'while(1){}{"id":"abc","payload":{"name":"Test"}}';
    const cleaned = stripAdobeWhileOne(raw);
    const parsed = JSON.parse(cleaned);
    assert.equal(parsed.id, 'abc');
    assert.equal(parsed.payload.name, 'Test');
  });

  it('provider methods no longer stub albums/assets as ADOBE_API_NOT_IMPLEMENTED', () => {
    const provider = read('supabase/functions/_shared/hubly_provider_lightroom.ts');
    assert.doesNotMatch(provider, /ADOBE_API_NOT_IMPLEMENTED/);
    assert.doesNotMatch(provider, /ADOBE_OAUTH_NOT_IMPLEMENTED/);
    assert.match(provider, /async listAlbums/);
    assert.match(provider, /async createAlbum/);
    assert.match(provider, /async renameAlbum/);
    assert.match(provider, /async listAssets/);
    assert.match(provider, /async getAsset/);
    assert.match(provider, /async downloadEditedAsset/);
    assert.match(provider, /async syncProject/);
    assert.match(provider, /existingAlbumId/);
  });

  it('project UI supports Create / Open / Sync album without fake pending ids', () => {
    const js = read('public/journey-os/photography-projects.js');
    assert.match(js, /lr-create-album/);
    assert.match(js, /lr-open/);
    assert.match(js, /Sync Album/);
    assert.match(js, /createAlbum/);
    assert.match(js, /openAlbum/);
    assert.doesNotMatch(js, /pending-\`\s*\+|pending-' \+|pending-" /);
    assert.doesNotMatch(js, /pending-' \+/);
    // Old fake album id pattern
    assert.doesNotMatch(js, /extId = 'pending-/);
  });

  it('ships provider migration for catalog_id + last_token_refresh_at', () => {
    const mig = read('supabase/migrations/20260728090000_adobe_lightroom_provider.sql');
    assert.match(mig, /catalog_id/);
    assert.match(mig, /last_token_refresh_at/);
  });
});

describe('Adobe Lightroom live API probes', () => {
  it('GET /v2/health reaches Adobe (real network, no mocked body)', async () => {
    const clientId = process.env.ADOBE_CLIENT_ID?.trim();
    const headers = { Accept: 'application/json' };
    if (clientId) headers['X-API-Key'] = clientId;

    const res = await fetch('https://lr.adobe.io/v2/health', { headers });
    const raw = await res.text();
    const cleaned = stripAdobeWhileOne(raw);

    // Real Adobe: 200 with key, or 403 "Api Key is required" without key.
    // Either proves we hit Adobe — never mock success.
    if (clientId) {
      assert.equal(res.ok, true, `Adobe health with API key failed: ${res.status} ${raw.slice(0, 200)}`);
    } else {
      assert.equal(res.status, 403, `Expected Adobe 403 without API key, got ${res.status}`);
      assert.match(cleaned, /Api Key is required/i);
    }
  });

  it('authenticated catalog probe when test refresh token is available', async (t) => {
    const clientId = process.env.ADOBE_CLIENT_ID?.trim();
    const clientSecret = process.env.ADOBE_CLIENT_SECRET?.trim();
    const refreshToken = process.env.ADOBE_TEST_REFRESH_TOKEN?.trim();
    if (!clientId || !clientSecret || !refreshToken) {
      t.skip('Set ADOBE_CLIENT_ID, ADOBE_CLIENT_SECRET, ADOBE_TEST_REFRESH_TOKEN for live OAuth/catalog tests');
      return;
    }

    const tokenRes = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    assert.equal(tokenRes.ok, true, `IMS refresh failed: ${JSON.stringify(tokenJson)}`);
    assert.ok(tokenJson.access_token, 'access_token required');

    const catRes = await fetch('https://lr.adobe.io/v2/catalog', {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        'X-API-Key': clientId,
        Accept: 'application/json',
      },
    });
    const catRaw = await catRes.text();
    const cat = JSON.parse(stripAdobeWhileOne(catRaw) || 'null');
    assert.equal(catRes.ok, true, `catalog failed: ${catRaw.slice(0, 300)}`);
    assert.ok(cat?.id, 'catalog id required');

    const albumsRes = await fetch(
      `https://lr.adobe.io/v2/catalogs/${encodeURIComponent(cat.id)}/albums?subtype=project`,
      {
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
          'X-API-Key': clientId,
          Accept: 'application/json',
        },
      },
    );
    const albumsRaw = await albumsRes.text();
    const albums = JSON.parse(stripAdobeWhileOne(albumsRaw) || 'null');
    assert.equal(albumsRes.ok, true, `list albums failed: ${albumsRaw.slice(0, 300)}`);
    assert.ok(Array.isArray(albums?.resources) || Array.isArray(albums), 'albums resources array');

    if (process.env.ADOBE_INTEGRATION_WRITE === '1') {
      const albumId = crypto.randomUUID().replace(/-/g, '');
      const now = new Date().toISOString();
      const putRes = await fetch(
        `https://lr.adobe.io/v2/catalogs/${encodeURIComponent(cat.id)}/albums/${albumId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${tokenJson.access_token}`,
            'X-API-Key': clientId,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            subtype: 'project',
            serviceId: clientId,
            payload: {
              name: `Hubly Integration ${now.slice(0, 19)}`,
              userCreated: now,
              userUpdated: now,
              publishInfo: { version: 3, created: now, updated: now, remoteId: 'hubly-integration-test' },
            },
          }),
        },
      );
      const putRaw = await putRes.text();
      assert.ok(putRes.ok || putRes.status === 201, `create album failed: ${putRes.status} ${putRaw.slice(0, 300)}`);

      const getRes = await fetch(
        `https://lr.adobe.io/v2/catalogs/${encodeURIComponent(cat.id)}/albums/${albumId}`,
        {
          headers: {
            Authorization: `Bearer ${tokenJson.access_token}`,
            'X-API-Key': clientId,
            Accept: 'application/json',
          },
        },
      );
      const getRaw = await getRes.text();
      const got = JSON.parse(stripAdobeWhileOne(getRaw) || 'null');
      assert.equal(getRes.ok, true, `get album failed: ${getRaw.slice(0, 300)}`);
      assert.equal(got?.id || albumId, albumId);

      const assetsRes = await fetch(
        `https://lr.adobe.io/v2/catalogs/${encodeURIComponent(cat.id)}/albums/${albumId}/assets`,
        {
          headers: {
            Authorization: `Bearer ${tokenJson.access_token}`,
            'X-API-Key': clientId,
            Accept: 'application/json',
          },
        },
      );
      const assetsRaw = await assetsRes.text();
      assert.equal(assetsRes.ok, true, `list album assets failed: ${assetsRaw.slice(0, 300)}`);
    } else {
      t.diagnostic('Set ADOBE_INTEGRATION_WRITE=1 to create a real project album in the beta account');
    }
  });
});
