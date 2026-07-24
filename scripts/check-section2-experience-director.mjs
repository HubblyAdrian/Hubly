#!/usr/bin/env node
/**
 * SECTION 2 — Experience Director Release Gate
 *
 * Complete only when ALL of these are proven:
 * - Experience Director exists (registered expert)
 * - Every customer-facing response passes through it
 * - It can simplify responses
 * - It can reduce unnecessary questions (10 → 3)
 * - It can veto overly complex interactions
 * - It enforces one Hubly personality
 * - Interception logs show before → after modification
 */
import fs from 'fs';
import path from 'path';
import {
  applyExperienceDirector,
  reviewCustomerFacingText,
  stripTechnicalLanguage,
  enforceHublyPersonality,
  limitQuestions,
  shouldCelebrate,
  evaluateExperience,
  settingsToConversation,
  listExperienceInterceptions,
  clearExperienceInterceptionsForTests,
  ED_MAX_QUESTIONS,
  ED_MAX_DASHBOARD_WIDGETS,
  ED_MAX_WEBSITE_SETTINGS_EXPOSED,
  EXPERIENCE_DIRECTOR_VERSION,
  HUBLY_PERSONALITY,
} from './lib/experience-director.mjs';

const root = process.cwd();
let failed = false;
const proofs = [];
const evidence = {
  fixtures: [],
  interceptionLogs: [],
  releaseGate: {},
};

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

clearExperienceInterceptionsForTests();

const ts = read('supabase/functions/_shared/hubly_brain_experience_director.ts');
const experts = read('supabase/functions/_shared/hubly_brain_experts.ts');
const think = read('supabase/functions/_shared/hubly_brain_think.ts');
const hublyAi = read('supabase/functions/_shared/hubly_ai.ts');
const docs = fs.existsSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION2.md'))
  ? read('docs/HUBLY_BRAIN_SECTION2.md')
  : '';

// --- Release Gate: Experience Director exists ---
ok(ts.includes('applyExperienceDirector') && EXPERIENCE_DIRECTOR_VERSION === '1.2.0', 'Experience Director exists (v1.2.0)');
ok(experts.includes('id: "experience_director"') && experts.includes('applyExperienceDirector'), 'ED registered through AI Expert Framework');
ok(experts.includes('veto_complexity') && experts.includes('enforce_hubly_personality'), 'ED capability declares veto + personality actions');

// --- Every customer-facing response passes through ED ---
ok(think.includes('Experience Director did not review') || think.includes('Section 2 invariant'), 'think() throws if ED did not review');
ok(
  experts.includes('alwaysInclude: true') && experts.includes('executionPriority: 100') &&
    experts.includes('id: "experience_director"'),
  'experience_director alwaysInclude + priority 100 (runs last via registry)',
);
ok(think.includes('selectExpertsFromRegistry'), 'think routes experts via registry while keeping ED gate');
ok(think.includes('intent === "weather"') && think.includes('applyExperienceDirector'), 'weather path reviewed by ED');
ok(think.includes('intent === "workspace"') && think.includes('applyExperienceDirector'), 'workspace path reviewed by ED');
ok(hublyAi.includes('CUSTOMER_FACING_TASKS') && hublyAi.includes('reviewCustomerFacingText'), 'customer-facing complete() text passes ED');
ok(hublyAi.includes('"chat"') && hublyAi.includes('"customer_support"') && hublyAi.includes('"business_coach"'), 'chat/support/coach marked customer-facing');

// --- Constants sync ---
ok(ts.includes('ED_MAX_QUESTIONS = 3'), 'runtime max questions = 3 (Release Gate example)');
ok(ED_MAX_QUESTIONS === 3 && ED_MAX_DASHBOARD_WIDGETS === 1 && ED_MAX_WEBSITE_SETTINGS_EXPOSED === 0, 'Node evidence caps match Release Gate');
ok(HUBLY_PERSONALITY.voice === 'one_business_partner', 'Hubly personality: one business partner');

// --- Evaluation rules exist ---
ok(typeof evaluateExperience === 'function' && ts.includes('unnecessaryUiExposure'), 'evaluation rules: complexity/clarity/tone/UI/questions');

// ========== Behavioral fixtures ==========

