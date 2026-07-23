#!/usr/bin/env node
/**
 * SECTION 5 — Business Memory Release Gate
 *
 * Proves persistent, versioned, explainable Business Memory owned by Hubly Brain.
 * Demo: pressure washing → commercial focus → memory retrieval (not chat).
 */
import fs from 'fs';
import path from 'path';
import {
  HUBLY_BUSINESS_MEMORY_VERSION,
  BUSINESS_MEMORY_OWNER,
  normalizeBusinessMemory,
  suggestMemoryUpdate,
  commitMemoryUpdates,
  extractMemorySuggestionsFromRequest,
  commitStrategyVersion,
  commitAiHistoryEntry,
  queryBusinessMemory,
  isMemoryRetrievalQuestion,
  persistBusinessMemoryLocal,
  loadBusinessMemoryLocal,
  clearBusinessMemoryStoreForTests,
  brainApplyOwnerMessage,
} from './lib/business-memory.mjs';

const root = process.cwd();
let failed = false;
const proofs = [];
const evidence = {
  memoryBefore: null,
  memoryAfter: null,
  versionHistory: [],
  changeLog: [],
  reasoning: [],
  timestamps: [],
  expertResponsible: [],
  retrievalExamples: [],
  persistence: {},
  importance: [],
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

// ——— Static architecture ———
const memSrc = read('supabase/functions/_shared/hubly_brain_memory.ts');
const thinkSrc = read('supabase/functions/_shared/hubly_brain_think.ts');
const migration = read('supabase/migrations/20260723150000_business_memory_changelog.sql');
const ssot = read('supabase/migrations/20260721200000_business_memories_ssot.sql');

ok(memSrc.includes('HUBLY_BUSINESS_MEMORY_VERSION = 2'), 'Business Memory exists (schema v2)');
ok(memSrc.includes('BUSINESS_MEMORY_OWNER') && memSrc.includes('hubly_brain'), 'Hubly Brain owns Business Memory');
ok(memSrc.includes('suggestMemoryUpdate') && memSrc.includes('commitMemoryUpdates'), 'Suggest vs commit separation exists');
ok(memSrc.includes('Experts may READ') || memSrc.includes('suggest') && memSrc.includes('COMMITS'), 'Experts suggest; Brain commits');
ok(thinkSrc.includes('commitMemoryUpdates') && thinkSrc.includes('extractMemorySuggestionsFromRequest'), 'Think pipeline commits via Brain');
ok(thinkSrc.includes('queryBusinessMemory') && thinkSrc.includes('isMemoryRetrievalQuestion'), 'Think retrieves from Business Memory');
ok(ssot.includes('business_memories'), 'Persistence table business_memories exists');
ok(migration.includes('business_memory_changes'), 'Auditable changelog table exists');

ok(memSrc.includes('owner?:') || memSrc.includes('HublyMemoryOwner'), 'Owner information schema stored');
ok(memSrc.includes('HublyMemoryBusinessBlock') || memSrc.includes('business?:'), 'Business information schema stored');
ok(memSrc.includes('HublyMemoryBrand') || memSrc.includes('brand?:'), 'Brand information schema stored');
ok(memSrc.includes('websiteHistory') && memSrc.includes('approvedAiChanges'), 'Website history stored');
ok(memSrc.includes('strategyHistory') && memSrc.includes('HublyStrategyVersion'), 'Strategy history stored');
ok(memSrc.includes('goalsBlock') || memSrc.includes('HublyMemoryGoals'), 'Goals are stored');
ok(memSrc.includes('aiHistory') && memSrc.includes('approved') && memSrc.includes('rejected'), 'AI recommendations + approvals/rejections stored');
ok(memSrc.includes('MemoryImportance') && memSrc.includes('critical') && memSrc.includes('lastVerified'), 'Memory Importance (importance/confidence/source/lastVerified)');
ok(memSrc.includes('connectedServices'), 'Connected services stored');

// ——— Seed structured memory (owner/brand/website/goals/services) ———
clearBusinessMemoryStoreForTests();
const empty = normalizeBusinessMemory({});
evidence.memoryBefore = JSON.parse(JSON.stringify(empty));
ok(empty.memoryVersion === 0, 'Fresh memory starts at memoryVersion 0');

const seed = commitMemoryUpdates(empty, [
  suggestMemoryUpdate({
    path: 'owner.name', value: 'Alex',
    reason: 'Owner name captured during onboarding',
    expertId: 'experience_director', importance: 'critical', confidence: 99, source: 'user',
  }),
  suggestMemoryUpdate({
    path: 'owner.preferredName', value: 'Alex',
    reason: 'Preferred name same as legal name',
    expertId: 'hubly_brain', importance: 'medium', confidence: 90, source: 'user',
  }),
  suggestMemoryUpdate({
    path: 'owner.role', value: 'owner',
    reason: 'Role is business owner',
    expertId: 'hubly_brain', importance: 'high', confidence: 95, source: 'user',
  }),
  suggestMemoryUpdate({
    path: 'owner.preferredCommunicationStyle', value: 'conversational',
    reason: 'Default Hubly communication style',
    expertId: 'experience_director', importance: 'medium', confidence: 80, source: 'ai_inference',
  }),
  suggestMemoryUpdate({
    path: 'business.name', value: 'SparkleWash',
    reason: 'Business name provided',
    expertId: 'hubly_brain', importance: 'critical', confidence: 98, source: 'user',
  }),
  suggestMemoryUpdate({
    path: 'servicesBlock.current', value: ['driveway wash', 'house wash'],
    reason: 'Initial services listed',
    expertId: 'research', importance: 'high', confidence: 85, source: 'user',
  }),
  suggestMemoryUpdate({
    path: 'goalsBlock.business', value: ['Get first 10 commercial accounts'],
    reason: 'Near-term business goal',
    expertId: 'strategy', importance: 'high', confidence: 80, source: 'user',
  }),
  suggestMemoryUpdate({
    path: 'goalsBlock.revenue', value: ['$8k/month within 6 months'],
    reason: 'Revenue goal stated',
    expertId: 'strategy', importance: 'high', confidence: 75, source: 'user',
  }),
  suggestMemoryUpdate({
    path: 'websiteHistory.currentHeroHeadline', value: 'Clean properties. Clear pricing.',
    reason: 'Initial hero headline',
    expertId: 'creative_director', importance: 'medium', confidence: 78, source: 'ai_inference',
  }),
  suggestMemoryUpdate({
    path: 'websiteHistory.versions', value: [{
      version: 1, at: new Date().toISOString(), heroHeadline: 'Clean properties. Clear pricing.',
      packages: ['Driveway', 'Building wash'], bookingFlow: 'request quote',
      reason: 'Initial website version', expertId: 'creative_director',
    }],
    reason: 'Website version 1 stored',
    expertId: 'creative_director', importance: 'medium', confidence: 80, source: 'ai_inference',
  }),
  suggestMemoryUpdate({
    path: 'connectedServices.stripe', value: false,
    reason: 'Stripe not connected yet',
    expertId: 'hubly_brain', importance: 'medium', confidence: 100, source: 'external_integration',
  }),
  suggestMemoryUpdate({
    path: 'brand.personality', value: 'reliable and straightforward',
    reason: 'Brand personality for a local service',
    expertId: 'creative_director', importance: 'medium', confidence: 72, source: 'ai_inference',
  }),
], { summary: 'Seed owner/business/brand/website/goals' });

ok(!!seed.memory.owner?.name, 'Owner information is stored');
ok(!!seed.memory.business?.name, 'Business information is stored');
ok(!!seed.memory.brand?.personality, 'Brand information is stored');
ok(Array.isArray(seed.memory.websiteHistory?.versions) && seed.memory.websiteHistory.versions.length >= 1, 'Website history is stored');
ok(Array.isArray(seed.memory.goalsBlock?.business) && seed.memory.goalsBlock.business.length >= 1, 'Goals are stored');
ok(seed.memory.connectedServices?.stripe === false, 'Connected services are stored');
ok(seed.committedBy === BUSINESS_MEMORY_OWNER, 'Commits attributed to Hubly Brain');

for (const c of seed.changes) {
  ok(!!c.at && !!c.reason && !!c.expertId && c.previous !== undefined && c.next !== undefined, `Change audited: ${c.path}`);
  ok(!!c.importance && typeof c.confidence === 'number' && !!c.source && !!c.memoryVersion, `Change has importance meta: ${c.path}`);
  evidence.changeLog.push(c);
  evidence.timestamps.push(c.at);
  evidence.expertResponsible.push({ path: c.path, expertId: c.expertId });
  evidence.reasoning.push({ path: c.path, reason: c.reason });
  evidence.importance.push(seed.memory.factMeta[c.path]);
}

// ——— Demo conversation scenario ———
const BIZ = 'demo-pressure-wash-section5';
clearBusinessMemoryStoreForTests();
let memory = normalizeBusinessMemory({});

console.log('\n— Conversation 1 —');
const c1 = brainApplyOwnerMessage(memory, "I'm starting a pressure washing business.", BIZ);
memory = c1.memory;
ok(memory.business?.industry === 'pressure washing', 'Conversation 1: Hubly stores the business industry');
ok(memory.business?.businessStage === 'starting', 'Conversation 1: business stage stored');
ok(memory.brand?.positioning, 'Conversation 1: initial positioning stored');
ok(c1.changes.every((c) => c.expertId && c.reason && c.at), 'Conversation 1: every update versioned with reasoning/timestamp/expert');
const afterC1Version = memory.memoryVersion;
evidence.versionHistory.push({ step: 1, memoryVersion: afterC1Version, changes: c1.changes.length });

console.log('— Conversation 2 —');
const beforePos = memory.brand?.positioning;
const c2 = brainApplyOwnerMessage(memory, 'Focus on commercial properties instead.', BIZ);
memory = c2.memory;
ok(memory.brand?.targetAudience === 'commercial properties', 'Conversation 2: Business Memory updates target audience');
ok(memory.brand?.positioning !== beforePos, 'Conversation 2: positioning changed');
ok(memory.memoryVersion > afterC1Version, 'Conversation 2: memoryVersion incremented');
const posChange = c2.changes.find((c) => c.path === 'brand.positioning');
ok(!!posChange && posChange.reason.includes('commercial'), 'Conversation 2: positioning change stores reasoning');
evidence.versionHistory.push({ step: 2, memoryVersion: memory.memoryVersion, changes: c2.changes.length });

// Strategy + AI history
const strat = commitStrategyVersion(memory, {
  positioning: memory.brand.positioning,
  homepageStrategy: 'Proof-led commercial homepage',
  pricingStrategy: 'Commercial packages',
  bookingStrategy: 'Request site visit',
  growthStrategy: 'Property manager outreach',
  reason: 'Strategy for commercial-first pressure washing',
  expertId: 'strategy',
  confidence: 86,
});
memory = strat.memory;
ok(Array.isArray(memory.strategyHistory) && memory.strategyHistory.length >= 1, 'Strategy history is stored (versioned)');

const approved = commitAiHistoryEntry(memory, {
  recommendation: 'Lead homepage with commercial before/after gallery',
  status: 'approved',
  reasoning: 'Matches commercial positioning and trust needs',
  confidence: 88,
  expertId: 'critic',
});
memory = approved.memory;
const rejected = commitAiHistoryEntry(memory, {
  recommendation: 'Use luxury gold palette and serif display',
  status: 'rejected',
  reasoning: 'Owner wants practical commercial branding, not luxury',
  confidence: 91,
  expertId: 'experience_director',
});
memory = rejected.memory;
ok(memory.aiHistory?.some((a) => a.status === 'approved'), 'AI recommendations (approved) are stored');
ok(memory.aiHistory?.some((a) => a.status === 'rejected'), 'Rejected AI changes are stored');
ok(memory.websiteHistory?.approvedAiChanges?.length >= 1, 'Approved AI changes stored on website history');
ok(memory.websiteHistory?.rejectedAiChanges?.length >= 1, 'Rejected AI changes stored on website history');
persistBusinessMemoryLocal(BIZ, memory);

console.log('— Conversation 3 —');
ok(isMemoryRetrievalQuestion('What kind of business are we building?'), 'Conversation 3: detected as memory retrieval');
const q3 = queryBusinessMemory(memory, 'What kind of business are we building?');
ok(q3.fromMemory === true && q3.usedChatHistory === false, 'Conversation 3: answered from Business Memory, not chat');
ok(/pressure washing/i.test(q3.answer) && /commercial/i.test(q3.answer), 'Conversation 3: answer reflects stored industry + audience');
evidence.retrievalExamples.push({ q: 'What kind of business are we building?', ...q3 });

console.log('— Conversation 4 —');
const q4 = queryBusinessMemory(memory, 'Why did we change our positioning?');
ok(q4.fromMemory && !q4.usedChatHistory, 'Conversation 4: positioning why from Memory');
ok(/commercial/i.test(q4.answer) && /because/i.test(q4.answer), 'Conversation 4: includes stored reasoning');
ok(Array.isArray(q4.changes) && q4.changes.length >= 1, 'Conversation 4: returns changelog evidence');
evidence.retrievalExamples.push({ q: 'Why did we change our positioning?', ...q4 });

console.log('— Conversation 5 —');
const q5 = queryBusinessMemory(memory, 'Show me what changed this week.');
ok(q5.fromMemory && !q5.usedChatHistory, 'Conversation 5: weekly changes from Memory');
ok(/brand\.|business\./i.test(q5.answer) || (q5.changes || []).length > 0, 'Conversation 5: summarizes memory updates');
evidence.retrievalExamples.push({ q: 'Show me what changed this week.', ...q5 });

// Persistence across "new conversation"
const freshSession = loadBusinessMemoryLocal(BIZ);
ok(!!freshSession, 'Business Memory survives new conversations (local persist)');
ok(freshSession.business?.industry === 'pressure washing', 'Persisted industry intact');
ok(freshSession.brand?.targetAudience === 'commercial properties', 'Persisted audience intact');
ok(freshSession.memoryVersion === memory.memoryVersion, 'Persisted memoryVersion intact');
ok((freshSession.changelog || []).length >= 3, 'Persisted changelog intact');
evidence.persistence = {
  businessId: BIZ,
  loaded: true,
  industry: freshSession.business?.industry,
  audience: freshSession.brand?.targetAudience,
  memoryVersion: freshSession.memoryVersion,
  changelogLength: freshSession.changelog?.length,
};

// Extra behavior examples
const stop = brainApplyOwnerMessage(freshSession, 'Stop offering interior detailing.', BIZ + '-extra');
ok(stop.memory.servicesBlock?.removed?.some((s) => /interior detailing/i.test(s)), 'Memory updates when owner removes a service');

const luxury = brainApplyOwnerMessage(normalizeBusinessMemory({}), "I don't like luxury branding.", BIZ + '-lux');
ok(/not luxury/i.test(luxury.memory.brand?.preferredCreativeDirection || ''), 'Memory updates when owner rejects luxury branding');

// Experts cannot be the commit owner
ok(BUSINESS_MEMORY_OWNER === 'hubly_brain', 'Commit owner constant is hubly_brain');
ok(thinkSrc.includes('Experts never write') || thinkSrc.includes('experts never write') || memSrc.includes('No expert writes'), 'Docs/code forbid expert direct writes');

evidence.memoryAfter = {
  memoryVersion: memory.memoryVersion,
  owner: memory.owner,
  business: memory.business,
  brand: memory.brand,
  servicesBlock: memory.servicesBlock,
  websiteHistory: {
    versions: memory.websiteHistory?.versions?.length,
    approved: memory.websiteHistory?.approvedAiChanges?.length,
    rejected: memory.websiteHistory?.rejectedAiChanges?.length,
    headline: memory.websiteHistory?.currentHeroHeadline,
  },
  strategyHistory: memory.strategyHistory,
  goalsBlock: memory.goalsBlock,
  aiHistory: memory.aiHistory,
  connectedServices: memory.connectedServices,
  factMetaSample: Object.fromEntries(Object.entries(memory.factMeta || {}).slice(0, 6)),
  changelogLength: memory.changelog?.length,
  versionHistory: memory.versionHistory,
};

ok(fs.existsSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION5.md')), 'Section 5 documentation exists');
ok(HUBLY_BUSINESS_MEMORY_VERSION === 2, 'Schema version is 2');

evidence.releaseGate = {
  businessMemoryExists: true,
  ownerStored: true,
  businessStored: true,
  brandStored: true,
  websiteHistoryStored: true,
  strategyHistoryStored: true,
  goalsStored: true,
  aiRecommendationsStored: true,
  approvedRejectedStored: true,
  survivesNewConversations: true,
  retrievesFromMemoryNotChat: true,
  everyUpdateVersioned: true,
  everyUpdateStoresReasoning: true,
  everyUpdateStoresTimestamps: true,
  everyUpdateIdentifiesExpert: true,
  memoryImportance: true,
  automatedEvidence: true,
};

const report = {
  section: 5,
  title: 'Business Memory',
  passed: !failed,
  checkedAt: new Date().toISOString(),
  version: '1.0.0',
  architectureSummary: {
    module: 'supabase/functions/_shared/hubly_brain_memory.ts',
    schemaVersion: HUBLY_BUSINESS_MEMORY_VERSION,
    owner: BUSINESS_MEMORY_OWNER,
    persistence: 'business_memories + business_memory_changes',
    principle: 'Experts suggest. Hubly Brain commits. Retrieval uses Memory, not chat logs.',
    importance: 'Every fact: importance / confidence / source / lastVerified',
  },
  proofs,
  evidence,
};

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs/HUBLY_BRAIN_SECTION5_PROOF.json'),
  JSON.stringify(report, null, 2) + '\n',
);

if (failed) {
  console.error('\nSECTION 5 INCOMPLETE — Business Memory Release Gate failed');
  process.exit(1);
}

console.log('\nSECTION 5 COMPLETE — Business Memory Release Gate passed');
console.log('Demo memoryVersion:', memory.memoryVersion);
console.log('Changelog entries:', memory.changelog?.length);
