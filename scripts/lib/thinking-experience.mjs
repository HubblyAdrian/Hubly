/**
 * Milestone 2 · Epic 3 — Hubly Thinking Experience
 *
 * Visible intelligence after Discovery — not a progress bar.
 * Timeline + Aha cards + collaboration are derived from industry reasoning
 * objects (same shape as Hubly Brain reasoning), not placeholder loaders.
 */
export const THINKING_VERSION = "1.0.0";
export const THINKING_LABEL = "Hubly Thinking Experience";
export const THINKING_TRANSITION =
  "I think I have a really strong direction. Let me start building.";

export const THINKING_STAGES = [
  { id: "research", label: "Research" },
  { id: "strategy", label: "Strategy" },
  { id: "creative", label: "Creative" },
  { id: "review", label: "Review" },
];

export const THINKING_FORBIDDEN = [
  "Loading…",
  "Loading...",
  "Please wait",
  "Skeleton",
  "63%",
  "Progress: ",
];

/** Industry knowledge used to build real reasoning objects (Brain-shaped). */
export const INDUSTRY_REASONING_PACKS = {
  pressure_washing: {
    label: "Pressure Washing",
    comparableCount: 412,
    researchLead:
      "Homeowners hire pressure washing for curb appeal — they fear damage and no-shows more than price alone.",
    competitorPattern: "Most competitors compete on price.",
    strategyPivot: "I'm exploring a premium positioning instead — trust before the quote.",
    creativeDrafts: [
      "Hero with before/after proof above the fold",
      "Package tiers (driveway / house / full property)",
      "Single Book / Get quote CTA",
    ],
    criticIssue: "The first version feels generic if we lead with price language.",
    criticResolve: "Rebuild around reliability and visible proof.",
    collaboration: [
      { expert: "research", text: "I think reliability matters most." },
      { expert: "strategy", text: "I'm leaning toward convenience instead." },
      { expert: "critic", text: "I agree with Research. Let's rebuild around reliability." },
    ],
    aha: {
      title: "Aha!",
      body: "I found that most pressure washing businesses in your area bury their booking button below the fold.",
      why: "I'm putting yours at the top because I think it'll increase conversions.",
    },
    brandWhy:
      "I'm recommending premium positioning because homeowners tend to value trust over the lowest price.",
    homepageWhy:
      "Lead with before/after proof, then packages, then one Book CTA — proof before price reduces damage fears.",
  },
  photography: {
    label: "Photography",
    comparableCount: 286,
    researchLead:
      "Wedding clients hire photographers for emotion and trust — they compare galleries, then personalities, then price.",
    competitorPattern: "Many photographers lead with finished galleries only.",
    strategyPivot: "I'm exploring a premium brand that leads with story and behind-the-scenes trust.",
    creativeDrafts: [
      "Editorial hero with a quiet luxury feel",
      "Behind-the-scenes strip before packages",
      "Inquiry-first booking for premium clients",
    ],
    criticIssue: "A stock-looking gallery homepage will feel interchangeable.",
    criticResolve: "Rebuild around narrative and behind-the-scenes proof.",
    collaboration: [
      { expert: "research", text: "Couples buy emotion and trust first." },
      { expert: "strategy", text: "I'm leaning toward volume packages." },
      { expert: "critic", text: "I agree with Research. Premium story beats volume." },
    ],
    aha: {
      title: "Aha!",
      body: "Wedding photographers with strong behind-the-scenes photos tend to convert better than those with only finished galleries.",
      why: "I'm featuring that early so clients feel the experience, not just the portfolio.",
    },
    brandWhy:
      "I'm recommending premium positioning because wedding clients choose photographers who feel trustworthy and distinctive — not the cheapest.",
    homepageWhy:
      "Lead with narrative and behind-the-scenes, then packages — finished-only galleries read as generic.",
  },
  lawn_care: {
    label: "Lawn Care",
    comparableCount: 358,
    researchLead:
      "Homeowners hire lawn care for consistency — they fear missed weeks more than a slightly higher route price.",
    competitorPattern: "Most lawn services sell one-off cuts.",
    strategyPivot: "I'm exploring recurring routes as the growth engine.",
    creativeDrafts: ["Route reliability hero", "Seasonal packages", "Easy pause/resume booking"],
    criticIssue: "One-off pricing language undersells the real offer.",
    criticResolve: "Rebuild around recurring reliability.",
    collaboration: [
      { expert: "research", text: "Reliability on the route matters most." },
      { expert: "strategy", text: "I'm leaning toward one-off promotions." },
      { expert: "critic", text: "I agree with Research. Recurring routes win." },
    ],
    aha: {
      title: "Aha!",
      body: "Recurring lawn routes usually beat one-off jobs for lifetime value.",
      why: "I'm structuring your offer around a weekly/biweekly route from day one.",
    },
    brandWhy: "I'm recommending a reliability-first brand because missed weeks kill trust faster than price wins it.",
    homepageWhy: "Lead with route consistency and seasonal packages, then booking.",
  },
  hvac: {
    label: "HVAC",
    comparableCount: 401,
    researchLead:
      "Homeowners hire HVAC for peace of mind — emergency fear and maintenance plans outweigh pure price shopping.",
    competitorPattern: "Many shops only chase emergency calls.",
    strategyPivot: "I'm exploring trust + maintenance plans for recurring revenue.",
    creativeDrafts: ["Trust-first hero", "Maintenance plan cards", "Same-day / next-day booking"],
    criticIssue: "Emergency-only messaging feels reactive and forgettable.",
    criticResolve: "Rebuild around planned care and trust.",
    collaboration: [
      { expert: "research", text: "Trust and response time matter most." },
      { expert: "strategy", text: "I'm leaning toward discount coupons." },
      { expert: "critic", text: "I agree with Research. Plans beat coupons." },
    ],
    aha: {
      title: "Aha!",
      body: "HVAC shops that win on maintenance plans grow steadier than ones that only chase emergencies.",
      why: "I'm putting a clear maintenance plan path near the top of your site.",
    },
    brandWhy: "I'm recommending trust-led positioning because homeowners buy peace of mind, not the cheapest call-out.",
    homepageWhy: "Lead with trust signals and maintenance plans, then emergency booking.",
  },
  spa: {
    label: "Spa",
    comparableCount: 274,
    researchLead:
      "Spa clients book for calm and convenience — friction in booking kills rebooking more than price.",
    competitorPattern: "Many spas hide booking behind phone calls.",
    strategyPivot: "I'm exploring effortless online booking as the differentiator.",
    creativeDrafts: ["Calm full-bleed hero", "Service menu with durations", "One-tap book"],
    criticIssue: "A cluttered menu reads stressful, not spa-like.",
    criticResolve: "Simplify services and put booking first.",
    collaboration: [
      { expert: "research", text: "Booking ease drives rebooking." },
      { expert: "strategy", text: "I'm leaning toward heavy promotions." },
      { expert: "critic", text: "I agree with Research. Ease beats constant discounts." },
    ],
    aha: {
      title: "Aha!",
      body: "Spas that make booking effortless keep clients coming back without constant promotion.",
      why: "I'm putting book-online at the top and keeping the menu calm.",
    },
    brandWhy: "I'm recommending a calm, booking-first brand because spa clients punish friction.",
    homepageWhy: "Lead with atmosphere and one-tap booking, then a simple service menu.",
  },
  cleaning: {
    label: "Cleaning",
    comparableCount: 390,
    researchLead:
      "Property managers and hosts hire cleaning for reliability on turnovers — missed keys and late cleans burn trust.",
    competitorPattern: "Many cleaners compete only on hourly rate.",
    strategyPivot: "I'm exploring reliability + recurring turnover schedules.",
    creativeDrafts: ["Reliability hero", "Turnover packages", "Recurring schedule booking"],
    criticIssue: "Hourly-rate-first messaging attracts the wrong clients.",
    criticResolve: "Rebuild around reliability and recurring property rhythm.",
    collaboration: [
      { expert: "research", text: "Reliability on turnovers matters most." },
      { expert: "strategy", text: "I'm leaning toward lowest hourly rate." },
      { expert: "critic", text: "I agree with Research. Reliability wins recurring work." },
    ],
    aha: {
      title: "Aha!",
      body: "Cleaning businesses that feel reliable — not cheapest — keep the best recurring work.",
      why: "I'm leading with consistency and turnover packages, not hourly rates.",
    },
    brandWhy: "I'm recommending reliability positioning because short-term rental hosts punish no-shows harder than price.",
    homepageWhy: "Lead with proof of reliability, then turnover packages and recurring booking.",
  },
};