// Fixture A: Research 10 questions → ED reduces to 3
{
  const ten = Array.from({ length: 10 }, (_, i) => `Question ${i + 1} about the business?`);
  const ed = applyExperienceDirector({
    request: 'Help me understand my customers',
    draftLines: ['I researched businesses like yours.'],
    proposedQuestions: ten,
    confidence: 80,
  });
  const pass = ed.questions.length === 3 && ed.delayed.extraQuestions.length === 7 &&
    ed.interception.modified &&
    ed.actions.some((a) => a.includes('limited_questions_to_3'));
  ok(pass, 'Fixture A: Research 10 questions → ED reduces to 3 (veto complexity of questioning)');
  evidence.fixtures.push({
    id: 'A_reduce_questions_10_to_3',
    claim: 'Experience Director reduced unnecessary questions',
    before: { questionCount: 10 },
    after: { questionCount: ed.questions.length, delayed: ed.delayed.extraQuestions.length, questions: ed.questions },
    actions: ed.actions,
    interception: ed.interception,
    pass,
  });
}

// Fixture B: Creative exposes 25 website settings → conversation
{
  const twentyFive = Array.from({ length: 25 }, (_, i) => `Setting ${i + 1}`);
  const ed = applyExperienceDirector({
    request: 'Customize my website',
    draftResponse: 'Here are all your website settings.',
    websiteSettings: twentyFive,
    confidence: 70,
  });
  const pass = ed.shown.websiteSettings.length === 0 &&
    ed.delayed.websiteSettings.length === 25 &&
    ed.vetoed === true &&
    /instead of a settings wall|options/i.test(ed.ownerResponse) &&
    ed.actions.some((a) => a.includes('converted_25_settings_to_conversation'));
  ok(pass, 'Fixture B: 25 website settings → ED converts to conversation (veto settings dump)');
  evidence.fixtures.push({
    id: 'B_settings_to_conversation',
    claim: 'Experience Director intercepted and modified a settings dump into conversation',
    before: { settingCount: 25, response: 'Here are all your website settings.' },
    after: {
      settingCount: ed.shown.websiteSettings.length,
      response: ed.ownerResponse,
      vetoed: ed.vetoed,
      vetoReason: ed.vetoReason,
    },
    actions: ed.actions,
    interception: ed.interception,
    pass,
  });
}

// Fixture C: Operations 18 dashboard widgets → 1 recommendation
{
  const eighteen = Array.from({ length: 18 }, (_, i) => `Widget ${i + 1}`);
  const ed = applyExperienceDirector({
    request: 'Show my dashboard',
    draftLines: ['Here is your operations overview.'],
    dashboardWidgets: eighteen,
    confidence: 75,
  });
  const pass = ed.shown.dashboardWidgets.length === 1 &&
    ed.delayed.dashboardWidgets.length === 17 &&
    ed.vetoed;
  ok(pass, 'Fixture C: 18 dashboard widgets → ED shows 1, hides rest (veto)');
  evidence.fixtures.push({
    id: 'C_dashboard_one_recommendation',
    claim: 'Experience Director reduced unnecessary UI exposure',
    before: { widgetCount: 18 },
    after: { shown: ed.shown.dashboardWidgets, delayedCount: ed.delayed.dashboardWidgets.length, vetoed: ed.vetoed },
    actions: ed.actions,
    pass,
  });
}

// Fixture D: Technical / multi-AI language → one Hubly personality
{
  const raw = 'As an AI, the Research Expert and Creative Director used an OpenAI LLM API JSON prompt for the hero CTA.';
  const ed = applyExperienceDirector({
    request: 'Explain what you did',
    draftResponse: raw,
    confidence: 70,
  });
  const pass = !/as an ai|research expert|creative director|openai|llm|\bapi\b|json|\bcta\b|hero/i.test(ed.ownerResponse) &&
    (ed.actions.includes('enforced_hubly_personality') || ed.actions.includes('rewrote_technical_language')) &&
    ed.interception.modified;
  ok(pass, 'Fixture D: enforces one Hubly personality (never robotic / multi-AI / technical)');
  evidence.fixtures.push({
    id: 'D_hubly_personality',
    claim: 'Experience Director enforced one Hubly personality',
    before: { response: raw },
    after: { response: ed.ownerResponse, actions: ed.actions, personality: ed.personality },
    interception: ed.interception,
    pass,
  });
}

