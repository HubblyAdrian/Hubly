/**
 * Hubly Brain — Initial Experts (Milestone 1 · Section 4)
 *
 * Experience Director · Research · Strategy · Creative Director · Critic
 * Registered with the Expert Framework. Brain runs them — never the customer.
 *
 * Each expert returns a structured report (reasoning + confidence) that Brain merges.
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
    competitors: (k.competitors || dnaKnow.competitors || []) as string[],
  };
}

function inferTrade(ctx: HublyExpertContext): string {
  const mem = normalizeBusinessMemory(ctx.memory as never);
  if (mem.industry) return mem.industry;
  const r = String(ctx.request || "").toLowerCase();
  if (/pressure\s*wash/.test(r)) return "pressure washing";
  if (/lawn|landscap/.test(r)) return "lawn care";
  if (/plumb/.test(r)) return "plumbing";
  if (/hvac|air\s*cond/.test(r)) return "HVAC";
  return "local service";
}

/** Research Expert — Research Report */
function researchExpert(ctx: HublyExpertContext): HublyExpertOutput {
  const know = knowledgeFromCtx(ctx);
  const mem = normalizeBusinessMemory(ctx.memory as never);
  const trade = inferTrade(ctx);
  const findings: string[] = [];

  if (know.psych) findings.push(know.psych);
  else if (/pressure\s*wash/i.test(trade) || /pressure\s*wash/i.test(String(ctx.request || ""))) {
    findings.push(
      "Homeowners hire pressure washing for curb appeal before selling, parties, or spring refresh — they fear damage and no-shows more than price alone.",
    );
  } else {
    findings.push(`Studying how customers hire ${trade} businesses from what the owner described.`);
  }

  if (know.buy) findings.push(know.buy);
  else findings.push(`Customers compare 2–3 ${trade} quotes and pick the one that feels trustworthy and clear.`);

  if (know.seasonality) findings.push(`Seasonality: ${know.seasonality}`);
  else if (/pressure\s*wash/i.test(trade)) findings.push("Seasonality: peak spring–early fall; wet weeks shift demand.");

  if (know.objections?.length) {
    findings.push(`Common objections: ${know.objections.slice(0, 3).join("; ")}`);
  } else if (/pressure\s*wash/i.test(trade)) {
    findings.push("Common objections: Will it damage paint/siding? Are you insured? Can you do driveways and roofs?");
  }

  const competitors = know.competitors.length
    ? know.competitors.map(String)
    : [`Generic ${trade} directory listings`, "Neighbor with a cheaper weekend side hustle"];
  const trustSignals = know.trust?.length
    ? know.trust.map(String)
    : ["Before/after photos", "Insured & licensed language", "Clear package pricing", "Same-week availability"];

  const confidence = know.psych || know.buy ? 88 : mem.industry || /pressure\s*wash/i.test(String(ctx.request || "")) ? 78 : 55;
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

  const report = {
    type: "Research Report",
    industry: trade,
    customerPsychology: findings[0],
    competitors,
    trustSignals,
    businessDna: {
      vocabulary: know.vocabulary.length ? know.vocabulary : ["driveway", "house wash", "soft wash", "curb appeal"],
      seasonality: know.seasonality || "spring–fall peak",
      objections: know.objections?.length ? know.objections : ["damage fears", "insurance", "scheduling"],
    },
    availableMemory: {
      industry: mem.industry || trade,
      businessName: mem.name || null,
      city: mem.city || null,
      hasServices: Array.isArray(mem.services) && mem.services.length > 0,
    },
    findings,
    confidence,
    reasoning: reasoning.map((d) => ({
      reason: d.reason,
      evidence: d.evidence,
      confidence: d.confidence,
      expectedImpact: d.expectedImpact,
    })),
  };

  return {
    expertId: "research",
    expertName: "Research Expert",
    ok: true,
    summary: `Research on ${trade}: ${findings[0]}`,
    output: report,
    payload: report,
    reasoning: report.reasoning,
    confidence,
    questions: confidence < 60 ? ["What kind of work do you primarily do?"] : [],
  };
}

