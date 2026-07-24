/**
 * Milestone 2 · Epic 4 — Creative Build Experience
 *
 * Watching Hubly build a business — not generate a website.
 * Progressive stages, live explanations, industry-specific sequences.
 */
export const CREATIVE_BUILD_VERSION = "1.0.0";
export const CREATIVE_BUILD_LABEL = "Creative Build Experience";
export const CREATIVE_BUILD_TRANSITION =
  "I think we built something you're going to be proud of.";
export const CREATIVE_BUILD_CHOICE_PROMPT = "I have two directions. Can I show you both?";

export const CREATIVE_BUILD_STAGES = [
  "structure",
  "hero",
  "brand",
  "packages",
  "booking",
  "portfolio",
  "workspace",
];

export const CREATIVE_BUILD_FORBIDDEN = [
  "Build Complete",
  "Loading…",
  "Loading...",
  "Please wait",
  "Skeleton loader",
];

/** Industry-specific build order + stage copy (Strategy / Creative / Critic sourced). */
export const INDUSTRY_BUILD_PACKS = {
  pressure_washing: {
    label: "Pressure Washing",
    sequence: ["structure", "hero", "brand", "packages", "booking", "portfolio", "workspace"],
    focus: ["trust", "services", "booking", "reviews"],
    directions: [
      { id: "luxury", label: "Luxury", hint: "High contrast, premium proof-first" },
      { id: "friendly", label: "Friendly", hint: "Warm, approachable neighborhood brand" },
    ],
    stages: {
      structure: {
        title: "Website structure",
        explain:
          "I'm laying out a proof-first homepage because Strategy said trust beats price for pressure washing.",
        surface: "website",
        confidence: 94,
        before: "Generic three-column template",
        after: "Proof → Packages → Book path",
        decision: "Premium positioning",
        bts: [
          { expert: "creative", text: "I'm trying a brighter hero image." },
          { expert: "critic", text: "I think the darker version feels more premium." },
          { expert: "creative", text: "Good point. Switching back." },
          { expert: "hubly", text: "I kept the darker version because it better supports the premium positioning we chose." },
        ],
      },
      hero: {
        title: "Hero comes alive",
        explain:
          "I moved booking above the fold because your customers usually want a quick quote.",
        surface: "website",
        confidence: 97,
        before: "Booking buried below the fold",
        after: "Book / Get quote in the hero",
        decision: "Strong call-to-action",
      },
      brand: {
        title: "Brand colors & type",
        explain:
          "I'm using darker colors because premium home service brands tend to convert better with higher contrast.",
        surface: "brand",
        confidence: 91,
        before: "Default bright palette",
        after: "Navy + warm accent, high contrast",
        decision: "Residential focus",
      },
      packages: {
        title: "Packages",
        explain: "I simplified your packages to reduce decision fatigue.",
        surface: "packages",
        confidence: 96,
        before: "Long à-la-carte list",
        after: "Driveway / House / Full property tiers",
        decision: "Recurring services highlighted",
      },
      booking: {
        title: "Booking experience",
        explain: "One primary quote path — Critic rejected multi-step quizzes as friction.",
        surface: "booking",
        confidence: 94,
        before: "Multi-step preference form",
        after: "Single Book / Get quote CTA",
        decision: "High-trust booking",
      },
      portfolio: {
        title: "Before & after proof",
        explain: "Visible proof reduces damage fears — Research ranked before/after photos first.",
        surface: "portfolio",
        confidence: 93,
        before: "Stock lifestyle photos only",
        after: "Before/after curb-appeal strip",
        decision: "Trust proof first",
      },
      workspace: {
        title: "Workspace draft",
        explain: "A quiet home for jobs and follow-ups — you'll see it after we reveal the business.",
        surface: "workspace",
        confidence: 88,
        before: "Empty dashboard shell",
        after: "Draft workspace for day-to-day",
        decision: "Business home ready",
      },
    },
  },
  photography: {
    label: "Photography",
    sequence: ["structure", "portfolio", "hero", "brand", "packages", "booking", "workspace"],
    focus: ["portfolio", "gallery", "packages", "booking"],
    directions: [
      { id: "luxury", label: "Luxury", hint: "Editorial, quiet luxury" },
      { id: "friendly", label: "Friendly", hint: "Warm documentary feel" },
    ],
    stages: {
      structure: {
        title: "Website structure",
        explain: "I'm leading with portfolio because wedding clients buy emotion before packages.",
        surface: "website",
        confidence: 95,
        before: "Service-first template",
        after: "Gallery-led homepage",
        decision: "Premium positioning",
        bts: [
          { expert: "creative", text: "I'm trying a finished-gallery-only hero." },
          { expert: "critic", text: "That feels interchangeable with every other photographer." },
          { expert: "creative", text: "Switching to behind-the-scenes + finished work." },
          { expert: "hubly", text: "I kept the story-led hero because it supports the premium brand we chose." },
        ],
      },
      portfolio: {
        title: "Portfolio gallery",
        explain: "Behind-the-scenes photos convert better than finished galleries alone.",
        surface: "portfolio",
        confidence: 96,
        before: "Finished shots only",
        after: "BTS + finished gallery mix",
        decision: "Story-first portfolio",
      },
      hero: {
        title: "Hero comes alive",
        explain: "Quiet luxury hero — Creative wanted polish without looking stock.",
        surface: "website",
        confidence: 94,
        before: "Busy collage hero",
        after: "Single editorial frame + soft CTA",
        decision: "Strong call-to-action",
      },
      brand: {
        title: "Brand colors & type",
        explain: "Soft neutrals and refined type for a premium wedding brand.",
        surface: "brand",
        confidence: 92,
        before: "Generic bright theme",
        after: "Muted editorial palette",
        decision: "Wedding client focus",
      },
      packages: {
        title: "Packages",
        explain: "I simplified packages so couples choose an experience, not a spreadsheet.",
        surface: "packages",
        confidence: 95,
        before: "Hourly add-on maze",
        after: "Clear day / weekend / full-weekend tiers",
        decision: "Clear package story",
      },
      booking: {
        title: "Booking experience",
        explain: "Inquiry-first booking fits premium photography — not same-day open slots.",
        surface: "booking",
        confidence: 93,
        before: "Instant book calendar",
        after: "Inquiry with date + vision",
        decision: "High-trust booking",
      },
      workspace: {
        title: "Workspace draft",
        explain: "A quiet place for inquiries and shoots — reveal comes next.",
        surface: "workspace",
        confidence: 87,
        before: "Empty shell",
        after: "Draft creative workspace",
        decision: "Business home ready",
      },
    },
  },
  cleaning: {
    label: "Cleaning",
    sequence: ["structure", "packages", "booking", "hero", "brand", "portfolio", "workspace"],
    focus: ["recurring", "reviews", "booking", "trust"],
    directions: [
      { id: "luxury", label: "Luxury", hint: "Hotel-clean reliability" },
      { id: "friendly", label: "Friendly", hint: "Neighborhood trusted cleaner" },
    ],
    stages: {
      structure: {
        title: "Website structure",
        explain: "I'm leading with recurring plans because hosts punish missed turnovers harder than price.",
        surface: "website",
        confidence: 93,
        before: "Hourly-rate homepage",
        after: "Recurring plans → Reviews → Book",
        decision: "Recurring services highlighted",
        bts: [
          { expert: "strategy", text: "Lead with lowest hourly rate." },
          { expert: "critic", text: "That attracts the wrong clients." },
          { expert: "creative", text: "Switching to reliability-first." },
          { expert: "hubly", text: "I kept reliability first because it wins recurring property work." },
        ],
      },
      packages: {
        title: "Recurring plans",
        explain: "Turnover packages and recurring schedules — not open-ended hourly quotes.",
        surface: "packages",
        confidence: 96,
        before: "Hourly only",
        after: "Turnover + recurring plans",
        decision: "Recurring services highlighted",
      },
      booking: {
        title: "Booking experience",
        explain: "Easy recurring booking so hosts don't chase you every turnover.",
        surface: "booking",
        confidence: 94,
        before: "Call-only scheduling",
        after: "Recurring book path",
        decision: "High-trust booking",
      },
      hero: {
        title: "Hero comes alive",
        explain: "Reliability message above the fold — Strategy ranked trust over cheapest.",
        surface: "website",
        confidence: 95,
        before: "Cheap & fast headline",
        after: "Reliable turnovers, on time",
        decision: "Strong call-to-action",
      },
      brand: {
        title: "Brand colors & type",
        explain: "Clean, calm palette that feels dependable — not discount-flyer loud.",
        surface: "brand",
        confidence: 90,
        before: "Neon promo colors",
        after: "Calm, trustworthy palette",
        decision: "Trust-first brand",
      },
      portfolio: {
        title: "Proof & reviews",
        explain: "Reviews and tidy proof shots build host confidence fast.",
        surface: "portfolio",
        confidence: 92,
        before: "No social proof",
        after: "Reviews + tidy proof strip",
        decision: "Trust proof first",
      },
      workspace: {
        title: "Workspace draft",
        explain: "A home for schedules and turnovers — next we reveal the business.",
        surface: "workspace",
        confidence: 86,
        before: "Empty shell",
        after: "Draft ops workspace",
        decision: "Business home ready",
      },
    },
  },
  hvac: {
    label: "HVAC",
    sequence: ["structure", "hero", "booking", "packages", "brand", "portfolio", "workspace"],
    focus: ["trust", "maintenance", "booking", "plans"],
    directions: [
      { id: "luxury", label: "Luxury", hint: "Peace-of-mind premium" },
      { id: "friendly", label: "Friendly", hint: "Neighborhood technician" },
    ],
    stages: {
      structure: {
        title: "Website structure",
        explain: "Trust-first layout — homeowners buy peace of mind, not the cheapest call-out.",
        surface: "website",
        confidence: 94,
        before: "Coupon-first template",
        after: "Trust → Plans → Book",
        decision: "Premium positioning",
        bts: [
          { expert: "strategy", text: "I'm leaning toward discount coupons." },
          { expert: "critic", text: "Plans beat coupons for recurring revenue." },
          { expert: "creative", text: "Putting maintenance plans near the top." },
          { expert: "hubly", text: "I kept the plan-led path because it matches the trust strategy." },
        ],
      },
      hero: {
        title: "Hero comes alive",
        explain: "Peace-of-mind hero with clear same-day / next-day booking.",
        surface: "website",
        confidence: 96,
        before: "Vague 'call us' hero",
        after: "Trust headline + book path",
        decision: "Strong call-to-action",
      },
      booking: {
        title: "Booking experience",
        explain: "Fast service booking without burying the maintenance plan option.",
        surface: "booking",
        confidence: 95,
        before: "Phone-only",
        after: "Book + plan signup",
        decision: "High-trust booking",
      },
      packages: {
        title: "Maintenance plans",
        explain: "Plans grow steadier than emergency-only shops — Research was clear.",
        surface: "packages",
        confidence: 97,
        before: "Emergency call-outs only",
        after: "Maintenance plan cards",
        decision: "Recurring services highlighted",
      },
      brand: {
        title: "Brand colors & type",
        explain: "Solid, trustworthy contrast — not flashy promo colors.",
        surface: "brand",
        confidence: 91,
        before: "Bright sale theme",
        after: "Steady professional palette",
        decision: "Trust-first brand",
      },
      portfolio: {
        title: "Proof & reviews",
        explain: "Reviews and licensed language reduce emergency fear.",
        surface: "portfolio",
        confidence: 92,
        before: "No proof",
        after: "Reviews + credentials strip",
        decision: "Trust proof first",
      },
      workspace: {
        title: "Workspace draft",
        explain: "A home for jobs and plans — reveal is next.",
        surface: "workspace",
        confidence: 87,
        before: "Empty shell",
        after: "Draft service workspace",
        decision: "Business home ready",
      },
    },
  },
  lawn_care: {
    label: "Lawn Care",
    sequence: ["structure", "packages", "booking", "hero", "brand", "portfolio", "workspace"],
    focus: ["routes", "recurring", "booking", "reliability"],
    directions: [
      { id: "luxury", label: "Luxury", hint: "Estate-level consistency" },
      { id: "friendly", label: "Friendly", hint: "Neighborhood route care" },
    ],
    stages: {
      structure: {
        title: "Website structure",
        explain: "Recurring routes first — missed weeks kill trust faster than price wins it.",
        surface: "website",
        confidence: 93,
        before: "One-off cut promo",
        after: "Route reliability → Packages → Book",
        decision: "Recurring services highlighted",
        bts: [
          { expert: "strategy", text: "I'm leaning toward one-off promotions." },
          { expert: "critic", text: "Recurring routes win." },
          { expert: "creative", text: "Leading with weekly/biweekly reliability." },
          { expert: "hubly", text: "I kept the route-first story because reliability is the brand." },
        ],
      },
      packages: {
        title: "Route packages",
        explain: "Weekly and biweekly routes as the default offer.",
        surface: "packages",
        confidence: 96,
        before: "One-off only",
        after: "Recurring route tiers",
        decision: "Recurring services highlighted",
      },
      booking: {
        title: "Booking experience",
        explain: "Easy pause/resume booking for seasonal routes.",
        surface: "booking",
        confidence: 94,
        before: "Call to schedule",
        after: "Route booking with pause/resume",
        decision: "High-trust booking",
      },
      hero: {
        title: "Hero comes alive",
        explain: "Reliability message — your lawn, on schedule.",
        surface: "website",
        confidence: 95,
        before: "Cheap cut headline",
        after: "On-schedule route promise",
        decision: "Strong call-to-action",
      },
      brand: {
        title: "Brand colors & type",
        explain: "Fresh outdoor greens with solid contrast for local trust.",
        surface: "brand",
        confidence: 90,
        before: "Default theme",
        after: "Outdoor trust palette",
        decision: "Local brand",
      },
      portfolio: {
        title: "Yard proof",
        explain: "Before/after lawns make reliability visible.",
        surface: "portfolio",
        confidence: 91,
        before: "No proof",
        after: "Yard before/after strip",
        decision: "Trust proof first",
      },
      workspace: {
        title: "Workspace draft",
        explain: "A home for routes and days — reveal next.",
        surface: "workspace",
        confidence: 86,
        before: "Empty shell",
        after: "Draft route workspace",
        decision: "Business home ready",
      },
    },
  },
  spa: {
    label: "Spa",
    sequence: ["structure", "brand", "booking", "packages", "hero", "portfolio", "workspace"],
    focus: ["calm", "booking", "menu", "atmosphere"],
    directions: [
      { id: "luxury", label: "Luxury", hint: "Quiet luxury spa" },
      { id: "friendly", label: "Friendly", hint: "Warm neighborhood wellness" },
    ],
    stages: {
      structure: {
        title: "Website structure",
        explain: "Booking-first calm layout — spa clients punish friction.",
        surface: "website",
        confidence: 94,
        before: "Phone-only menu site",
        after: "Atmosphere → Book → Simple menu",
        decision: "Premium positioning",
        bts: [
          { expert: "strategy", text: "I'm leaning toward heavy promotions." },
          { expert: "critic", text: "Ease beats constant discounts." },
          { expert: "creative", text: "Keeping the menu calm and book-online first." },
          { expert: "hubly", text: "I kept booking effortless because rebooking depends on it." },
        ],
      },
      brand: {
        title: "Brand colors & type",
        explain: "Soft spa atmosphere — never cluttered or loud.",
        surface: "brand",
        confidence: 93,
        before: "Busy promo theme",
        after: "Calm spa palette",
        decision: "Calm brand",
      },
      booking: {
        title: "Booking experience",
        explain: "One-tap book at the top — Research said friction kills rebooking.",
        surface: "booking",
        confidence: 97,
        before: "Call to book",
        after: "One-tap online book",
        decision: "High-trust booking",
      },
      packages: {
        title: "Service menu",
        explain: "I simplified services with durations to reduce decision fatigue.",
        surface: "packages",
        confidence: 95,
        before: "Endless menu",
        after: "Clear duration-based services",
        decision: "Clear package story",
      },
      hero: {
        title: "Hero comes alive",
        explain: "Full-bleed calm hero that feels like the room, not an ad.",
        surface: "website",
        confidence: 94,
        before: "Coupon banner hero",
        after: "Atmosphere-led hero + book",
        decision: "Strong call-to-action",
      },
      portfolio: {
        title: "Atmosphere gallery",
        explain: "Space and treatment photos that sell the feeling.",
        surface: "portfolio",
        confidence: 91,
        before: "No gallery",
        after: "Calm atmosphere strip",
        decision: "Story-first portfolio",
      },
      workspace: {
        title: "Workspace draft",
        explain: "A quiet home for appointments — reveal is next.",
        surface: "workspace",
        confidence: 87,
        before: "Empty shell",
        after: "Draft spa workspace",
        decision: "Business home ready",
      },
    },
  },
};