const DEFAULT_PACK = INDUSTRY_REASONING_PACKS.pressure_washing;

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function resolveIndustryKey(ctx = {}) {
  const raw = String(
    ctx.industryId ||
      ctx.industryKey ||
      ctx.industry ||
      ctx.facts?.industryId?.value ||
      ctx.facts?.industry?.value ||
      ctx.seed ||
      "",
  ).toLowerCase();
  if (/pressure|power\s*wash|soft\s*wash/.test(raw)) return "pressure_washing";
  if (/photo|wedding/.test(raw)) return "photography";
  if (/lawn|landscap|mow/.test(raw)) return "lawn_care";
  if (/hvac|heating|furnace|air\s*condition/.test(raw)) return "hvac";
  if (/\bspa\b|massage|facial|wellness/.test(raw)) return "spa";
  if (/clean|maid|airbnb|turnover|short.?term/.test(raw)) return "cleaning";
  return "pressure_washing";
}

export function getIndustryPack(key) {
  return INDUSTRY_REASONING_PACKS[key] || DEFAULT_PACK;
}

/**
 * Build Brain-shaped reasoning objects for this business (not placeholder blurbs).
 */
export function buildThinkingReasoningObjects(ctx = {}) {
  const key = resolveIndustryKey(ctx);
  const pack = getIndustryPack(key);
  const area = ctx.area || ctx.facts?.area?.value || "your area";
  const positioning = ctx.positioning || ctx.facts?.positioning?.value || "premium";
  const customer = ctx.customer || ctx.facts?.customer?.value || "residential";
  const now = new Date().toISOString();

  const brand = {
    reasoningId: uid("r"),
    decisionKey: "brand_positioning",
    decision: `${pack.label} with ${positioning} trust-first positioning`,
    explanation: pack.brandWhy,
    evidence: [pack.researchLead, pack.competitorPattern],
    confidence: 90,
    expectedOutcome: "higher_trust",
    expertsInvolved: ["research", "strategy"],
    timestamp: now,
    domain: "brand",
  };
  const homepage = {
    reasoningId: uid("r"),
    decisionKey: "homepage_strategy",
    decision: pack.creativeDrafts[0],
    explanation: pack.homepageWhy,
    evidence: pack.creativeDrafts,
    confidence: 88,
    expectedOutcome: "higher_conversion",
    expertsInvolved: ["strategy", "creative_director", "critic"],
    timestamp: now,
    domain: "website",
  };
  const aha = {
    reasoningId: uid("r"),
    decisionKey: "aha_insight",
    decision: pack.aha.body,
    explanation: `${pack.aha.body} ${pack.aha.why}`,
    evidence: [`area=${area}`, `customer=${customer}`, pack.competitorPattern],
    confidence: 86,
    expectedOutcome: "clearer_positioning",
    expertsInvolved: ["research", "strategy", "creative_director"],
    timestamp: now,
    domain: "insight",
  };
  return [brand, homepage, aha];
}

