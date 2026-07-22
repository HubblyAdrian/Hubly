#!/usr/bin/env node
/**
 * Business Blueprint Validation Suite
 *
 * Permanent rule: Hubly supports businesses — not blueprint files.
 * Official blueprints improve quality. Missing official → AI-generated
 * temporary blueprint (same schema). Validate: Can Hubly build this business?
 *
 * Usage:
 *   node scripts/validate-blueprints.mjs
 *
 * Writes:
 *   artifacts/BLUEPRINT_VALIDATION_REPORT.md
 *   artifacts/blueprint-validation.json
 *   docs/BLUEPRINT_VALIDATION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BP_DIR = path.join(ROOT, 'public/business-blueprints');
const OUT_DIR = path.join(ROOT, 'artifacts');

/** Supported home-service categories for Closed Beta build proof. */
const REQUIRED_INDUSTRIES = [
  { key: 'detailing', label: 'Mobile Detailing', aliases: ['detailing'], prompt: 'I own a mobile detailing company.' },
  { key: 'cleaning', label: 'House Cleaning', aliases: ['cleaning', 'house-cleaning'], prompt: 'I run a house cleaning business.' },
  { key: 'windows', label: 'Window Cleaning', aliases: ['windows', 'window-cleaning'], prompt: 'I own a window cleaning company.' },
  { key: 'pressure_washing', label: 'Pressure Washing', aliases: ['pressure_washing', 'pressure-washing'], prompt: 'I do pressure washing.' },
  { key: 'landscaping', label: 'Lawn Care', aliases: ['landscaping', 'lawn-care'], prompt: 'I own a lawn care business.' },
  { key: 'hvac', label: 'HVAC', aliases: ['hvac'], prompt: 'I own an HVAC company.' },
  { key: 'electrical', label: 'Electrical', aliases: ['electrical'], prompt: 'I own an electrical company.' },
  { key: 'plumbing', label: 'Plumbing', aliases: ['plumbing'], prompt: 'I own a plumbing company.' },
  { key: 'painting', label: 'Painting', aliases: ['painting'], prompt: 'I own a painting company.' },
  { key: 'junk_removal', label: 'Junk Removal', aliases: ['junk_removal', 'junk-removal'], prompt: 'I do junk removal.' },
  { key: 'photography', label: 'Photography', aliases: ['photography'], prompt: 'I run a photography studio.' },
  { key: 'spa', label: 'Spa & Wellness', aliases: ['spa'], prompt: 'I own a spa and wellness business.' },
];

/** Full product proof chain — can Hubly build this business? */
const LIFECYCLE_CHECKS = [
  'conversation',
  'business_memory',
  'business_dna',
  'blueprint',
  'planner',
  'runtime',
  'website',
  'booking',
  'crm',
  'business_health',
  'hubly_daily',
  'creative_director',
  'ask_ai',
];

function loadScript(file) {
  const src = fs.readFileSync(path.join(BP_DIR, file), 'utf8');
  const sandbox = { console, globalThis: {} };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(src, sandbox);
  return sandbox;
}

function loadOfficialBlueprints() {
  const files = fs.readdirSync(BP_DIR).filter((f) => f.endsWith('.json'));
  const byId = {};
  for (const file of files) {
    const bp = JSON.parse(fs.readFileSync(path.join(BP_DIR, file), 'utf8'));
    byId[bp.id] = { file, bp, official: true };
  }
  return byId;
}

