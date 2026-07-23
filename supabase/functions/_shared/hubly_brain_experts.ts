/**
 * Hubly Brain — Initial Experts (Milestone 1)
 *
 * Experience Director · Research · Strategy · Creative Director · Critic
 * Registered with the Expert Framework. Brain runs them — never the customer.
 */

import {
  registerExpert,
  listExperts,
  type HublyExpertContext,
  type HublyExpertOutput,
} from "./hubly_brain_expert_framework.ts";
import { makeDecision } from "./hubly_brain_reasoning.ts";
import { buildCreativeDirectorBrief } from "./hubly_brain_creative_director.ts";
import { normalizeBusinessMemory } from "./hubly_brain_memory.ts";
import { normalizeBusinessDNA } from "./hubly_brain_dna.ts";
import { applyExperienceDirector } from "./hubly_brain_experience_director.ts";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function knowledgeFromCtx(ctx: HublyExpertContext) {
  const k = (ctx.blueprintKnowledge || {}) as Record<string, unknown>;
  const dna = (ctx.dna || {}) as Record<string, unknown>;
  const dnaKnow = (dna.knowledge || {}) as Record<string, unknown>;
  return {
    psych: String(k.customerPsychology || dnaKnow.customerPsychology || "").trim(),
    buy: String(k.buyingBehavior || dnaKnow.buyingBehavior || "").trim(),
    trust: (k.trustSignals || dnaKnow.trustSignals || []) as string[],
    goals: (k.homepageGoals || dnaKnow.homepageGoals || []) as string[],
    factors: (k.decisionFactors || dnaKnow.decisionFactors || []) as string[],
    objections: (k.commonObjections || dnaKnow.commonObjections || []) as string[],
    seasonality: String(k.seasonality || dnaKnow.seasonality || "").trim(),
    vocabulary: (k.industryVocabulary || dnaKnow.industryVocabulary || []) as string[],
  };
}

function researchExpert(ctx: HublyExpertContext): HublyExpertOutput {
  const know = knowledgeFromCtx(ctx);
  const mem = normalizeBusinessMemory(ctx.memory as never);
  const trade = mem.industry || "local service";
  const findings: string[] = [];
  if (know.psych) findings.push(know.psych);
  if (know.buy) findings.push(know.buy);
  if (know.seasonality) findings.push(`Seasonality: ${know.seasonality}`);
  if (know.objections?.length) findings.push(`Common objections: ${know.objections.slice(0, 3).join("; ")}`);
  if (!findings.length) {
    findings.push(`Studying how customers hire ${trade} businesses from what the owner described.`);
  }
  const confidence = know.psych || know.buy ? 88 : mem.industry ? 72 : 55;
  const reasoning = [
    makeDecision({
      domain: "research",
      decision: "industry_research",
      reason: findings[0],
      evidence: findings.slice(0, 4),
      confidence,
      expectedImpact: "Better positioning and fewer wrong assumptions",
      expertId: "research",
    }),
  ];
  return {
    expertId: "research",
    ok: true,
    summary: `Research on ${trade}: ${findings[0]}`,
    payload: { trade, findings, knowledge: know },
    reasoning: reasoning.map((d) => ({
      reason: d.reason,
      evidence: d.evidence,
      confidence: d.confidence,
      expectedImpact: d.expectedImpact,
    })),
    confidence,
    questions: confidence < 60 ? ["What kind of work do you primarily do?"] : [],
  };
}

function strategyExpert(ctx: HublyExpertContext): HublyExpertOutput {
  const know = knowledgeFromCtx(ctx);
  const research = ctx.priorOutputs?.find((o) => o.expertId === "research");
  const factors = know.factors || [];
  const lead = factors[0] || know.goals?.[0] || "trust and clear next step";
  const avoid = factors[1] || "generic price competition";
  const reason = `I'm positioning around ${String(lead).toLowerCase()} instead of ${String(avoid).toLowerCase()}.`;
  const confidence = factors.length ? 86 : research?.confidence ? clamp(research.confidence - 4) : 70;
  return {
    expertId: "strategy",
    ok: true,
    summary: reason,
    payload: {
      positioning: lead,
      dePrioritize: avoid,
      homepageGoals: know.goals || [],
      fromResearch: research?.payload || null,
    },
    reasoning: [{
      reason,
      evidence: [String(lead), String(avoid), ...(know.goals || []).slice(0, 2).map(String)],
      confidence,
      expectedImpact: "Homepage and offers reinforce what customers actually decide on",
    }],
    confidence,
  };
}