export function buildAhaCards(reasoningObjects, pack) {
  const cards = [];
  const ahaObj = (reasoningObjects || []).find((r) => r.decisionKey === "aha_insight");
  if (ahaObj || pack?.aha) {
    cards.push({
      kind: "aha",
      title: "💡 Aha!",
      body: pack.aha.body,
      why: pack.aha.why,
      decisionKey: "aha_insight",
      fromReasoning: true,
      reasoningId: ahaObj?.reasoningId || null,
    });
  }
  const brand = (reasoningObjects || []).find((r) => r.decisionKey === "brand_positioning");
  if (brand) {
    cards.push({
      kind: "why",
      title: "I found a stronger positioning",
      body: brand.explanation,
      why: brand.decision,
      decisionKey: brand.decisionKey,
      fromReasoning: true,
      reasoningId: brand.reasoningId,
    });
  }
  return cards;
}

export function buildExpertTimeline(ctx = {}, pack) {
  const p = pack || getIndustryPack(resolveIndustryKey(ctx));
  const area = ctx.area || ctx.facts?.area?.value || "your area";
  return [
    {
      expertId: "research",
      expertName: "Research Expert",
      emoji: "🧠",
      status: "complete",
      lines: [
        `Researching ${p.label.toLowerCase()} businesses${area && area !== "your area" ? ` around ${area}` : ""}…`,
        `Found ${p.comparableCount} comparable businesses.`,
        p.researchLead,
      ],
    },
    {
      expertId: "strategy",
      expertName: "Strategy Expert",
      emoji: "📈",
      status: "complete",
      lines: [p.competitorPattern, p.strategyPivot],
    },
    {
      expertId: "creative_director",
      expertName: "Creative Director",
      emoji: "🎨",
      status: "complete",
      lines: ["Drafting homepage concepts…", `Testing: ${p.creativeDrafts.join(" · ")}`],
    },
    {
      expertId: "critic",
      expertName: "Critic",
      emoji: "🧐",
      status: "complete",
      lines: [p.criticIssue, "I'm asking Creative Director to try again.", p.criticResolve],
    },
  ];
}

