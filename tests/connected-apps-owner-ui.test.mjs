/**
 * Connected Apps owner UI + universal Projects module.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Connected Apps owner UI', () => {
  it('Apps page is owner-facing Connected Apps, not Intent Engine hero', () => {
    const js = read('public/journey-os/app-marketplace.js');
    assert.match(js, /Connected Apps/);
    assert.match(js, /Available integrations/);
    assert.match(js, /Last sync/);
    assert.match(js, /data-am-act="settings"/);
    assert.match(js, /data-am-act="connect"/);
    assert.match(js, /data-am-act="disconnect"/);
    assert.match(js, /Developer · Intent pipeline/);
    assert.doesNotMatch(js, /Ask Hubly → Intent → Capabilities → Execution Plan/);
  });

  it('Projects nav is always available; Lightroom is feature-gated', () => {
    const html = read('public/hubly.html');
    const js = read('public/journey-os/photography-projects.js');
    assert.match(html, /function hasBusinessCapability/);
    assert.match(html, /if\(key==='projects'\)return true/);
    assert.match(html, /data-v="photo-projects"/);
    assert.match(html, /ni-lbl">Projects</);
    assert.match(js, /function hasProjectsCapability\(\) \{\s*return true;/);
    assert.match(js, /hasLightroomCapability/);
    assert.match(js, /projectWorkspaceProfile/);
  });
});
