/**
 * Node mirror of hubly_brain_conversation_intelligence.ts — Section 10.
 */
export const CONVERSATION_INTELLIGENCE_VERSION = '1.0.0';
export const CONVERSATION_INTELLIGENCE_SCHEMA = 1;
export const CONVERSATION_INTELLIGENCE_OWNER = 'hubly_brain';

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function cloneCi(ci) {
  return JSON.parse(JSON.stringify(ci));
}

export function normalizeConversationIntelligence(input) {
  const i = input || {};
  const now = new Date().toISOString();
  return {
    schemaVersion: CONVERSATION_INTELLIGENCE_SCHEMA,
    engineVersion: CONVERSATION_INTELLIGENCE_VERSION,
    intelligenceVersion: typeof i.intelligenceVersion === 'number' ? i.intelligenceVersion : 0,
    businessId: i.businessId ? String(i.businessId) : null,
    activeGoal: i.activeGoal ? String(i.activeGoal) : null,
    currentProject: i.currentProject ? String(i.currentProject) : null,
    activeTopic: i.activeTopic ? String(i.activeTopic) : null,
    activeThreadId: i.activeThreadId ? String(i.activeThreadId) : null,
    threads: Array.isArray(i.threads)
      ? i.threads.map((t) => ({
        threadId: String(t.threadId || newId('thr')),
        name: String(t.name || 'Untitled'),
        status: t.status === 'paused' || t.status === 'completed' ? t.status : 'active',
        children: Array.isArray(t.children)
          ? t.children.map((c) => ({
            name: String(c.name),
            status: c.status === 'paused' || c.status === 'completed' ? c.status : 'active',
          }))
          : [],
        updatedAt: t.updatedAt ? String(t.updatedAt) : now,
      }))
      : [],
    pendingDecisions: Array.isArray(i.pendingDecisions)
      ? i.pendingDecisions.map((d) => ({
        id: String(d.id || newId('pd')),
        text: String(d.text),
        status: d.status === 'approved' || d.status === 'dismissed' ? d.status : 'pending',
        at: d.at ? String(d.at) : now,
        threadId: d.threadId ? String(d.threadId) : null,
      }))
      : [],
    openQuestions: Array.isArray(i.openQuestions)
      ? i.openQuestions.map((q) => ({
        id: String(q.id || newId('oq')),
        question: String(q.question),
        status: q.status === 'answered' ? 'answered' : 'open',
        at: q.at ? String(q.at) : now,
      }))
      : [],
    commitments: Array.isArray(i.commitments)
      ? i.commitments.map((c) => ({
        id: String(c.id || newId('cmt')),
        promise: String(c.promise),
        dueAt: c.dueAt ? String(c.dueAt) : null,
        status: c.status === 'done' ? 'done' : 'open',
        at: c.at ? String(c.at) : now,
      }))
      : [],
    deferredIdeas: Array.isArray(i.deferredIdeas)
      ? i.deferredIdeas.map((d) => ({
        id: String(d.id || newId('def')),
        idea: String(d.idea),
        status: d.status === 'revisited' || d.status === 'done' ? d.status : 'deferred',
        at: d.at ? String(d.at) : now,
        revisitHint: d.revisitHint ? String(d.revisitHint) : null,
        context: d.context ? String(d.context) : null,
      }))
      : [],
    followUpQueue: Array.isArray(i.followUpQueue)
      ? i.followUpQueue.map((f) => ({
        id: String(f.id || newId('fu')),
        type: ['reminder', 'suggestion', 'approval', 'research', 'improvement'].includes(String(f.type))
          ? f.type
          : 'suggestion',
        text: String(f.text),
        dueAt: f.dueAt ? String(f.dueAt) : null,
        status: f.status === 'done' || f.status === 'cancelled' ? f.status : 'queued',
        at: f.at ? String(f.at) : now,
      }))
      : [],
    emotionalContext: {
      state: i.emotionalContext?.state ? String(i.emotionalContext.state) : 'neutral',
      confidence: typeof i.emotionalContext?.confidence === 'number' ? i.emotionalContext.confidence : 50,
      updatedAt: i.emotionalContext?.updatedAt ? String(i.emotionalContext.updatedAt) : now,
    },
    aiContext: {
      experts: Array.isArray(i.aiContext?.experts)
        ? i.aiContext.experts.map((e) => ({
          expertId: String(e.expertId),
          status: String(e.status || 'idle'),
        }))
        : [],
      phase: i.aiContext?.phase ? String(i.aiContext.phase) : 'idle',
      updatedAt: i.aiContext?.updatedAt ? String(i.aiContext.updatedAt) : now,
    },
    lastActiveAt: i.lastActiveAt ? String(i.lastActiveAt) : null,
    updatedAt: i.updatedAt ? String(i.updatedAt) : now,
  };
}

