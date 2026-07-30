/**
 * Media ↔ Studio continuous workflow — Hubly owns assets + campaigns.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Media ↔ Studio continuous workflow', () => {
  it('ships a shared Media-Studio bridge', () => {
    const bridge = read('public/journey-os/media-studio-bridge.js');
    const hubly = read('public/hubly.html');
    assert.match(bridge, /HublyMediaStudioBridge/);
    assert.match(bridge, /hubly_media_studio_bridge/);
    assert.match(bridge, /toStudioAsset/);
    assert.match(bridge, /switchToStudio/);
    assert.match(bridge, /switchToMedia/);
    assert.match(hubly, /media-studio-bridge\.js\?v=studio-14/);
  });

  it('Media supports multi-select and Use in Campaign / Create Marketing', () => {
    const projects = read('public/journey-os/photography-projects.js');
    const css = read('public/journey-os/photography-projects.css');
    assert.match(projects, /media-toggle/);
    assert.match(projects, /media-use-studio/);
    assert.match(projects, /media-create-marketing/);
    assert.match(projects, /Use in Campaign|Use in Studio/);
    assert.match(projects, /Create Marketing/);
    assert.match(projects, /openStudioWithSelected/);
    assert.match(projects, /AI Enhance/);
    assert.match(projects, /Before\/After Compare/);
    assert.match(projects, /Remove Background/);
    assert.match(projects, /photoUrls: photoUrls/);
    assert.match(css, /\.pp-media-tile\.is-selected/);
    assert.match(css, /\.pp-media-actionbar/);
  });

  it('Studio browses Media, replaces images, and uses Edit Campaign', () => {
    const studio = read('public/journey-os/hubly-studio.js');
    assert.match(studio, /Edit Campaign/);
    assert.match(studio, /Edit in Canva/);
    assert.match(studio, /browse-media/);
    assert.match(studio, /replace-image/);
    assert.match(studio, /Browse Media/);
    assert.match(studio, /Recent Jobs/);
    assert.match(studio, /AI Generate Campaign/);
    assert.match(studio, /consumeMediaBridge/);
    assert.match(studio, /openFromMedia/);
    assert.match(studio, /startBrowseMedia/);
    assert.doesNotMatch(studio, /Continue Editing/);
    assert.match(studio, /Media owns the photos|source of truth/i);
  });

  it('cache-busts bridged assets', () => {
    const hubly = read('public/hubly.html');
    assert.match(hubly, /hubly-studio\.js\?v=studio-14/);
    assert.match(hubly, /photography-projects\.js\?v=projects-15/);
  });
});
