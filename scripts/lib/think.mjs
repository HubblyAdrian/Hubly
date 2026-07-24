/**
 * Node mirror of hubly_brain_think.ts — Sections 4–10 behavioral proofs.
 */
import {
  discoverExperts,
  selectExpertsFromRegistry,
  runExpert,
  sanitizeExpertError,
} from './expert-framework.mjs';
import { ensureExpertsRegistered } from './initial-experts.mjs';
import { applyExperienceDirector } from './experience-director.mjs';
import { loadBusinessDnaKnowledge, attachDnaKnowledgePack } from './dna-knowledge.mjs';
import {
  isWhyQuestion,
  answerWhyFromReasoning,
  recordBuildBusinessReasoningChain,
} from './reasoning-engine.mjs';
import {
  assessDecision,
  assessHomepageRewrite,
  answerWhyFromDecision,
  isWhyDecisionQuestion,
  decisionActionToConfidenceBand,
} from './decision-engine.mjs';
import {
  applyConversationIntelligenceTurn,
  buildResumeGreeting,
  isConversationIntelligenceQuestion,
  loadConversationIntelligenceLocal,
  normalizeConversationIntelligence,
  persistConversationIntelligenceLocal,
  queryConversationIntelligence,
  CONVERSATION_INTELLIGENCE_OWNER,
} from './conversation-intelligence.mjs';
import {
  ensureRegistriesBootstrapped,
  planRegistryRoute,
} from './registries.mjs';
import { recordFlightRecorder } from './mission-control.mjs';
import { extractBuilderIntentFromOutput } from './builder-expert.mjs';
import { generateChangePlan } from './change-plan.mjs';
import { generatePreview } from './preview-engine.mjs';
import { startCollaboration } from './collaboration.mjs';
import { proposeVersionFromPlan } from './version-engine.mjs';
import { startCreativeSession } from './business-builder.mjs';
import { buildBookingIntelligence } from './booking-intelligence.mjs';
import { buildWorkspaceIntelligence } from './workspace-intelligence.mjs';
import { buildAutomationIntelligence } from './automation-intelligence.mjs';
import { buildMediaIntelligence } from './media-intelligence.mjs';
import { buildChatOsSession } from './chat-os.mjs';
import { deployApprovedChangePlan } from './business-deployment.mjs';
import {
  normalizeWorkspaceMemory,
  extractWorkspaceSuggestionsFromRequest,
  commitWorkspaceUpdates,
  queryWorkspaceMemory,
  persistWorkspaceMemoryLocal,
  loadWorkspaceMemoryLocal,
} from './workspace-memory.mjs';

export function detectIntent(request, explicit) {
  if (explicit) return String(explicit);
  const r = String(request || '').toLowerCase();
  if (isWhyDecisionQuestion(r) || isWhyQuestion(r)) return 'why';
  if (isConversationIntelligenceQuestion(r)) return 'conversation_intelligence';
  if (/weather|forecast|temperature/.test(r)) return 'weather';
  // Website creative work (rewrite homepage, redesign) is Builder — not workspace chrome.
  if (
    /rewrite (my |the )?homepage|redesign (my |the )?(website|homepage)|make (my |the )?website|website feel|homepage feel/.test(
      r,
    )
  ) {
    return 'build_business';
  }
  // Workspace layout only — do not match bare "homepage" (that stole rewrite_homepage QA).
  if (
    /move |sidebar|dashboard|pin |hide |workspace|jobs above|put .+ above|mobile workspace|focus mode|what (do you think|should i)|calendar (as )?(home|landing)|adaptive homepage/.test(
      r,
    )
  ) {
    return 'workspace';
  }
  // Capability / Builder prep — before coach (which matches "booking")
  if (
    /arrival window|same-?day|no same.?day|travel buffer|minimum notice|daily capacity|two jobs|2 jobs|maximum per day|weather|rain(ing)?|reschedule exterior|estimate.?only|tuesdays? are estimate|optimiz(e|ing).*schedule|fridays? (are|only).*ceramic|ceramic.*(friday|only|after 2)|coating.?only|seasonal|snow removal/.test(
      r,
    )
  ) {
    return 'build_business';
  }
  if (
    /portfolio|upload.*(photo|image)|these \d+ photos|prep instruction|automation|workflow|after .+ booking|review request|ask for (a )?review|follow up on quotes|membership.*month|friday.*(summary|report)|recurring customer|instagram|before.?after|organize everything|visual timeline/
      .test(r)
  ) {
    return 'build_business';
  }
  if (
    /rewrite (my |the )?homepage|website|homepage|luxury|premium|layout|brand|build me|build my|start(?:ing)?\s+(?:a\s+)?(?:new\s+)?(?:business|company)|pressure\s*wash|new company|redesign/
      .test(r)
  ) {
    return 'build_business';
  }
  if (/research|competitor|industry/.test(r)) return 'research';
  if (/coach|grow|booking|revenue|how'?s my business|how is my business/.test(r)) return 'coach';
  return 'general';
}

function toMergedRecord(out) {
  return {
    expertName: out.expertName || out.expertId,
    expertId: out.expertId,
    executionTimeMs: out.executionTimeMs ?? 0,
    reasoning: out.reasoning || [],
    confidence: out.confidence ?? 0,
    output: out.output || out.payload || null,
    status: out.status || (out.ok ? 'ok' : 'failed'),
    retries: out.retries ?? 0,
  };
}

function outputTypeOf(out) {
  const o = out.output || out.payload || {};
  return o.type || out.expertId;
}

function buildTranscriptEntry(out, idx, req, intent, all) {
  const prev = all[idx - 1];
  const why = out.reasoning?.[0]?.reason || out.summary || 'No reasoning recorded';
  let changedFromPrevious = 'First expert in this run — established the baseline.';
  if (prev) {
    changedFromPrevious =
      `${prev.expertName || prev.expertId} produced ${outputTypeOf(prev)}; ` +
      `${out.expertName || out.expertId} advanced that into ${outputTypeOf(out)} ` +
      `(confidence ${prev.confidence} → ${out.confidence}).`;
  }
  return {
    expertId: out.expertId,
    expertName: out.expertName || out.expertId,
    received: {
      request: String(req.request || ''),
      intent,
      priorExpertIds: all.slice(0, idx).map((p) => p.expertId),
      memorySurfaces: [
        req.memory ? 'business_memory' : '',
        req.dna ? 'business_dna' : '',
        req.blueprintKnowledge ? 'blueprints' : '',
      ].filter(Boolean),
    },
    concluded: out.summary,
    why,
    changedFromPrevious,
    confidence: out.confidence,
    status: out.status || (out.ok ? 'ok' : 'failed'),
    executionTimeMs: out.executionTimeMs ?? 0,
    outputType: outputTypeOf(out),
    retries: out.retries ?? 0,
  };
}

function clampAvg(nums) {
  if (!nums.length) return 0;
  return Math.max(0, Math.min(100, Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)));
}