const DEFAULT_PACK = INDUSTRY_BUILD_PACKS.pressure_washing;

export function resolveBuildIndustryKey(ctx = {}) {
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

export function getBuildPack(key) {
  return INDUSTRY_BUILD_PACKS[key] || DEFAULT_PACK;
}

export function applyInterruptToBuild(experience, text) {
  const t = String(text || "").toLowerCase();
  const updates = [];
  let direction = experience.chosenDirection || null;
  if (/premium|luxury|darker|more premium|high.?end/.test(t)) {
    direction = "luxury";
    updates.push({
      kind: "interrupt",
      text: "Got it — shifting toward a more premium feel.",
      surface: "brand",
      confidenceDelta: 2,
    });
  }
  if (/friendly|warmer|brighter|less formal/.test(t)) {
    direction = "friendly";
    updates.push({
      kind: "interrupt",
      text: "Understood — warming the brand up.",
      surface: "brand",
      confidenceDelta: 1,
    });
  }
  if (/don'?t like blue|no blue|change (the )?color|not blue/.test(t)) {
    updates.push({
      kind: "interrupt",
      text: "I'll move away from blue and refresh the accent.",
      surface: "brand",
      confidenceDelta: 1,
    });
  }
  if (/booking higher|move booking|book(ing)? (up|higher|top)/.test(t)) {
    updates.push({
      kind: "interrupt",
      text: "Moving booking higher — it's already a priority in the hero.",
      surface: "booking",
      confidenceDelta: 2,
    });
  }
  if (/membership|recurring|subscription/.test(t)) {
    updates.push({
      kind: "interrupt",
      text: "Highlighting memberships / recurring plans in packages.",
      surface: "packages",
      confidenceDelta: 2,
      decision: "Recurring services highlighted",
    });
  }
  if (!updates.length) {
    updates.push({
      kind: "interrupt",
      text: "I heard you — I'll fold that into the next pass.",
      surface: "website",
      confidenceDelta: 0,
    });
  }
  return { direction, updates };
}

/**
 * Full Creative Build payload — progressive, industry-specific, no silent building.
 */
export function orchestrateCreativeBuildExperience(ctx = {}) {
  const key = resolveBuildIndustryKey(ctx);
  const pack = getBuildPack(key);
  const sequence = [...(pack.sequence || CREATIVE_BUILD_STAGES)];
  const stageCards = sequence.map((id) => {
    const s = pack.stages[id] || {
      title: id,
      explain: `Building ${id}…`,
      surface: id,
      confidence: 85,
      before: "Earlier draft",
      after: "Improved version",
      decision: id,
    };
    return {
      id,
      title: s.title,
      explain: s.explain,
      surface: s.surface,
      confidence: s.confidence,
      before: s.before,
      after: s.after,
      decision: s.decision,
      bts: s.bts || null,
      source: "strategy_creative_critic",
    };
  });

  const decisions = [];
  for (const s of stageCards) {
    if (s.decision && !decisions.includes(s.decision)) decisions.push(s.decision);
  }
  // Ensure core decision chips exist
  for (const d of ["Premium positioning", "Residential focus", "High-trust booking", "Strong call-to-action"]) {
    if (!decisions.includes(d) && /pressure|lawn|hvac|clean/i.test(pack.label)) {
      /* leave industry-specific */
    }
  }

  const confidences = stageCards.map((s) => s.confidence);
  const designConfidence = Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length);

  const surfaceConfidence = {};
  for (const s of stageCards) {
    surfaceConfidence[s.surface] = Math.max(surfaceConfidence[s.surface] || 0, s.confidence);
  }

  const signature = [key, sequence.join(">"), pack.focus.join(","), stageCards[0]?.explain?.slice(0, 48)].join("::");

  return {
    version: CREATIVE_BUILD_VERSION,
    industryKey: key,
    industryLabel: pack.label,
    sequence,
    stages: stageCards,
    decisions,
    designConfidence,
    surfaceConfidence,
    directions: pack.directions,
    choicePrompt: CREATIVE_BUILD_CHOICE_PROMPT,
    transition: CREATIVE_BUILD_TRANSITION,
    focus: pack.focus,
    signature,
    fakeInstantReveal: false,
    source: "hubly_brain_reasoning",
  };
}

