/**
 * Hubly-first Media + Studio — integrations never block core work.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Hubly-first Media + Studio architecture', () => {
  it('renames Operate Projects nav to Media without changing route ids', () => {
    const hubly = read('public/hubly.html');
    const projects = read('public/journey-os/photography-projects.js');
    const journey = read('public/journey-os/journey.js');
    assert.match(hubly, /data-v="photo-projects"/);
    assert.match(hubly, /ni-lbl">Media</);
    assert.match(hubly, /title="Media"/);
    assert.match(hubly, /'photo-projects':'Media'/);
    assert.match(projects, /lbl\.textContent = 'Media'/);
    assert.match(projects, /titleEl\.textContent = 'Media'/);
    assert.match(projects, /HublyMedia/);
    assert.match(journey, /title: 'Media'/);
    assert.match(journey, /label: 'Media AI'/);
  });

  it('treats Lightroom as optional enhancement on Media', () => {
    const projects = read('public/journey-os/photography-projects.js');
    assert.match(projects, /Connect Adobe \(optional\)|Continue in Hubly Media/);
    assert.match(projects, /optional tools that extend Hubly Media/i);
    assert.match(projects, /no Adobe required/i);
    assert.match(projects, /Lightroom sync is optional/i);
    // Primary card CTA is Open (brand), not Sync Lightroom
    assert.match(projects, /pp-btn-brand" data-pp-act="open"/);
  });

  it('Studio never dead-ends when Canva is missing', () => {
    const studio = read('public/journey-os/hubly-studio.js');
    const api = read('public/journey-os/studio/api.js');
    assert.match(studio, /continue-edit/);
    assert.match(studio, /Continue Editing/);
    assert.match(studio, /Edit in Canva/);
    assert.match(studio, /Keep editing in Hubly/);
    assert.doesNotMatch(studio, /Visual editor not connected yet/);
    assert.match(api, /Canva is optional/);
  });

  it('cache-busts Media + Studio assets', () => {
    const hubly = read('public/hubly.html');
    assert.match(hubly, /hubly-studio\.js\?v=studio-13/);
    assert.match(hubly, /photography-projects\.js\?v=projects-14/);
    assert.match(hubly, /app-marketplace\.js\?v=projects-14/);
  });
});
