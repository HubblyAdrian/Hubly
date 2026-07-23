/**
 * Node mirror of hubly_brain_experts.ts — Section 4 behavioral proofs.
 */
import { registerExpert, listExperts, clearRegistryForTests } from './expert-framework.mjs';
import { applyExperienceDirector } from './experience-director.mjs';

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function inferTrade(ctx) {
  const mem = ctx.memory || {};
  if (mem.industry) return mem.industry;
  const r = String(ctx.request || '').toLowerCase();
  if (/pressure\s*wash/.test(r)) return 'pressure washing';
  return 'local service';
}

function researchExpert(ctx) {
  const trade = inferTrade(ctx);
  const findings = [
    /pressure\s*wash/i.test(trade) || /pressure\s*wash/i.test(String(ctx.request || ''))
      ? 'Homeowners hire pressure washing for curb appeal before selling, parties, or spring refresh — they fear damage and no-shows more than price alone.'
      : `Studying how customers hire ${trade} businesses from what the owner described.`,
    `Customers compare 2–3 ${trade} quotes and pick the one that feels trustworthy and clear.`,
    /pressure\s*wash/i.test(trade)
      ? 'Seasonality: peak spring–early fall; wet weeks shift demand.'
      : 'Seasonality varies by trade.',
    /pressure\s*wash/i.test(trade)
      ? 'Common objections: Will it damage paint/siding? Are you insured? Can you do driveways and roofs?'
      : 'Common objections: price, trust, availability.',
  ];
  const confidence = 78;
  const reasoning = [{
    reason: findings[0],
    evidence: findings.slice(0, 4),
    confidence,
    expectedImpact: 'Better positioning and fewer wrong assumptions',
  }];
  const report = {
    type: 'Research Report',
    industry: trade,
    customerPsychology: findings[0],
    competitors: [`Generic ${trade} directory listings`, 'Neighbor with a cheaper weekend side hustle'],
    trustSignals: ['Before/after photos', 'Insured & licensed language', 'Clear package pricing', 'Same-week availability'],
    businessDna: {
      vocabulary: ['driveway', 'house wash', 'soft wash', 'curb appeal'],
      seasonality: 'spring–fall peak',
      objections: ['damage fears', 'insurance', 'scheduling'],
    },
    availableMemory: {
      industry: (ctx.memory && ctx.memory.industry) || trade,
      businessName: (ctx.memory && ctx.memory.name) || null,
      city: (ctx.memory && ctx.memory.city) || null,
      hasServices: !!(ctx.memory && ctx.memory.services && ctx.memory.services.length),
    },
    findings,
    confidence,
    reasoning,
  };
  return {
    expertId: 'research',
    expertName: 'Research Expert',
    ok: true,
    summary: `Research on ${trade}: ${findings[0]}`,
    output: report,
    payload: report,
    reasoning,
    confidence,
    questions: [],
  };
}

function strategyExpert(ctx) {
  const research = (ctx.priorOutputs || []).find((o) => o.expertId === 'research');
  const researchOut = research?.output || research?.payload || {};
  const trade = researchOut.industry || inferTrade(ctx);
  const lead = 'visible proof and clear next step';
  const avoid = 'generic price competition';
  const reason = `I'm positioning around ${lead} instead of ${avoid}.`;
  const confidence = research?.confidence ? clamp(research.confidence - 4) : 72;
  const strategy = {
    type: 'Business Strategy',
    positioning: `${trade} that earns trust with before/after proof before asking for a booking`,
    targetAudience: 'Homeowners who care about curb appeal and want a reliable local crew',
    messaging: reason,
    pricingDirection: 'Package tiers (driveway / house / full property) with a clear mid package as the default',
    homepageStrategy: 'Lead with proof, then packages, then a single Book now path',
    bookingStrategy: 'One primary CTA — request a quote or book a slot; avoid multi-step preference quizzes',
    businessPriorities: [
      'Collect before/after proof',
      'Publish 2–3 clear packages',
      'Make booking the only hard ask on the first screen',
    ],
    fromResearch: researchOut,
    confidence,
    reasoning: [{
      reason,
      evidence: [lead, avoid, ...(researchOut.trustSignals || []).slice(0, 2)],
      confidence,
      expectedImpact: 'Homepage and offers reinforce what customers actually decide on',
    }],
  };
  return {
    expertId: 'strategy',
    expertName: 'Strategy Expert',
    ok: true,
    summary: reason,
    output: strategy,
    payload: strategy,
    reasoning: strategy.reasoning,
    confidence,
  };
}

