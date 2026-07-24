/**
 * Milestone 2 · Epic 5 — Business Reveal
 *
 * Unveil a new business — not "website finished."
 * Guided sections, stored reasoning Why?, alternatives, pride, time capsule.
 */
export const REVEAL_VERSION = "1.0.0";
export const REVEAL_LABEL = "Business Reveal";
export const REVEAL_HERO =
  "I think we built something you're going to be proud of.";
export const REVEAL_PRIDE =
  "Six minutes ago, this business only existed as an idea. Now it has a brand, a website, a booking experience, and a strategy.";
export const REVEAL_FORWARD =
  "When you're ready, I'll help you launch it.";
export const TIME_CAPSULE_LABEL = "Version 1.0 — Day One";

export const REVEAL_SECTIONS = [
  "identity",
  "website",
  "booking",
  "packages",
  "portfolio",
  "workspace",
  "summary",
];

export const REVEAL_FORBIDDEN = [
  "Website complete",
  "Website finished",
  "Build Complete",
  "Dashboard",
  "Go to dashboard",
];

const INDUSTRY_REVEAL = {
  pressure_washing: {
    label: "Pressure Washing",
    positioning: "Premium & Reliable",
    customer: "Homeowners",
    growth: "Recurring Maintenance",
    tagline: "Curb appeal you can trust — proof before the quote.",
    refine: ["Photography", "Pricing", "Reviews"],
    story:
      "A premium local pressure washing brand that leads with trust, clear packages, and an immediate quote path.",
    sections: {
      identity: {
        title: "Business Identity",
        body: "Logo feel, brand voice, and positioning locked around reliability — not the lowest price.",
        why: "I positioned you as premium & reliable because homeowners fear damage and no-shows more than price alone.",
      },
      website: {
        title: "Website",
        body: "Proof-first homepage with booking above the fold.",
        why: "I positioned your booking higher because homeowners usually want an immediate quote.",
      },
      booking: {
        title: "Booking Experience",
        body: "Single Book / Get quote path — no multi-step quiz.",
        why: "Critic rejected preference quizzes as friction after trust is earned.",
      },
      packages: {
        title: "Packages",
        body: "Three clear tiers: driveway, house, full property.",
        why: "I simplified your services into three packages because that typically increases conversion.",
      },
      portfolio: {
        title: "Portfolio",
        body: "Before/after curb-appeal proof strip.",
        why: "Research ranked before/after photos as the top trust signal for pressure washing.",
      },
      workspace: {
        title: "Workspace Draft",
        body: "A quiet home for jobs and follow-ups — ready when you launch.",
        why: "You'll manage the business here after launch — not before you've seen what we built.",
      },
    },
    alternatives: [
      {
        id: "luxury",
        label: "Luxury version",
        summary: "Darker contrast, proof-first hero, high-trust booking.",
      },
      {
        id: "friendly",
        label: "Friendly version (almost picked)",
        summary: "Warmer neighborhood feel — still intentional, less formal.",
      },
    ],
  },
  photography: {
    label: "Photography",
    positioning: "Premium Editorial",
    customer: "Wedding couples",
    growth: "Inquiry-led bookings",
    tagline: "Story first. Gallery that feels like you.",
    refine: ["Inquiry form copy", "Package naming", "Behind-the-scenes depth"],
    story:
      "A premium wedding photography brand that leads with story and behind-the-scenes trust before packages.",
    sections: {
      identity: {
        title: "Business Identity",
        body: "Quiet luxury brand — distinctive, never stock.",
        why: "Wedding clients choose photographers who feel trustworthy and distinctive — not the cheapest.",
      },
      website: {
        title: "Website",
        body: "Gallery-led homepage with soft inquiry CTA.",
        why: "I'm leading with portfolio because couples buy emotion before packages.",
      },
      booking: {
        title: "Booking Experience",
        body: "Inquiry-first — date + vision, not same-day open slots.",
        why: "Premium photography books through conversation, not instant commodity slots.",
      },
      packages: {
        title: "Packages",
        body: "Day / weekend / full-weekend experiences.",
        why: "I simplified packages so couples choose an experience, not a spreadsheet.",
      },
      portfolio: {
        title: "Portfolio",
        body: "Behind-the-scenes + finished gallery mix.",
        why: "BTS photos convert better than finished galleries alone.",
      },
      workspace: {
        title: "Workspace Draft",
        body: "A quiet place for inquiries and shoots.",
        why: "Creative work needs a calm home after the reveal — not a CRM dump.",
      },
    },
    alternatives: [
      {
        id: "luxury",
        label: "Luxury version",
        summary: "Editorial hero, muted palette, inquiry-first.",
      },
      {
        id: "friendly",
        label: "Friendly version (almost picked)",
        summary: "Warmer documentary feel with a softer CTA.",
      },
    ],
  },
  cleaning: {
    label: "Cleaning",
    positioning: "Reliable & Recurring",
    customer: "Short-term rental hosts",
    growth: "Recurring turnovers",
    tagline: "On-time turnovers. Reliability you can book.",
    refine: ["Review collection", "Plan pricing", "Host portal"],
    story:
      "A reliability-first cleaning business built around recurring turnover plans — not hourly race-to-bottom.",
    sections: {
      identity: {
        title: "Business Identity",
        body: "Dependable brand that hosts can trust with keys and calendars.",
        why: "Hosts punish no-shows harder than price — reliability is the positioning.",
      },
      website: {
        title: "Website",
        body: "Recurring plans → reviews → book.",
        why: "I led with recurring plans because that's the real growth engine.",
      },
      booking: {
        title: "Booking Experience",
        body: "Recurring book path hosts won't chase every week.",
        why: "Easy recurring booking keeps turnovers on the calendar.",
      },
      packages: {
        title: "Packages",
        body: "Turnover, weekly, and biweekly plans.",
        why: "I simplified into plans because hourly quotes attract the wrong clients.",
      },
      portfolio: {
        title: "Portfolio",
        body: "Reviews and tidy proof shots.",
        why: "Social proof builds host confidence faster than rate sheets.",
      },
      workspace: {
        title: "Workspace Draft",
        body: "Schedules and turnovers in one quiet home.",
        why: "Ops clarity comes after you're proud of what we built.",
      },
    },
    alternatives: [
      {
        id: "luxury",
        label: "Luxury version",
        summary: "Hotel-clean reliability, calm proof-first site.",
      },
      {
        id: "friendly",
        label: "Friendly version (almost picked)",
        summary: "Neighborhood trusted cleaner energy.",
      },
    ],
  },
  hvac: {
    label: "HVAC",
    positioning: "Trusted & Plan-led",
    customer: "Homeowners",
    growth: "Maintenance plans",
    tagline: "Peace of mind — plans before panic.",
    refine: ["Plan pricing", "Emergency SLA copy", "Review proof"],
    story:
      "A trust-led HVAC business that grows on maintenance plans instead of chasing only emergencies.",
    sections: {
      identity: {
        title: "Business Identity",
        body: "Steady, licensed, peace-of-mind brand.",
        why: "Homeowners buy peace of mind, not the cheapest call-out.",
      },
      website: {
        title: "Website",
        body: "Trust → plans → book.",
        why: "Strategy put maintenance plans near the top for recurring revenue.",
      },
      booking: {
        title: "Booking Experience",
        body: "Book service + plan signup without burying either.",
        why: "Fast booking still leaves room for the plan that grows the business.",
      },
      packages: {
        title: "Packages",
        body: "Tune-up, seasonal, and priority plans.",
        why: "Plans grow steadier than emergency-only shops.",
      },
      portfolio: {
        title: "Portfolio",
        body: "Reviews and credentials strip.",
        why: "Licensed language and reviews reduce emergency fear.",
      },
      workspace: {
        title: "Workspace Draft",
        body: "Jobs and plans in one place.",
        why: "You'll run the business from here after launch.",
      },
    },
    alternatives: [
      {
        id: "luxury",
        label: "Luxury version",
        summary: "Peace-of-mind premium, plan-led hero.",
      },
      {
        id: "friendly",
        label: "Friendly version (almost picked)",
        summary: "Neighborhood technician warmth.",
      },
    ],
  },
};