/** Strategy Expert — Business Strategy */
function strategyExpert(ctx: HublyExpertContext): HublyExpertOutput {
  const know = knowledgeFromCtx(ctx);
  const research = ctx.priorOutputs?.find((o) => o.expertId === "research");
  const researchOut = (research?.output || research?.payload || {}) as {
    industry?: string;
    trustSignals?: string[];
    customerPsychology?: string;
  };
  const trade = researchOut.industry || inferTrade(ctx);
  const factors = know.factors || [];
  const lead = String(factors[0] || know.goals?.[0] || "visible proof and clear next step");
  const avoid = String(factors[1] || "generic price competition");
  const reason = `I'm positioning around ${lead.toLowerCase()} instead of ${avoid.toLowerCase()}.`;
  const confidence = factors.length ? 86 : research?.confidence ? clamp(research.confidence - 4) : 72;

  const strategy = {
    type: "Business Strategy",
    positioning: `${trade} that earns trust with before/after proof before asking for a booking`,
    targetAudience: /pressure\s*wash/i.test(trade)
      ? "Homeowners who care about curb appeal and want a reliable local crew"
      : `Local customers who need a trusted ${trade} partner`,
    messaging: reason,
    pricingDirection: "Package tiers (driveway / house / full property) with a clear mid package as the default",
    homepageStrategy: "Lead with proof, then packages, then a single Book now path",
    bookingStrategy: "One primary CTA — request a quote or book a slot; avoid multi-step preference quizzes",
    businessPriorities: [
      "Collect before/after proof",
      "Publish 2–3 clear packages",
      "Make booking the only hard ask on the first screen",
    ],
    fromResearch: researchOut,
    confidence,
    reasoning: [{
      reason,
      evidence: [lead, avoid, ...(know.goals || []).slice(0, 2).map(String), ...(researchOut.trustSignals || []).slice(0, 2)],
      confidence,
      expectedImpact: "Homepage and offers reinforce what customers actually decide on",
    }],
  };

  return {
    expertId: "strategy",
    expertName: "Strategy Expert",
    ok: true,
    summary: reason,
    output: strategy,
    payload: strategy,
    reasoning: strategy.reasoning,
    confidence,
  };
}

/** Creative Director — Creative Plan */
function creativeDirectorExpert(ctx: HublyExpertContext): HublyExpertOutput {
  const mem = normalizeBusinessMemory(ctx.memory as never);
  const dna = normalizeBusinessDNA(ctx.dna as never);
  const strategy = ctx.priorOutputs?.find((o) => o.expertId === "strategy");
  const strategyOut = (strategy?.output || strategy?.payload || {}) as {
    positioning?: string;
    homepageStrategy?: string;
    bookingStrategy?: string;
    messaging?: string;
  };
  const brief = buildCreativeDirectorBrief({ memory: mem, dna });
  const direction = String(strategyOut.positioning || dna.brand?.preferredTone || "trust-first");
  const confidence = 84;
  const reason =
    `Creative direction leans ${direction} so the first screen earns trust before asking for a booking.`;

  const plan = {
    type: "Creative Plan",
    websiteDirection: strategyOut.homepageStrategy || "Proof-led homepage with one booking path",
    brandDirection: direction,
    homepage: {
      sections: ["Hero with before/after", "Packages", "Trust proof", "Book"],
      headline: brief?.headline || `Clean driveways. Clear pricing. Easy booking.`,
      intro: brief?.intro || strategyOut.messaging || reason,
    },
    booking: strategyOut.bookingStrategy || "Single Book / Get quote CTA",
    packages: ["Driveway refresh", "House wash", "Full property"],
    voice: "Calm, local, confident — never salesy or technical",
    creativeRecommendations: [
      ...(brief?.rationales || []).slice(0, 3).map((r: { title?: string; detail?: string }) =>
        String(r.title || r.detail || "")
      ).filter(Boolean),
      "Show real before/after photos above the fold",
      "Keep package cards to three",
    ].slice(0, 5),
    brief,
    strategy: strategyOut,
    confidence,
    reasoning: [{
      reason,
      evidence: [
        brief?.intro || "",
        strategyOut.homepageStrategy || "",
        ...((brief?.rationales || []) as Array<{ detail?: string }>).slice(0, 2).map((r) => String(r.detail || "")),
      ].filter(Boolean),
      confidence,
      expectedImpact: "Site feels intentional for this trade, not template-generic",
    }],
  };

  return {
    expertId: "creative_director",
    expertName: "Creative Director",
    ok: true,
    summary: plan.homepage.headline,
    output: plan,
    payload: plan,
    reasoning: plan.reasoning,
    confidence,
  };
}