function creativeDirectorExpert(ctx) {
  const strategy = (ctx.priorOutputs || []).find((o) => o.expertId === 'strategy');
  const strategyOut = strategy?.output || strategy?.payload || {};
  const direction = strategyOut.positioning || 'trust-first';
  const confidence = 84;
  const reason = `Creative direction leans ${direction} so the first screen earns trust before asking for a booking.`;
  const plan = {
    type: 'Creative Plan',
    websiteDirection: strategyOut.homepageStrategy || 'Proof-led homepage with one booking path',
    brandDirection: direction,
    homepage: {
      sections: ['Hero with before/after', 'Packages', 'Trust proof', 'Book'],
      headline: 'Clean driveways. Clear pricing. Easy booking.',
      intro: strategyOut.messaging || reason,
    },
    booking: strategyOut.bookingStrategy || 'Single Book / Get quote CTA',
    packages: ['Driveway refresh', 'House wash', 'Full property'],
    voice: 'Calm, local, confident — never salesy or technical',
    creativeRecommendations: [
      'Show real before/after photos above the fold',
      'Keep package cards to three',
      'One Book button only',
    ],
    strategy: strategyOut,
    confidence,
    reasoning: [{
      reason,
      evidence: [strategyOut.homepageStrategy || '', strategyOut.messaging || ''].filter(Boolean),
      confidence,
      expectedImpact: 'Site feels intentional for this trade, not template-generic',
    }],
  };
  return {
    expertId: 'creative_director',
    expertName: 'Creative Director',
    ok: true,
    summary: plan.homepage.headline,
    output: plan,
    payload: plan,
    reasoning: plan.reasoning,
    confidence,
  };
}

function criticExpert(ctx) {
  const prior = ctx.priorOutputs || [];
  const avg = prior.length
    ? prior.reduce((s, p) => s + (p.confidence || 0), 0) / prior.length
    : 50;
  const issues = [];
  const creative = prior.find((p) => p.expertId === 'creative_director');
  const strategy = prior.find((p) => p.expertId === 'strategy');
  const creativeOut = creative?.output || creative?.payload || {};
  const checks = {
    genericWork: false,
    weakMessaging: false,
    inconsistentStrategy: false,
    poorUx: false,
    poorTrust: false,
    weakBranding: false,
  };
  if (strategy && creative && Math.abs((strategy.confidence || 0) - (creative.confidence || 0)) > 25) {
    issues.push('Strategy and creative confidence diverge — simplify the recommendation.');
    checks.inconsistentStrategy = true;
  }
  if (!creativeOut.homepage?.headline) {
    issues.push('Missing homepage headline.');
    checks.weakBranding = true;
  }
  const confidence = clamp(avg - issues.length * 6);
  const rejected = issues.length >= 3 || confidence < 55;
  const ok = !rejected && confidence >= 60;
  const report = {
    type: 'Quality Report',
    checks,
    issues,
    proceed: ok,
    rejected,
    requestRegeneration: rejected || checks.genericWork,
    reviewedExperts: prior.map((p) => p.expertId),
    confidence,
    reasoning: [{
      reason: ok
        ? 'Experts agree enough to proceed without overwhelming the owner.'
        : issues[0] || 'Confidence too low to ship without a clarifying question.',
      evidence: issues,
      confidence,
      expectedImpact: ok ? 'Owner sees one clear Hubly answer' : 'Avoid confusing or thin advice',
    }],
  };
  return {
    expertId: 'critic',
    expertName: 'Critic',
    ok,
    summary: ok
      ? 'Quality Report: recommendation is coherent enough to show the owner.'
      : `Quality Report: needs tightening — ${issues[0] || 'low confidence'}`,
    output: report,
    payload: report,
    reasoning: report.reasoning,
    confidence,
    questions: confidence < 60 ? ['What matters more right now — more bookings, or a more premium brand feel?'] : [],
  };
}