function creativeDirectorExpert(ctx: HublyExpertContext): HublyExpertOutput {
  const mem = normalizeBusinessMemory(ctx.memory as never);
  const dna = normalizeBusinessDNA(ctx.dna as never);
  const strategy = ctx.priorOutputs?.find((o) => o.expertId === "strategy");
  const brief = buildCreativeDirectorBrief({
    memory: mem,
    dna,
  });
  const direction = String(
    (strategy?.payload as { positioning?: string } | undefined)?.positioning ||
      dna.brand?.preferredTone ||
      "trust-first",
  );
  const confidence = 84;
  const reason = `Creative direction leans ${direction} so the first screen earns trust before asking for a booking.`;
  return {
    expertId: "creative_director",
    ok: true,
    summary: brief?.headline || reason,
    payload: {
      brief,
      direction,
      strategy: strategy?.payload || null,
    },
    reasoning: [{
      reason,
      evidence: [
        brief?.intro || "",
        ...((brief?.rationales || []) as Array<{ detail?: string }>).slice(0, 2).map((r) => String(r.detail || "")),
      ].filter(Boolean),
      confidence,
      expectedImpact: "Site feels intentional for this trade, not template-generic",
    }],
    confidence,
  };
}

function criticExpert(ctx: HublyExpertContext): HublyExpertOutput {
  const prior = ctx.priorOutputs || [];
  const avg = prior.length
    ? prior.reduce((s, p) => s + (p.confidence || 0), 0) / prior.length
    : 50;
  const issues: string[] = [];
  const creative = prior.find((p) => p.expertId === "creative_director");
  const strategy = prior.find((p) => p.expertId === "strategy");
  if (strategy && creative && Math.abs((strategy.confidence || 0) - (creative.confidence || 0)) > 25) {
    issues.push("Strategy and creative confidence diverge — simplify the recommendation.");
  }
  if ((creative?.payload as { brief?: { rationales?: unknown[] } } | undefined)?.brief?.rationales &&
    ((creative?.payload as { brief?: { rationales?: unknown[] } }).brief!.rationales!.length > 5)) {
    issues.push("Too many rationales for the owner — keep the top three.");
  }
  const request = String(ctx.request || "");
  if (/luxury|premium/i.test(request) && !/trust|proof|review/i.test(JSON.stringify(strategy?.payload || {}))) {
    issues.push("Luxury asks still need trust proof on the first screen.");
  }
  const confidence = clamp(avg - issues.length * 6);
  const ok = issues.length < 3 && confidence >= 60;
  return {
    expertId: "critic",
    ok,
    summary: ok
      ? "Critic: recommendation is coherent enough to show the owner."
      : `Critic: needs tightening — ${issues[0] || "low confidence"}`,
    payload: { issues, proceed: ok },
    reasoning: [{
      reason: ok
        ? "Experts agree enough to proceed without overwhelming the owner."
        : issues[0] || "Confidence too low to ship without a clarifying question.",
      evidence: issues,
      confidence,
      expectedImpact: ok ? "Owner sees one clear Hubly answer" : "Avoid confusing or thin advice",
    }],
    confidence,
    questions: confidence < 60 ? ["What matters more right now — more bookings, or a more premium brand feel?"] : [],
  };
}

function experienceDirectorExpert(ctx: HublyExpertContext): HublyExpertOutput {
  const prior = ctx.priorOutputs || [];
  const critic = prior.find((p) => p.expertId === "critic");
  const research = prior.find((p) => p.expertId === "research");
  const strategy = prior.find((p) => p.expertId === "strategy");
  const creative = prior.find((p) => p.expertId === "creative_director");

  const creativePayload = (creative?.payload || {}) as {
    brief?: { rationales?: Array<{ title?: string; detail?: string }> };
    homepageSections?: string[];
    dashboardWidgets?: string[];
  };
  const homepageSections = creativePayload.homepageSections ||
    (creativePayload.brief?.rationales || []).map((r) => String(r.title || r.detail || "")).filter(Boolean);
  const dashboardWidgets = creativePayload.dashboardWidgets ||
    ((strategy?.payload as { homepageGoals?: string[] } | undefined)?.homepageGoals || []);

  const ed = applyExperienceDirector({
    request: ctx.request,
    draftLines: [research?.summary, strategy?.summary, creative?.summary].filter(Boolean) as string[],
    proposedQuestions: [...(research?.questions || []), ...(critic?.questions || [])],
    homepageSections,
    dashboardWidgets,
    criticOk: critic?.ok,
    confidence: clamp(
      ((research?.confidence || 70) + (strategy?.confidence || 70) + (creative?.confidence || 70) +
        (critic?.confidence || 70)) / 4,
    ),
  });

  return {
    expertId: "experience_director",
    ok: true,
    summary: ed.ownerResponse,
    payload: {
      ownerResponse: ed.ownerResponse,
      questions: ed.questions,
      celebrate: ed.celebrate,
      hideDetails: ed.hideDetails,
      maxQuestions: 2,
      delayed: ed.delayed,
      shown: ed.shown,
      actions: ed.actions,
      simplifiedFrom: prior.map((p) => p.expertId),
      experienceDirectorVersion: ed.version,
      reviewedBy: ed.reviewedBy,
    },
    reasoning: [{
      reason: "Experience Director kept the answer conversational and short so Hubly feels like a partner, not a report.",
      evidence: ed.actions,
      confidence: ed.confidence,
      expectedImpact: "Owner feels understood — not interviewed",
    }],
    confidence: ed.confidence,
    questions: ed.questions,
  };
}

