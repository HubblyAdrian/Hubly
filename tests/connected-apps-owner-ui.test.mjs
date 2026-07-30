/**
 * Connected Apps owner UI + universal Media module.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Connected Apps owner UI', () => {
  it('Apps page is owner-facing Connected Apps with business + creative split', () => {
    const js = read('public/journey-os/app-marketplace.js');
    assert.match(js, /Connected Apps/);
    assert.match(js, /Connect the tools you already use/);
    assert.match(js, /Business apps/);
    assert.match(js, /Creative & media apps|Creative & project apps/);
    assert.match(js, /What happens after you connect/);
    assert.match(js, /Last sync/);
    assert.match(js, /data-am-act="connect"/);
    assert.match(js, /data-am-act="disconnect"/);
    assert.match(js, /Developer · Intent pipeline/);
    assert.match(js, /relevantApps/);
    assert.doesNotMatch(js, /Ask Hubly → Intent → Capabilities → Execution Plan/);
  });

  it('catalog scopes business vs project apps', () => {
    const catalog = JSON.parse(read('hubly-core/connected-apps-catalog.json'));
    const byId = Object.fromEntries(catalog.apps.map((a) => [a.id, a]));
    assert.equal(byId.google.scope, 'business');
    assert.equal(byId.stripe.scope, 'business');
    assert.equal(byId.twilio.scope, 'business');
    assert.equal(byId.meta.scope, 'business');
    assert.equal(byId.google_business.scope, 'business');
    assert.equal(byId.adobe_lightroom.scope, 'project');
    assert.equal(byId.canva.scope, 'project');
    assert.equal(byId.frame_io.scope, 'project');
    assert.equal(byId.dropbox.scope, 'project');
    assert.equal(byId.google_drive.scope, 'project');
  });

  it('Media nav is always available; Lightroom is feature-gated', () => {
    const html = read('public/hubly.html');
    const js = read('public/journey-os/photography-projects.js');
    assert.match(html, /function hasBusinessCapability/);
    assert.match(html, /if\(key==='projects'\)return true/);
    assert.match(html, /data-v="photo-projects"/);
    assert.match(html, /ni-lbl">Media</);
    assert.match(js, /function hasProjectsCapability\(\) \{\s*return true;/);
    assert.match(js, /hasLightroomCapability/);
    assert.match(js, /projectWorkspaceProfile/);
  });
});