function experienceDirectorExpert(ctx) {
  const prior = ctx.priorOutputs || [];
  const critic = prior.find((p) => p.expertId === 'critic');
  const research = prior.find((p) => p.expertId === 'research');
  const strategy = prior.find((p) => p.expertId === 'strategy');
  const creative = prior.find((p) => p.expertId === 'creative_director');
  const creativePayload = creative?.output || creative?.payload || {};
  const strategyPayload = strategy?.output || strategy?.payload || {};
  const homepageSections = creativePayload.homepage?.sections || [];
  const ed = applyExperienceDirector({
    request: ctx.request,
    draftLines: [
      research?.summary,
      strategyPayload.messaging || strategy?.summary,
      creativePayload.homepage?.intro || creative?.summary,
    ].filter(Boolean),
    proposedQuestions: [...(research?.questions || []), ...(critic?.questions || [])],
    homepageSections,
    dashboardWidgets: (strategyPayload.businessPriorities || []).slice(0, 1),
    websiteSettings: [],
    criticOk: critic?.ok,
    confidence: clamp(
      ((research?.confidence || 70) + (strategy?.confidence || 70) + (creative?.confidence || 70) +
        (critic?.confidence || 70)) / 4,
    ),
  });
  const review = {
    type: 'Experience Review',
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
        'Experience Director kept the answer conversational and short so Hubly feels like a partner, not a report.',
      evidence: ed.actions,
      confidence: ed.confidence,
      expectedImpact: 'Owner feels understood — not interviewed',
    }],
  };
  return {
    expertId: 'experience_director',
    expertName: 'Experience Director',
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

export function resetExpertsForTests() {
  registered = false;
  clearRegistryForTests();
}

export function ensureExpertsRegistered() {
  if (registered) return;
  registered = true;

  registerExpert({
    id: 'experience_director',
    name: 'Experience Director',
    version: '1.2.0',
    purpose: 'Protect the customer experience — simplify, remove complexity, protect Hubly personality, enforce conversational UX.',
    responsibilities: ['Simplify', 'Remove unnecessary complexity', 'Protect Hubly personality', 'Enforce conversational UX'],
    capability: { can: ['experience', 'simplify'], tools: [], reads: ['business_memory'], actions: ['rewrite_response'] },
    allowedTools: [],
    allowedActions: ['rewrite_response', 'limit_questions', 'veto_complexity'],
    inputs: ['request', 'priorOutputs'],
    outputs: ['Experience Review', 'reasoning', 'confidence'],
    requiredMemory: [],
    confidence: { baseline: 85, reportsReasoning: true },
    reasoning: { required: true, fields: ['reason', 'evidence', 'confidence', 'expectedImpact'] },
    executionPriority: 100,
    failureBehavior: 'fallback_local',
    dependencies: [],
    intents: ['*'],
    alwaysInclude: true,
  }, experienceDirectorExpert);

  registerExpert({
    id: 'research',
    name: 'Research Expert',
    version: '1.1.0',
    purpose: 'Understand the business before anything is created.',
    responsibilities: ['Industry', 'Customer psychology', 'Competitors', 'Trust signals', 'Business DNA', 'Business memory'],
    capability: { can: ['research', 'industry', 'build', 'start'], tools: ['blueprints'], reads: ['business_memory', 'business_dna'], actions: ['report_findings'] },
    allowedTools: ['blueprints'],
    allowedActions: ['report_findings'],
    inputs: ['request', 'memory'],
    outputs: ['Research Report', 'reasoning', 'confidence'],
    requiredMemory: ['industry'],
    confidence: { baseline: 80, reportsReasoning: true },
    reasoning: { required: true, fields: ['reason', 'evidence', 'confidence', 'expectedImpact'] },
    executionPriority: 10,
    failureBehavior: 'fallback_local',
    dependencies: [],
    intents: ['build_business', 'website', 'research', 'coach', 'general'],
  }, researchExpert);

  registerExpert({
    id: 'strategy',
    name: 'Strategy Expert',
    version: '1.1.0',
    purpose: 'Convert research into decisions.',
    responsibilities: ['Positioning', 'Target audience', 'Messaging', 'Pricing', 'Homepage', 'Booking', 'Priorities'],
    capability: { can: ['strategy', 'positioning', 'build', 'start'], tools: [], reads: ['business_memory'], actions: ['set_positioning'] },
    allowedTools: [],
    allowedActions: ['set_positioning'],
    inputs: ['research'],
    outputs: ['Business Strategy', 'reasoning', 'confidence'],
    requiredMemory: [],
    confidence: { baseline: 78, reportsReasoning: true },
    reasoning: { required: true, fields: ['reason', 'evidence', 'confidence', 'expectedImpact'] },
    executionPriority: 20,
    failureBehavior: 'fallback_local',
    dependencies: ['research'],
    intents: ['build_business', 'website', 'coach', 'general'],
  }, strategyExpert);

  registerExpert({
    id: 'creative_director',
    name: 'Creative Director',
    version: '1.1.0',
    purpose: 'Transform strategy into customer-facing assets.',
    responsibilities: ['Website direction', 'Brand', 'Homepage', 'Booking', 'Packages', 'Voice'],
    capability: { can: ['creative', 'website', 'brand', 'build', 'start'], tools: ['website_builder'], reads: ['business_memory'], actions: ['propose_creative_direction'] },
    allowedTools: ['website_builder'],
    allowedActions: ['propose_creative_direction'],
    inputs: ['strategy'],
    outputs: ['Creative Plan', 'reasoning', 'confidence'],
    requiredMemory: [],
    confidence: { baseline: 82, reportsReasoning: true },
    reasoning: { required: true, fields: ['reason', 'evidence', 'confidence', 'expectedImpact'] },
    executionPriority: 30,
    failureBehavior: 'fallback_local',
    dependencies: ['strategy'],
    intents: ['build_business', 'website', 'general'],
  }, creativeDirectorExpert);

  registerExpert({
    id: 'critic',
    name: 'Critic',
    version: '1.1.0',
    purpose: 'Protect quality.',
    responsibilities: ['Review prior outputs', 'Reject or request regeneration'],
    capability: { can: ['critic', 'review', 'qa', 'build', 'start'], tools: [], reads: ['business_memory'], actions: ['block', 'request_regeneration'] },
    allowedTools: [],
    allowedActions: ['block', 'request_regeneration'],
    inputs: ['priorOutputs'],
    outputs: ['Quality Report', 'reasoning', 'confidence'],
    requiredMemory: [],
    confidence: { baseline: 75, reportsReasoning: true },
    reasoning: { required: true, fields: ['reason', 'evidence', 'confidence', 'expectedImpact'] },
    executionPriority: 40,
    failureBehavior: 'skip',
    dependencies: [],
    intents: ['build_business', 'website', 'research', 'coach', 'general'],
  }, criticExpert);
}

export function listRegisteredExperts() {
  ensureExpertsRegistered();
  return listExperts();
}
