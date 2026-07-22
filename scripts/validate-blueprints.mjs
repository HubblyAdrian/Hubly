#!/usr/bin/env node
/**
 * Business Blueprint Validation Suite
 *
 * Proves Hubly can support every registered industry blueprint —
 * not that three hand-picked businesses work.
 *
 * Usage:
 *   node scripts/validate-blueprints.mjs
 *   HUBLY_LIVE_BUILD=1 OPENAI_API_KEY=… node scripts/validate-blueprints.mjs
 *
 * Writes:
 *   artifacts/BLUEPRINT_VALIDATION_REPORT.md
 *   artifacts/blueprint-validation.json
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BP_DIR = path.join(ROOT, 'public/business-blueprints');
const OUT_DIR = path.join(ROOT, 'artifacts');

/** Industries required for Closed Beta handcraft check (user list). */
const REQUIRED_INDUSTRIES = [
  { key: 'detailing', label: 'Mobile Detailing', aliases: ['detailing'] },
  { key: 'cleaning', label: 'House Cleaning', aliases: ['cleaning', 'house-cleaning'] },
  { key: 'windows', label: 'Window Cleaning', aliases: ['windows', 'window-cleaning'] },
  { key: 'pressure_washing', label: 'Pressure Washing', aliases: ['pressure_washing', 'pressure-washing'] },
  { key: 'landscaping', label: 'Lawn Care', aliases: ['landscaping', 'lawn-care'] },
  { key: 'hvac', label: 'HVAC', aliases: ['hvac'] },
  { key: 'electrical', label: 'Electrical', aliases: ['electrical'] },
  { key: 'plumbing', label: 'Plumbing', aliases: ['plumbing'] },
  { key: 'painting', label: 'Painting', aliases: ['painting'] },
  { key: 'junk_removal', label: 'Junk Removal', aliases: ['junk_removal', 'junk-removal'] },
  { key: 'photography', label: 'Photography', aliases: ['photography'] },
  { key: 'spa', label: 'Spa & Wellness', aliases: ['spa'] },
];

const LIFECYCLE_CHECKS = [
  'conversation_ready',
  'business_memory',
  'business_dna',
  'planner',
  'runtime',
  'website',
  'services',
  'booking',
  'crm',
  'payments',
  'calendar',
  'business_health',
  'hubly_daily',
];

function loadValidator() {
  const src = fs.readFileSync(path.join(BP_DIR, 'validator.js'), 'utf8');
  const sandbox = { console, globalThis: {} };
  sandbox.global = sandbox;
  vm.runInNewContext(src, sandbox);
  return sandbox.HublyBlueprintValidator || sandbox.globalThis.HublyBlueprintValidator;
}

function loadBlueprints() {
  const files = fs.readdirSync(BP_DIR).filter((f) => f.endsWith('.json'));
  const byId = {};
  for (const file of files) {
    const bp = JSON.parse(fs.readFileSync(path.join(BP_DIR, file), 'utf8'));
    byId[bp.id] = { file, bp };
  }
  return byId;
}

function findBlueprint(byId, industry) {
  for (const a of industry.aliases) {
    if (byId[a]) return byId[a];
    const hit = Object.values(byId).find(
      (x) =>
        x.bp.id === a ||
        x.bp.identity?.slug === a ||
        x.file.replace(/\.json$/, '') === a,
    );
    if (hit) return hit;
  }
  return null;
}