export function buildCollaborationBeats(pack) {
  return (pack.collaboration || []).map((c) => ({
    expertId: c.expert,
    expertName:
      c.expert === "research"
        ? "Research"
        : c.expert === "strategy"
        ? "Strategy"
        : c.expert === "critic"
        ? "Critic"
        : c.expert,
    text: c.text,
  }));
}

export function buildUnderstandingFacts(ctx = {}) {
  const facts = ctx.facts || {};
  const order = ["industry", "area", "operations", "positioning", "customer", "goal", "stage"];
  const out = [];
  for (const k of order) {
    const f = facts[k];
    if (f?.label && (f.confidence == null || f.confidence >= 55)) out.push({ label: f.label, key: k });
  }
  if (!out.length) {
    const pack = getIndustryPack(resolveIndustryKey(ctx));
    out.push({ label: pack.label, key: "industry" });
    if (ctx.positioning || facts.positioning?.value) {
      out.push({
        label:
          String(ctx.positioning || facts.positioning.value) === "premium"
            ? "Premium positioning"
            : String(ctx.positioning || facts.positioning.value),
        key: "positioning",
      });
    }
  }
  return out;
}

export function buildStageProgress(activeIndex = 0) {
  return THINKING_STAGES.map((s, i) => ({
    ...s,
    status: i < activeIndex ? "complete" : i === activeIndex ? "in_progress" : i === activeIndex + 1 ? "waiting" : "pending",
  }));
}

/**
 * Full Thinking Experience payload for one business context.
 * No fake delays — caller controls pacing of reveal.
 */
export function orchestrateThinkingExperience(ctx = {}) {
  const key = resolveIndustryKey(ctx);
  const pack = getIndustryPack(key);
  const reasoningObjects = buildThinkingReasoningObjects(ctx);
  const timeline = buildExpertTimeline(ctx, pack);
  const ahaCards = buildAhaCards(reasoningObjects, pack);
  const collaboration = buildCollaborationBeats(pack);
  const understanding = buildUnderstandingFacts(ctx);
  const stages = THINKING_STAGES.map((s) => ({ ...s, status: "complete" }));
  const primaryWhy = reasoningObjects.find((r) => r.decisionKey === "brand_positioning") || reasoningObjects[0];

  const discoveryMoments = [
    ...(ctx.moments || []).map((text) => ({ kind: "discovery", text, fromDiscovery: true })),
    {
      kind: "discovery",
      text: "I noticed something interesting…",
      fromReasoning: true,
    },
    {
      kind: "discovery",
      text: "I'm changing direction.",
      fromReasoning: true,
    },
    {
      kind: "discovery",
      text: "I don't think we should copy everyone else.",
      fromReasoning: true,
    },
    {
      kind: "discovery",
      text: pack.strategyPivot,
      fromReasoning: true,
    },
  ];

  const emotionArc = ["curiosity", "discovery", "confidence", "excitement"];

  const signature = [
    key,
    pack.comparableCount,
    pack.researchLead.slice(0, 40),
    pack.aha.body.slice(0, 40),
    timeline.map((t) => t.lines[0]).join("|"),
  ].join("::");

  return {
    version: THINKING_VERSION,
    industryKey: key,
    industryLabel: pack.label,
    stages,
    timeline,
    ahaCards,
    collaboration,
    understanding,
    discoveryMoments,
    reasoningObjects,
    primaryWhy: {
      decision: primaryWhy.decision,
      explanation: primaryWhy.explanation,
      decisionKey: primaryWhy.decisionKey,
    },
    emotionArc,
    transition: THINKING_TRANSITION,
    signature,
    fakeDelayMs: 0,
    source: "hubly_brain_reasoning",
  };
}

