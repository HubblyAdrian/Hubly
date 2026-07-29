import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const projects = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
const adobe = readFileSync(join(root, 'public/journey-os/adobe-lightroom-service.js'), 'utf8');
const deployAll = readFileSync(join(root, 'scripts/deploy-adobe-oauth-edges.sh'), 'utf8');
const deployLr = readFileSync(join(root, 'scripts/deploy-adobe-lightroom-edge.sh'), 'utf8');
const css = readFileSync(join(root, 'public/journey-os/photography-projects.css'), 'utf8');
const hubly = readFileSync(join(root, 'public/hubly.html'), 'utf8');

describe('Projects Lightroom + NEF fixes', () => {
  it('deploys adobe-lightroom with OAuth edges', () => {
    assert.match(deployAll, /adobe-lightroom/);
    assert.match(deployAll, /adobe-oauth-start/);
    assert.match(deployLr, /adobe-lightroom/);
    assert.match(deployLr, /functions deploy/);
  });

  it('maps undeployed adobe-lightroom to an actionable error', () => {
    assert.match(adobe, /EDGE_NOT_DEPLOYED/);
    assert.match(adobe, /deploy-adobe-lightroom-edge\.sh/);
    assert.match(adobe, /does not upload photos to Adobe Lightroom/);
  });

  it('extracts embedded JPEG previews for NEF/RAW uploads', () => {
    assert.match(projects, /extractEmbeddedJpegFromBuffer/);
    assert.match(projects, /buildMediaPreview/);
    assert.match(projects, /isRawPhotoName/);
    assert.match(projects, /raw_embedded/);
    assert.match(projects, /RAW · no preview/);
    assert.match(projects, /_preview\.jpg/);
    assert.match(css, /\.pp-raw-badge/);
  });

  it('clarifies Publish is Hubly-only and Sync is Adobe→Hubly', () => {
    assert.match(projects, /Publish Hubly gallery/);
    assert.match(projects, /Upload to Lightroom/);
    assert.match(projects, /Two-way media/);
    assert.match(projects, /Sync Now/);
    assert.match(projects, /Hubly gallery published — not uploaded to Adobe Lightroom/);
  });

  it('cache-busts Projects assets', () => {
    assert.match(hubly, /photography-projects\.js\?v=projects-12/);
    assert.match(hubly, /photography-projects\.css\?v=projects-12/);
  });
});
