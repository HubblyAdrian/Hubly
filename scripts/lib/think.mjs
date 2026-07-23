/**
 * Node mirror of hubly_brain_think.ts — Section 4 behavioral proofs.
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

export function detectIntent(request, explicit) {
  if (explicit) return String(explicit);
  const r = String(request || '').toLowerCase();
  if (/weather|forecast|temperature/.test(r)) return 'weather';
  if (/move |sidebar|dashboard|pin |hide |workspace/.test(r)) return 'workspace';
  if (
    /website|homepage|luxury|premium|layout|brand|build me|build my|start(?:ing)?\s+(?:a\s+)?(?:new\s+)?(?:business|company)|pressure\s*wash|new company/
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

  const intent = detectIntent(req.request, req.intent);
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

  return {
    ok: critic ? critic.ok !== false : true,
    intent,
    response,
    questions,
    celebrate: !!payload.celebrate,
    confidence,
    expertsRun: ordered,
    expertOutputs,
    mergedExpertRecords: expertOutputs.map(toMergedRecord),
    expertTranscript,
    failures,
    dna,
    timeline,
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
