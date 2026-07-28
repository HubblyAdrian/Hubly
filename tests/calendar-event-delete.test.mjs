import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const journey = readFileSync(join(root, 'public/journey-os/journey.js'), 'utf8');
const css = readFileSync(join(root, 'public/journey-os/operate-pixel.css'), 'utf8');

describe('calendar event delete', () => {
  it('renders a delete control on timed calendar events', () => {
    assert.match(journey, /jos-gcal-event-wrap/);
    assert.match(journey, /class="jos-gcal-del"/);
    assert.match(journey, /data-jos-act="jobs-delete"/);
    assert.match(css, /\.jos-gcal-del\{/);
  });

  it('deletes the job from state after confirm', () => {
    assert.match(journey, /act === 'jobs-delete'/);
    assert.match(journey, /from your calendar\?/);
    assert.match(journey, /S\(\)\.jobs = \(S\(\)\.jobs \|\| \[\]\)\.filter/);
    assert.match(journey, /Google events can/);
    assert.match(journey, /be deleted here/);
  });

  it('does not open the drawer when clicking delete', () => {
    assert.ok(journey.includes('[data-jos-act="jobs-delete"], .jos-gcal-del'));
    assert.ok(journey.includes('[data-jos-gcal-resize], [data-jos-act="jobs-delete"], .jos-gcal-del'));
  });
});