export function ensureThread(ci, name, children = []) {
  const intel = normalizeConversationIntelligence(ci);
  const existing = intel.threads.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    for (const child of children) {
      if (!existing.children.some((c) => c.name.toLowerCase() === child.toLowerCase())) {
        existing.children.push({ name: child, status: 'active' });
      }
    }
    existing.updatedAt = new Date().toISOString();
    intel.activeThreadId = existing.threadId;
    return { intelligence: intel, threadId: existing.threadId };
  }
  const thread = {
    threadId: newId('thr'),
    name,
    status: 'active',
    children: children.map((c) => ({ name: c, status: 'active' })),
    updatedAt: new Date().toISOString(),
  };
  intel.threads.push(thread);
  intel.activeThreadId = thread.threadId;
  return { intelligence: intel, threadId: thread.threadId };
}

export function commitIntelligenceUpdates(base, patch, opts = {}) {
  const before = normalizeConversationIntelligence(base);
  const intel = normalizeConversationIntelligence({
    ...before,
    ...patch,
    intelligenceVersion: (before.intelligenceVersion || 0) + 1,
    updatedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  });
  return {
    intelligence: intel,
    committedBy: CONVERSATION_INTELLIGENCE_OWNER,
    reason: opts.reason || 'Brain committed Conversation Intelligence update',
  };
}