function findOfficial(byId, industry) {
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

function qualityScore(bp, source) {
  let score = source === 'official' ? 70 : 55;
  const catalog = bp.services?.catalog || [];
  score += Math.min(12, catalog.length * 2);
  const copy = bp.website?.sectionCopy || {};
  if ((copy.heroSubFallback || '').length >= 40) score += 6;
  if ((bp.knowledge?.brandVoice || '').length >= 40) score += 6;
  if ((bp.knowledge?.seoTopics || []).length >= 3 || (bp.decisionFactors || []).length >= 3) score += 4;
  if ((bp.knowledge?.suggestedUpsells || bp.booking?.defaultAddons || []).length >= 2) score += 3;
  if ((bp.website?.trustSignals || []).length >= 3) score += 3;
  if ((bp.playbooks || []).length >= 1) score += 2;
  if (Array.isArray(bp.identity?.specialties) && bp.identity.specialties.length >= 1) score += 2;
  const generic = /unlock your potential|synergy|cutting-edge|revolutionize|one.?stop.?shop/i;
  if (generic.test(bp.knowledge?.brandVoice || '') || generic.test(copy.heroSubFallback || '')) score -= 15;
  return Math.max(0, Math.min(100, score));
}

function checkLifecycle(bp, source) {
  const steps = {};
  const reasons = [];

  const convOk =
    !!bp.identity?.name &&
    Array.isArray(bp.customerJourney) &&
    bp.customerJourney.length > 0 &&
    !!bp.knowledge?.brandVoice;
  steps.conversation = convOk ? 'pass' : 'fail';
  if (!convOk) reasons.push('conversation seeds incomplete');

  const memOk =
    !!bp.knowledge?.customerPsychology &&
    !!bp.knowledge?.buyingBehavior &&
    Array.isArray(bp.services?.catalog) &&
    bp.services.catalog.length > 0;
  steps.business_memory = memOk ? 'pass' : 'fail';
  if (!memOk) reasons.push('cannot seed Business Memory');

  const dnaOk =
    !!bp.knowledge?.brandVoice &&
    Array.isArray(bp.homepage?.priority) &&
    bp.homepage.priority.length > 0 &&
    (!!bp.knowledge?.brandPersonality || !!bp.knowledge?.salesStyle || !!bp.knowledge?.targetCustomer || source === 'official');
  steps.business_dna = dnaOk ? 'pass' : 'fail';
  if (!dnaOk) reasons.push('cannot seed Business DNA');

  steps.blueprint = bp.id && bp.version ? 'pass' : 'fail';

  const planOk =
    (Array.isArray(bp.decisionRules) || Array.isArray(bp.playbooks)) &&
    bp.capabilities &&
    typeof bp.capabilities === 'object';
  steps.planner = planOk ? 'pass' : 'fail';
  if (!planOk) reasons.push('planner inputs incomplete');

  steps.runtime = bp.runtimeMinVersion ? 'pass' : 'fail';

  const webOk =
    !!bp.website?.defaultLayout &&
    Array.isArray(bp.website?.sections?.required) &&
    bp.website.sections.required.length > 0 &&
    !!bp.website?.sectionCopy?.heroSubFallback;
  steps.website = webOk ? 'pass' : 'fail';
  if (!webOk) reasons.push('website incomplete');

  const bookOk =
    !!bp.booking &&
    (Array.isArray(bp.booking.steps) || Array.isArray(bp.booking.wizardSteps) || !!bp.booking.mode);
  steps.booking = bookOk ? 'pass' : 'fail';
  if (!bookOk) reasons.push('booking incomplete');

  const crmOk =
    Array.isArray(bp.customerJourney) &&
    bp.customerJourney.length > 0 &&
    Array.isArray(bp.successMetrics);
  steps.crm = crmOk ? 'pass' : 'fail';

  const healthOk =
    Array.isArray(bp.successMetrics) &&
    bp.successMetrics.length > 0 &&
    Array.isArray(bp.dashboard?.widgets);
  steps.business_health = healthOk ? 'pass' : 'fail';

  const dailyOk =
    (Array.isArray(bp.playbooks) && bp.playbooks.length > 0) ||
    (Array.isArray(bp.automation?.enabledTriggers) && bp.automation.enabledTriggers.length > 0) ||
    Array.isArray(bp.dashboard?.widgets);
  steps.hubly_daily = dailyOk ? 'pass' : 'fail';

  // Creative Director — identity + homepage + section copy drive CD
  const cdOk =
    !!bp.identity?.name &&
    Array.isArray(bp.homepage?.priority) &&
    !!bp.website?.sectionCopy?.servicesTitle;
  steps.creative_director = cdOk ? 'pass' : 'fail';

  // Ask AI — knowledge + decision factors teach HublyAI / composeSystemPrompt
  const askOk =
    !!bp.knowledge?.brandVoice &&
    Array.isArray(bp.decisionFactors) &&
    bp.decisionFactors.length > 0 &&
    !!bp.knowledge?.customerPsychology;
  steps.ask_ai = askOk ? 'pass' : 'fail';

  const failed = Object.entries(steps).filter(([, v]) => v === 'fail').map(([k]) => k);
  return { steps, failed, reasons, pass: failed.length === 0 };
}

// Load validator + generator + intelligence
const sandbox = loadScript('validator.js');
vm.runInNewContext(fs.readFileSync(path.join(BP_DIR, 'intelligence.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(BP_DIR, 'generate.js'), 'utf8'), sandbox);
const Validator = sandbox.HublyBlueprintValidator || sandbox.globalThis.HublyBlueprintValidator;
const Generator = sandbox.HublyBlueprintGenerator || sandbox.globalThis.HublyBlueprintGenerator;

const officialById = loadOfficialBlueprints();
const rows = [];
const comparisons = [];

for (const industry of REQUIRED_INDUSTRIES) {
  const found = findOfficial(officialById, industry);
  let officialResult = null;
  let generatedResult = null;
  let used = null;
  let source = null;
  let confidence = null;

  if (found) {
    const schema = Validator.validateBlueprint(found.bp, { runtimeVersion: '1.0' });
    const life = checkLifecycle(found.bp, 'official');
    const q = qualityScore(found.bp, 'official');
    officialResult = {
      ok: schema.ok && life.pass,
      schema,
      life,
      quality: q,
      confidence: 99,
      id: found.bp.id,
      file: found.file,
    };
    // Still generate a peer for comparison (quality delta)
    const gen = Generator.ensure(industry.prompt || industry.key);
    if (gen?.blueprint) {
      const gSchema = Validator.validateBlueprint(gen.blueprint, { runtimeVersion: '1.0' });
      const gLife = checkLifecycle(gen.blueprint, 'ai_generated');
      generatedResult = {
        ok: gSchema.ok && gLife.pass,
        schema: gSchema,
        life: gLife,
        quality: qualityScore(gen.blueprint, 'ai_generated'),
        confidence: gen.confidence,
        id: gen.blueprint.id,
        clarifying: gen.clarifyingQuestions || [],
      };
    }
    used = found.bp;
    source = 'official';
    confidence = 99;
  } else {
    const gen = Generator.ensure(industry.prompt || industry.key);
    if (!gen?.blueprint) {
      rows.push({
        business_type: industry.label,
        key: industry.key,
        result: 'FAIL',
        class: 'PRODUCT',
        blueprint_source: 'none',
        confidence: null,
        reason: 'Could not generate temporary blueprint — Hubly cannot build this business',
        steps: Object.fromEntries(LIFECYCLE_CHECKS.map((s) => [s, 'fail'])),
        evidence: 'generator returned null',
      });
      continue;
    }
    const schema = Validator.validateBlueprint(gen.blueprint, { runtimeVersion: '1.0' });
    const life = checkLifecycle(gen.blueprint, 'ai_generated');
    generatedResult = {
      ok: schema.ok && life.pass,
      schema,
      life,
      quality: qualityScore(gen.blueprint, 'ai_generated'),
      confidence: gen.confidence,
      id: gen.blueprint.id,
      clarifying: gen.clarifyingQuestions || [],
      needsClarification: !!gen.needsClarification,
    };
    used = gen.blueprint;
    source = 'ai_generated';
    confidence = gen.confidence;
  }

  const life = checkLifecycle(used, source);
  const schema = Validator.validateBlueprint(used, { runtimeVersion: '1.0' });
  const canBuild = schema.ok && life.pass;
  const qOfficial = officialResult?.quality ?? null;
  const qGenerated = generatedResult?.quality ?? (source === 'ai_generated' ? qualityScore(used, 'ai_generated') : null);

  comparisons.push({
    industry: industry.label,
    key: industry.key,
    official: officialResult
      ? { id: officialResult.id, confidence: 99, quality: qOfficial, can_build: officialResult.ok }
      : null,
    generated: generatedResult
      ? {
          id: generatedResult.id,
          confidence: generatedResult.confidence,
          quality: generatedResult.quality,
          can_build: generatedResult.ok,
          clarifying_questions: generatedResult.clarifying,
        }
      : null,
    delta_quality:
      qOfficial != null && qGenerated != null ? qOfficial - qGenerated : null,
  });

  rows.push({
    business_type: industry.label,
    key: industry.key,
    id: used.id,
    file: officialResult?.file || '(ai-generated)',
    result: canBuild ? 'PASS' : 'FAIL',
    class: 'PRODUCT',
    blueprint_source: source,
    confidence,
    quality: source === 'official' ? qOfficial : qGenerated,
    official_quality: qOfficial,
    generated_quality: qGenerated,
    reason: canBuild
      ? source === 'official'
        ? `Official blueprint builds successfully (confidence ${confidence}%)`
        : `AI-generated blueprint builds successfully (confidence ${confidence}%) — official file not required`
      : [...(schema.ok ? [] : schema.errors.slice(0, 2)), ...life.reasons].join('; '),
    steps: life.steps,
    failed_steps: life.failed,
    evidence:
      source === 'official'
        ? `${officialResult.file} id=${used.id} source=official conf=${confidence}%`
        : `generated id=${used.id} source=ai_generated conf=${confidence}%`,
  });
}

const passCount = rows.filter((r) => r.result === 'PASS').length;
const failCount = rows.filter((r) => r.result === 'FAIL').length;
const officialUsed = rows.filter((r) => r.blueprint_source === 'official').length;
const generatedUsed = rows.filter((r) => r.blueprint_source === 'ai_generated').length;

const md = [];
md.push('# Business Blueprint Validation Report');
md.push('');
md.push(`Generated: ${new Date().toISOString()}`);
md.push('');
md.push('## Philosophy');
md.push('');
md.push('**Living Blueprints** — Hubly supports businesses; knowledge is the moat.');
md.push('');
md.push('Official → AI Generated → Owner edits → Customer behavior → Bookings/Reviews/Revenue → Blueprint improves → Community Learned / Hubly Optimized → Promote to Official.');
md.push('');
md.push('Official blueprints improve quality. They are not the goal — Living Blueprints that get smarter over time are.');
md.push('When no official blueprint exists, an AI-generated Living Blueprint (same schema) is used.');
md.push('');
md.push('Blueprint Source values: Official · AI Generated · Hybrid · Community Learned · Hubly Optimized');
md.push('');
md.push('| Metric | Value |');
md.push('|---|---|');
md.push(`| Required industries | ${REQUIRED_INDUSTRIES.length} |`);
md.push(`| Can build (PASS) | ${passCount} |`);
md.push(`| Cannot build (FAIL) | ${failCount} |`);
md.push(`| Using official blueprint | ${officialUsed} |`);
md.push(`| Using AI-generated blueprint | ${generatedUsed} |`);
md.push('');
md.push('| Business Type | Result | Source | Confidence | Quality | Reason |');
md.push('|---|---|---|---|---|---|');
for (const r of rows) {
  md.push(
    `| ${r.business_type} | **${r.result}** | ${r.blueprint_source} | ${r.confidence ?? '—'}% | ${r.quality ?? '—'} | ${String(r.reason).replace(/\|/g, '/')} |`,
  );
}
md.push('');
md.push('## Official vs Generated');
md.push('');
md.push('| Industry | Official conf / quality | Generated conf / quality | Quality delta (official − generated) |');
md.push('|---|---|---|---|');
for (const c of comparisons) {
  const o = c.official
    ? `${c.official.confidence}% / ${c.official.quality}`
    : '— (none)';
  const g = c.generated
    ? `${c.generated.confidence}% / ${c.generated.quality}`
    : '—';
  const d = c.delta_quality != null ? `+${c.delta_quality}` : '—';
  md.push(`| ${c.industry} | ${o} | ${g} | ${d} |`);
}
md.push('');
md.push('## Lifecycle proof (Conversation → … → Ask AI)');
md.push('');
for (const r of rows) {
  md.push(`### ${r.business_type} — ${r.result} (${r.blueprint_source}, ${r.confidence}%)`);
  md.push('');
  md.push('| Step | Status |');
  md.push('|---|---|');
  for (const s of LIFECYCLE_CHECKS) {
    md.push(`| ${s} | ${r.steps[s] || '—'} |`);
  }
  md.push('');
}
md.push('## DNA field');
md.push('');
md.push('Business DNA includes `blueprintSource`: **Official** | **AI Generated** | **Hybrid** | **Community Learned** | **Hubly Optimized**.');
md.push('Plus `blueprintReasoning` (HQ-only: why Hubly built it this way) and AI Review Pass scores on publish.');
md.push('Use Learning Dashboard in Hubly HQ to see where Hubly is getting smarter.');
md.push('');

fs.mkdirSync(OUT_DIR, { recursive: true });
const json = {
  philosophy: 'Hubly supports businesses — not blueprint files.',
  passCount,
  failCount,
  officialUsed,
  generatedUsed,
  rows,
  comparisons,
};
fs.writeFileSync(path.join(OUT_DIR, 'blueprint-validation.json'), JSON.stringify(json, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'BLUEPRINT_VALIDATION_REPORT.md'), md.join('\n'));
fs.writeFileSync(path.join(ROOT, 'docs/BLUEPRINT_VALIDATION_REPORT.md'), md.join('\n'));

console.log(md.join('\n'));
console.log(`\nWrote artifacts/BLUEPRINT_VALIDATION_REPORT.md (${passCount} pass / ${failCount} fail)`);
process.exit(failCount ? 1 : 0);