function resolveKey(ctx = {}) {
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
  if (/clean|maid|airbnb|turnover|short.?term/.test(raw)) return "cleaning";
  if (/hvac|heating|furnace|air\s*condition/.test(raw)) return "hvac";
  if (/lawn|landscap|mow/.test(raw)) return "lawn_care";
  if (/\bspa\b|massage|facial/.test(raw)) return "spa";
  return "pressure_washing";
}

function packFor(key) {
  if (INDUSTRY_REVEAL[key]) return INDUSTRY_REVEAL[key];
  // Fallback maps lawn/spa lightly onto pressure structure with renamed labels
  if (key === "lawn_care") {
    return {
      ...INDUSTRY_REVEAL.pressure_washing,
      label: "Lawn Care",
      positioning: "Reliable Routes",
      growth: "Recurring routes",
      tagline: "Your lawn, on schedule.",
      story: "A route-first lawn care brand built on reliability and recurring schedules.",
    };
  }
  if (key === "spa") {
    return {
      ...INDUSTRY_REVEAL.photography,
      label: "Spa",
      positioning: "Calm & Bookable",
      customer: "Wellness clients",
      growth: "Effortless rebooking",
      tagline: "Calm space. One-tap book.",
      story: "A booking-first spa brand that removes friction and keeps the menu calm.",
    };
  }
  return INDUSTRY_REVEAL.pressure_washing;
}