/** Critic — Quality Report */
function criticExpert(ctx: HublyExpertContext): HublyExpertOutput {
  const prior = ctx.priorOutputs || [];
  const avg = prior.length
    ? prior.reduce((s, p) => s + (p.confidence || 0), 0) / prior.length
    : 50;
  const issues: string[] = [];
  const creative = prior.find((p) => p.expertId === "creative_director");
  const strategy = prior.find((p) => p.expertId === "strategy");
  const research = prior.find((p) => p.expertId === "research");

  const creativeOut = (creative?.output || creative?.payload || {}) as {
    creativeRecommendations?: string[];
    brandDirection?: string;
    homepage?: { headline?: string };
  };
  const strategyOut = (strategy?.output || strategy?.payload || {}) as {
    messaging?: string;
    positioning?: string;
  };
  const researchOut = (research?.output || research?.payload || {}) as {
    findings?: string[];
  };

  const checks = {
    genericWork: false,
    weakMessaging: false,
    inconsistentStrategy: false,
    poorUx: false,
    poorTrust: false,
    weakBranding: false,
  };

  if (strategy && creative && Math.abs((strategy.confidence || 0) - (creative.confidence || 0)) > 25) {
    issues.push("Strategy and creative confidence diverge — simplify the recommendation.");
    checks.inconsistentStrategy = true;
  }
  if ((creativeOut.creativeRecommendations || []).length > 6) {
    issues.push("Too many creative recommendations — keep the top three.");
    checks.poorUx = true;
  }
  const request = String(ctx.request || "");
  if (/luxury|premium/i.test(request) && !/trust|proof|review/i.test(JSON.stringify(strategyOut))) {
    issues.push("Luxury asks still need trust proof on the first screen.");
    checks.poorTrust = true;
  }
  const blob = JSON.stringify({ strategyOut, creativeOut, researchOut }).toLowerCase();
  if (/lorem ipsum|click here|synergy|best in class|world-class/.test(blob)) {
    issues.push("Generic marketing language detected.");
    checks.genericWork = true;
    checks.weakMessaging = true;
  }
  if (!creativeOut.homepage?.headline) {
    issues.push("Missing homepage headline.");
    checks.weakBranding = true;
  }

  const confidence = clamp(avg - issues.length * 6);
  const rejected = issues.length >= 3 || confidence < 55;
  const requestRegeneration = rejected || checks.genericWork;
  const ok = !rejected && confidence >= 60;

  const report = {
    type: "Quality Report",
    checks,
    issues,
    proceed: ok,
    rejected,
    requestRegeneration,
    reviewedExperts: prior.map((p) => p.expertId),
    confidence,
    reasoning: [{
      reason: ok
        ? "Experts agree enough to proceed without overwhelming the owner."
        : issues[0] || "Confidence too low to ship without a clarifying question.",
      evidence: issues,
      confidence,
      expectedImpact: ok ? "Owner sees one clear Hubly answer" : "Avoid confusing or thin advice",
    }],
  };

  return {
    expertId: "critic",
    expertName: "Critic",
    ok,
    summary: ok
      ? "Quality Report: recommendation is coherent enough to show the owner."
      : `Quality Report: needs tightening — ${issues[0] || "low confidence"}`,
    output: report,
    payload: report,
    reasoning: report.reasoning,
    confidence,
    questions: confidence < 60 ? ["What matters more right now — more bookings, or a more premium brand feel?"] : [],
  };
}

