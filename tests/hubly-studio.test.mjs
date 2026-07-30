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
    assert.match(hubly, /hubly-studio\.js\?v=studio-15/);
    assert.match(journey, /HublyStudio\.setMode/);
    assert.match(contract, /V1\.0/);
    assert.match(contract, /single channel: Email/i);
    assert.match(spec, /V1\.0 frozen/);
  });

  it('Campaign Workspace is Hubly-native; Canva is optional', () => {
    assert.match(studio, /Edit Campaign/);
    assert.match(studio, /Edit in Canva|continue-edit/);
    assert.match(studio, /hs-workspace-shell/);
    assert.match(studio, /CAMPAIGN_GOALS/);
    assert.match(studio, /dt_review_spotlight|dt_ceramic/);
    assert.match(studio, /Publish Email|publish-email|publish'/);
    assert.match(studio, /Campaign Brief/);
    assert.match(studio, /isCanvaLinked|workspaceEditActionsHtml/);
    assert.doesNotMatch(studio, /Visual editor not connected yet/);
    assert.doesNotMatch(studio, /Customize Design needs Canva/);
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
    assert.match(studio, /buildStudioAnalytics|CAMPAIGNS CREATED|CREATED/);
    assert.match(studio, /posting_frequency|FREQUENCY/);
    assert.doesNotMatch(studio, /REVENUE INFLUENCED/);
    assert.doesNotMatch(studio, /QUOTES REQUESTED/);
  });

  it('Studio persist never opens Website editor; exit is Back to Hubly', () => {
    assert.match(studio, /persistStudioMeta/);
    assert.match(studio, /Never call saveStorefront|never call saveStorefront/i);
    assert.doesNotMatch(studio, /saveStorefront\(\)/);
    assert.match(studio, /leave-studio/);
    assert.match(studio, /Back to Hubly/);
    assert.match(css, /\.hs-back-hubly/);
    assert.match(hubly, /jos-studio-mode/);
    assert.match(hubly, /inStudio/);
  });

  it('workspace tabs stick and preview uses business facts not plumbing placeholders', () => {
    assert.match(studio, /refreshWorkspace/);
    assert.match(studio, /resetWorkspace/);
    assert.match(studio, /function bizContext/);
    assert.match(studio, /function reviewLine/);
    assert.doesNotMatch(studio, /Fixed our plumbing leak/);
    assert.doesNotMatch(studio, /Mrs\. Miller/);
    assert.doesNotMatch(studio, /No Leak Too Large/);
    assert.match(studio, /Updated headlines from your campaign package/);
  });

  it('Brand Kit is editable and persists logo/color facts', () => {
    assert.match(studio, /function ensureBrandKit/);
    assert.match(studio, /function saveBrandKit/);
    assert.match(studio, /brand-color-hex/);
    assert.match(studio, /brand-voice-toggle/);
    assert.match(studio, /upload-logo/);
    assert.match(studio, /Applied Brand Kit to/);
    assert.match(studio, /not mixed into Business Memory/);
    assert.match(css, /\.hs-color-edit/);
  });

  it('Elements is a campaign graphics library, not a redirect stub', () => {
    assert.match(studio, /function renderElements/);
    assert.match(studio, /ELEMENT_LIBRARY/);
    assert.match(studio, /el-attach/);
    assert.match(studio, /Add to campaign|Use in campaign/);
    assert.match(studio, /Open Campaign Workspace|Assets list and preview chips/);
    assert.doesNotMatch(studio, /screen === 'elements'\) return renderSimple/);
    assert.match(css, /\.hs-el-grid/);
  });

  it('Uploads is a media library; Photos pulls Hubly job media', () => {
    assert.match(studio, /function renderUploads/);
    assert.match(studio, /function renderPhotos/);
    assert.match(studio, /media-upload/);
    assert.match(studio, /ingestUploadFiles/);
    assert.match(studio, /Photos vs Uploads|Media is the source of truth|Browse Media/);
    assert.doesNotMatch(studio, /screen === 'uploads'\) return renderSimple/);
    assert.doesNotMatch(studio, /screen === 'photos'\) return renderSimple/);
    assert.match(css, /\.hs-upload-drop/);
    assert.match(api, /p === 'assets'/);
  });

  it('Publish Center is real email queue — no fake social posts', () => {
    assert.match(studio, /function publishCampaignEmail/);
    assert.match(studio, /publish-now/);
    assert.match(studio, /Ready to publish/);
    assert.match(studio, /No demo posts/);
    assert.doesNotMatch(studio, /Winter pipeline safety/);
    assert.doesNotMatch(studio, /Best Times to Post/);
    assert.doesNotMatch(studio, /d === today \|\| d === 9 \|\| d === 24/);
  });

  it('Analytics shows real Studio activity without fake attribution', () => {
    assert.match(studio, /function buildStudioAnalytics/);
    assert.match(studio, /function paintAnalytics/);
    assert.match(studio, /an-range/);
    assert.match(studio, /By campaign goal/);
    assert.match(studio, /Recent activity/);
    assert.match(studio, /never faked/);
    assert.doesNotMatch(studio, /revenue attribution are deferred/);
    assert.match(css, /\.hs-an-chart/);
    assert.match(edge, /publish_rate/);
  });

  it('Studio Settings shows Canva connect status and actions', () => {
    assert.match(studio, /function renderStudioSettings/);
    assert.match(studio, /canva-connect/);
    assert.match(studio, /Connect Canva/);
    assert.match(studio, /function connectCanvaFromStudio/);
    assert.match(studio, /Studio works fully without it|Canva is an optional advanced editor/);
    assert.doesNotMatch(studio, /screen === 'settings'\) \{\s*return renderSimple/);
    assert.match(css, /\.hs-settings-canva/);
    assert.match(api, /canva_linked/);
  });
});