/**
 * Hubly Brain think — orchestrates experts via registry. Experts never call each other.
 */
export async function think(req) {
  const started = Date.now();
  ensureExpertsRegistered();
  discoverExperts();
  ensureRegistriesBootstrapped();
  const registryRouting = planRegistryRoute(String(req.request || ''));

  const intent = detectIntent(req.request, req.intent);
  const businessId = req.businessId || req.memory?.businessId || null;

  // Section 7 — Brain loads DNA knowledge for experts to read
  let dna = req.dna || {};
  if (!dna.knowledgePack) {
    const pack = loadBusinessDnaKnowledge({
      request: String(req.request || ''),
      industry: req.memory?.industry || null,
      city: req.memory?.city || null,
    });
    dna = attachDnaKnowledgePack(dna, pack);
  }

  // Section 6 — Workspace Memory commits (Brain-owned)
  const seededWs = businessId ? loadWorkspaceMemoryLocal(businessId) : null;
  let workspace = normalizeWorkspaceMemory(seededWs || req.workspace || { businessId });
  if (businessId) workspace.businessId = businessId;
  let workspaceChanges = [];
  const wsExtracted = extractWorkspaceSuggestionsFromRequest(String(req.request || ''), workspace);
  if (wsExtracted.length) {
    const wsCommitted = commitWorkspaceUpdates(workspace, wsExtracted, {
      summary: `Owner workspace: ${String(req.request || '').slice(0, 120)}`,
    });
    workspace = wsCommitted.workspace;
    workspaceChanges = wsCommitted.changes;
    if (businessId) persistWorkspaceMemoryLocal(businessId, workspace);
  }

  // Section 10 — Conversation Intelligence working memory
  const seededCi = businessId ? loadConversationIntelligenceLocal(businessId) : null;
  let conversationIntelligence = normalizeConversationIntelligence(
    seededCi || req.conversationIntelligence || null,
  );
  if (businessId) conversationIntelligence.businessId = businessId;

  if (
    intent === 'conversation_intelligence' ||
    isConversationIntelligenceQuestion(String(req.request || ''))
  ) {
    const retrieval = queryConversationIntelligence(String(req.request || ''), conversationIntelligence);
    const ed = applyExperienceDirector({
      request: req.request,
      draftResponse: retrieval.answer,
      proposedQuestions: [],
      confidence: retrieval.confidence,
      criticOk: true,
    });
    conversationIntelligence = applyConversationIntelligenceTurn(
      conversationIntelligence,
      String(req.request || ''),
      { businessId, phase: 'retrieval', expertsRun: ['experience_director'] },
    );
    if (businessId) persistConversationIntelligenceLocal(businessId, conversationIntelligence);
    const flightRecorder = recordFlightRecorder({
      request: String(req.request || ''),
      intent: 'conversation_intelligence',
      businessId,
      startedAt: new Date(started).toISOString(),
      latencyMs: Date.now() - started,
      ok: true,
      memoriesLoaded: ['conversation_intelligence', 'business_memory'],
      dnaFactsUsed: [],
      expertsExecuted: [{
        expertId: 'experience_director',
        status: 'ok',
        confidence: ed.confidence,
        ms: Date.now() - started,
        summary: String(ed.ownerResponse || '').slice(0, 160),
      }],
      reasoningObjects: [],
      decisionObjects: [],
      capabilitiesSelected: [],
      knowledgeAccessed: [],
      finalResponse: ed.ownerResponse,
      memoryWrites: [{ system: 'conversation_intelligence', summary: 'retrieval / resume' }],
      confidence: ed.confidence,
      decisionScore: null,
      decisionAction: 'conversation_intelligence',
      builderIntent: null,
      chatOs: null,
    });
    const chatOsFast = buildChatOsSession({
      businessId: businessId || `biz_${Date.now().toString(36)}`,
      request: String(req.request || ''),
      response: ed.ownerResponse,
      channel: req.channel || 'typing',
      ownerName: req.memory?.name || null,
      industry: req.memory?.industry || null,
      conversationIntelligence,
      memoriesLoaded: ['conversation_intelligence', 'business_memory', 'workspace_memory', 'business_dna'],
      missionControlReplayId: flightRecorder.executionId,
    });
    if (flightRecorder) {
      flightRecorder.chatOs = {
        id: chatOsFast.id,
        label: chatOsFast.label,
        channel: chatOsFast.channel,
        voiceReady: true,
        routeCount: chatOsFast.routes.length,
        routes: [...chatOsFast.routes],
        builderCount: chatOsFast.buildersInvoked.length,
        toolCount: chatOsFast.toolsUsed.length,
        memoryCount: chatOsFast.memoriesRead.length,
        activeProject: chatOsFast.activeProject?.name ?? null,
        canvasSurface: chatOsFast.canvas.activeSurface,
        proactiveCount: chatOsFast.proactiveStarters.length,
        singlePersonality: true,
        requiresApproval: true,
        applied: false,
        executed: false,
        waitingFor: chatOsFast.waitingFor,
      };
      flightRecorder.timeline = [
        ...(flightRecorder.timeline || []),
        {
          at: new Date().toISOString(),
          t: (flightRecorder.timeline?.at(-1)?.t || 0) + 12,
          phase: 'chat_os',
          detail: `Hubly Chat OS: ${chatOsFast.routes.length} route(s)`,
          meta: { ...flightRecorder.chatOs },
        },
      ];
    }
    return {
      ok: true,
      intent: 'conversation_intelligence',
      response: ed.ownerResponse,
      questions: ed.questions,
      celebrate: !!ed.celebrate,
      confidence: ed.confidence,
      expertsRun: ['experience_director'],
      expertOutputs: [],
      failures: [],
      dna,
      conversationIntelligence,
      conversationIntelligenceCommittedBy: CONVERSATION_INTELLIGENCE_OWNER,
      conversationIntelligenceRetrieval: retrieval,
      chatOs: chatOsFast,
      missionControlExecutionId: flightRecorder.executionId,
      flightRecorder,
      experienceDirector: {
        reviewedBy: 'experience_director',
        actions: [...(ed.actions || []), 'answered_from_conversation_intelligence'],
        questionsShown: ed.questions?.length || 0,
        celebrate: !!ed.celebrate,
        hideDetails: true,
      },
    };
  }

  // Section 6 — Workspace / weather fast-path (Experience Director only)
  // Milestone 1.5: if Builder Expert is selected, use the full expert pipeline.
  // When only ED is selected (or weather), keep the explanatory fast-path.
  if (intent === 'workspace' || intent === 'weather') {
    const orderedFast = selectExpertsFromRegistry({ intent, request: String(req.request || '') });
    const domainExperts = orderedFast.filter((id) => id !== 'experience_director' && id !== 'builder');
    // Builder may also match workspace — still allow ED fast-path when no other domain experts
    // and the request is a simple layout move (Founder Scenario 4). Builder epics pass
    // registryRouting that still executes builder on the full path when needed.
    const simpleLayoutMove = /move |above|sidebar|pin |hide /i.test(String(req.request || ''));
    const builderSelected = orderedFast.includes('builder');
    // Prefer full Builder pipeline when Builder Expert is selected (M1.5 epics).
    // Prefer ED fast-path when Builder is NOT selected.
    if (!builderSelected && domainExperts.length === 0) {
    const wsLook = queryWorkspaceMemory(workspace, 'What does my workspace look like?').answer;
    const looksLikeMove = /move |above|sidebar|jobs|customers|pin |hide /i.test(String(req.request || ''));
    const wsSummary = workspaceChanges.length || looksLikeMove
      ? wsLook
      : (wsLook || 'I can rearrange your workspace from preferences — tell me exactly what to move, hide, or pin.');
    const draft = intent === 'weather'
      ? "I can check the weather for your service area once location services are connected — for now, tell me your city and I'll keep it in Business Memory."
      : (workspaceChanges.length || looksLikeMove
        ? `Done — I moved your workspace the way you like. ${wsSummary}`
        : wsSummary);
    const ed = applyExperienceDirector({
      request: req.request,
      draftResponse: draft,
      proposedQuestions: [],
      confidence: intent === 'weather' ? 90 : 92,
      criticOk: true,
    });
    const ownerResponse = (intent === 'workspace' && !(ed.ownerResponse || '').match(/jobs|customers|sidebar|moved|workspace/i))
      ? draft
      : ed.ownerResponse;
    const edRecord = {
      expertId: 'experience_director',
      expertName: 'Experience Director',
      ok: true,
      status: 'ok',
      executionTimeMs: Date.now() - started,
      retries: 0,
      summary: ownerResponse,
      output: { type: 'Experience Review', ownerResponse, workspaceChanges },
      payload: { type: 'Experience Review', ownerResponse, workspaceChanges },
      reasoning: [{
        reason: 'Experience Director fast-path for workspace/weather.',
        evidence: [intent, ...workspaceChanges.map((c) => c.path)],
        confidence: ed.confidence,
      }],
      confidence: ed.confidence,
      questions: ed.questions,
    };
    const flightRecorder = recordFlightRecorder({
      request: String(req.request || ''),
      intent,
      businessId,
      startedAt: new Date(started).toISOString(),
      latencyMs: Date.now() - started,
      ok: true,
      memoriesLoaded: ['business_memory', 'workspace_memory', 'conversation_intelligence'],
      dnaFactsUsed: [],
      expertsExecuted: [{
        expertId: 'experience_director',
        status: 'ok',
        confidence: ed.confidence,
        ms: Date.now() - started,
        summary: String(ownerResponse || '').slice(0, 160),
      }],
      reasoningObjects: [],
      decisionObjects: [],
      capabilitiesSelected: [],
      knowledgeAccessed: [],
      finalResponse: ownerResponse,
      memoryWrites: workspaceChanges.length
        ? [{ system: 'workspace_memory', summary: `${workspaceChanges.length} change(s)` }]
        : [],
      confidence: ed.confidence,
      decisionScore: null,
      decisionAction: 'workspace_preferences',
      builderIntent: null,
      chatOs: null,
    });
    const chatOsFast = buildChatOsSession({
      businessId: businessId || `biz_${Date.now().toString(36)}`,
      request: String(req.request || ''),
      response: ownerResponse,
      channel: req.channel || 'typing',
      ownerName: req.memory?.name || null,
      industry: req.memory?.industry || null,
      conversationIntelligence,
      memoriesLoaded: ['business_memory', 'workspace_memory', 'conversation_intelligence'],
      missionControlReplayId: flightRecorder.executionId,
    });
    if (flightRecorder) {
      flightRecorder.chatOs = {
        id: chatOsFast.id,
        label: chatOsFast.label,
        channel: chatOsFast.channel,
        voiceReady: true,
        routeCount: chatOsFast.routes.length,
        routes: [...chatOsFast.routes],
        builderCount: chatOsFast.buildersInvoked.length,
        toolCount: chatOsFast.toolsUsed.length,
        memoryCount: chatOsFast.memoriesRead.length,
        activeProject: chatOsFast.activeProject?.name ?? null,
        canvasSurface: chatOsFast.canvas.activeSurface,
        proactiveCount: chatOsFast.proactiveStarters.length,
        singlePersonality: true,
        requiresApproval: true,
        applied: false,
        executed: false,
        waitingFor: chatOsFast.waitingFor,
      };
    }
    return {
      ok: true,
      intent,
      response: ownerResponse,
      questions: ed.questions,
      celebrate: !!ed.celebrate,
      confidence: ed.confidence,
      expertsRun: ['experience_director'],
      expertOutputs: [edRecord],
      failures: [],
      dna,
      workspace,
      workspaceChanges,
      conversationIntelligence,
      registryRouting,
      builderIntent: null,
      chatOs: chatOsFast,
      missionControlExecutionId: flightRecorder.executionId,
      flightRecorder,
      experienceDirector: {
        reviewedBy: 'experience_director',
        actions: [...(ed.actions || []), 'workspace_fast_path'],
        questionsShown: ed.questions?.length || 0,
        celebrate: !!ed.celebrate,
        hideDetails: true,
      },
    };
    }
  }

  // Section 9 / 8 — Why? from Decision Objects or Reasoning Objects (never regenerate).
  if (
    intent === 'why' ||
    isWhyDecisionQuestion(String(req.request || '')) ||
    isWhyQuestion(String(req.request || ''))
  ) {
    const whyDecision = isWhyDecisionQuestion(String(req.request || ''))
      ? answerWhyFromDecision(String(req.request || ''), { businessId })
      : null;
    const why = whyDecision
      ? null
      : answerWhyFromReasoning(String(req.request || ''), { businessId });
    const draft = whyDecision?.answer || why?.answer || "I don't have stored reasoning for that yet.";
    const conf = whyDecision?.decision?.decisionScore ?? why?.confidence ?? 50;
    const ed = applyExperienceDirector({
      request: req.request,
      draftResponse: draft,
      proposedQuestions: [],
      confidence: conf,
      criticOk: true,
    });
    const edRecord = {
      expertId: 'experience_director',
      expertName: 'Experience Director',
      ok: true,
      status: 'ok',
      executionTimeMs: Date.now() - started,
      retries: 0,
      summary: ed.ownerResponse,
      output: {
        type: 'Experience Review',
        ownerResponse: ed.ownerResponse,
        fromStoredReasoning: !whyDecision,
        fromStoredDecision: !!whyDecision,
      },
      payload: {
        type: 'Experience Review',
        ownerResponse: ed.ownerResponse,
        fromStoredReasoning: !whyDecision,
        fromStoredDecision: !!whyDecision,
      },
      reasoning: [{
        reason: whyDecision
          ? 'Answered Why? from stored Decision Object — not regenerated.'
          : 'Answered Why? from stored Reasoning Object — not regenerated.',
        evidence: whyDecision?.decision
          ? [whyDecision.decision.decisionId, whyDecision.decision.finalDecision]
          : why?.reasoning
          ? [why.reasoning.reasoningId, why.reasoning.decisionKey]
          : [],
        confidence: conf,
      }],
      confidence: ed.confidence,
      questions: ed.questions,
    };
    return {
      ok: true,
      intent: 'why',
      response: ed.ownerResponse,
      questions: ed.questions,
      celebrate: !!ed.celebrate,
      confidence: ed.confidence,
      confidenceBand: decisionActionToConfidenceBand(whyDecision?.decision?.finalDecision || 'ask'),
      expertsRun: ['experience_director'],
      expertOutputs: [edRecord],
      mergedExpertRecords: [toMergedRecord(edRecord)],
      expertTranscript: {
        customerVisible: false,
        entries: [buildTranscriptEntry(edRecord, 0, req, 'why', [])],
        assembly: {
          expertsInOrder: ['experience_director'],
          finalResponseSource: 'experience_director',
          mergedFrom: whyDecision
            ? ['experience_director', 'decision_engine']
            : ['experience_director', 'reasoning_engine'],
          howAssembled: whyDecision
            ? 'Hubly Brain retrieved stored Decision Object(s) and Experience Director phrased the answer.'
            : 'Hubly Brain retrieved stored Reasoning Object(s) and Experience Director phrased the answer.',
        },
      },
      failures: [],
      dna,
      timeline: [{
        expertId: 'experience_director',
        ms: Date.now() - started,
        confidence: ed.confidence,
        summary: ed.ownerResponse,
      }],
      reasoningObjects: why?.reasoning
        ? [why.reasoning, ...why.history.filter((h) => h.reasoningId !== why.reasoning.reasoningId)]
        : [],
      whyAnswer: why,
      decisionObjects: whyDecision?.decision ? [whyDecision.decision] : [],
      whyDecisionAnswer: whyDecision,
      primaryDecision: whyDecision?.decision || null,
      experienceDirector: {
        reviewedBy: 'experience_director',
        actions: [
          ...(ed.actions || []),
          whyDecision ? 'answered_from_stored_decision' : 'answered_from_stored_reasoning',
        ],
        questionsShown: ed.questions?.length || 0,
        celebrate: !!ed.celebrate,
        hideDetails: true,
      },
      console: {
        intent: 'why',
        expertsSelected: ['experience_director'],
        latencyMs: Date.now() - started,
      },
    };
  }

  const ordered = selectExpertsFromRegistry({
    intent,
    request: String(req.request || ''),
    forced: req.experts || null,
  });
  if (!ordered.includes('experience_director')) {
    throw new Error('Section 2 invariant violated: Experience Director not selected by registry');
  }

  const expertOutputs = [];
  const timeline = [];
  const failures = [];

  for (const expertId of ordered) {
    const priorSnapshot = [...expertOutputs];
    const out = await runExpert(expertId, {
      request: req.request,
      intent,
      memory: req.memory || null,
      dna,
      workspace: req.workspace || null,
      conversation: req.conversation || null,
      blueprintKnowledge: req.blueprintKnowledge || dna.knowledge || null,
      priorOutputs: priorSnapshot,
    });
    expertOutputs.push(out);
    timeline.push({
      expertId,
      ms: out.executionTimeMs ?? 0,
      confidence: out.confidence,
      summary: out.summary,
    });
    if (out.status === 'failed' || out.status === 'skipped' || out.ok === false) {
      failures.push({
        expertId,
        status: out.status || 'failed',
        error: out.error ? sanitizeExpertError(out.error) : null,
        retries: out.retries ?? 0,
      });
    }

    if (expertId === 'critic') {
      const report = out.output || out.payload || {};
      if (report.requestRegeneration && ordered.includes('creative_director')) {
        const regen = await runExpert('creative_director', {
          request: req.request,
          intent,
          memory: req.memory || null,
          dna: req.dna || null,
          priorOutputs: expertOutputs.filter((o) => o.expertId !== 'creative_director' && o.expertId !== 'critic'),
        });
        regen.retries = (regen.retries || 0) + 1;
        regen.status = regen.ok ? 'retried' : regen.status;
        const idx = expertOutputs.findIndex((o) => o.expertId === 'creative_director');
        if (idx >= 0) expertOutputs[idx] = regen;
        else expertOutputs.push(regen);
        timeline.push({
          expertId: 'creative_director',
          ms: regen.executionTimeMs ?? 0,
          confidence: regen.confidence,
          summary: `regenerated: ${regen.summary}`,
        });
      }
    }
  }

  const experience = expertOutputs.find((o) => o.expertId === 'experience_director');
  if (!experience) {
    throw new Error('Section 2 invariant violated: Experience Director did not review this response');
  }
  const critic = expertOutputs.find((o) => o.expertId === 'critic');
  const payload = experience.output || experience.payload || {};
  let response = payload.ownerResponse || experience.summary || "I'm thinking about your business.";
  let questions = (payload.questions || experience.questions || []).slice(0, 3);
  let edActions = [...(payload.actions || ['reviewed'])];
  const confidence = clampAvg(expertOutputs.map((o) => o.confidence));

  if (/openai|anthropic|stack|exception|not_registered|expert_failed/i.test(response)) {
    const safe = applyExperienceDirector({
      request: req.request,
      draftResponse: "I'm putting together a clear next step for your business.",
      proposedQuestions: questions,
      confidence: Math.max(60, confidence),
      criticOk: true,
    });
    response = safe.ownerResponse;
    questions = safe.questions;
    edActions = [...edActions, ...safe.actions, 'sanitized_customer_response'];
  }

  const expertTranscript = {
    customerVisible: false,
    entries: expertOutputs.map((out, idx) => buildTranscriptEntry(out, idx, req, intent, expertOutputs)),
    assembly: {
      expertsInOrder: ordered,
      finalResponseSource: 'experience_director',
      mergedFrom: expertOutputs.map((o) => o.expertId),
      howAssembled:
        'Hubly Brain ran registry-selected experts in priority order, collected structured outputs ' +
        '(Research Report → Business Strategy → Creative Plan → Quality Report → Experience Review), ' +
        'then Experience Director produced the single customer-facing response.',
    },
  };

  // Section 9 — AI Decision Engine
  const requestText = String(req.request || '');
  const isHomepageRewrite = /rewrite (my |the )?homepage/i.test(requestText);
  const strategyOut = expertOutputs.find((o) => o.expertId === 'strategy');
  const strategyPayload = strategyOut?.output || strategyOut?.payload || {};
  const primaryDecision = isHomepageRewrite
    ? assessHomepageRewrite({
      request: requestText,
      businessId,
      confidence,
      hasBusinessMemory: !!(req.memory?.industry || req.memory?.name),
      hasBusinessDna: !!dna.knowledgePack,
      hasStrategy: !!(strategyPayload.homepageStrategy || strategyPayload.positioning),
      industryKnown: !!(req.memory?.industry || dna.knowledgePack?.industryProfile?.industryName),
      missingInfo: [
        ...(req.memory?.industry ? [] : ['industry']),
        ...(req.memory?.name ? [] : ['business_name']),
      ],
    })
    : assessDecision({
      recommendation:
        strategyPayload.homepageStrategy ||
        strategyPayload.positioning ||
        strategyOut?.summary ||
        'Apply expert recommendation',
      request: requestText,
      confidence,
      evidence: (strategyOut?.reasoning || []).flatMap((r) => r.evidence || []).slice(0, 5),
      evidenceSourceKinds: [
        dna.knowledgePack ? 'business_dna' : 'system',
        'strategy_expert',
        'research_expert',
      ],
      hasBusinessMemory: !!(req.memory?.industry || req.memory?.name),
      hasBusinessDna: !!dna.knowledgePack,
      hasStrategy: !!(strategyPayload.homepageStrategy || strategyPayload.positioning),
      industryKnown: !!req.memory?.industry,
      expectedOutcome: 'higher_conversion',
      touchesWebsite: /website|homepage|layout|brand/i.test(requestText) || intent === 'build_business',
      businessId,
      reasoningKey: intent,
    });

  if (primaryDecision.finalDecision === 'ask') {
    if (!questions.length) {
      questions = primaryDecision.missingInfo.length
        ? [`Quick one — what's your ${primaryDecision.missingInfo[0].replace(/_/g, ' ')}?`]
        : ['What matters most right now — more bookings, or a more premium feel?'];
    }
    edActions = [...edActions, 'decision_engine_ask'];
  } else if (primaryDecision.finalDecision === 'research_more') {
    // Workspace layout moves are already applied in Workspace Memory — don't mute them.
    if (intent !== 'workspace') {
      const edMore = applyExperienceDirector({
        request: req.request,
        draftResponse: "I want to research a bit more before I commit — the evidence isn't strong enough yet.",
        proposedQuestions: questions.length ? questions : ['Tell me who you mainly serve.'],
        confidence: primaryDecision.decisionScore,
        criticOk: false,
      });
      response = edMore.ownerResponse;
      questions = edMore.questions;
      edActions = [...edActions, ...edMore.actions, 'decision_engine_research_more'];
    } else {
      edActions = [...edActions, 'decision_engine_research_more_skipped_for_workspace'];
    }
  } else if (primaryDecision.finalDecision === 'recommend') {
    edActions = [...edActions, 'decision_engine_recommend', 'requires_owner_approval'];
    if (isHomepageRewrite && !/approval|approve|say the word/i.test(response)) {
      response = `${response} I recommend this homepage rewrite — say the word and I'll apply it.`;
    }
  } else if (primaryDecision.finalDecision === 'proceed') {
    edActions = [...edActions, 'decision_engine_proceed'];
  }

  // Workspace intent must explain the change (Founder Scenario 4) even when Builder + Decision Engine ran.
  if (intent === 'workspace') {
    const wsLook = queryWorkspaceMemory(workspace, 'What does my workspace look like?').answer;
    if (!/jobs|customers|sidebar|moved|workspace/i.test(response || '')) {
      response = `Done — I moved your workspace the way you like. ${wsLook}`;
      edActions = [...edActions, 'workspace_explanation_restored'];
    }
  }

  // Section 10 — update Conversation Intelligence
  conversationIntelligence = applyConversationIntelligenceTurn(
    conversationIntelligence,
    String(req.request || ''),
    {
      businessId,
      expertsRun: ordered,
      expertStatuses: expertOutputs.map((o) => ({
        expertId: o.expertId,
        status: o.status || (o.ok ? 'complete' : 'failed'),
      })),
      phase: 'experts_complete',
    },
  );
  if (
    /^(hi|hello|hey)\b/i.test(String(req.request || '').trim()) &&
    conversationIntelligence.currentProject
  ) {
    response = buildResumeGreeting(conversationIntelligence);
    edActions = [...edActions, 'conversation_intelligence_resume'];
  }
  if (businessId) persistConversationIntelligenceLocal(businessId, conversationIntelligence);

  // Milestone 1.5 prep — surface Builder Plan language for discovered booking capabilities
  const bookingCaps = (registryRouting?.capabilities || []).filter((c) =>
    c.capabilityId === 'arrival_windows' || c.capabilityId === 'no_same_day_bookings'
  );
  if (bookingCaps.length && !/arrival|same.?day/i.test(response)) {
    const labels = bookingCaps
      .map((c) => c.capabilityLabel || c.label || c.capabilityId)
      .join(' and ');
    response =
      `${response} I can set up ${labels} for your booking flow — I'll show a preview and wait for your approval before anything goes live.`;
    edActions = [...edActions, 'builder_plan_preview', 'requires_owner_approval'];
  }

  // Section 8 — persist structured Reasoning Objects + Decision Graph for build flows.
  let reasoningObjects = [];
  if (
    intent === 'build_business' ||
    /pressure\s*wash|starting a|homepage|booking|pricing/i.test(String(req.request || ''))
  ) {
    reasoningObjects = recordBuildBusinessReasoningChain({
      request: String(req.request || ''),
      businessId,
      businessVersion: req.memory?.memoryVersion ?? null,
      workspaceVersion: req.workspace?.memoryVersion ?? null,
      dnaVersion: dna.knowledgePack?.knowledgeVersion ?? dna.version ?? null,
      industry:
        req.memory?.industry ||
        req.memory?.business?.industry ||
        dna.knowledgePack?.industryProfile?.industryName ||
        null,
      experts: ordered,
    });
  }

  // Section 12 — Mission Control flight recorder (AI Replay)
  const builderOut = expertOutputs.find((o) => o.expertId === 'builder') || null;
  const builderIntent = extractBuilderIntentFromOutput(builderOut);
  const changePlan = builderIntent
    ? generateChangePlan(builderIntent, { missionControlReplayId: null }).changePlan
    : null;
  const preview = changePlan
    ? generatePreview(changePlan, { missionControlReplayId: null }).preview
    : null;
  const collaboration = preview && changePlan
    ? startCollaboration(preview, changePlan, { missionControlReplayId: null }).session
    : null;
  const businessVersion = changePlan
    ? proposeVersionFromPlan(
      businessId || `biz_${Date.now().toString(36)}`,
      changePlan,
      preview,
      collaboration,
    )
    : null;
  const creativeSession = changePlan
    ? startCreativeSession({
      businessId: businessId || `biz_${Date.now().toString(36)}`,
      plan: changePlan,
      preview,
      collaboration,
      businessVersion,
      missionControlReplayId: null,
    }).session
    : null;
  const bookingRequest = String(req.request || '');
  const wantsBookingIntelligence = !!(
    changePlan &&
    (changePlan.affectedSystems.includes('Booking') ||
      changePlan.changes.some((c) => c.path.startsWith('booking.')) ||
      /same-?day|arrival window|travel|buffer|capacity|weather|ceramic.*(friday|only)|fridays? (are|only).*ceramic|estimate|optimiz|seasonal|minimum notice|skill rout|emergency.?only/.test(
        bookingRequest.toLowerCase(),
      ))
  );
  const bookingIntelligence =
    wantsBookingIntelligence && changePlan
      ? buildBookingIntelligence({
        businessId: businessId || `biz_${Date.now().toString(36)}`,
        plan: changePlan,
        industry:
          req.memory?.industry ||
          req.memory?.business?.industry ||
          dna?.knowledgePack?.industryProfile?.industryName ||
          null,
        missionControlReplayId: null,
      })
      : null;
  const workspaceRequest = String(req.request || '');
  const wantsWorkspaceIntelligence = !!(
    changePlan &&
    (changePlan.affectedSystems.includes('Workspace') ||
      changePlan.changes.some((c) => c.path.startsWith('workspace.')) ||
      /jobs above|sidebar|hide |pin |homepage|calendar.*(home|landing)|mobile|phone workspace|never use|what (do you think|should i)|focus mode|job day/.test(
        workspaceRequest.toLowerCase(),
      ))
  );
  const workspaceIntelligence =
    wantsWorkspaceIntelligence && changePlan
      ? buildWorkspaceIntelligence({
        businessId: businessId || `biz_${Date.now().toString(36)}`,
        plan: changePlan,
        industry:
          req.memory?.industry ||
          req.memory?.business?.industry ||
          dna?.knowledgePack?.industryProfile?.industryName ||
          null,
        missionControlReplayId: null,
      })
      : null;
  const automationRequest = String(req.request || '');
  const wantsAutomationIntelligence = !!(
    changePlan &&
    (changePlan.affectedSystems.includes('Automations') ||
      changePlan.changes.some((c) => c.path.startsWith('automations.')) ||
      /prep instruction|automat|workflow|review request|ask for (a )?review|quote.*follow|if it rains|membership|friday.*(summary|report)|recurring customer/.test(
        automationRequest.toLowerCase(),
      ))
  );
  const automationIntelligence =
    wantsAutomationIntelligence && changePlan
      ? buildAutomationIntelligence({
        businessId: businessId || `biz_${Date.now().toString(36)}`,
        plan: changePlan,
        industry:
          req.memory?.industry ||
          req.memory?.business?.industry ||
          dna?.knowledgePack?.industryProfile?.industryName ||
          null,
        missionControlReplayId: null,
      })
      : null;
  const mediaRequest = String(req.request || '');
  const wantsMediaIntelligence = !!(
    changePlan &&
    (changePlan.affectedSystems.includes('Portfolio') ||
      changePlan.changes.some((c) => c.path.startsWith('portfolio.') || c.path.startsWith('media.')) ||
      /upload|photos|gallery|portfolio|instagram|before.?after|hero|weak photo|organize everything|visual timeline|evolved over/.test(
        mediaRequest.toLowerCase(),
      ))
  );
  const mediaIntelligence =
    wantsMediaIntelligence && changePlan
      ? buildMediaIntelligence({
        businessId: businessId || `biz_${Date.now().toString(36)}`,
        plan: changePlan,
        industry:
          req.memory?.industry ||
          req.memory?.business?.industry ||
          dna?.knowledgePack?.industryProfile?.industryName ||
          null,
        missionControlReplayId: null,
      })
      : null;
  const chatOs = buildChatOsSession({
    businessId: businessId || `biz_${Date.now().toString(36)}`,
    request: String(req.request || ''),
    response,
    channel: req.channel || 'typing',
    ownerName: req.memory?.name || null,
    industry:
      req.memory?.industry ||
      req.memory?.business?.industry ||
      dna?.knowledgePack?.industryProfile?.industryName ||
      null,
    conversationIntelligence,
    builderIntent,
    changePlan,
    preview,
    creativeSession,
    bookingIntelligence,
    workspaceIntelligence,
    automationIntelligence,
    mediaIntelligence,
    memoriesLoaded: [
      'business_memory',
      'business_dna',
      'workspace_memory',
      'conversation_intelligence',
    ],
    missionControlReplayId: null,
  });
  // Epic 12 — only when caller supplies an approved collaboration + deployApproved.
  const approvedCollab = req.approvedCollaboration || null;
  const deployment =
    req.deployApproved && changePlan && preview && approvedCollab
      ? deployApprovedChangePlan({
        businessId: businessId || `biz_${Date.now().toString(36)}`,
        plan: changePlan,
        preview,
        collaboration: approvedCollab,
        businessVersion,
        missionControlReplayId: null,
      })
      : null;
  const flightRecorder = recordFlightRecorder({
    request: String(req.request || ''),
    intent,
    businessId,
    startedAt: new Date(started).toISOString(),
    latencyMs: Date.now() - started,
    ok: critic ? critic.ok !== false : true,
    memoriesLoaded: [
      'business_memory',
      'business_dna',
      'workspace_memory',
      'conversation_intelligence',
    ],
    dnaFactsUsed: (dna.knowledgePack?.evidence || []).slice(0, 8).map((e) => e.id || e.claim).filter(Boolean),
    expertsExecuted: expertOutputs.map((o) => ({
      expertId: o.expertId,
      status: o.status || (o.ok ? 'ok' : 'failed'),
      confidence: o.confidence ?? 0,
      ms: o.executionTimeMs ?? 0,
      summary: String(o.summary || '').slice(0, 160),
    })),
    reasoningObjects: (reasoningObjects || []).map((r) => ({
      reasoningId: r.reasoningId,
      decisionKey: r.decisionKey,
      decision: r.decision,
      confidence: r.confidence,
    })),
    decisionObjects: [primaryDecision].filter(Boolean).map((d) => ({
      decisionId: d.decisionId,
      recommendation: d.recommendation,
      finalDecision: d.finalDecision,
      decisionScore: d.decisionScore,
      requiresApproval: d.requiresApproval,
    })),
    capabilitiesSelected: (registryRouting?.capabilities || []).map((c) => ({
      toolId: c.toolId,
      capabilityId: c.capabilityId,
      label: c.capabilityLabel,
    })),
    knowledgeAccessed: (registryRouting?.knowledge || []).map((k) => ({
      knowledgeId: k.knowledgeId,
      name: k.name,
      access: k.access,
    })),
    finalResponse: response,
    memoryWrites: [
      { system: 'conversation_intelligence', summary: conversationIntelligence.currentProject || 'updated' },
    ],
    confidence,
    decisionScore: primaryDecision?.decisionScore ?? null,
    decisionAction: primaryDecision?.finalDecision ?? null,
    builderIntent: builderIntent
      ? {
        intentId: builderIntent.intentId,
        category: builderIntent.intentCategory,
        label: builderIntent.intentLabel,
        goal: builderIntent.ownerGoal,
        affectedSystems: [...builderIntent.affectedSystems],
        capabilities: builderIntent.requiredCapabilities.map(
          (c) => `${c.toolName}:${c.capabilityId}`,
        ),
        risk: builderIntent.estimatedRisk,
        confidence: builderIntent.confidence,
        confidenceExplanation: builderIntent.confidenceExplanation.summary,
        requiresChangePlan: builderIntent.requiresChangePlan,
        applied: false,
        changePlanGenerated: false,
      }
      : null,
    changePlan: changePlan
      ? {
        id: changePlan.id,
        intentId: changePlan.intentId,
        title: changePlan.title,
        builderType: changePlan.builderType,
        affectedSystems: [...changePlan.affectedSystems],
        actionCount: changePlan.changes.length,
        actions: changePlan.changes.map((a) => ({
          path: a.path,
          builderOwner: a.builderOwner,
          risk: a.risk,
        })),
        risk: changePlan.risk,
        confidence: changePlan.confidence,
        requiresApproval: changePlan.requiresApproval,
        validationOk: changePlan.validation.ok,
        estimatedImpact: changePlan.estimatedImpact.summary,
        applied: false,
        executed: false,
        previewGenerated: !!preview,
      }
      : null,
    preview: preview
      ? {
        id: preview.id,
        changePlanId: preview.changePlanId,
        intentId: preview.intentId,
        title: preview.title,
        headline: preview.headline,
        primarySurface: preview.primarySurface,
        optionCount: preview.options.length,
        versionCount: preview.versions.length,
        currentVersion: preview.currentVersion,
        lifecycle: preview.lifecycle,
        progressiveComplete: preview.progressiveComplete,
        stageCount: preview.stages.length,
        compareModes: [...new Set(preview.surfaces.map((s) => s.compareMode))],
        applied: false,
        executed: false,
        published: false,
        mutatedLiveState: false,
        waitingFor: preview.waitingFor,
      }
      : null,
    collaboration: collaboration
      ? {
        id: collaboration.id,
        previewId: collaboration.previewId,
        changePlanId: collaboration.changePlanId,
        phase: collaboration.phase,
        openingPrompt: collaboration.openingPrompt,
        iterations: collaboration.iterations,
        recommendationLabel: collaboration.recommendation?.label || null,
        recommendationConfidence: collaboration.recommendation?.confidence ?? null,
        alternativeCount: collaboration.alternatives.length,
        hasNegotiation: !!collaboration.negotiation,
        partialApprovalCount: collaboration.partialApprovals.length,
        hasSummary: !!collaboration.summary,
        launchCta: collaboration.launchCta,
        ownerConfidence: collaboration.ownerConfidence,
        status: collaboration.status,
        applied: false,
        executed: false,
        waitingFor: collaboration.waitingFor,
      }
      : null,
    businessVersion: businessVersion
      ? {
        id: businessVersion.id,
        label: businessVersion.label,
        status: businessVersion.status,
        changePlanId: businessVersion.changePlanId,
        surfaces: [...businessVersion.surfaces],
        changeCount: businessVersion.changes.length,
        parentVersionId: businessVersion.parentVersionId,
        rollbackAvailable: true,
        applied: false,
        rollbackExecuted: false,
      }
      : null,
    creativeSession: creativeSession
      ? {
        id: creativeSession.id,
        label: creativeSession.label,
        direction: creativeSession.direction.label,
        decisionCount: creativeSession.decisions.length,
        surfacesTouched: [...creativeSession.surfacesTouched],
        businessScoreOverall: creativeSession.score.overall,
        preferenceCount: creativeSession.memory.preferences.length,
        hasChallenge: !!creativeSession.challenge,
        requiresApproval: true,
        applied: false,
        executed: false,
        waitingFor: creativeSession.waitingFor,
      }
      : null,
    bookingIntelligence: bookingIntelligence
      ? {
        id: bookingIntelligence.id,
        label: bookingIntelligence.label,
        ruleCount: bookingIntelligence.rules.length,
        concepts: [...new Set(bookingIntelligence.rules.map((r) => r.conceptId))],
        healthOverall: bookingIntelligence.health.overall,
        recommendationCount: bookingIntelligence.recommendations.length,
        simulatorHorizonDays: bookingIntelligence.simulator.horizonDays,
        industry: bookingIntelligence.industry,
        requiresApproval: true,
        applied: false,
        executed: false,
        waitingFor: bookingIntelligence.waitingFor,
      }
      : null,
    workspaceIntelligence: workspaceIntelligence
      ? {
        id: workspaceIntelligence.id,
        label: workspaceIntelligence.label,
        changeCount: workspaceIntelligence.changes.length,
        concepts: [...new Set(workspaceIntelligence.changes.map((c) => c.conceptId))],
        healthOverall: workspaceIntelligence.health.overall,
        recommendationCount: workspaceIntelligence.recommendations.length,
        homepage: workspaceIntelligence.homepage.landing,
        focusMode: workspaceIntelligence.focusMode?.mode ?? null,
        deviceCount: workspaceIntelligence.devices.length,
        requiresApproval: true,
        applied: false,
        executed: false,
        waitingFor: workspaceIntelligence.waitingFor,
      }
      : null,
    automationIntelligence: automationIntelligence
      ? {
        id: automationIntelligence.id,
        label: automationIntelligence.label,
        workflowCount: automationIntelligence.workflows.length,
        outcomes: [...new Set(automationIntelligence.workflows.map((w) => w.outcomeId))],
        healthOverall: automationIntelligence.health.overall,
        timeSavedHoursPerMonth: automationIntelligence.health.timeSavedHoursPerMonth,
        recommendationCount: automationIntelligence.recommendations.length,
        discoveryCount: automationIntelligence.discovery.length,
        simulationHorizonDays: automationIntelligence.simulation.horizonDays,
        requiresApproval: true,
        applied: false,
        executed: false,
        waitingFor: automationIntelligence.waitingFor,
      }
      : null,
    mediaIntelligence: mediaIntelligence
      ? {
        id: mediaIntelligence.id,
        label: mediaIntelligence.label,
        assetCount: mediaIntelligence.assets.length,
        changeCount: mediaIntelligence.changes.length,
        concepts: [...new Set(mediaIntelligence.changes.map((c) => c.conceptId))],
        healthOverall: mediaIntelligence.health.overall,
        recommendationCount: mediaIntelligence.recommendations.length,
        missingContentCount: mediaIntelligence.missingContent.length,
        surfaceCount: mediaIntelligence.multiSurface.surfaces.filter((s) => s.selected).length,
        requiresApproval: true,
        applied: false,
        executed: false,
        published: false,
        waitingFor: mediaIntelligence.waitingFor,
      }
      : null,
    chatOs: {
      id: chatOs.id,
      label: chatOs.label,
      channel: chatOs.channel,
      voiceReady: true,
      routeCount: chatOs.routes.length,
      routes: [...chatOs.routes],
      builderCount: chatOs.buildersInvoked.length,
      toolCount: chatOs.toolsUsed.length,
      memoryCount: chatOs.memoriesRead.length,
      activeProject: chatOs.activeProject?.name ?? null,
      canvasSurface: chatOs.canvas.activeSurface,
      proactiveCount: chatOs.proactiveStarters.length,
      singlePersonality: true,
      requiresApproval: true,
      applied: false,
      executed: false,
      waitingFor: chatOs.waitingFor,
    },
    deployment: deployment
      ? {
        id: deployment.id,
        label: deployment.label,
        status: deployment.status,
        changePlanId: deployment.changePlanId,
        businessVersionLabel: deployment.businessVersionLabel,
        stageCount: deployment.stages.length,
        builders: deployment.stages.map((s) => s.ownerLabel),
        validationScore: deployment.validation.score,
        healthOverall: deployment.health.overall,
        dryRunOk: deployment.dryRun.ok,
        verified: deployment.verified,
        deployed: deployment.deployed,
        rolledBack: deployment.rolledBack,
        feedCount: deployment.feed.length,
      }
      : null,
  });

  if (changePlan && flightRecorder.executionId) {
    for (const a of changePlan.changes) {
      a.missionControlReplayId = flightRecorder.executionId;
    }
  }
  if (preview && flightRecorder.executionId) {
    preview.missionControlReplayId = flightRecorder.executionId;
  }
  if (collaboration && flightRecorder.executionId) {
    collaboration.missionControlReplayId = flightRecorder.executionId;
  }
  if (businessVersion && flightRecorder.executionId) {
    businessVersion.missionControlReplayId = flightRecorder.executionId;
  }
  if (creativeSession && flightRecorder.executionId) {
    creativeSession.missionControlReplayId = flightRecorder.executionId;
  }
  if (bookingIntelligence && flightRecorder.executionId) {
    bookingIntelligence.missionControlReplayId = flightRecorder.executionId;
  }
  if (workspaceIntelligence && flightRecorder.executionId) {
    workspaceIntelligence.missionControlReplayId = flightRecorder.executionId;
  }
  if (automationIntelligence && flightRecorder.executionId) {
    automationIntelligence.missionControlReplayId = flightRecorder.executionId;
  }
  if (mediaIntelligence && flightRecorder.executionId) {
    mediaIntelligence.missionControlReplayId = flightRecorder.executionId;
  }
  if (flightRecorder.executionId) {
    chatOs.missionControlReplayId = flightRecorder.executionId;
  }
  if (deployment && flightRecorder.executionId) {
    deployment.missionControlReplayId = flightRecorder.executionId;
  }

  return {
    ok: critic ? critic.ok !== false : true,
    intent,
    response,
    questions,
    celebrate: !!payload.celebrate,
    confidence,
    confidenceBand: decisionActionToConfidenceBand(primaryDecision.finalDecision),
    expertsRun: ordered,
    expertOutputs,
    mergedExpertRecords: expertOutputs.map(toMergedRecord),
    expertTranscript,
    failures,
    dna,
    timeline,
    reasoningObjects,
    whyAnswer: null,
    decisionObjects: [primaryDecision],
    whyDecisionAnswer: null,
    primaryDecision,
    conversationIntelligence,
    conversationIntelligenceCommittedBy: CONVERSATION_INTELLIGENCE_OWNER,
    conversationIntelligenceRetrieval: null,
    registryRouting,
    builderIntent,
    changePlan,
    preview,
    collaboration,
    businessVersion,
    creativeSession,
    bookingIntelligence,
    workspaceIntelligence,
    automationIntelligence,
    mediaIntelligence,
    chatOs,
    deployment,
    missionControlExecutionId: flightRecorder.executionId,
    flightRecorder,
    experienceDirector: {
      reviewedBy: 'experience_director',
      actions: edActions,
      questionsShown: questions.length,
      celebrate: !!payload.celebrate,
      hideDetails: true,
    },
    console: {
      intent,
      expertsSelected: ordered,
      latencyMs: Date.now() - started,
    },
  };
}