function detectEmotion(request) {
  const r = request.toLowerCase();
  if (/love it|awesome|excited|amazing|can't wait/.test(r)) return { state: 'excited', confidence: 85 };
  if (/frustrated|annoyed|broken|hate|angry/.test(r)) return { state: 'frustrated', confidence: 88 };
  if (/confused|not sure|don't understand|unclear/.test(r)) return { state: 'confused', confidence: 82 };
  if (/publish|go live|launch it/.test(r)) return { state: 'publishing', confidence: 80 };
  if (/celebrate|we did it|shipped/.test(r)) return { state: 'celebrating', confidence: 85 };
  if (/learn|how does|explain|teach/.test(r)) return { state: 'learning', confidence: 75 };
  if (/maybe|explore|thinking about|consider/.test(r)) return { state: 'exploring', confidence: 70 };
  return { state: 'neutral', confidence: 55 };
}

export function extractIntelligenceFromRequest(request, base) {
  const r = String(request || '').trim();
  const low = r.toLowerCase();
  const ci = normalizeConversationIntelligence(base);
  const suggestions = [];
  const patch = {};
  let threadHint = null;
  const now = new Date().toISOString();
  const emotion = detectEmotion(r);
  patch.emotionalContext = { state: emotion.state, confidence: emotion.confidence, updatedAt: now };

  if (/redesign(ing)? (my |the )?website|website redesign/.test(low)) {
    patch.activeGoal = 'Building website';
    patch.currentProject = 'Website Redesign';
    patch.activeTopic = 'Website';
    threadHint = 'Website Redesign';
    suggestions.push({
      path: 'currentProject',
      value: 'Website Redesign',
      reason: 'Owner started website redesign',
      expertId: 'hubly_brain',
    });
  }
  if (/improv(e|ing) (my |the )?booking|booking page|booking flow/.test(low)) {
    patch.activeGoal = 'Improving booking';
    patch.currentProject = patch.currentProject || 'Website Redesign';
    patch.activeTopic = 'Scheduling';
    threadHint = 'Website Redesign';
  }
  if (/memberships? later|want memberships later|memberships? (someday|eventually|later)/.test(low)) {
    const idea = {
      id: newId('def'),
      idea: 'Memberships',
      status: 'deferred',
      at: now,
      revisitHint: 'Revisit when customer volume supports recurring revenue',
      context: r,
    };
    patch.deferredIdeas = [...ci.deferredIdeas.filter((d) => d.idea.toLowerCase() !== 'memberships'), idea];
    threadHint = threadHint || 'Business Growth';
    suggestions.push({ path: 'deferredIdeas', value: idea, reason: 'Owner deferred memberships', expertId: 'hubly_brain' });
  }
  if (/connect stripe|stripe/.test(low) && /connect|set up|enable/.test(low)) {
    const pd = { id: newId('pd'), text: 'Connect Stripe', status: 'pending', at: now };
    patch.pendingDecisions = [...ci.pendingDecisions.filter((d) => d.text !== 'Connect Stripe'), pd];
    patch.activeTopic = 'Invoices';
    threadHint = 'Operations';
  }
  if (/approve homepage|homepage approval/.test(low)) {
    const pd = { id: newId('pd'), text: 'Approve homepage', status: 'pending', at: now };
    patch.pendingDecisions = [
      ...(patch.pendingDecisions || ci.pendingDecisions).filter((d) => d.text !== 'Approve homepage'),
      pd,
    ];
  }
  if (/publish (my |the )?website|go live/.test(low)) {
    const pd = { id: newId('pd'), text: 'Publish website', status: 'pending', at: now };
    patch.pendingDecisions = [
      ...(patch.pendingDecisions || ci.pendingDecisions).filter((d) => d.text !== 'Publish website'),
      pd,
    ];
    patch.emotionalContext = { state: 'publishing', confidence: 80, updatedAt: now };
  }
  if (patch.currentProject === 'Website Redesign' && !ci.pendingDecisions.length) {
    patch.pendingDecisions = [
      { id: newId('pd'), text: 'Approve homepage', status: 'pending', at: now },
      { id: newId('pd'), text: 'Connect Stripe', status: 'pending', at: now },
      { id: newId('pd'), text: 'Publish website', status: 'pending', at: now },
    ];
  }
  if (/should recurring|primary package|open question|what do you think about/.test(low)) {
    patch.openQuestions = [...ci.openQuestions, { id: newId('oq'), question: r, status: 'open', at: now }];
  }
  if (/remind me tomorrow|remind me later|i'?ll remind you|i will remind you/.test(low)) {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const cmt = {
      id: newId('cmt'),
      promise: /remind me/i.test(r) ? 'Remind owner tomorrow' : r,
      dueAt: tomorrow,
      status: 'open',
      at: now,
    };
    patch.commitments = [...ci.commitments, cmt];
    patch.followUpQueue = [
      ...ci.followUpQueue,
      { id: newId('fu'), type: 'reminder', text: cmt.promise, dueAt: tomorrow, status: 'queued', at: now },
    ];
  }
  if (/i'?ll build|i will build|three homepage options/.test(low)) {
    patch.commitments = [
      ...(patch.commitments || ci.commitments),
      { id: newId('cmt'), promise: 'Build three homepage options', dueAt: null, status: 'open', at: now },
    ];
  }
  if (/pricing|packages? redesign/.test(low) && !/memberships/.test(low)) {
    patch.activeTopic = patch.activeTopic || 'Marketing';
    if (/pricing/.test(low)) threadHint = threadHint || 'Business Growth';
  }
  if (/continue where we left off|what were we doing|ready to continue|pick up where/.test(low)) {
    threadHint = ci.threads.find((t) => t.threadId === ci.activeThreadId)?.name || ci.currentProject;
  }
  return { suggestions, patch, threadHint };
}

export function applyConversationIntelligenceTurn(base, request, opts = {}) {
  const extracted = extractIntelligenceFromRequest(request, base);
  let intel = normalizeConversationIntelligence(base);
  if (opts.businessId) intel.businessId = opts.businessId;
  if (extracted.threadHint) {
    const children =
      extracted.threadHint === 'Website Redesign'
        ? ['Homepage', 'Booking Flow', 'Portfolio']
        : extracted.threadHint === 'Business Growth'
        ? ['Memberships', 'Pricing', 'Reviews']
        : extracted.threadHint === 'Operations'
        ? ['Stripe', 'Google Calendar', 'Scheduling']
        : [];
    intel = ensureThread(intel, extracted.threadHint, children).intelligence;
  }
  const now = new Date().toISOString();
  const experts =
    opts.expertStatuses ||
    (opts.expertsRun || []).map((id) => ({ expertId: id, status: 'complete' }));
  return commitIntelligenceUpdates(
    intel,
    {
      ...extracted.patch,
      activeThreadId: intel.activeThreadId,
      threads: intel.threads,
      aiContext: {
        experts,
        phase: opts.phase || (experts.length ? 'experts_complete' : intel.aiContext.phase),
        updatedAt: now,
      },
    },
    { reason: `Turn: ${String(request).slice(0, 80)}` },
  ).intelligence;
}

export function isConversationIntelligenceQuestion(request) {
  const r = String(request || '').toLowerCase();
  return (
    /what were we doing|what('?s| is) left|what still needs|pending (decision|approval)|what project|what are we (working|waiting)|what have you promised|continue where we left|ready to continue|pick up where|what('?s| is) (our |the )?current (goal|project|topic)/.test(
      r,
    ) ||
    (/deferred|memberships\?|revisit/.test(r) && /membership|idea|talked about/.test(r))
  );
}

export function queryConversationIntelligence(request, ciInput) {
  const ci = normalizeConversationIntelligence(ciInput);
  const r = String(request || '').toLowerCase();
  const paths = [];
  let answer = '';
  let confidence = 80;

  if (/what were we doing|continue where|ready to continue|pick up where|yesterday/.test(r)) {
    paths.push('currentProject', 'activeGoal', 'activeThreadId');
    const thread = ci.threads.find((t) => t.threadId === ci.activeThreadId);
    const project = ci.currentProject || thread?.name || 'your last project';
    const goal = ci.activeGoal || 'moving the business forward';
    answer =
      ci.lastActiveAt || ci.currentProject
        ? `We were working on ${project} (${goal}). Ready to continue?`
        : "I don't have an active project stored yet — what should we focus on?";
  } else if (/what('?s| is) left|still needs|pending|waiting for|what are we waiting/.test(r)) {
    paths.push('pendingDecisions');
    const pending = ci.pendingDecisions.filter((d) => d.status === 'pending');
    answer = pending.length
      ? `Here's what's left:\n${pending.map((d) => `• ${d.text}`).join('\n')}`
      : 'Nothing is waiting on your approval right now.';
  } else if (/what project|current project/.test(r)) {
    paths.push('currentProject', 'threads');
    const thread = ci.threads.find((t) => t.threadId === ci.activeThreadId);
    answer = ci.currentProject
      ? `We're on ${ci.currentProject}${thread ? ` (thread: ${thread.name})` : ''}.`
      : 'No current project is stored yet.';
  } else if (/promised|commitment|remind/.test(r)) {
    paths.push('commitments');
    const open = ci.commitments.filter((c) => c.status === 'open');
    answer = open.length
      ? `I've promised: ${open.map((c) => c.promise).join('; ')}.`
      : "I don't have open commitments stored.";
  } else if (/membership|deferred|revisit|talked about/.test(r)) {
    paths.push('deferredIdeas');
    const def = ci.deferredIdeas.filter((d) => d.status === 'deferred' || d.status === 'revisited');
    answer = def.length
      ? `We talked about ${def.map((d) => d.idea).join(', ')}. ${def[0].revisitHint || 'Want to revisit that?'}`
      : "I don't have a deferred idea stored for that.";
    confidence = 85;
  } else if (/current goal|active goal/.test(r)) {
    paths.push('activeGoal');
    answer = ci.activeGoal ? `Your active goal is: ${ci.activeGoal}.` : 'No active goal stored yet.';
  } else if (/current topic|active topic/.test(r)) {
    paths.push('activeTopic');
    answer = ci.activeTopic ? `We're focused on: ${ci.activeTopic}.` : 'No active topic stored yet.';
  } else {
    paths.push('currentProject', 'pendingDecisions', 'activeGoal');
    answer =
      [
        ci.currentProject ? `Project: ${ci.currentProject}.` : null,
        ci.activeGoal ? `Goal: ${ci.activeGoal}.` : null,
        ci.pendingDecisions.filter((d) => d.status === 'pending').length
          ? `Pending: ${ci.pendingDecisions.filter((d) => d.status === 'pending').map((d) => d.text).join(', ')}.`
          : null,
      ]
        .filter(Boolean)
        .join(' ') || 'Conversation Intelligence is empty so far.';
  }

  return {
    fromConversationIntelligence: true,
    fromChatHistory: false,
    answer,
    paths,
    confidence,
    intelligence: cloneCi(ci),
  };
}

export function buildResumeGreeting(ciInput) {
  const ci = normalizeConversationIntelligence(ciInput);
  if (ci.currentProject) {
    return `We were improving ${
      ci.currentProject === 'Website Redesign' ? 'your website' : ci.currentProject
    }. Ready to continue?`;
  }
  if (ci.activeGoal) return `Last time we focused on ${ci.activeGoal}. Ready to continue?`;
  return 'Where would you like to pick up?';
}

export function buildDeferredRevisitMessage(ciInput, opts = {}) {
  const ci = normalizeConversationIntelligence(ciInput);
  const memberships = ci.deferredIdeas.find((d) => /membership/i.test(d.idea) && d.status === 'deferred');
  if (!memberships) return null;
  const jobs = opts.jobsAverage ?? 35;
  return `We talked about memberships. You're averaging ${jobs} jobs now. Want to revisit that?`;
}

const LOCAL_STORE = new Map();

export function persistConversationIntelligenceLocal(businessId, ci) {
  LOCAL_STORE.set(String(businessId), cloneCi(normalizeConversationIntelligence(ci)));
}

export function loadConversationIntelligenceLocal(businessId) {
  const v = LOCAL_STORE.get(String(businessId));
  return v ? cloneCi(v) : null;
}

export function clearConversationIntelligenceForTests() {
  LOCAL_STORE.clear();
}

export function memorySeparationManifest() {
  return {
    conversationIntelligence: {
      owner: CONVERSATION_INTELLIGENCE_OWNER,
      answers: 'What are we currently working on?',
      storesTurns: false,
      storesBusinessFacts: false,
      storesWorkspacePrefs: false,
    },
    businessMemory: { answers: 'What do I know about the business?', distinct: true },
    workspaceMemory: { answers: 'How does this owner work?', distinct: true },
    conversationMemoryTurns: {
      answers: 'Raw chat turns (logs) — not Conversation Intelligence',
      distinct: true,
    },
  };
}