let registered = false;

export function ensureExpertsRegistered(): void {
  if (registered) return;
  registered = true;

  registerExpert({
    id: "experience_director",
    name: "Experience Director",
    purpose: "Protect the human experience — simplify, delay non-essentials, keep Hubly conversational.",
    version: "1.1.0",
    capability: {
      can: ["experience", "simplify", "onboarding", "conversation", "celebrate"],
      tools: [],
      reads: ["business_memory", "workspace_memory", "conversation_memory"],
      actions: [
        "rewrite_response",
        "limit_questions",
        "celebrate",
        "delay_nonessential",
        "limit_homepage_sections",
        "limit_dashboard_widgets",
      ],
    },
    inputs: ["request", "priorOutputs", "memory"],
    outputs: ["ownerResponse", "questions"],
    requiredMemory: [],
    failureBehavior: "fallback_local",
  }, experienceDirectorExpert);

  registerExpert({
    id: "research",
    name: "Research Expert",
    purpose: "Research businesses like this one using Business DNA / blueprint knowledge.",
    version: "1.0.0",
    capability: {
      can: ["research", "industry", "psychology", "competitors", "seasonality", "build", "website", "luxury"],
      tools: ["blueprints", "business_dna"],
      reads: ["business_memory", "business_dna", "blueprints"],
      actions: ["report_findings"],
    },
    inputs: ["request", "memory", "dna", "blueprintKnowledge"],
    outputs: ["findings"],
    requiredMemory: ["industry"],
    failureBehavior: "fallback_local",
  }, researchExpert);

  registerExpert({
    id: "strategy",
    name: "Strategy Expert",
    purpose: "Turn research into positioning, offer hierarchy, and homepage priorities.",
    version: "1.0.0",
    capability: {
      can: ["strategy", "positioning", "pricing", "offers", "build", "website", "luxury", "grow"],
      tools: [],
      reads: ["business_memory", "business_dna", "blueprints"],
      actions: ["set_positioning"],
    },
    inputs: ["research", "memory", "dna"],
    outputs: ["positioning"],
    requiredMemory: [],
    failureBehavior: "fallback_local",
  }, strategyExpert);

  registerExpert({
    id: "creative_director",
    name: "Creative Director",
    purpose: "Translate strategy into creative direction and explainable design choices.",
    version: "1.0.0",
    capability: {
      can: ["creative", "design", "website", "brand", "layout", "copy", "luxury", "build"],
      tools: ["website_builder"],
      reads: ["business_memory", "business_dna"],
      actions: ["propose_creative_direction"],
    },
    inputs: ["strategy", "memory", "dna"],
    outputs: ["brief"],
    requiredMemory: [],
    failureBehavior: "fallback_local",
  }, creativeDirectorExpert);

  registerExpert({
    id: "critic",
    name: "Critic",
    purpose: "Review expert outputs for coherence, overconfidence, and confidence before Hubly speaks.",
    version: "1.0.0",
    capability: {
      can: ["critic", "review", "qa", "build", "website"],
      tools: [],
      reads: ["business_memory"],
      actions: ["block", "request_clarify"],
    },
    inputs: ["priorOutputs"],
    outputs: ["issues", "proceed"],
    requiredMemory: [],
    failureBehavior: "skip",
  }, criticExpert);
}

export const HublyExperts = {
  ensureRegistered: ensureExpertsRegistered,
  listRegisteredExperts: () => {
    ensureExpertsRegistered();
    return listExperts();
  },
};