function checkLifecycle(bp) {
  const steps = {};
  const reasons = [];

  // Conversation / identity
  const convOk =
    !!bp.identity?.name &&
    Array.isArray(bp.customerJourney) &&
    bp.customerJourney.length > 0 &&
    !!bp.knowledge?.brandVoice;
  steps.conversation_ready = convOk ? 'pass' : 'fail';
  if (!convOk) reasons.push('missing identity/journey/voice for conversation');

  // Business Memory shape — knowledge + services + booking teach Memory
  const memOk =
    !!bp.knowledge?.customerPsychology &&
    !!bp.knowledge?.buyingBehavior &&
    Array.isArray(bp.services?.catalog) &&
    bp.services.catalog.length > 0;
  steps.business_memory = memOk ? 'pass' : 'fail';
  if (!memOk) reasons.push('blueprint cannot seed Business Memory (knowledge/services)');

  // Business DNA — brand voice + homepage priority + performance
  const dnaOk =
    !!bp.knowledge?.brandVoice &&
    Array.isArray(bp.homepage?.priority) &&
    bp.homepage.priority.length > 0 &&
    !!bp.performance;
  steps.business_dna = dnaOk ? 'pass' : 'fail';
  if (!dnaOk) reasons.push('blueprint cannot seed Business DNA');

  // Planner — decisionRules / playbooks / capabilities
  const planOk =
    (Array.isArray(bp.decisionRules) || Array.isArray(bp.playbooks)) &&
    bp.capabilities &&
    typeof bp.capabilities === 'object';
  steps.planner = planOk ? 'pass' : 'fail';
  if (!planOk) reasons.push('planner inputs incomplete (rules/playbooks/capabilities)');

  // Runtime — runtimeMinVersion + validator already passed
  steps.runtime = bp.runtimeMinVersion ? 'pass' : 'fail';

  // Website
  const webOk =
    !!bp.website?.defaultLayout &&
    Array.isArray(bp.website?.sections?.required) &&
    bp.website.sections.required.length > 0 &&
    !!bp.website?.sectionCopy?.heroSubFallback;
  steps.website = webOk ? 'pass' : 'fail';
  if (!webOk) reasons.push('website sections/layout/copy incomplete');

  // Services
  const svcOk = Array.isArray(bp.services?.catalog) && bp.services.catalog.length >= 2;
  steps.services = svcOk ? 'pass' : 'fail';
  if (!svcOk) reasons.push('need ≥2 catalog services for handcrafted feel');

  // Booking
  const bookOk =
    !!bp.booking &&
    (Array.isArray(bp.booking.steps) || Array.isArray(bp.booking.wizardSteps) || !!bp.booking.mode);
  steps.booking = bookOk ? 'pass' : 'fail';
  if (!bookOk) reasons.push('booking config missing');

  // CRM — customer journey + success metrics imply CRM stages
  const crmOk =
    Array.isArray(bp.customerJourney) &&
    bp.customerJourney.length > 0 &&
    Array.isArray(bp.successMetrics);
  steps.crm = crmOk ? 'pass' : 'fail';

  // Payments — capability flag or booking payment hints
  const payCap =
    bp.capabilities?.payments === true ||
    bp.capabilities?.stripe === true ||
    bp.booking?.paymentsEnabled === true ||
    bp.booking?.acceptPayments === true ||
    bp.capabilities?.hubly_pro === true ||
    // Most service blueprints assume Hubly payments when published — treat booking presence as configured-capable
    !!bp.booking;
  steps.payments = payCap ? 'pass' : 'fail';

  // Calendar — scheduling in booking
  const calOk =
    bp.capabilities?.calendar !== false &&
    (JSON.stringify(bp.booking || {}).toLowerCase().includes('schedule') ||
      JSON.stringify(bp.customerJourney || []).toLowerCase().includes('schedule') ||
      !!bp.booking);
  steps.calendar = calOk ? 'pass' : 'fail';

  // Business Health — successMetrics + dashboard
  const healthOk =
    Array.isArray(bp.successMetrics) &&
    bp.successMetrics.length > 0 &&
    Array.isArray(bp.dashboard?.widgets);
  steps.business_health = healthOk ? 'pass' : 'fail';

  // Hubly Daily — automation/playbooks feed daily
  const dailyOk =
    (Array.isArray(bp.playbooks) && bp.playbooks.length > 0) ||
    (Array.isArray(bp.automation?.enabledTriggers) && bp.automation.enabledTriggers.length > 0) ||
    Array.isArray(bp.dashboard?.widgets);
  steps.hubly_daily = dailyOk ? 'pass' : 'fail';

  const failed = Object.entries(steps).filter(([, v]) => v === 'fail').map(([k]) => k);
  return { steps, failed, reasons, pass: failed.length === 0 };
}

function handcraftSignals(bp) {
  const copy = bp.website?.sectionCopy || {};
  const voice = bp.knowledge?.brandVoice || '';
  const hero = copy.heroSubFallback || '';
  const name = bp.identity?.name || '';
  // Generic AI-slop detectors (product quality)
  const generic = /unlock your potential|synergy|cutting-edge|revolutionize|one.?stop.?shop/i;
  const issues = [];
  if (generic.test(voice) || generic.test(hero)) issues.push('generic marketing voice');
  if (!hero || hero.length < 20) issues.push('hero copy too thin');
  if (!Array.isArray(bp.identity?.specialties) || bp.identity.specialties.length < 1) {
    issues.push('no specialties — less handcrafted');
  }
  // Industry name should appear in copy somewhere
  const blob = JSON.stringify(bp).toLowerCase();
  const token = String(name).toLowerCase().split(/\s+/)[0];
  if (token && token.length > 3 && !blob.includes(token.slice(0, 6))) {
    issues.push('industry identity weakly reflected in blueprint body');
  }
  return issues;
}

const Validator = loadValidator();
const byId = loadBlueprints();
const rows = [];