/** Experience Director — Experience Review (customer-facing gate) */
function experienceDirectorExpert(ctx: HublyExpertContext): HublyExpertOutput {
  const prior = ctx.priorOutputs || [];
  const critic = prior.find((p) => p.expertId === "critic");
  const research = prior.find((p) => p.expertId === "research");
  const strategy = prior.find((p) => p.expertId === "strategy");
  const creative = prior.find((p) => p.expertId === "creative_director");

  const creativePayload = (creative?.output || creative?.payload || {}) as {
    brief?: { rationales?: Array<{ title?: string; detail?: string }> };
    homepage?: { sections?: string[]; headline?: string; intro?: string };
    homepageSections?: string[];
    dashboardWidgets?: string[];
    websiteSettings?: string[];
    creativeRecommendations?: string[];
  };
  const strategyPayload = (strategy?.output || strategy?.payload || {}) as {
    messaging?: string;
    businessPriorities?: string[];
    homepageStrategy?: string;
  };

  const homepageSections = creativePayload.homepageSections ||
    creativePayload.homepage?.sections ||
    (creativePayload.brief?.rationales || []).map((r) => String(r.title || r.detail || "")).filter(Boolean);
  const dashboardWidgets = creativePayload.dashboardWidgets ||
    (strategyPayload.businessPriorities || []).slice(0, 1);
  const websiteSettings = creativePayload.websiteSettings || [];

  const draftLines = [
    research?.summary,
    strategyPayload.messaging || strategy?.summary,
    creativePayload.homepage?.intro || creative?.summary,
  ].filter(Boolean) as string[];

  const ed = applyExperienceDirector({
    request: ctx.request,
    draftLines,
    proposedQuestions: [...(research?.questions || []), ...(critic?.questions || [])],
    homepageSections,
    dashboardWidgets,
    websiteSettings,
    criticOk: critic?.ok,
    confidence: clamp(
      ((research?.confidence || 70) + (strategy?.confidence || 70) + (creative?.confidence || 70) +
        (critic?.confidence || 70)) / 4,
    ),
  });

  const review = {
    type: "Experience Review",
    ownerResponse: ed.ownerResponse,
    questions: ed.questions,
    celebrate: ed.celebrate,
    hideDetails: ed.hideDetails,
    maxQuestions: 3,
    vetoed: ed.vetoed,
    vetoReason: ed.vetoReason,
    evaluation: ed.evaluation,
    delayed: ed.delayed,
    shown: ed.shown,
    actions: ed.actions,
    interception: ed.interception,
    personality: ed.personality,
    simplifiedFrom: prior.map((p) => p.expertId),
    experienceDirectorVersion: ed.version,
    reviewedBy: ed.reviewedBy,
    confidence: ed.confidence,
    reasoning: [{
      reason: ed.vetoReason ||
        "Experience Director kept the answer conversational and short so Hubly feels like a partner, not a report.",
      evidence: ed.actions,
      confidence: ed.confidence,
      expectedImpact: "Owner feels understood — not interviewed",
    }],
  };

  return {
    expertId: "experience_director",
    expertName: "Experience Director",
    ok: true,
    summary: ed.ownerResponse,
    output: review,
    payload: review,
    reasoning: review.reasoning,
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
    version: "1.2.0",
    purpose: "Protect the customer experience — simplify, remove complexity, protect Hubly personality, enforce conversational UX.",
    responsibilities: [
      "Simplify every customer-facing response",
      "Remove unnecessary complexity",
      "Protect Hubly personality",
      "Enforce conversational UX",
    ],
    capability: {
      can: ["experience", "simplify", "onboarding", "conversation", "celebrate", "veto", "personality"],
      tools: [],
      reads: ["business_memory", "workspace_memory", "conversation_memory"],
      actions: [
        "rewrite_response",
        "limit_questions",
        "celebrate",
        "delay_nonessential",
        "limit_homepage_sections",
        "limit_dashboard_widgets",
        "convert_settings_to_conversation",
        "veto_complexity",
        "enforce_hubly_personality",
      ],
    },
    allowedTools: [],
    allowedActions: [
      "rewrite_response",
      "limit_questions",
      "celebrate",
      "delay_nonessential",
      "veto_complexity",
      "enforce_hubly_personality",
    ],
    inputs: ["request", "priorOutputs", "memory"],
    outputs: ["Experience Review", "ownerResponse", "questions", "reasoning", "confidence"],
    requiredMemory: [],
    confidence: { baseline: 85, reportsReasoning: true },
    reasoning: { required: true, fields: ["reason", "evidence", "confidence", "expectedImpact"] },
    executionPriority: 100,
    failureBehavior: "fallback_local",
    dependencies: [],
    intents: ["*"],
    alwaysInclude: true,
  }, experienceDirectorExpert);

  registerExpert({
    id: "research",
    name: "Research Expert",
    version: "1.1.0",
    purpose: "Understand the business before anything is created — industry, psychology, competitors, trust, DNA, memory.",
    responsibilities: [
      "Industry research",
      "Customer psychology",
      "Competitors",
      "Trust signals",
      "Business DNA",
      "Available business memory",
    ],
    capability: {
      can: ["research", "industry", "psychology", "competitors", "seasonality", "build", "website", "luxury", "start"],
      tools: ["blueprints", "business_dna"],
      reads: ["business_memory", "business_dna", "blueprints"],
      actions: ["report_findings"],
    },
    allowedTools: ["blueprints", "business_dna"],
    allowedActions: ["report_findings"],
    inputs: ["request", "memory", "dna", "blueprintKnowledge"],
    outputs: ["Research Report", "findings", "reasoning", "confidence"],
    requiredMemory: ["industry"],
    confidence: { baseline: 80, reportsReasoning: true },
    reasoning: { required: true, fields: ["reason", "evidence", "confidence", "expectedImpact"] },
    executionPriority: 10,
    failureBehavior: "fallback_local",
    dependencies: [],
    intents: ["build_business", "website", "research", "coach", "general"],
  }, researchExpert);

  registerExpert({
    id: "strategy",
    name: "Strategy Expert",
    version: "1.1.0",
    purpose: "Convert research into decisions — positioning, audience, messaging, pricing, homepage, booking, priorities.",
    responsibilities: [
      "Positioning",
      "Target audience",
      "Messaging",
      "Pricing direction",
      "Homepage strategy",
      "Booking strategy",
      "Business priorities",
    ],
    capability: {
      can: ["strategy", "positioning", "pricing", "offers", "build", "website", "luxury", "grow", "start"],
      tools: [],
      reads: ["business_memory", "business_dna", "blueprints"],
      actions: ["set_positioning"],
    },
    allowedTools: [],
    allowedActions: ["set_positioning"],
    inputs: ["research", "memory", "dna"],
    outputs: ["Business Strategy", "positioning", "reasoning", "confidence"],
    requiredMemory: [],
    confidence: { baseline: 78, reportsReasoning: true },
    reasoning: { required: true, fields: ["reason", "evidence", "confidence", "expectedImpact"] },
    executionPriority: 20,
    failureBehavior: "fallback_local",
    dependencies: ["research"],
    intents: ["build_business", "website", "coach", "general"],
  }, strategyExpert);

  registerExpert({
    id: "creative_director",
    name: "Creative Director",
    version: "1.1.0",
    purpose: "Transform strategy into customer-facing assets — website, brand, homepage, booking, packages, voice.",
    responsibilities: [
      "Website direction",
      "Brand direction",
      "Homepage",
      "Booking",
      "Packages",
      "Voice",
      "Creative recommendations",
    ],
    capability: {
      can: ["creative", "design", "website", "brand", "layout", "copy", "luxury", "build", "start"],
      tools: ["website_builder"],
      reads: ["business_memory", "business_dna"],
      actions: ["propose_creative_direction"],
    },
    allowedTools: ["website_builder"],
    allowedActions: ["propose_creative_direction"],
    inputs: ["strategy", "memory", "dna"],
    outputs: ["Creative Plan", "brief", "reasoning", "confidence"],
    requiredMemory: [],
    confidence: { baseline: 82, reportsReasoning: true },
    reasoning: { required: true, fields: ["reason", "evidence", "confidence", "expectedImpact"] },
    executionPriority: 30,
    failureBehavior: "fallback_local",
    dependencies: ["strategy"],
    intents: ["build_business", "website", "general"],
  }, creativeDirectorExpert);

  registerExpert({
    id: "critic",
    name: "Critic",
    version: "1.1.0",
    purpose: "Protect quality — review prior experts for generic work, weak messaging, inconsistent strategy, poor UX/trust/branding.",
    responsibilities: [
      "Review prior expert outputs",
      "Detect generic or weak work",
      "Reject or request regeneration when needed",
    ],
    capability: {
      can: ["critic", "review", "qa", "build", "website", "research", "start"],
      tools: [],
      reads: ["business_memory"],
      actions: ["block", "request_clarify", "request_regeneration"],
    },
    allowedTools: [],
    allowedActions: ["block", "request_clarify", "request_regeneration"],
    inputs: ["priorOutputs"],
    outputs: ["Quality Report", "issues", "proceed", "reasoning", "confidence"],
    requiredMemory: [],
    confidence: { baseline: 75, reportsReasoning: true },
    reasoning: { required: true, fields: ["reason", "evidence", "confidence", "expectedImpact"] },
    executionPriority: 40,
    failureBehavior: "skip",
    dependencies: [],
    intents: ["build_business", "website", "research", "coach", "general"],
  }, criticExpert);
}

export const HublyExperts = {
  ensureRegistered: ensureExpertsRegistered,
  listRegisteredExperts: () => {
    ensureExpertsRegistered();
    return listExperts();
  },
};
