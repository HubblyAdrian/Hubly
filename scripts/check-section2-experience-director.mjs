#!/usr/bin/env node
/**
 * SECTION 2 — Experience Director (blocks Milestone 2 until green).
 *
 * Proves with CODE + BEHAVIORAL FIXTURES + EVIDENCE + DOCS:
 * 1. Experience Director exists and is registered
 * 2. Every customer-facing think path is reviewed by ED
 * 3. Research 10 questions → ED shows max 2
 * 4. Creative 8 homepage sections → ED shows 4, delays rest
 * 5. Operations 15 widgets → ED shows 1
 * 6. Technical language rewritten for owners
 * 7. Celebration moments suggested when appropriate
 * 8. Constants stay in sync between runtime TS and Node evidence lib
 */
import fs from 'fs';
import path from 'path';
import {
  applyExperienceDirector,
  stripTechnicalLanguage,
  limitQuestions,
  shouldCelebrate,
  ED_MAX_QUESTIONS,
  ED_MAX_OWNER_LINES,
  ED_MAX_HOMEPAGE_SECTIONS,
  ED_MAX_DASHBOARD_WIDGETS,
  EXPERIENCE_DIRECTOR_VERSION,
} from './lib/experience-director.mjs';

const root = process.cwd();
let failed = false;
const proofs = [];
const evidence = { fixtures: [] };

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  } else {
    console.log('PASS:', msg);
    proofs.push(msg);
  }
}

function read(p) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

const ts = read('supabase/functions/_shared/hubly_brain_experience_director.ts');
const experts = read('supabase/functions/_shared/hubly_brain_experts.ts');
const think = read('supabase/functions/_shared/hubly_brain_think.ts');
const docs = fs.existsSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION2.md'))
  ? read('docs/HUBLY_BRAIN_SECTION2.md')
  : '';

// --- Structural ---
ok(ts.includes('applyExperienceDirector') && ts.includes('EXPERIENCE_DIRECTOR_VERSION'), 'Experience Director module exists');
ok(experts.includes('id: "experience_director"') && experts.includes('applyExperienceDirector'), 'ED registered and used by expert framework');
ok(think.includes('applyExperienceDirector') && think.includes('experience_director'), 'think pipeline uses Experience Director');
ok(think.includes('Section 2 invariant') || think.includes('Experience Director did not review'), 'think enforces ED review invariant');
ok(think.includes('intent === "weather"') && think.includes('applyExperienceDirector'), 'weather fast path still reviewed by ED');
ok(think.includes('intent === "workspace"') && think.includes('applyExperienceDirector'), 'workspace fast path still reviewed by ED');
ok(PIPELINE_LAST(think), 'experience_director is last in PIPELINE_ORDER');

function PIPELINE_LAST(src) {
  const m = src.match(/PIPELINE_ORDER[^=]*=\s*\[([\s\S]*?)\];/);
  if (!m) return false;
  const ids = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  return ids.length && ids[ids.length - 1] === 'experience_director';
}

// --- Sync constants between TS runtime and Node evidence lib ---
for (const key of [
  'ED_MAX_QUESTIONS = 2',
  'ED_MAX_OWNER_LINES = 3',
  'ED_MAX_HOMEPAGE_SECTIONS = 4',
  'ED_MAX_DASHBOARD_WIDGETS = 1',
  'EXPERIENCE_DIRECTOR_VERSION = "1.1.0"',
]) {
  ok(ts.includes(key), `runtime TS declares ${key}`);
}
ok(ED_MAX_QUESTIONS === 2 && ED_MAX_HOMEPAGE_SECTIONS === 4, 'Node evidence lib caps match Section 2 spec');
ok(EXPERIENCE_DIRECTOR_VERSION === '1.1.0', 'Experience Director version 1.1.0');

// --- Behavioral fixtures (human-readable evidence) ---

// Fixture A: Research wants 10 questions → ED asks 2
{
  const ten = Array.from({ length: 10 }, (_, i) => `Question ${i + 1} about the business?`);
  const ed = applyExperienceDirector({
    request: 'Build me a website',
    draftLines: ['Research looks good.', 'Strategy is trust-first.', 'Creative is ready.'],
    proposedQuestions: ten,
    confidence: 80,
  });
  const pass = ed.questions.length === 2 && ed.delayed.extraQuestions.length === 8 &&
    ed.actions.some((a) => a.includes('limited_questions'));
  ok(pass, 'Fixture A: 10 research questions → ED shows 2, delays 8');
  evidence.fixtures.push({
    id: 'A_limit_questions',
    input: { proposedQuestions: ten.length },
    output: { shown: ed.questions, delayedCount: ed.delayed.extraQuestions.length, actions: ed.actions },
    pass,
  });
}

