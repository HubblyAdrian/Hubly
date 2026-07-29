import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hubly = readFileSync(join(root, 'public/hubly.html'), 'utf8');
const journey = readFileSync(join(root, 'public/journey-os/journey.js'), 'utf8');
const studio = readFileSync(join(root, 'public/journey-os/hubly-studio.js'), 'utf8');
const css = readFileSync(join(root, 'public/journey-os/hubly-studio.css'), 'utf8');
const api = readFileSync(join(root, 'public/journey-os/studio/api.js'), 'utf8');
const edge = readFileSync(join(root, 'supabase/functions/studio-api/index.ts'), 'utf8');
const engine = readFileSync(join(root, 'supabase/functions/_shared/hubly_campaign_engine.ts'), 'utf8');
const brief = readFileSync(join(root, 'supabase/functions/_shared/hubly_studio_campaign_brief.ts'), 'utf8');
const ctx = readFileSync(join(root, 'supabase/functions/_shared/hubly_studio_business_context.ts'), 'utf8');
const recs = readFileSync(join(root, 'supabase/functions/_shared/hubly_studio_recommendations.ts'), 'utf8');
const pub = readFileSync(join(root, 'supabase/functions/_shared/hubly_studio_publisher.ts'), 'utf8');
const migrationCampaign = readFileSync(join(root, 'supabase/migrations/20260729210000_hubly_campaign_engine.sql'), 'utf8');
const migrationV1 = readFileSync(join(root, 'supabase/migrations/20260729220000_hubly_studio_v1_freeze.sql'), 'utf8');
const contract = readFileSync(join(root, 'docs/HUBLY_STUDIO_V1_CONTRACT.md'), 'utf8');
const spec = readFileSync(join(root, 'docs/HUBLY_STUDIO_IMPLEMENTATION_SPEC.md'), 'utf8');

describe('Hubly Studio V1.0 contract', () => {
  it('ships Studio shell and frozen contract', () => {
    assert.match(hubly, /data-v="studio"/);
    assert.match(hubly, /hubly-studio\.js\?v=studio-3/);
    assert.match(journey, /HublyStudio\.setMode/);
    assert.match(contract, /V1\.0/);
    assert.match(contract, /single channel: Email/i);
    assert.match(spec, /V1\.0 frozen/);
  });

  it('Project Workspace + Customize in Canva + detailing goals', () => {
    assert.match(studio, /Customize in Canva/);
    assert.match(studio, /hs-workspace-shell/);
    assert.match(studio, /CAMPAIGN_GOALS/);
    assert.match(studio, /dt_review_spotlight|dt_ceramic/);
    assert.match(studio, /Publish Email|publish-email|publish'/);
    assert.match(studio, /Campaign Brief/);
    assert.match(css, /\.hs-workspace-shell/);
    assert.doesNotMatch(studio, /Powered by Canva SDK/);
  });

  it('Business Context + Brief + Recommendation + Email publisher', () => {
    assert.match(ctx, /buildStudioBusinessContext/);
    assert.match(brief, /CampaignBrief/);
    assert.match(brief, /prompt_template must only reference/);
    assert.match(brief, /come up with/);
    assert.match(recs, /recommendCampaigns/);
    assert.doesNotMatch(recs, /OpenWeather|competitor_url|revenue_prediction/);
    assert.match(pub, /EmailStudioPublisher/);
    assert.match(pub, /V1 implements Email/);
    assert.match(engine, /planToCampaignBrief/);
    assert.match(engine, /dt_ceramic/);
    assert.match(engine, /DEFAULT_PROMPT_TEMPLATE/);
  });

  it('API routes for V1 pipeline', () => {
    assert.match(edge, /resource === \"recommend\"/);
    assert.match(edge, /resource === \"context\"/);
    assert.match(edge, /resource === \"publish\"/);
    assert.match(edge, /resource === \"analytics\"/);
    assert.match(edge, /planToCampaignBrief/);
    assert.match(edge, /V1_PUBLISH_CHANNEL/);
    assert.match(edge, /campaigns_created/);
    assert.match(api, /recommend/);
    assert.match(api, /publish/);
  });

  it('migrations seed detailing playbooks + prompt_template', () => {
    assert.ok(existsSync(join(root, 'supabase/migrations/20260729220000_hubly_studio_v1_freeze.sql')));
    assert.match(migrationCampaign, /campaign_playbooks/);
    assert.match(migrationV1, /prompt_template/);
    assert.match(migrationV1, /dt_review_spotlight/);
    assert.match(migrationV1, /dt_ceramic/);
  });

  it('V1 analytics are counters only', () => {
    assert.match(studio, /CAMPAIGNS CREATED/);
    assert.match(studio, /CAMPAIGNS PUBLISHED/);
    assert.match(studio, /POSTING FREQUENCY/);
    assert.doesNotMatch(studio, /REVENUE INFLUENCED/);
    assert.doesNotMatch(studio, /QUOTES REQUESTED/);
  });
});
