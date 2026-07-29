import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const journey = readFileSync(join(root, 'public/journey-os/journey.js'), 'utf8');
const hubly = readFileSync(join(root, 'public/hubly.html'), 'utf8');
const api = readFileSync(join(root, 'api/router.js'), 'utf8');

describe('Home dashboard live weather', () => {
  it('does not hardcode 72°F Sunny on Home', () => {
    assert.doesNotMatch(journey, /var weatherTemp = 72/);
    assert.doesNotMatch(journey, /Sunny · 0% rain/);
    assert.match(journey, /homeWeatherSummary\(\)/);
    assert.match(journey, /ensureHomeWeatherLoaded/);
    assert.match(journey, /loadWeatherForecast/);
  });

  it('loads current conditions from Open-Meteo via API proxy', () => {
    assert.match(api, /current=temperature_2m,weather_code,precipitation/);
    assert.match(api, /current:\s*\{/);
    assert.match(hubly, /S\.weatherCurrent/);
    assert.match(hubly, /weatherConditionLabel/);
    assert.match(hubly, /current=temperature_2m,weather_code,precipitation/);
  });
});
