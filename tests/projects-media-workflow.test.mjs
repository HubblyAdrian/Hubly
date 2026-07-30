import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const projects = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
const hubly = readFileSync(join(root, 'public/hubly.html'), 'utf8');
const css = readFileSync(join(root, 'public/journey-os/photography-projects.css'), 'utf8');

describe('Projects media previews + Adobe workflow copy', () => {
  it('uploads media previews under auth.uid() not businessId', () => {
    assert.match(projects, /function authOwnerId/);
    assert.match(projects, /ownerId \+ '\/projects\/'/);
    assert.match(projects, /Path must start with auth\.uid/);
    assert.ok(!projects.includes("var path = bid + '/' + p.id + '/'"));
  });

  it('scans RAW head and tail for embedded JPEG previews', () => {
    assert.match(projects, /file\.size - chunk/);
    assert.match(projects, /Middle pass for odd containers/);
    assert.match(projects, /isDurableMediaUrl/);
    assert.match(projects, /Never persist ephemeral blob/);
  });

  it('keeps Lightroom upload optional while Hubly owns media', () => {
    assert.match(projects, /Upload to Lightroom/);
    assert.match(projects, /Automatically upload new photos to Lightroom/);
    assert.match(projects, /uploadProjectMediaToLightroom/);
    assert.match(projects, /Hubly Media works without Adobe|no Adobe required/);
    assert.match(css, /\.pp-workflow-steps/);
  });

  it('cache-busts Projects assets at projects-16', () => {
    assert.match(hubly, /photography-projects\.js\?v=projects-16/);
    assert.match(hubly, /photography-projects\.css\?v=projects-16/);
    assert.match(hubly, /adobe-lightroom-service\.js\?v=projects-16/);
  });
});
