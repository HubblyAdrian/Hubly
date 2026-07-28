import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const journey = fs.readFileSync('public/journey-os/journey.js', 'utf8');
const css = fs.readFileSync('public/journey-os/operate-pixel.css', 'utf8');

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

test('Create menu offers Job, Task, and Block', () => {
  assert.match(journey, /function ensureGcalCreateMenu/);
  assert.match(journey, /data-jos-act="jobs-gcal-create-menu"/);
  assert.match(journey, /data-jos-gcal-type="job"/);
  assert.match(journey, /data-jos-gcal-type="task"/);
  assert.match(journey, /data-jos-gcal-type="block"/);
  assert.match(css, /\.jos-gcal-create-menu\{/);
});

test('create dialog supports repeat and people search', () => {
  assert.match(journey, /id="jos-gcal-create-repeat"/);
  assert.match(journey, /Does not repeat/);
  assert.match(journey, /Every weekday/);
  assert.match(journey, /id="jos-gcal-create-people"/);
  assert.match(journey, /function gcalPeopleCandidates/);
  assert.match(journey, /leadsOsList\(\)/);
  assert.match(journey, /jobs-gcal-people-pick/);
  assert.match(journey, /function saveGcalCreate/);
  assert.match(journey, /function gcalRepeatDates/);
  assert.match(css, /\.jos-gcal-create-types/);
  assert.match(css, /\.jos-gcal-people-hit/);
});
