import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const projects = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
const adobe = readFileSync(join(root, 'public/journey-os/adobe-lightroom-service.js'), 'utf8');
const hubly = readFileSync(join(root, 'public/hubly.html'), 'utf8');

describe('Lightroom tab opens without waiting on Adobe', () => {
  it('switches to Lightroom immediately then refreshes status in background', () => {
    assert.match(projects, /refreshLightroomStatusInBackground/);
    assert.match(projects, /Never block the tab on Adobe catalog verify/);
    assert.match(projects, /switchCommandTab\('lightroom'\);\s*\n\s*refreshLightroomStatusInBackground/);
    assert.doesNotMatch(
      projects,
      /nextTab === 'lightroom'\) \{\s*ensureAdobeStatus\(st\)\.then\(function \(\) \{ switchCommandTab\('lightroom'\)/,
    );
  });

  it('supports quick DB-only Adobe status for tab open', () => {
    assert.match(adobe, /opts && opts\.quick/);
    assert.match(adobe, /adobe-oauth-disconnect/);
    assert.match(adobe, /Avoids Adobe catalog/);
    assert.match(adobe, /Quick path for tab open/);
    assert.match(projects, /quick: !!opts\.quick/);
    assert.match(projects, /quick: true/);
  });

  it('cache-busts Projects and Adobe Lightroom scripts', () => {
    assert.match(hubly, /photography-projects\.js\?v=projects-10/);
    assert.match(hubly, /adobe-lightroom-service\.js\?v=projects-10/);
  });
});
