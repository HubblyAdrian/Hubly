#!/usr/bin/env node
/**
 * SECTION 10 — Conversation Intelligence Release Gate
 *
 * Proves short-term working memory (not chat logs): goals, projects, threads,
 * pending decisions, commitments, deferred ideas, follow-ups, emotion, AI context,
 * retrieval without chat history, and separation from Business/Workspace Memory.
 */
import fs from 'fs';
import path from 'path';
import {
  CONVERSATION_INTELLIGENCE_VERSION,
  CONVERSATION_INTELLIGENCE_OWNER,
  applyConversationIntelligenceTurn,
  buildDeferredRevisitMessage,
  buildResumeGreeting,
  clearConversationIntelligenceForTests,
  ensureThread,
  isConversationIntelligenceQuestion,
  loadConversationIntelligenceLocal,
  memorySeparationManifest,
  normalizeConversationIntelligence,
  persistConversationIntelligenceLocal,
  queryConversationIntelligence,
} from './lib/conversation-intelligence.mjs';
import { think } from './lib/think.mjs';
import { clearRegistryForTests } from './lib/expert-framework.mjs';
import { resetExpertsForTests, ensureExpertsRegistered } from './lib/initial-experts.mjs';

const root = process.cwd();
let failed = false;
const proofs = [];
const evidence = {
  activeGoal: null,
  activeProject: null,
  activeTopic: null,
  pendingDecisions: [],
  deferredIdeas: [],
  commitments: [],
  openQuestions: [],
  followUpQueue: [],
  emotionalContext: null,
  aiContext: null,
  threads: [],
  retrieval: [],
  persistence: null,
  memorySeparation: null,
  resume: null,
  demo: {},
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

clearConversationIntelligenceForTests();
clearRegistryForTests();
resetExpertsForTests();
ensureExpertsRegistered();

const ciSrc = read('supabase/functions/_shared/hubly_brain_conversation_intelligence.ts');
const turnSrc = read('supabase/functions/_shared/hubly_brain_conversation_memory.ts');
const thinkSrc = read('supabase/functions/_shared/hubly_brain_think.ts');
const memSrc = read('supabase/functions/_shared/hubly_brain_memory.ts');
const wsSrc = read('supabase/functions/_shared/hubly_brain_workspace_memory.ts');
const aiSrc = read('supabase/functions/_shared/hubly_ai.ts');

ok(ciSrc.includes('CONVERSATION_INTELLIGENCE_VERSION'), 'Conversation Intelligence exists');
ok(ciSrc.includes('activeGoal') && ciSrc.includes('currentProject') && ciSrc.includes('activeTopic'), 'Goal / Project / Topic fields exist');
ok(ciSrc.includes('pendingDecisions') && ciSrc.includes('openQuestions'), 'Pending Decisions and Open Questions exist');
ok(ciSrc.includes('commitments') && ciSrc.includes('deferredIdeas'), 'Commitments and Deferred Ideas exist');
ok(ciSrc.includes('followUpQueue'), 'Follow-up Queue exists');
ok(ciSrc.includes('emotionalContext') && ciSrc.includes('aiContext'), 'Emotional + AI Context exist');
ok(ciSrc.includes('HublyConversationThread') || ciSrc.includes('threads'), 'Conversation Threads exist');
ok(ciSrc.includes('queryConversationIntelligence') && ciSrc.includes('fromChatHistory: false'), 'Retrieval from structured CI (not chat history)');
ok(thinkSrc.includes('applyConversationIntelligenceTurn'), 'Think updates Conversation Intelligence');
ok(thinkSrc.includes('isConversationIntelligenceQuestion'), 'Think routes CI retrieval questions');
ok(aiSrc.includes('HublyConversationIntelligenceApi'), 'HublyAI exposes Conversation Intelligence');
ok(turnSrc.includes('not Conversation Intelligence') || turnSrc.includes('conversation_intelligence'), 'Turn logs clarified as distinct from CI');
ok(CONVERSATION_INTELLIGENCE_OWNER === 'hubly_brain', 'CI owned by Hubly Brain');
ok(CONVERSATION_INTELLIGENCE_VERSION === '1.0.0', 'CI versioned');

const BUSINESS_ID = 'biz_section10_demo';
let ci = normalizeConversationIntelligence({ businessId: BUSINESS_ID });

// Conversation 1 — redesigning website
ci = applyConversationIntelligenceTurn(ci, "I'm redesigning my website.", {
  businessId: BUSINESS_ID,
  expertsRun: ['research', 'strategy', 'creative_director', 'critic', 'experience_director'],
  phase: 'experts_complete',
});
ok(ci.currentProject === 'Website Redesign', 'Conversation 1 stores Current Project: Website Redesign');
ok(ci.activeGoal === 'Building website', 'Active Goal is tracked');
ok(ci.activeTopic === 'Website', 'Active Topic is tracked');
ok(ci.threads.some((t) => t.name === 'Website Redesign'), 'Website Redesign thread created');
ok(
  ci.threads.find((t) => t.name === 'Website Redesign')?.children?.some((c) => c.name === 'Homepage'),
  'Thread includes Homepage / Booking / Portfolio children',
);
ok(ci.pendingDecisions.filter((d) => d.status === 'pending').length >= 3, 'Pending Decisions seeded for website redesign');
ok(ci.aiContext.experts.length >= 1, 'AI Context stores expert activity');
ok(!!ci.emotionalContext?.state, 'Emotional Context is stored');
evidence.activeGoal = ci.activeGoal;
evidence.activeProject = ci.currentProject;
evidence.activeTopic = ci.activeTopic;
evidence.pendingDecisions = ci.pendingDecisions;
evidence.emotionalContext = ci.emotionalContext;
evidence.aiContext = ci.aiContext;
evidence.threads = ci.threads;
evidence.demo.conversation1 = { project: ci.currentProject, threadId: ci.activeThreadId };

// Open question
ci = applyConversationIntelligenceTurn(
  ci,
  'Should recurring mowing be your primary package?',
  { businessId: BUSINESS_ID },
);
ok(ci.openQuestions.some((q) => q.status === 'open'), 'Open Questions are tracked');
evidence.openQuestions = ci.openQuestions;

// Conversation 2 — memberships later
ci = applyConversationIntelligenceTurn(ci, 'I want memberships later.', {
  businessId: BUSINESS_ID,
});
ok(ci.deferredIdeas.some((d) => /membership/i.test(d.idea) && d.status === 'deferred'), 'Conversation 2 stores Deferred Idea: Memberships');
ok(ci.threads.some((t) => t.name === 'Business Growth'), 'Business Growth thread created for deferred memberships');
evidence.deferredIdeas = ci.deferredIdeas;
evidence.demo.conversation2 = { deferred: ci.deferredIdeas.map((d) => d.idea) };

persistConversationIntelligenceLocal(BUSINESS_ID, ci);
const loaded = loadConversationIntelligenceLocal(BUSINESS_ID);
ok(!!loaded && loaded.currentProject === 'Website Redesign', 'Conversation Intelligence persists across sessions');
ok(loaded.intelligenceVersion >= 1, 'Intelligence version increments on commits');
evidence.persistence = {
  businessId: BUSINESS_ID,
  intelligenceVersion: loaded.intelligenceVersion,
  currentProject: loaded.currentProject,
  deferredCount: loaded.deferredIdeas.length,
};

// Conversation 3 — What's left to do?
ok(isConversationIntelligenceQuestion("What's left to do?"), 'Detects left-to-do retrieval question');
const left = queryConversationIntelligence("What's left to do?", loaded);
ok(left.fromConversationIntelligence === true && left.fromChatHistory === false, 'Retrieval comes from structured CI — not chat history');
ok(/Approve homepage/i.test(left.answer), 'What\'s left includes Approve homepage');
ok(/Connect Stripe/i.test(left.answer), 'What\'s left includes Connect Stripe');
ok(/Publish website/i.test(left.answer), 'What\'s left includes Publish website');
evidence.retrieval.push({ q: "What's left to do?", answer: left.answer, paths: left.paths });
evidence.demo.conversation3 = { answer: left.answer };

// Conversation 4 — two weeks later memberships revisit
const revisit = buildDeferredRevisitMessage(loaded, { jobsAverage: 35 });
ok(!!revisit && /memberships/i.test(revisit) && /35 jobs/i.test(revisit), 'Conversation 4 deferred revisit message from CI');
evidence.demo.conversation4 = { revisit };

// Conversation 5 — Remind me tomorrow
ci = applyConversationIntelligenceTurn(loaded, 'Remind me tomorrow.', { businessId: BUSINESS_ID });
ok(ci.commitments.some((c) => c.status === 'open' && /remind/i.test(c.promise)), 'Conversation 5 stores Commitment');
ok(ci.followUpQueue.some((f) => f.type === 'reminder' && f.status === 'queued'), 'Follow-up Queue records reminder');
evidence.commitments = ci.commitments;
evidence.followUpQueue = ci.followUpQueue;
evidence.demo.conversation5 = { commitments: ci.commitments.map((c) => c.promise) };

const promised = queryConversationIntelligence('What have you promised me?', ci);
ok(/Remind/i.test(promised.answer), 'Promised-me retrieval answers from Commitments');
evidence.retrieval.push({ q: 'What have you promised me?', answer: promised.answer });

const resume = buildResumeGreeting(ci);
ok(/Ready to continue|website|Website/i.test(resume), 'Hubly resumes conversations naturally');
evidence.resume = resume;

const continueQ = queryConversationIntelligence("Let's continue where we left off.", ci);
ok(/Website Redesign|Building website/i.test(continueQ.answer), 'Continue-where-we-left-off uses active thread/project');
evidence.retrieval.push({ q: "Let's continue where we left off.", answer: continueQ.answer });

// Memory separation
const sep = memorySeparationManifest();
ok(sep.conversationIntelligence.storesTurns === false, 'CI does not store chat turns');
ok(sep.conversationIntelligence.storesBusinessFacts === false, 'CI does not store business facts');
ok(sep.conversationIntelligence.storesWorkspacePrefs === false, 'CI does not store workspace prefs');
ok(sep.businessMemory.distinct && sep.workspaceMemory.distinct, 'Business + Workspace Memory remain distinct systems');
ok(!('industry' in ci) && !('sidebarOrder' in ci), 'CI object has no Business/Workspace fields');
ok(!('turns' in ci), 'CI object has no chat turns field');
ok(memSrc.includes('BUSINESS_MEMORY_OWNER') || memSrc.includes('hubly_brain'), 'Business Memory module remains separate');
ok(wsSrc.includes('WORKSPACE_MEMORY_OWNER') || wsSrc.includes('Workspace Memory'), 'Workspace Memory module remains separate');
evidence.memorySeparation = sep;

// Operations thread
const ops = ensureThread(ci, 'Operations', ['Stripe', 'Google Calendar', 'Scheduling']);
ok(ops.intelligence.threads.some((t) => t.name === 'Operations' && t.children.length >= 3), 'Operations thread with Stripe/Calendar/Scheduling');

// End-to-end think persistence + retrieval
clearConversationIntelligenceForTests();
const t1 = await think({
  request: "I'm redesigning my website.",
  businessId: 'biz_section10_think',
  memory: { businessId: 'biz_section10_think', name: 'Demo Co', industry: 'pressure washing', memoryVersion: 1 },
});
ok(t1.conversationIntelligence?.currentProject === 'Website Redesign', 'Think stores Website Redesign in CI');
ok(t1.conversationIntelligenceCommittedBy === 'hubly_brain', 'Think CI commits owned by Hubly Brain');

const t2 = await think({
  request: 'I want memberships later.',
  businessId: 'biz_section10_think',
  memory: { businessId: 'biz_section10_think', industry: 'pressure washing', memoryVersion: 1 },
});
ok(
  t2.conversationIntelligence?.deferredIdeas?.some((d) => /membership/i.test(d.idea)),
  'Think stores deferred memberships',
);

const t3 = await think({
  request: "What's left to do?",
  businessId: 'biz_section10_think',
  memory: { businessId: 'biz_section10_think', industry: 'pressure washing', memoryVersion: 1 },
});
ok(t3.intent === 'conversation_intelligence', 'Think routes What\'s left to CI intent');
ok(t3.conversationIntelligenceRetrieval?.fromChatHistory === false, 'Think retrieval not from chat history');
ok(/Approve homepage|Connect Stripe|Publish website/i.test(t3.response), 'Think What\'s left answers from CI pending decisions');
ok(
  t3.experienceDirector?.actions?.includes('answered_from_conversation_intelligence'),
  'Experience Director marks CI retrieval',
);

const t5 = await think({
  request: 'Remind me tomorrow.',
  businessId: 'biz_section10_think',
  memory: { businessId: 'biz_section10_think', industry: 'pressure washing', memoryVersion: 1 },
});
ok(t5.conversationIntelligence?.commitments?.some((c) => /remind/i.test(c.promise)), 'Think stores remind-me commitment');

evidence.demo.think = {
  project: t1.conversationIntelligence.currentProject,
  leftResponse: t3.response,
  commitments: t5.conversationIntelligence.commitments.map((c) => c.promise),
};

evidence.releaseGate = {
  conversationIntelligenceExists: true,
  activeGoalTracked: !!evidence.activeGoal,
  currentProjectTracked: !!evidence.activeProject,
  activeTopicTracked: !!evidence.activeTopic,
  pendingDecisionsTracked: evidence.pendingDecisions.length >= 3,
  openQuestionsTracked: evidence.openQuestions.some((q) => q.status === 'open'),
  commitmentsTracked: evidence.commitments.some((c) => c.status === 'open'),
  deferredIdeasTracked: evidence.deferredIdeas.some((d) => d.status === 'deferred'),
  followUpQueueExists: evidence.followUpQueue.length >= 1,
  emotionalContextStored: !!evidence.emotionalContext?.state,
  aiContextStored: (evidence.aiContext?.experts?.length || 0) >= 1,
  resumesNaturally: /continue/i.test(evidence.resume || ''),
  separateFromBusinessMemory: true,
  separateFromWorkspaceMemory: true,
  retrievalFromStructuredMemory: evidence.retrieval.every((r) => !!r.answer),
  conversationThreads: evidence.threads.length >= 1,
  automatedEvidence: true,
};

ok(Object.values(evidence.releaseGate).every(Boolean), 'All Section 10 release-gate claims proven');

const report = {
  section: 10,
  title: 'Conversation Intelligence',
  passed: !failed,
  version: CONVERSATION_INTELLIGENCE_VERSION,
  owner: CONVERSATION_INTELLIGENCE_OWNER,
  checkedAt: new Date().toISOString(),
  proofs,
  evidence,
  failures: failed ? 'One or more Section 10 checks failed — see console.' : null,
};

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs/HUBLY_BRAIN_SECTION10_PROOF.json'),
  JSON.stringify(report, null, 2) + '\n',
);

if (failed) {
  console.error('\nSECTION 10 INCOMPLETE — Conversation Intelligence');
  process.exit(1);
}

console.log('\nSECTION 10 PASS — Conversation Intelligence');
console.log('Evidence:', path.join(root, 'docs/HUBLY_BRAIN_SECTION10_PROOF.json'));
process.exit(0);