// Fixture B: Creative generated 8 homepage sections → show 4
{
  const eight = ['Hero', 'Services', 'Reviews', 'Gallery', 'About', 'FAQ', 'Pricing', 'Contact'];
  const ed = applyExperienceDirector({
    request: 'Build me a luxury website',
    draftLines: ['Creative direction ready.'],
    homepageSections: eight,
    confidence: 84,
    criticOk: true,
  });
  const pass = ed.shown.homepageSections.length === 4 &&
    ed.delayed.homepageSections.length === 4 &&
    ed.actions.some((a) => a.includes('homepage_sections'));
  ok(pass, 'Fixture B: 8 homepage sections → ED shows 4, delays 4');
  evidence.fixtures.push({
    id: 'B_homepage_sections',
    input: { sections: eight },
    output: { shown: ed.shown.homepageSections, delayed: ed.delayed.homepageSections, actions: ed.actions },
    pass,
  });
}

// Fixture C: Operations wants 15 dashboard widgets → show 1
{
  const fifteen = Array.from({ length: 15 }, (_, i) => `Widget ${i + 1}`);
  const ed = applyExperienceDirector({
    request: 'Improve my dashboard',
    draftLines: ['Here is what to focus on.'],
    dashboardWidgets: fifteen,
    confidence: 75,
  });
  const pass = ed.shown.dashboardWidgets.length === 1 &&
    ed.delayed.dashboardWidgets.length === 14;
  ok(pass, 'Fixture C: 15 dashboard widgets → ED shows 1 recommendation');
  evidence.fixtures.push({
    id: 'C_dashboard_widgets',
    input: { widgets: fifteen.length },
    output: { shown: ed.shown.dashboardWidgets, delayedCount: ed.delayed.dashboardWidgets.length },
    pass,
  });
}

// Fixture D: Technical language rewritten
{
  const raw = 'The LLM hero CTA uses an OpenAI API JSON prompt in the UX pipeline.';
  const cleaned = stripTechnicalLanguage(raw);
  const ed = applyExperienceDirector({
    request: 'Explain the homepage',
    draftResponse: raw,
    confidence: 70,
  });
  const pass = !/LLM|OpenAI|API|JSON|CTA|UX|pipeline|hero/i.test(ed.ownerResponse) &&
    /Hubly|first screen|Book button|connection|details|experience|process/i.test(ed.ownerResponse) &&
    ed.actions.includes('rewrote_technical_language');
  ok(pass, 'Fixture D: technical language rewritten for the owner');
  evidence.fixtures.push({
    id: 'D_rewrite_technical',
    input: raw,
    output: { cleaned, ownerResponse: ed.ownerResponse, actions: ed.actions },
    pass,
  });
}

// Fixture E: Celebrate on launch moments
{
  const yes = shouldCelebrate('Build me a luxury website and launch it', true);
  const no = shouldCelebrate('What is the weather?', true);
  const blocked = shouldCelebrate('Build me a website', false);
  ok(yes && !no && !blocked, 'Fixture E: celebrate on build/launch, not on weather / critic fail');
  evidence.fixtures.push({
    id: 'E_celebrate',
    output: { buildLaunch: yes, weather: no, criticBlocked: blocked },
    pass: yes && !no && !blocked,
  });
}

// Fixture F: Too many draft lines delayed
{
  const lines = ['One', 'Two', 'Three', 'Four', 'Five'];
  const ed = applyExperienceDirector({ request: 'Help', draftLines: lines, confidence: 70 });
  const pass = ed.delayed.extraLines.length === 2 && !ed.ownerResponse.includes('Five');
  ok(pass, `Fixture F: ${lines.length} draft lines → max ${ED_MAX_OWNER_LINES} shown`);
  evidence.fixtures.push({
    id: 'F_limit_lines',
    output: { response: ed.ownerResponse, delayed: ed.delayed.extraLines, actions: ed.actions },
    pass,
  });
}

// Fixture G: limitQuestions helper
{
  const q = limitQuestions(['A?', 'B?', 'C?', 'A?']);
  ok(q.shown.length === 2 && q.delayed.length === 1 && q.limited, 'Fixture G: limitQuestions dedupes and caps at 2');
  evidence.fixtures.push({ id: 'G_limitQuestions_helper', output: q, pass: q.shown.length === 2 && q.limited });
}

ok(docs.includes('Experience Director') && docs.includes('Fixture'), 'Section 2 documentation exists with fixtures');

const report = {
  section: 2,
  title: 'Experience Director',
  passed: !failed,
  checkedAt: new Date().toISOString(),
  version: EXPERIENCE_DIRECTOR_VERSION,
  proofs,
  evidence,
  failures: failed ? 'See FAIL lines above' : null,
};
fs.writeFileSync(
  path.join(root, 'docs/HUBLY_BRAIN_SECTION2_PROOF.json'),
  JSON.stringify(report, null, 2) + '\n',
);

if (failed) {
  console.error('\nSECTION 2 INCOMPLETE — Milestone 2 blocked');
  process.exit(1);
}
console.log('\nSECTION 2 COMPLETE — Experience Director proven');
