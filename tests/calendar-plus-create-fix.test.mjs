import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const journey = fs.readFileSync('public/journey-os/journey.js', 'utf8');

test('calendar create pop is a single body-level dialog', () => {
  assert.match(journey, /function ensureGcalCreatePop/);
  assert.match(journey, /document\.body\.appendChild\(pop\)/);
  assert.match(journey, /Create pop lives on document\.body/);
  assert.doesNotMatch(
    journey,
    /var gcalCreatePop =\s*'<div class="jos-gcal-create-pop" id="jos-gcal-create-pop"/
  );
});

test('slot plus opens create pop from wireJobsRoot', () => {
  assert.match(journey, /closest\('\.jos-gcal-slot-add/);
  assert.match(journey, /openGcalCreatePop\(root,/);
  assert.match(journey, /data-jos-act="jobs-gcal-new"/);
  assert.match(journey, /_josGcalPopIgnoreClick/);
});
