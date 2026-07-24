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

export function detectIntent(request, explicit) {
  if (explicit) return String(explicit);
  const r = String(request || '').toLowerCase();
  if (isWhyDecisionQuestion(r) || isWhyQuestion(r)) return 'why';
  if (isConversationIntelligenceQuestion(r)) return 'conversation_intelligence';
  if (/weather|forecast|temperature/.test(r)) return 'weather';
  if (/move |sidebar|dashboard|pin |hide |workspace/.test(r)) return 'workspace';
  if (
    /rewrite (my |the )?homepage|website|homepage|luxury|premium|layout|brand|build me|build my|start(?:ing)?\s+(?:a\s+)?(?:new\s+)?(?:business|company)|pressure\s*wash|new company|redesign/
      .test(r)
  ) {
    return 'build_business';
  }
  if (/research|competitor|industry/.test(r)) return 'research';
  if (/coach|grow|booking|revenue/.test(r)) return 'coach';
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
      experienceDirector: {
        reviewedBy: 'experience_director',
        actions: [...(ed.actions || []), 'answered_from_conversation_intelligence'],
        questionsShown: ed.questions?.length || 0,
        celebrate: !!ed.celebrate,
        hideDetails: true,
      },
    };
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
  } else if (primaryDecision.finalDecision === 'recommend') {
    edActions = [...edActions, 'decision_engine_recommend', 'requires_owner_approval'];
    if (isHomepageRewrite && !/approval|approve|say the word/i.test(response)) {
      response = `${response} I recommend this homepage rewrite — say the word and I'll apply it.`;
    }
  } else if (primaryDecision.finalDecision === 'proceed') {
    edActions = [...edActions, 'decision_engine_proceed'];
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
  });

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
