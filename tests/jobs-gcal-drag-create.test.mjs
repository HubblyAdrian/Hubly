import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const journey = fs.readFileSync('public/journey-os/journey.js', 'utf8');
const css = fs.readFileSync('public/journey-os/operate-pixel.css', 'utf8');

test('Jobs calendar supports drag-to-create range helpers', () => {
  assert.match(journey, /function openGcalCreatePop/);
  assert.match(journey, /function createJobAtRange/);
  assert.match(journey, /function snapJobMinutes/);
  assert.match(journey, /data-jos-gcal-start/);
  assert.match(journey, /jobs-gcal-create-job/);
  assert.match(journey, /jobs-gcal-create-block/);
  assert.match(journey, /jobs-gcal-new/);
});

test('Jobs calendar paints a draft range and resize handle', () => {
  assert.match(css, /\.jos-gcal-draft\b/);
  assert.match(css, /\.jos-gcal-resize\b/);
  assert.match(css, /\.jos-gcal-create-pop\b/);
  assert.match(journey, /data-jos-gcal-resize/);
  assert.match(journey, /Drag empty time/);
});