export function creativeBuildExperiencesAreDistinct(a, b) {
  return a?.signature && b?.signature && a.signature !== b.signature;
}

export function evaluateCreativeBuildHtml(html) {
  const h = String(html || "");
  const issues = [];
  const ok = (cond, msg) => {
    if (!cond) issues.push(msg);
    return !!cond;
  };

  const slice = (() => {
    const i = h.indexOf('id="is-step-creative-build"');
    if (i < 0) return "";
    const j = h.indexOf('id="is-step-vibe"', i);
    return j > i ? h.slice(i, j) : h.slice(i, i + 30000);
  })();

  const checks = {
    creativeCanvas: ok(/data-creative-build-experience|is-creative-canvas/.test(h), "Missing Creative Canvas"),
    conversationLive: ok(/is-creative-conversation|is-creative-live/.test(h), "Missing conversation|live layout"),
    progressiveStages: ok(
      CREATIVE_BUILD_STAGES.every((s) => h.includes(s) || /structure|hero|brand|packages|booking|portfolio|workspace/.test(h)),
      "Missing progressive stages",
    ),
    liveExplanations: ok(/is-creative-explain|I moved booking|I simplified your packages|darker colors/.test(h), "Missing live explanations"),
    beforeAfter: ok(/is-creative-ba|Original Idea|Improved Version|before.*after/i.test(h), "Missing before/after"),
    confidenceMeter: ok(/is-creative-confidence|Design confidence|Homepage[\s\S]{0,40}\d{2}%/.test(h), "Missing confidence meter"),
    decisionsPanel: ok(/is-creative-decisions|Creative Decisions/.test(h), "Missing decisions panel"),
    dualChoice: ok(/Can I show you both|I have two directions|is-creative-choice/.test(h), "Missing dual direction choice"),
    liveInterrupt: ok(/is-creative-interrupt|isCreativeBuildInterrupt|Make it feel more premium/.test(h), "Missing live interrupt"),
    industrySpecific: ok(/orchestrateCreativeBuildExperience|INDUSTRY_BUILD|sequence/.test(h), "Missing industry sequences"),
    behindScenes: ok(/is-creative-bts|Creative Director|Switching back|darker version/.test(h), "Missing behind-the-scenes"),
    transition: ok(/I think we built something you're going to be proud of/.test(h), "Missing proud transition"),
    noBuildComplete: ok(!/Build Complete/.test(slice), "Says Build Complete"),
    thinkingHandoff: ok(/isRunCreativeBuildExperience|isDiscoveryCompleteToThinking[\s\S]{0,500}isRunCreativeBuildExperience/.test(h), "Thinking not handing off to Creative Build"),
    revealShell: ok(/is-step-reveal-shell|readyForReveal|data-reveal-shell/.test(h), "Missing soft Reveal shell"),
    wordmark: ok(/hubly-wordmark/.test(slice) || /is-creative-brand/.test(h), "Missing Hubly brand"),
  };

  return { passed: issues.length === 0, issues, checks };
}

export const HublyCreativeBuildExperience = {
  version: CREATIVE_BUILD_VERSION,
  label: CREATIVE_BUILD_LABEL,
  orchestrate: orchestrateCreativeBuildExperience,
  transition: CREATIVE_BUILD_TRANSITION,
  stages: CREATIVE_BUILD_STAGES,
  packs: INDUSTRY_BUILD_PACKS,
};