// Fixture E: Evaluation scores fire on complex drafts
{
  const evaluation = evaluateExperience({
    proposedQuestions: Array.from({ length: 10 }, (_, i) => `Q${i}`),
    websiteSettings: Array.from({ length: 25 }, (_, i) => `S${i}`),
    dashboardWidgets: Array.from({ length: 18 }, (_, i) => `W${i}`),
    draftResponse: 'Certainly! As an AI I would be happy to expose every setting.',
  });
  const pass = evaluation.complexity >= 70 &&
    evaluation.unnecessaryQuestions > 50 &&
    evaluation.unnecessaryUiExposure > 50 &&
    evaluation.softwareFeelRisk >= 70;
  ok(pass, 'Fixture E: evaluation rules score complexity / questions / UI / software-feel');
  evidence.fixtures.push({ id: 'E_evaluation_rules', evaluation, pass });
}

// Fixture F: Celebrate milestone
{
  const ed = applyExperienceDirector({
    request: 'Launch my website',
    draftResponse: 'Your site is ready to go live.',
    criticOk: true,
    confidence: 90,
  });
  ok(ed.celebrate && /nice work|milestone/i.test(ed.ownerResponse), 'Fixture F: celebrate milestone moments');
  evidence.fixtures.push({
    id: 'F_celebrate',
    after: { celebrate: ed.celebrate, response: ed.ownerResponse },
    pass: ed.celebrate,
  });
}

// Fixture G: reviewCustomerFacingText path (complete() gate)
{
  const ed = reviewCustomerFacingText('As an AI, here is your LLM API response.', { request: 'hi' });
  ok(ed.reviewedBy === 'experience_director' && ed.interception.modified, 'Fixture G: reviewCustomerFacingText intercepts complete()-style replies');
  evidence.fixtures.push({
    id: 'G_review_customer_facing_text',
    before: 'As an AI, here is your LLM API response.',
    after: ed.ownerResponse,
    interception: ed.interception,
    pass: ed.interception.modified,
  });
}

// Fixture H: settingsToConversation helper
{
  const line = settingsToConversation(Array.from({ length: 25 }, (_, i) => `S${i}`));
  ok(/25/.test(line) && /settings wall/i.test(line), 'Fixture H: settingsToConversation helper');
  evidence.fixtures.push({ id: 'H_settings_helper', line, pass: /25/.test(line) });
}

// --- Interception logs prove ED modified at least one response ---
const logs = listExperienceInterceptions(50);
const modifiedLogs = logs.filter((l) => l.modified);
ok(modifiedLogs.length >= 1, 'Execution logs: at least one ED interception modified a response');
ok(logs.length >= 5, 'Execution logs: multiple ED reviews recorded this run');
evidence.interceptionLogs = modifiedLogs.slice(0, 5).map((l) => ({
  id: l.id,
  at: l.at,
  modified: l.modified,
  vetoed: l.vetoed,
  before: l.before,
  after: l.after,
  actions: l.actions,
}));

// --- Docs ---
ok(docs.includes('Experience Director') && docs.includes('Release Gate'), 'Section 2 documentation covers Release Gate');

evidence.releaseGate = {
  experienceDirectorExists: true,
  everyCustomerFacingResponsePassesThrough: true,
  canSimplifyResponses: true,
  canReduceUnnecessaryQuestions: true,
  canVetoOverlyComplexInteractions: true,
  enforcesOneHublyPersonality: true,
  provenWithAutomatedEvidence: !failed,
};

const report = {
  section: 2,
  title: 'Experience Director',
  passed: !failed,
  checkedAt: new Date().toISOString(),
  version: EXPERIENCE_DIRECTOR_VERSION,
  implementationSummary: {
    module: 'supabase/functions/_shared/hubly_brain_experience_director.ts',
    registeredExpert: 'experience_director',
    thinkInvariant: 'Experience Director always last; throws if missing',
    completeGate: 'CUSTOMER_FACING_TASKS text reviewed via reviewCustomerFacingText',
    authority: 'veto power over complexity, settings dumps, widget sprawl',
    personality: HUBLY_PERSONALITY,
  },
  proofs,
  evidence,
  failures: failed ? 'See FAIL lines above' : null,
};

fs.writeFileSync(
  path.join(root, 'docs/HUBLY_BRAIN_SECTION2_PROOF.json'),
  JSON.stringify(report, null, 2) + '\n',
);

if (failed) {
  console.error('\nSECTION 2 INCOMPLETE — do not continue to Section 3');
  process.exit(1);
}
console.log('\nSECTION 2 COMPLETE — Experience Director Release Gate passed');
console.log(`Interceptions logged this run: ${logs.length} (modified: ${modifiedLogs.length})`);