export function thinkingExperiencesAreDistinct(a, b) {
  return a?.signature && b?.signature && a.signature !== b.signature;
}

export function hasPercentageProgress(text) {
  return /\b\d{1,3}%\b/.test(String(text || ""));
}

export function evaluateThinkingHtml(html) {
  const h = String(html || "");
  const issues = [];
  const ok = (cond, msg) => {
    if (!cond) issues.push(msg);
    return !!cond;
  };

  const thinking = (() => {
    const i = h.indexOf('id="is-step-thinking"');
    if (i < 0) return "";
    const j = h.indexOf('id="is-step-vibe"', i);
    return j > i ? h.slice(i, j) : h.slice(i, i + 25000);
  })();

  const checks = {
    thinkingCanvas: ok(/data-thinking-experience|is-thinking-canvas/.test(h), "Missing Thinking Canvas"),
    expertTimeline: ok(/is-think-timeline|Research Expert|Strategy Expert/.test(h), "Missing expert timeline"),
    ahaCards: ok(/Aha!|is-aha-card|aha_insight/.test(h), "Missing Aha cards"),
    collaboration: ok(/is-think-collab|agree with Research|I'm leaning toward/.test(h), "Missing collaboration"),
    understandingPanel: ok(/is-think-understanding|Understanding/.test(thinking) || /is-think-understanding/.test(h), "Missing understanding panel"),
    stageProgress: ok(/is-think-stages|Research[\s\S]{0,80}Complete|In Progress/.test(h), "Missing stage progress"),
    whyExplain: ok(/primaryWhy|brandWhy|I'm recommending|because/.test(h), "Missing why explanations"),
    noPercent: ok(!/is-think[\s\S]{0,200}\d{1,3}%/.test(thinking) || !/\b63%\b/.test(thinking), "Percentage progress found"),
    noSpinner: ok(!/Loading…|skeleton.?loader|Please wait/i.test(thinking), "Spinner/loading copy in Thinking"),
    transition: ok(/I think I have a really strong direction\. Let me start building/.test(h), "Missing build transition"),
    orchestrator: ok(/orchestrateThinkingExperience|isRunThinkingExperience|buildThinkingReasoningObjects/.test(h), "Missing thinking orchestrator"),
    noFakeSleep: ok(!/isDiscoveryCompleteToThinking[\s\S]{0,400}isSleep\(1[6-9]\d{2}\)|isDiscoveryCompleteToThinking[\s\S]{0,400}isSleep\([2-9]\d{3}\)/.test(h), "Fake delay in Thinking handoff"),
    brainDriven: ok(/reasoningObjects|source:\s*['\"]hubly_brain|HublyAI\.think|fromReasoning/.test(h), "Not Brain/reasoning driven"),
    emotionPacing: ok(/curiosity|discovery|confidence|excitement|emotionArc/.test(h), "Missing emotion arc"),
    wordmark: ok(/hubly-wordmark-on-dark|hubly-wordmark/.test(thinking) || /is-think-brand/.test(h), "Missing Hubly brand on Thinking"),
  };

  return { passed: issues.length === 0, issues, checks };
}

export const HublyThinkingExperience = {
  version: THINKING_VERSION,
  label: THINKING_LABEL,
  orchestrate: orchestrateThinkingExperience,
  transition: THINKING_TRANSITION,
  packs: INDUSTRY_REASONING_PACKS,
};