/**
 * Build stored reasoning map for Why? answers — never regenerated guesses.
 */
export function buildRevealReasoningStore(ctx = {}, pack) {
  const p = pack || packFor(resolveKey(ctx));
  const fromThinking = ctx.thinkingReasoningObjects || ctx.reasoningObjects || [];
  const fromBuild = (ctx.creativeStages || []).map((s) => ({
    reasoningId: `build_${s.id}`,
    decisionKey: s.id,
    decision: s.decision || s.title,
    explanation: s.explain,
    confidence: s.confidence || 90,
    source: "creative_build",
  }));
  const sectionWhy = Object.entries(p.sections || {}).map(([id, sec]) => ({
    reasoningId: `reveal_${id}`,
    decisionKey: id,
    decision: sec.title,
    explanation: sec.why,
    confidence: 92,
    source: "reveal_store",
  }));
  const store = [...fromThinking, ...fromBuild, ...sectionWhy];
  // Dedupe by decisionKey keeping first
  const seen = new Set();
  return store.filter((r) => {
    const k = r.decisionKey || r.reasoningId;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function answerWhyFromStore(store, topic) {
  const t = String(topic || "").toLowerCase();
  const hit =
    (store || []).find((r) => String(r.decisionKey || "").toLowerCase() === t) ||
    (store || []).find((r) => String(r.decision || "").toLowerCase().includes(t)) ||
    (store || []).find((r) => String(r.explanation || "").toLowerCase().includes(t));
  if (!hit) {
    return {
      ok: false,
      text: "I want to answer from what we already decided — ask about identity, website, booking, packages, portfolio, or brand.",
      fromStore: false,
    };
  }
  return {
    ok: true,
    text: hit.explanation,
    decisionKey: hit.decisionKey,
    reasoningId: hit.reasoningId,
    fromStore: true,
    source: hit.source || "stored_reasoning",
  };
}

export function buildTimeCapsule(ctx = {}, reveal) {
  return {
    label: TIME_CAPSULE_LABEL,
    createdAt: new Date().toISOString(),
    firstConversation: ctx.seed || ctx.firstConversation || null,
    originalVision: ctx.learningSummary?.lines || ctx.moments || [],
    firstWebsite: reveal?.sections?.find((s) => s.id === "website")?.body || null,
    firstBrand: reveal?.snapshot?.positioning || null,
    firstStrategy: reveal?.story || null,
    firstSnapshot: reveal?.snapshot || null,
    firstReasoning: (reveal?.reasoningStore || []).slice(0, 8),
    businessName: reveal?.businessName || null,
    industry: reveal?.industryLabel || null,
  };
}

export function orchestrateBusinessReveal(ctx = {}) {
  const key = resolveKey(ctx);
  const pack = packFor(key);
  const name = String(ctx.businessName || ctx.biz || `My ${pack.label}`).trim() || `My ${pack.label}`;

  const confidence = Math.min(
    99,
    Math.max(
      88,
      Number(ctx.designConfidence) ||
        Math.round(
          ((ctx.creativeStages || []).reduce((a, s) => a + (s.confidence || 90), 0) /
            Math.max(1, (ctx.creativeStages || []).length)) ||
            96,
        ),
    ),
  );

  const sections = [
    {
      id: "identity",
      ...pack.sections.identity,
      items: ["Logo", "Brand", "Positioning", "Tagline"],
      tagline: pack.tagline,
    },
    { id: "website", ...pack.sections.website },
    { id: "booking", ...pack.sections.booking },
    { id: "packages", ...pack.sections.packages },
    { id: "portfolio", ...pack.sections.portfolio },
    { id: "workspace", ...pack.sections.workspace },
    {
      id: "summary",
      title: "Business Summary",
      body: pack.story,
      why: "This summary is the strategy we chose together — not a template checklist.",
    },
  ];

  const snapshot = {
    businessType: pack.label,
    positioning: pack.positioning,
    primaryCustomer: pack.customer,
    growthFocus: pack.growth,
    websiteReady: true,
    bookingReady: true,
    brandReady: true,
  };

  const reasoningStore = buildRevealReasoningStore(
    {
      ...ctx,
      creativeStages: ctx.creativeStages || [],
      thinkingReasoningObjects: ctx.thinkingReasoningObjects || ctx.reasoningObjects || [],
    },
    pack,
  );

  const alternatives = (pack.alternatives || []).map((a) => ({
    ...a,
    rejected: a.id !== (ctx.chosenDirection || "luxury"),
    chosen: a.id === (ctx.chosenDirection || "luxury"),
  }));

  const reveal = {
    version: REVEAL_VERSION,
    industryKey: key,
    industryLabel: pack.label,
    businessName: name,
    welcome: `Welcome to ${name}.`,
    hero: REVEAL_HERO,
    pride: REVEAL_PRIDE,
    forward: REVEAL_FORWARD,
    story: pack.story,
    tagline: pack.tagline,
    sections,
    snapshot,
    overallConfidence: confidence,
    refineAreas: pack.refine || [],
    alternatives,
    reasoningStore,
    noDashboardFirst: true,
    cinematic: true,
    signature: [key, name, pack.positioning, pack.tagline.slice(0, 40)].join("::"),
  };

  reveal.timeCapsule = buildTimeCapsule(ctx, reveal);
  return reveal;
}

export function revealExperiencesAreDistinct(a, b) {
  return a?.signature && b?.signature && a.signature !== b.signature;
}

export function evaluateRevealHtml(html) {
  const h = String(html || "");
  const issues = [];
  const ok = (cond, msg) => {
    if (!cond) issues.push(msg);
    return !!cond;
  };

  const slice = (() => {
    const i = h.indexOf('id="is-step-reveal"') >= 0
      ? h.indexOf('id="is-step-reveal"')
      : h.indexOf('id="is-step-reveal-shell"');
    if (i < 0) return "";
    const j = h.indexOf('id="is-step-vibe"', i);
    return j > i ? h.slice(i, j) : h.slice(i, i + 35000);
  })();

  const checks = {
    revealCanvas: ok(/data-business-reveal|is-reveal-canvas|id="is-step-reveal"/.test(h), "Missing Reveal canvas"),
    heroStatement: ok(/I think we built something you're going to be proud of/.test(h), "Missing hero statement"),
    welcomeBiz: ok(/Welcome to|is-reveal-welcome/.test(h), "Missing Welcome to business"),
    guidedSections: ok(
      /is-reveal-section|Business Identity|Booking Experience|Business Snapshot/.test(h),
      "Missing guided sections",
    ),
    whyExplain: ok(/Why we built it|is-reveal-why|answerWhyFromStore|isRevealAskWhy/.test(h), "Missing Why explanations"),
    snapshot: ok(/Business Snapshot|is-reveal-snapshot/.test(h), "Missing Business Snapshot"),
    confidence: ok(/Overall Business Confidence|is-reveal-confidence/.test(h), "Missing confidence summary"),
    alternatives: ok(/Show me the luxury|almost picked|is-reveal-alts|isRevealShowAlternative/.test(h), "Missing alternatives"),
    interactiveWhy: ok(/Why did you do this|is-reveal-ask|isRevealAskWhy/.test(h), "Missing interactive Why"),
    prideMoment: ok(/Six minutes ago|is-reveal-pride/.test(h), "Missing pride moment"),
    forwardLaunch: ok(/When you're ready, I'll help you launch it/.test(h), "Missing Epic 6 transition"),
    noDashboardFirst: ok(!/Go to dashboard|Open dashboard/i.test(slice), "Dashboard shown first"),
    noWebsiteComplete: ok(!/Website complete|Website finished/i.test(slice), "Says website complete"),
    timeCapsule: ok(/Version 1\.0 — Day One|Time Capsule|is-reveal-capsule|timeCapsule/.test(h), "Missing Time Capsule"),
    creativeHandoff: ok(/isRunBusinessReveal|isRunCreativeBuildExperience[\s\S]{0,400}isRunBusinessReveal/.test(h), "Creative not handing off to Reveal"),
    wordmark: ok(/hubly-wordmark/.test(slice) || /is-reveal-brand/.test(h), "Missing Hubly brand"),
  };

  return { passed: issues.length === 0, issues, checks };
}

export const HublyBusinessReveal = {
  version: REVEAL_VERSION,
  label: REVEAL_LABEL,
  orchestrate: orchestrateBusinessReveal,
  answerWhy: answerWhyFromStore,
  timeCapsule: buildTimeCapsule,
  hero: REVEAL_HERO,
  pride: REVEAL_PRIDE,
  forward: REVEAL_FORWARD,
};