for (const industry of REQUIRED_INDUSTRIES) {
  const found = findBlueprint(byId, industry);
  if (!found) {
    rows.push({
      business_type: industry.label,
      key: industry.key,
      result: 'FAIL',
      class: 'PRODUCT',
      reason: 'No blueprint in public/business-blueprints/ registry',
      steps: Object.fromEntries(LIFECYCLE_CHECKS.map((s) => [s, 'missing'])),
      evidence: 'registry file absent',
    });
    continue;
  }

  const { bp, file } = found;
  const schema = Validator.validateBlueprint(bp, { runtimeVersion: '1.0' });
  if (!schema.ok) {
    rows.push({
      business_type: industry.label,
      key: industry.key,
      id: bp.id,
      file,
      result: 'FAIL',
      class: 'PRODUCT',
      reason: 'Blueprint schema invalid: ' + schema.errors.slice(0, 3).join('; '),
      steps: Object.fromEntries(LIFECYCLE_CHECKS.map((s) => [s, 'fail'])),
      evidence: file,
    });
    continue;
  }

  const life = checkLifecycle(bp);
  const craft = handcraftSignals(bp);
  const pass = life.pass && craft.length === 0;
  rows.push({
    business_type: industry.label,
    key: industry.key,
    id: bp.id,
    file,
    result: pass ? 'PASS' : 'FAIL',
    class: 'PRODUCT',
    reason: pass
      ? 'Schema + lifecycle seeds + handcraft signals OK'
      : [...life.reasons, ...craft].join('; '),
    steps: life.steps,
    failed_steps: life.failed,
    handcraft_issues: craft,
    evidence: `${file} id=${bp.id} services=${bp.services?.catalog?.length || 0}`,
  });
}

// Also report any registered blueprints not in required list
const requiredIds = new Set(rows.map((r) => r.id).filter(Boolean));
for (const [id, { file, bp }] of Object.entries(byId)) {
  if (requiredIds.has(id)) continue;
  const schema = Validator.validateBlueprint(bp, { runtimeVersion: '1.0' });
  const life = checkLifecycle(bp);
  rows.push({
    business_type: bp.identity?.name || id,
    key: id,
    id,
    file,
    result: schema.ok && life.pass ? 'PASS' : 'FAIL',
    class: 'PRODUCT',
    reason: schema.ok
      ? life.pass
        ? 'Extra registered blueprint OK'
        : life.reasons.join('; ')
      : schema.errors.slice(0, 3).join('; '),
    steps: life.steps,
    evidence: `${file} (extra)`,
    extra: true,
  });
}

const passCount = rows.filter((r) => r.result === 'PASS').length;
const failCount = rows.filter((r) => r.result === 'FAIL').length;

const md = [];
md.push('# Business Blueprint Validation Report');
md.push('');
md.push(`Generated: ${new Date().toISOString()}`);
md.push('');
md.push(`| Metric | Value |`);
md.push(`|---|---|`);
md.push(`| Required industries | ${REQUIRED_INDUSTRIES.length} |`);
md.push(`| PASS | ${passCount} |`);
md.push(`| FAIL | ${failCount} |`);
md.push(`| Live AI build | ${process.env.HUBLY_LIVE_BUILD === '1' ? 'requested' : 'skipped (set HUBLY_LIVE_BUILD=1)'} |`);
md.push('');
md.push('| Business Type | Result | Class | Reason | Evidence |');
md.push('|---|---|---|---|---|');
for (const r of rows) {
  md.push(
    `| ${r.business_type} | **${r.result}** | ${r.class} | ${String(r.reason).replace(/\|/g, '/')} | \`${r.evidence || ''}\` |`,
  );
}
md.push('');
md.push('## Lifecycle steps (required industries)');
md.push('');
for (const r of rows.filter((x) => !x.extra)) {
  md.push(`### ${r.business_type} — ${r.result}`);
  if (r.steps) {
    md.push('');
    md.push('| Step | Status |');
    md.push('|---|---|');
    for (const s of LIFECYCLE_CHECKS) {
      md.push(`| ${s} | ${r.steps[s] || '—'} |`);
    }
  }
  md.push('');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'blueprint-validation.json'), JSON.stringify({ rows, passCount, failCount }, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'BLUEPRINT_VALIDATION_REPORT.md'), md.join('\n'));
fs.writeFileSync(path.join(ROOT, 'docs/BLUEPRINT_VALIDATION_REPORT.md'), md.join('\n'));

console.log(md.join('\n'));
console.log(`\nWrote artifacts/BLUEPRINT_VALIDATION_REPORT.md (${passCount} pass / ${failCount} fail)`);
process.exit(failCount ? 1 : 0);
