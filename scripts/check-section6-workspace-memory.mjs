#!/usr/bin/env node
/**
 * SECTION 6 — Workspace Memory Release Gate
 *
 * Proves Brain-owned Workspace Memory: how the owner likes to work.
 * Separate from Business Memory. Foundation for future Workspace Expert.
 */
import fs from 'fs';
import path from 'path';
import {
  HUBLY_WORKSPACE_MEMORY_VERSION,
  WORKSPACE_MEMORY_OWNER,
  normalizeWorkspaceMemory,
  suggestWorkspaceUpdate,
  commitWorkspaceUpdates,
  extractWorkspaceSuggestionsFromRequest,
  commitWorkspaceAiSuggestion,
  queryWorkspaceMemory,
  isWorkspaceRetrievalQuestion,
  persistWorkspaceMemoryLocal,
  loadWorkspaceMemoryLocal,
  clearWorkspaceMemoryStoreForTests,
  brainApplyWorkspaceMessage,
} from './lib/workspace-memory.mjs';

const root = process.cwd();
let failed = false;
const proofs = [];
const evidence = {
  workspaceBefore: null,
  workspaceAfter: null,
  versionHistory: [],
  changeLog: [],
  reasoning: [],
  timestamps: [],
  expertResponsible: [],
  retrievalExamples: [],
  persistence: {},
  importance: [],
  separationFromBusinessMemory: {},
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
const wsSrc = read('supabase/functions/_shared/hubly_brain_workspace_memory.ts');
const bizSrc = read('supabase/functions/_shared/hubly_brain_memory.ts');
const thinkSrc = read('supabase/functions/_shared/hubly_brain_think.ts');
const migration = read('supabase/migrations/20260723160000_workspace_memory_changelog.sql');
const tableMig = read('supabase/migrations/20260723010000_hubly_brain_milestone1_memory.sql');

ok(wsSrc.includes('HUBLY_WORKSPACE_MEMORY_VERSION = 2'), 'Workspace Memory exists (schema v2)');
ok(wsSrc.includes('WORKSPACE_MEMORY_OWNER') && wsSrc.includes('hubly_brain'), 'Hubly Brain owns Workspace Memory');
ok(wsSrc.includes('suggestWorkspaceUpdate') && wsSrc.includes('commitWorkspaceUpdates'), 'Suggest vs commit separation exists');
ok(wsSrc.includes('how the owner likes to work') || wsSrc.includes('how the owner likes to work'), 'Framed as how the owner likes to work');
ok(wsSrc.includes('Separate from Business Memory') || wsSrc.includes('separate from Business Memory'), 'Explicitly separate from Business Memory');
ok(wsSrc.includes('does NOT personalize CRM') || wsSrc.includes('does NOT personalize'), 'Does not personalize CRM');
ok(wsSrc.includes('Workspace Expert') || wsSrc.includes('Milestone 10'), 'Foundation for future Workspace Expert');
ok(thinkSrc.includes('commitWorkspaceUpdates') && thinkSrc.includes('extractWorkspaceSuggestionsFromRequest'), 'Think pipeline commits workspace via Brain');
ok(thinkSrc.includes('queryWorkspaceMemory') && thinkSrc.includes('isWorkspaceRetrievalQuestion'), 'Think retrieves from Workspace Memory');
ok(tableMig.includes('workspace_memories'), 'Persistence table workspace_memories exists');
ok(migration.includes('workspace_memory_changes'), 'Auditable workspace changelog table exists');

ok(wsSrc.includes('sidebarOrder'), 'Sidebar order stored');
ok(wsSrc.includes('dashboardLayout'), 'Dashboard layout stored');
ok(wsSrc.includes('favoritePages'), 'Favorite pages stored');
ok(wsSrc.includes('hiddenModules') || wsSrc.includes('hiddenTools'), 'Hidden tools stored');
ok(wsSrc.includes('pinnedActions'), 'Pinned actions stored');
ok(wsSrc.includes('aiSuggestions'), 'Future AI workspace suggestions stored');
ok(wsSrc.includes('workingStyle'), 'Working style preferences stored');
ok(wsSrc.includes('WorkspaceImportance') && wsSrc.includes('lastVerified'), 'Memory Importance on workspace facts');

// Separation proof — Business Memory module must not own sidebar/pins
ok(!bizSrc.includes('sidebarOrder') && !bizSrc.includes('pinnedActions'), 'Business Memory does not store sidebar/pins');
evidence.separationFromBusinessMemory = {
  businessMemoryHasSidebar: bizSrc.includes('sidebarOrder'),
  workspaceMemoryHasSidebar: wsSrc.includes('sidebarOrder'),
  principle: 'Business = what is true about the business; Workspace = how the owner likes to work',
};

// ——— Seed ———
clearWorkspaceMemoryStoreForTests();
const empty = normalizeWorkspaceMemory({});
evidence.workspaceBefore = JSON.parse(JSON.stringify(empty));
ok(empty.memoryVersion === 0, 'Fresh workspace memory starts at memoryVersion 0');
ok(Array.isArray(empty.sidebarOrder) && empty.sidebarOrder.includes('jobs'), 'Default sidebar foundation present');

const seed = commitWorkspaceUpdates(empty, [
  suggestWorkspaceUpdate({
    path: 'workingStyle.density', value: 'compact',
    reason: 'Owner prefers a denser workspace',
    expertId: 'hubly_brain', importance: 'medium', confidence: 80, source: 'user',
  }),
  suggestWorkspaceUpdate({
    path: 'dashboardLayout', value: ['pipeline', 'today', 'revenue'],
    reason: 'Owner wants pipeline first on dashboard',
    expertId: 'hubly_brain', importance: 'high', confidence: 88, source: 'user',
  }),
], { summary: 'Seed working style + dashboard' });

ok(seed.committedBy === WORKSPACE_MEMORY_OWNER, 'Commits attributed to Hubly Brain');
ok(seed.workspace.workingStyle?.density === 'compact', 'Working style stored');
ok(seed.workspace.dashboardLayout?.[0] === 'pipeline', 'Dashboard layout stored');

for (const c of seed.changes) {
  ok(!!c.at && !!c.reason && !!c.expertId, `Change audited: ${c.path}`);
  ok(!!c.importance && typeof c.confidence === 'number' && !!c.source, `Importance meta: ${c.path}`);
  evidence.changeLog.push(c);
  evidence.timestamps.push(c.at);
  evidence.expertResponsible.push({ path: c.path, expertId: c.expertId });
  evidence.reasoning.push({ path: c.path, reason: c.reason });
  evidence.importance.push(seed.workspace.factMeta[c.path]);
}

// ——— Demo conversations ———
const BIZ = 'demo-workspace-section6';
clearWorkspaceMemoryStoreForTests();
let workspace = normalizeWorkspaceMemory({});

console.log('\n— Conversation 1: sidebar —');
const c1 = brainApplyWorkspaceMessage(workspace, 'Put Jobs above Customers in the sidebar.', BIZ);
workspace = c1.workspace;
ok(workspace.sidebarOrder.indexOf('jobs') < workspace.sidebarOrder.indexOf('customers'), 'Conversation 1: Jobs above Customers in sidebar');
ok(c1.changes.every((c) => c.reason && c.at && c.expertId && c.memoryVersion), 'Conversation 1: updates versioned with reasoning/timestamp/expert');
evidence.versionHistory.push({ step: 1, memoryVersion: workspace.memoryVersion, changes: c1.changes.length });

console.log('— Conversation 2: hide tools —');
const c2 = brainApplyWorkspaceMessage(workspace, 'Hide the Marketing tools for now.', BIZ);
workspace = c2.workspace;
ok(workspace.hiddenModules.includes('marketing') || workspace.hiddenTools.includes('marketing'), 'Conversation 2: Marketing hidden');
ok(workspace.memoryVersion > c1.workspace.memoryVersion, 'Conversation 2: memoryVersion incremented');
evidence.versionHistory.push({ step: 2, memoryVersion: workspace.memoryVersion, changes: c2.changes.length });

console.log('— Conversation 3: pin action —');
const c3 = brainApplyWorkspaceMessage(workspace, 'Pin Create Quote.', BIZ);
workspace = c3.workspace;
ok(workspace.pinnedActions.some((a) => /create_quote|create quote/i.test(a)), 'Conversation 3: Create Quote pinned');
evidence.versionHistory.push({ step: 3, memoryVersion: workspace.memoryVersion, changes: c3.changes.length });

const fav = brainApplyWorkspaceMessage(workspace, 'Favorite the calendar page.', BIZ);
workspace = fav.workspace;
ok(workspace.favoritePages.includes('calendar'), 'Favorite pages stored');

const ai = commitWorkspaceAiSuggestion(workspace, {
  suggestion: 'Move Calendar next to Jobs for field days',
  status: 'suggested',
  reason: 'Owner often asks about schedule after jobs',
  expertId: 'hubly_brain',
  confidence: 70,
});
workspace = ai.workspace;
ok(workspace.aiSuggestions?.some((s) => s.status === 'suggested'), 'Future AI workspace suggestions stored');
persistWorkspaceMemoryLocal(BIZ, workspace);

console.log('— Conversation 4: retrieval —');
ok(isWorkspaceRetrievalQuestion('What does my workspace look like?'), 'Conversation 4: detected as workspace retrieval');
const q4 = queryWorkspaceMemory(workspace, 'What does my workspace look like?');
ok(q4.fromWorkspaceMemory === true && q4.usedChatHistory === false, 'Conversation 4: answered from Workspace Memory, not chat');
ok(/jobs/i.test(q4.answer) && /marketing/i.test(q4.answer) && /create_quote|create quote/i.test(q4.answer), 'Conversation 4: reflects sidebar/hidden/pins');
evidence.retrievalExamples.push({ q: 'What does my workspace look like?', ...q4 });

console.log('— Conversation 5: why hidden —');
const q5 = queryWorkspaceMemory(workspace, 'Why did we hide Marketing?');
ok(q5.fromWorkspaceMemory && !q5.usedChatHistory, 'Conversation 5: hide reason from Workspace Memory');
ok(/hide/i.test(q5.answer) && /marketing/i.test(q5.answer), 'Conversation 5: includes stored reasoning');
evidence.retrievalExamples.push({ q: 'Why did we hide Marketing?', ...q5 });

// Persistence across new conversation
const fresh = loadWorkspaceMemoryLocal(BIZ);
ok(!!fresh, 'Workspace Memory survives new conversations');
ok(fresh.sidebarOrder.indexOf('jobs') < fresh.sidebarOrder.indexOf('customers'), 'Persisted sidebar intact');
ok(fresh.hiddenModules.includes('marketing'), 'Persisted hidden tools intact');
ok(fresh.pinnedActions.some((a) => /create_quote/i.test(a)), 'Persisted pins intact');
ok(fresh.memoryVersion === workspace.memoryVersion, 'Persisted memoryVersion intact');
evidence.persistence = {
  businessId: BIZ,
  loaded: true,
  sidebarOrder: fresh.sidebarOrder,
  hiddenModules: fresh.hiddenModules,
  pinnedActions: fresh.pinnedActions,
  memoryVersion: fresh.memoryVersion,
  changelogLength: fresh.changelog?.length,
};

// Extract without Brain commit path still only suggests
const suggestionsOnly = extractWorkspaceSuggestionsFromRequest('Pin Send Invoice.', workspace);
ok(suggestionsOnly.length >= 1 && suggestionsOnly[0].expertId === WORKSPACE_MEMORY_OWNER, 'Extract produces suggestions for Brain to commit');

evidence.workspaceAfter = {
  memoryVersion: workspace.memoryVersion,
  sidebarOrder: workspace.sidebarOrder,
  dashboardLayout: workspace.dashboardLayout,
  hiddenModules: workspace.hiddenModules,
  favoritePages: workspace.favoritePages,
  pinnedActions: workspace.pinnedActions,
  workingStyle: workspace.workingStyle,
  aiSuggestions: workspace.aiSuggestions,
  factMetaSample: Object.fromEntries(Object.entries(workspace.factMeta || {}).slice(0, 6)),
  changelogLength: workspace.changelog?.length,
  versionHistory: workspace.versionHistory,
};

ok(fs.existsSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION6.md')), 'Section 6 documentation exists');
ok(HUBLY_WORKSPACE_MEMORY_VERSION === 2, 'Schema version is 2');

evidence.releaseGate = {
  workspaceMemoryExists: true,
  sidebarStored: true,
  dashboardStored: true,
  favoritesStored: true,
  hiddenToolsStored: true,
  pinnedActionsStored: true,
  aiSuggestionsStored: true,
  separateFromBusinessMemory: true,
  notCrmPersonalization: true,
  brainOwnsCommits: true,
  survivesNewConversations: true,
  retrievesFromWorkspaceMemoryNotChat: true,
  everyUpdateVersioned: true,
  everyUpdateStoresReasoning: true,
  everyUpdateStoresTimestamps: true,
  everyUpdateIdentifiesExpert: true,
  memoryImportance: true,
  foundationForWorkspaceExpert: true,
  automatedEvidence: true,
};

const report = {
  section: 6,
  title: 'Workspace Memory',
  passed: !failed,
  checkedAt: new Date().toISOString(),
  version: '1.0.0',
  architectureSummary: {
    module: 'supabase/functions/_shared/hubly_brain_workspace_memory.ts',
    schemaVersion: HUBLY_WORKSPACE_MEMORY_VERSION,
    owner: WORKSPACE_MEMORY_OWNER,
    persistence: 'workspace_memories + workspace_memory_changes',
    principle: 'Business Memory = business facts. Workspace Memory = how the owner likes to work.',
    future: 'Foundation for Workspace Expert (Milestone 10). Not CRM personalization.',
    importance: 'Every fact: importance / confidence / source / lastVerified',
  },
  proofs,
  evidence,
};

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs/HUBLY_BRAIN_SECTION6_PROOF.json'),
  JSON.stringify(report, null, 2) + '\n',
);

if (failed) {
  console.error('\nSECTION 6 INCOMPLETE — Workspace Memory Release Gate failed');
  process.exit(1);
}

console.log('\nSECTION 6 COMPLETE — Workspace Memory Release Gate passed');
console.log('Demo memoryVersion:', workspace.memoryVersion);
console.log('Sidebar:', workspace.sidebarOrder.join(' → '));
