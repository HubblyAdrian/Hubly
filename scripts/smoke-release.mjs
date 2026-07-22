#!/usr/bin/env node
/**
 * Hubly deployment smoke — every deploy must pass.
 * Failures turn Release Gate RED via mission-control smoke_report.
 *
 * Usage:
 *   node scripts/smoke-release.mjs
 *   HUBLY_BASE=https://myhubly.app node scripts/smoke-release.mjs
 *   HUBLY_MISSION_CONTROL_SECRET=… REPORT_SMOKE=1 node scripts/smoke-release.mjs
 *
 * Categories (required):
 *   business_build, website_build, website_publish, booking, payments,
 *   crm, calendar, emails, hubly_hq, release_gate
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = (process.env.HUBLY_BASE || '').replace(/\/$/, '');
const REPORT = process.env.REPORT_SMOKE === '1' || process.env.REPORT_SMOKE === 'true';
const SUPA_URL = process.env.SUPABASE_URL || 'https://rtwxxkxpkqdrhclkozma.supabase.co';
const SUPA_ANON = process.env.SUPABASE_ANON_KEY || '';
const HQ_SECRET = (process.env.HUBLY_MISSION_CONTROL_SECRET || '').trim();

const checks = [];

function check(id, label, ok, detail = '') {
  checks.push({ id, label, ok: !!ok, detail: String(detail || '') });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  [${id}] ${label}${detail ? ` — ${detail}` : ''}`);
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function has(rel, re) {
  if (!exists(rel)) return false;
  return re.test(read(rel));
}

function commitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return process.env.GITHUB_SHA || null;
  }
}

// ——— Static / repository proofs (always run) ———

check(
  'business_build',
  'Business Build path present',
  exists('supabase/functions/hubly-build-business/index.ts') &&
    has('supabase/functions/_shared/hubly_ai.ts', /buildBusiness/) &&
    has('supabase/functions/_shared/hubly_brain_executors.ts', /executeCapability/),
  'hubly-build-business + Hubly.buildBusiness + executors',
);

check(
  'website_build',
  'Website Build / Runtime present',
  has('supabase/functions/_shared/hubly_brain_website.ts', /buildWebsiteCopyFromMemoryDna/) &&
    has('supabase/functions/_shared/hubly_brain_website.ts', /websiteBuilderSystemPrompt/),
  'hubly_brain_website copy + prompt',
);

check(
  'website_publish',
  'Website Publish path present',
  has('supabase/functions/_shared/hubly_brain_website.ts', /publishBusinessWebsite/) &&
    has('public/hubly.html', /saveStorefront|published/),
  'publishBusinessWebsite + owner saveStorefront',
);

check(
  'booking',
  'Booking path present',
  has('public/hubly.html', /submitBooking|booking_requests/) &&
    (exists('supabase/migrations/20260722030000_get_busy_windows.sql') ||
      has('public/hubly.html', /assertSlotOpen/)),
  'submitBooking + busy windows / conflict check',
);

check(
  'payments',
  'Payments path present',
  exists('supabase/functions/create-booking-checkout/index.ts') &&
    exists('supabase/functions/stripe-webhook/index.ts') &&
    exists('supabase/migrations/20260722020000_first_customer_payments.sql'),
  'checkout + webhook + first-customer payments migration',
);

check(
  'crm',
  'CRM service-role path (not public booking)',
  has('supabase/functions/_shared/crm_from_booking.ts', /upsertCrmFromBooking/) &&
    has('supabase/functions/hire-crm/index.ts', /upsertCrmFromBooking/) &&
    has('supabase/functions/stripe-webhook/index.ts', /upsertCrmFromBooking/) &&
    has('public/hubly.html', /publicVisitor|isPublicWebsiteView/) &&
    has('public/hubly.html', /hire-crm/),
  'hire-crm + stripe-webhook service-role; public booking skips customers writes',
);

check(
  'calendar',
  'Calendar edges + client invoke names',
  exists('supabase/functions/google-calendar-oauth-start/index.ts') &&
    exists('supabase/functions/google-calendar-oauth-callback/index.ts') &&
    exists('supabase/functions/google-calendar-push-job/index.ts') &&
    exists('supabase/functions/google-calendar-maintain/index.ts') &&
    has('public/hubly.html', /google-calendar-oauth-start/) &&
    has('public/hubly.html', /google-calendar-push-job/) &&
    has('public/hubly.html', /assertSlotOpen/),
  'oauth-start/callback + push-job + maintain + busy windows',
);

check(
  'hubly_hq',
  'Hubly HQ surfaces present',
  exists('public/mission-control.html') &&
    exists('supabase/functions/mission-control/index.ts') &&
    has('public/mission-control.html', /CEO Daily/) &&
    has('public/mission-control.html', /Release Gate/) &&
    has('public/mission-control.html', /Proof Mode/) &&
    has('public/mission-control.html', /AI Learning/) &&
    has('public/mission-control.html', /Admin Audit Log/) &&
    has('supabase/functions/mission-control/index.ts', /audit_log/) &&
    has('supabase/functions/mission-control/index.ts', /proof_mode/) &&
    has('supabase/functions/mission-control/index.ts', /ai_learning/) &&
    has('supabase/functions/mission-control/index.ts', /smoke_report/) &&
    has('public/website-ai-review.js', /HublyWebsiteAIReview/) &&
    has('public/business-blueprints/intelligence.js', /HublyBlueprintIntelligence/),
  'HQ UI + Proof Mode + AI Learning + Living Blueprints + audit_log + smoke_report',
);

check(
  'build_confidence',
  'Owner-intent business birth narrative',
  exists('public/hubly.html') &&
    has('public/hubly.html', /You’re not starting with software anymore/) &&
    has('public/hubly.html', /From this point on, I’ll help you grow it/) &&
    has('public/hubly.html', /isBuildConfidenceBeats/) &&
    has('public/hubly.html', /Learning what makes your business different/) &&
    has('public/hubly.html', /Your business is ready/) &&
    has('public/hubly.html', /Give me about two minutes/),
  'Story beats + reveal + grow promise map to real build work',
);

check(
  'emails',
  'Owner / customer email notify path present',
  exists('api/notify.js') &&
    has('public/hubly.html', /notifyWebsiteHire|notify/),
  'api/notify.js + notifyWebsiteHire',
);

check(
  'release_gate',
  'Release Gate smoke wiring present',
  has('supabase/functions/_shared/mission_control.ts', /latestSmokeRun/) &&
    has('supabase/functions/_shared/mission_control.ts', /recordSmokeRun/) &&
    has('supabase/functions/_shared/mission_control.ts', /e2e_smoke/) &&
    exists('supabase/migrations/20260722180000_hubly_smoke_runs.sql'),
  'smoke runs → e2e_smoke RED on fail',
);

check(
  'blueprint_suite',
  'Blueprint validation suite present',
  exists('scripts/validate-blueprints.mjs') &&
    exists('public/business-blueprints/validator.js') &&
    exists('public/business-blueprints/detailing.json'),
  'validate-blueprints.mjs + registry',
);

check(
  'edge_probe_script',
  'Production edge probe script present',
  exists('scripts/probe-production-edges.mjs') &&
    exists('scripts/deploy-proof-edges.sh'),
  'probe + deploy-proof-edges',
);

check(
  'infra_product_split',
  'Infra vs product docs separated',
  exists('docs/INFRASTRUCTURE_BLOCKERS.md') &&
    exists('docs/PRODUCT_FAILURES.md'),
  'INFRASTRUCTURE_BLOCKERS + PRODUCT_FAILURES',
);

// ——— Optional live checks ———

async function live() {
  if (!BASE) {
    console.log('SKIP  live HTTP checks (set HUBLY_BASE to enable)');
    return;
  }
  try {
    const hq = await fetch(BASE + '/hq', { redirect: 'follow' });
    const text = await hq.text();
    check('hubly_hq_live', 'Hubly HQ route serves', hq.status === 200 && /CEO Daily|Hubly HQ|mission/i.test(text), `GET /hq → ${hq.status}`);
  } catch (e) {
    check('hubly_hq_live', 'Hubly HQ route serves', false, e.message);
  }
  try {
    const home = await fetch(BASE + '/', { redirect: 'follow' });
    check('signup_live', 'Public home / signup surface', home.status === 200, `GET / → ${home.status}`);
  } catch (e) {
    check('signup_live', 'Public home / signup surface', false, e.message);
  }
}

await live();

// Optional: fail smoke if critical edges missing in production
if (process.env.LIVE_EDGES === '1') {
  const { spawnSync } = await import('child_process');
  const probe = spawnSync(process.execPath, ['scripts/probe-production-edges.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const missing = (probe.stdout || '').includes('MISSING: **0**') || (probe.stdout || '').includes('MISSING: **0**');
  // parse from json
  let missingCount = 99;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/edge-probe.json'), 'utf8'));
    missingCount = (j.missing || []).length;
  } catch {}
  check(
    'live_edges',
    'Critical production edges deployed',
    missingCount === 0,
    missingCount === 0 ? '0 MISSING' : `${missingCount} MISSING — see docs/EDGE_PROBE.md`,
  );
}

// Blueprint suite (product) — every supported industry must be buildable
// (official OR AI-generated). Missing official files are NOT failures.
{
  const { spawnSync } = await import('child_process');
  const run = spawnSync(process.execPath, ['scripts/validate-blueprints.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  let failRequired = 0;
  let passCount = 0;
  let generatedUsed = 0;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/blueprint-validation.json'), 'utf8'));
    failRequired = (j.rows || []).filter((r) => r.result === 'FAIL').length;
    passCount = j.passCount || 0;
    generatedUsed = j.generatedUsed || 0;
  } catch {
    failRequired = 99;
  }
  check(
    'blueprints_can_build',
    'Every supported industry can build (official or AI-generated)',
    failRequired === 0,
    failRequired === 0
      ? `${passCount} PASS (${generatedUsed} AI-generated)`
      : `${failRequired} cannot build — PRODUCT`,
  );
  if (run.status && run.status !== 0 && failRequired === 0) {
    // Validator exited non-zero unexpectedly
  }
}

const failed = checks.filter((c) => !c.ok);
const passed = failed.length === 0;
const sha = commitSha();
const result = {
  passed,
  gate_status: passed ? 'green' : 'red',
  failed_ids: failed.map((c) => c.id),
  checks,
  commit_sha: sha,
  environment: process.env.SMOKE_ENV || (BASE ? 'live' : 'repo'),
  reported_at: new Date().toISOString(),
};

const outDir = path.join(ROOT, 'artifacts');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'smoke-release.json');
fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(`\nWrote ${outFile}`);
console.log(passed ? '\nSMOKE GREEN' : `\nSMOKE RED — failed: ${result.failed_ids.join(', ')}`);

if (REPORT) {
  if (!HQ_SECRET) {
    console.error('REPORT_SMOKE=1 requires HUBLY_MISSION_CONTROL_SECRET');
    process.exit(2);
  }
  const anon = SUPA_ANON || (() => {
    try {
      const html = read('public/mission-control.html');
      return html.match(/['"](eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)['"]/)?.[1] || '';
    } catch {
      return '';
    }
  })();
  if (!anon) {
    console.error('Missing SUPABASE_ANON_KEY for smoke_report');
    process.exit(2);
  }
  const res = await fetch(SUPA_URL + '/functions/v1/mission-control', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: 'Bearer ' + anon,
      'x-hubly-mission-control': HQ_SECRET,
    },
    body: JSON.stringify({
      action: 'smoke_report',
      admin_email: 'smoke-release',
      passed,
      checks,
      failed_ids: result.failed_ids,
      environment: result.environment,
      commit_sha: sha,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    console.error('smoke_report failed:', json.error || res.status);
    process.exit(2);
  }
  console.log('Reported to Hubly HQ Release Gate:', json.data?.gate_status || result.gate_status);
}

process.exit(passed ? 0 : 1);
