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
const migrationStudio = readFileSync(join(root, 'supabase/migrations/20260729200000_hubly_studio.sql'), 'utf8');
const migrationCampaign = readFileSync(join(root, 'supabase/migrations/20260729210000_hubly_campaign_engine.sql'), 'utf8');
const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');
const spec = readFileSync(join(root, 'docs/HUBLY_STUDIO_IMPLEMENTATION_SPEC.md'), 'utf8');
const campaignDoc = readFileSync(join(root, 'docs/HUBLY_STUDIO_CAMPAIGN_ENGINE.md'), 'utf8');

describe('Hubly Studio replaces Marketing', () => {
  it('ships Studio nav and view host instead of Marketing label', () => {
    assert.match(hubly, /data-v="studio"/);
    assert.match(hubly, /id="v-studio"/);
    assert.match(hubly, /id="jos-studio-root"/);
    assert.match(hubly, /hubly-studio\.js\?v=studio-2/);
    assert.match(hubly, /hubly-studio\.css\?v=studio-2/);
    assert.match(hubly, /studio\/api\.js\?v=studio-2/);
    assert.match(hubly, /studio:'Studio'/);
    assert.doesNotMatch(hubly, /title="Marketing"/);
  });

  it('wires journey onSwitchView to HublyStudio', () => {
    assert.match(journey, /HublyStudio\.setMode/);
    assert.match(journey, /studio: function/);
    assert.match(journey, /open-studio/);
    assert.match(journey, /jos-studio-promo/);
    assert.match(journey, /studio: \{ title: 'Studio'/);
  });

  it('keeps designed screens and Project Workspace CTA', () => {
    assert.match(studio, /HublyStudio/);
    assert.match(studio, /AI Creative Partner/);
    assert.match(studio, /Publish Center/);
    assert.match(studio, /Brand Kit/);
    assert.match(studio, /Template Gallery/);
    assert.match(studio, /CAMPAIGN_GOALS/);
    assert.match(studio, /Customize Design/);
    assert.match(studio, /hs-workspace-shell/);
    assert.match(studio, /generateCampaign/);
    assert.match(studio, /campaign\/plan/);
    assert.doesNotMatch(studio, /Powered by Canva SDK/);
    assert.match(api, /HublyStudioApi/);
    assert.match(css, /--hs-brand:\s*#D9632D/);
    assert.match(css, /\.hs-workspace-shell/);
    assert.match(css, /\.jos-studio-promo/);
  });

  it('persists studioOs in business meta', () => {
    assert.match(hubly, /studioOs:S\.studioOs/);
    assert.match(hubly, /if\(meta\.studioOs/);
  });

  it('ships Studio backend schema and edge API', () => {
    assert.ok(existsSync(join(root, 'supabase/functions/studio-api/index.ts')));
    assert.match(migrationStudio, /studio_projects/);
    assert.match(migrationStudio, /studio_brand_kit/);
    assert.match(migrationStudio, /studio_publish_queue/);
    assert.match(edge, /studio-api/);
    assert.match(edge, /Provider not configured/);
    assert.match(config, /\[functions\.studio-api\]/);
    assert.match(spec, /replaces Operate \*\*Marketing\*\*/);
  });
});

describe('Campaign Engine', () => {
  it('ships knowledge tables and plan storage', () => {
    assert.match(migrationCampaign, /campaign_playbooks/);
    assert.match(migrationCampaign, /campaign_seasonal_calendar/);
    assert.match(migrationCampaign, /campaign_triggers/);
    assert.match(migrationCampaign, /campaign_plans/);
    assert.match(migrationCampaign, /studio_project_versions/);
    assert.match(migrationCampaign, /canva_design_id/);
    assert.match(migrationCampaign, /pw_spring_clean/);
    assert.match(migrationCampaign, /business_inputs/);
    assert.match(migrationCampaign, /dna_inputs/);
  });

  it('engine returns structured plans and keeps Memory vs DNA separate', () => {
    assert.match(engine, /export function buildCampaignPlan/);
    assert.match(engine, /business_inputs/);
    assert.match(engine, /dna_inputs/);
    assert.match(engine, /ai_brief/);
    assert.match(engine, /EMBEDDED_PLAYBOOKS/);
    assert.match(engine, /suggestCampaigns/);
    assert.match(edge, /buildCampaignPlan/);
    assert.match(edge, /campaign\/plan/);
    assert.match(edge, /projects\/:id\/customize/);
    assert.match(campaignDoc, /[Mm]arketing brain/);
  });

  it('analytics track business outcomes', () => {
    assert.match(studio, /QUOTES REQUESTED/);
    assert.match(studio, /JOBS BOOKED/);
    assert.match(studio, /REVENUE INFLUENCED/);
    assert.match(studio, /Top Performing Campaigns/);
  });
});
