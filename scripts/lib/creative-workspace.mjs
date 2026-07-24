/**
 * Milestone 2 · Epic 9 — Creative Workspace
 *
 * Conversation-first creation — not a website editor.
 * Intent in → Hubly implements → live business updates.
 */
export const WORKSPACE_VERSION = "1.0.0";
export const WORKSPACE_LABEL = "Creative Workspace";

export const FORBIDDEN_EDITOR = [
  "Where is that setting",
  "Open the inspector",
  "Property panel",
];

export const CONVERSATION_STARTERS = [
  "Make my website feel more luxurious.",
  "Add memberships.",
  "Move booking higher.",
  "I don't like these colors.",
  "Rewrite my About page.",
  "Make it look like Apple.",
];

export const CREATIVE_DIRECTIONS = [
  { id: "luxury", label: "Luxury", feel: "Quiet confidence, deep contrast, sparse type." },
  { id: "friendly", label: "Friendly", feel: "Warm, approachable, neighborhood trust." },
  { id: "modern", label: "Modern", feel: "Clean geometry, crisp hierarchy." },
  { id: "minimal", label: "Minimal", feel: "Breathing room, fewer words, stronger photos." },
  { id: "bold", label: "Bold", feel: "High energy, strong CTAs, punchy headlines." },
  { id: "premium", label: "Premium", feel: "Refined materials, elevated service cues." },
  { id: "warm", label: "Warm", feel: "Soft light, human tone, inviting color." },
  { id: "playful", label: "Playful", feel: "Light motion cues, friendly voice." },
];

export const WEBSITE_HEALTH_DIMS = [
  { id: "trust", label: "Trust" },
  { id: "conversion", label: "Conversion" },
  { id: "seo", label: "SEO" },
  { id: "accessibility", label: "Accessibility" },
  { id: "photography", label: "Photography" },
];

export const VERSION_SURFACES = [
  "Homepage",
  "Booking",
  "Brand",
  "Portfolio",
  "Packages",
  "Workspace",
];

export const ADVANCED_CONTROLS = [
  "Colors",
  "Typography",
  "Spacing",
  "Padding",
  "Buttons",
  "Layout",
  "Packages",
  "Booking",
];

export const SECTION_ASKS = [
  "Why is this section here?",
  "Can we improve this?",
  "Is this converting well?",
  "Make this shorter.",
  "Add more trust.",
];

export const BUILDER_PIPELINE = [
  { id: "director", agent: "Creative Director", action: "Updated Hero" },
  { id: "builder", agent: "Website Builder", action: "Applied" },
  { id: "critic", agent: "Critic", action: "Approved" },
  { id: "deploy", agent: "Deployment", action: "Ready" },
];

/** Creative Playgrounds — four concepts side by side. */
export const PLAYGROUND_CONCEPTS = [
  {
    id: "modern_premium",
    label: "Modern Premium",
    palette: ["#141B2B", "#D9632D", "#F7F4EF"],
    typography: "Plus Jakarta Sans / tight tracking",
    booking: "One-tap book above the fold",
    personality: "Confident local specialist",
    why: "Balances trust with a polished first impression.",
  },
  {
    id: "local_friendly",
    label: "Local & Friendly",
    palette: ["#1F3A2E", "#E8A87C", "#FFF8F0"],
    typography: "Rounded sans / open leading",
    booking: "Neighborhood booking CTA mid-page",
    personality: "Neighbor you already trust",
    why: "Fits owners who win on relationships and referrals.",
  },
  {
    id: "luxury_service",
    label: "Luxury Service",
    palette: ["#0B0F14", "#C9A86A", "#EDE8E1"],
    typography: "Editorial display + quiet body",
    booking: "Inquiry-first with calm availability",
    personality: "Quiet, elevated craft",
    why: "For premium positioning without looking corporate.",
  },
  {
    id: "bold_energy",
    label: "Bold & High Energy",
    palette: ["#111827", "#D9632D", "#FDE68A"],
    typography: "Heavy headlines / short lines",
    booking: "Urgent book CTA + same-day windows",
    personality: "Fast, decisive, high demand",
    why: "When speed and visibility are the growth lever.",
  },
];

export const PLAYGROUND_INTRO =
  "I spent a few minutes exploring different directions for your business.";

function resolveKey(ctx = {}) {
  const raw = String(
    ctx.industryId ||
      ctx.industryKey ||
      ctx.industry ||
      ctx.businessType ||
      ctx.seed ||
      "",
  ).toLowerCase();
  if (/pressure|power\s*wash|soft\s*wash/.test(raw)) return "pressure_washing";
  if (/photo|wedding/.test(raw)) return "photography";
  if (/hvac|heating|furnace|air\s*condition/.test(raw)) return "hvac";
  if (/lawn|landscap|mow/.test(raw)) return "lawn_care";
  if (/clean|maid|airbnb|turnover|short.?term/.test(raw)) return "cleaning";
  if (/\bspa\b|massage|facial|wellness/.test(raw)) return "spa";
  return "pressure_washing";
}

function clampScore(n, fallback = 90) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function buildWebsiteHealth(ctx = {}) {
  const scores = {
    trust: clampScore(ctx.trustScore, 95),
    conversion: clampScore(ctx.conversionScore, 91),
    seo: clampScore(ctx.seoScore, 89),
    accessibility: clampScore(ctx.a11yScore, 97),
    photography: clampScore(ctx.photoScore, 82),
  };
  if (ctx.hasPortfolio === false) scores.photography = Math.min(scores.photography, 70);
  const values = Object.values(scores);
  const overall = clampScore(values.reduce((a, b) => a + b, 0) / values.length);
  return {
    overall,
    label: "Website Health",
    dimensions: WEBSITE_HEALTH_DIMS.map((d) => ({
      ...d,
      score: scores[d.id],
      why: `${d.label} affects how visitors decide to trust and book.`,
      nextStep: `Improve ${d.label.toLowerCase()} with one focused creative change.`,
      ask: `Why is ${d.label} at ${scores[d.id]}?`,
    })),
  };
}

export function buildAiSuggestions(ctx = {}) {
  const key = resolveKey(ctx);
  const base = [
    {
      id: "hero",
      text: "I think this hero image is hurting trust.",
      why: "Generic stock reads as temporary, not established.",
      nextStep: "Swap in a finished job photo from your work.",
    },
    {
      id: "booking",
      text: "Your booking flow has one unnecessary step.",
      why: "Extra friction drops same-session conversions.",
      nextStep: "Collapse contact details into the first book screen.",
    },
    {
      id: "headline",
      text: "I found a stronger headline.",
      why: "Outcome-first headlines outperform feature lists.",
      nextStep: "Lead with the result customers buy.",
    },
    {
      id: "gallery",
      text: "Your gallery needs more before-and-after photos.",
      why: "Proof converts better than atmosphere alone.",
      nextStep: "Add three before/after pairs above the fold.",
    },
  ];
  if (key === "photography") {
    base[0] = {
      id: "hero",
      text: "I think the hero should feature a real couple, not gear.",
      why: "Emotion converts wedding inquiries.",
      nextStep: "Pin an atmosphere shot above packages.",
    };
  } else if (key === "hvac") {
    base[3] = {
      id: "gallery",
      text: "Add licensed & insured proof near the hero.",
      why: "Emergency fear drops with visible credentials.",
      nextStep: "Place proof chips under the headline.",
    };
  }
  return base;
}

export function buildVersionTimeline(ctx = {}) {
  const versions =
    Array.isArray(ctx.versions) && ctx.versions.length
      ? ctx.versions
      : [
          { id: 1, label: "Version 1", surface: "Homepage", note: "Day One launch", active: false },
          { id: 2, label: "Version 2", surface: "Brand", note: "Direction: Premium", active: false },
          { id: 3, label: "Version 3", surface: "Booking", note: "Booking moved higher", active: false },
          { id: 4, label: "Version 4", surface: "Portfolio", note: "Gallery trust lift", active: false },
          { id: 5, label: "Version 5", surface: "Packages", note: "Memberships draft", active: false },
          { id: 6, label: "Version 6", surface: "Homepage", note: "Warmer palette", active: false },
          { id: 7, label: "Version 7", surface: "Workspace", note: "Creative memory applied", active: false },
          { id: 8, label: "Version 8", surface: "Homepage", note: "Current live", active: true },
        ];
  return versions.map((v) => ({
    ...v,
    reversible: true,
    surfaces: VERSION_SURFACES.slice(),
  }));
}

export function buildCreativeMemory(ctx = {}) {
  const prefs = Array.isArray(ctx.creativePreferences)
    ? ctx.creativePreferences.slice()
    : [];
  if (ctx.preferDarkerColors || /dark/i.test(String(ctx.lastPreference || ""))) {
    if (!prefs.some((p) => /dark/i.test(p))) prefs.push("Prefers darker colors");
  }
  if (!prefs.length) {
    prefs.push("No strong preferences stored yet — I'll learn as we create.");
  }
  return {
    preferences: prefs,
    remembers: true,
    line: prefs[0]?.includes("darker")
      ? "I remember you like darker colors — I'll keep that in mind."
      : "I'll remember what you like so you never repeat yourself.",
  };
}

export function buildCompareAlternative(currentDirection, requested) {
  const cur =
    CREATIVE_DIRECTIONS.find((d) => d.id === currentDirection) || CREATIVE_DIRECTIONS[5];
  const alt =
    CREATIVE_DIRECTIONS.find((d) => d.id === requested) ||
    CREATIVE_DIRECTIONS.find((d) => d.id !== cur.id) ||
    CREATIVE_DIRECTIONS[0];
  return {
    current: { id: cur.id, label: cur.label, feel: cur.feel },
    alternative: { id: alt.id, label: alt.label, feel: alt.feel },
    reasoning: `${alt.label} shifts the business toward ${alt.feel.toLowerCase()} without rebuilding from scratch.`,
    recommendation: `Try ${alt.label} if you want ${alt.feel.split(",")[0].toLowerCase()}; keep ${cur.label} if the current voice already converts.`,
  };
}

export function buildPlaygrounds(ctx = {}) {
  const key = resolveKey(ctx);
  const biz = ctx.businessName || ctx.biz || "Your Business";
  return {
    intro: PLAYGROUND_INTRO,
    cta: "Explore Ideas",
    concepts: PLAYGROUND_CONCEPTS.map((c) => ({
      ...c,
      homepagePreview: `${c.label} homepage for ${biz}`,
      industryFit: key,
      why: c.why,
    })),
    mixPrompt: "Mix the typography from Concept A with the layout from Concept C.",
  };
}

export function interpretCreativeIntent(message, ctx = {}) {
  const m = String(message || "").toLowerCase();
  const memory = buildCreativeMemory(ctx);
  let direction = ctx.currentDirection || "premium";
  let liveChange = "Listening — tell me what to change.";
  let reasoning = "Waiting for clear creative intent.";

  if (/why did you|why change|reasoning/.test(m)) {
    liveChange = "No visual change — explaining the last decision.";
    reasoning = ctx.lastReasoning || "Stored reasoning from the last creative decision.";
  } else if (/interrupt|actually|make it warmer|warmer/.test(m)) {
    direction = "warm";
    liveChange = "Adapting mid-stream — shifting toward warmer without losing prior context.";
    reasoning = "Interruptions keep prior decisions; only the active direction pivots.";
  } else if (/luxur|apple|premium|elegant/.test(m)) {
    direction = /apple|luxur/.test(m) ? "luxury" : "premium";
    liveChange = "Elevating contrast, tightening type, refining the hero.";
    reasoning = "Luxury/premium cues request quieter confidence and stronger materials.";
  } else if (/\bwarm\b|friend|neighbor/.test(m)) {
    direction = "warm";
    liveChange = "Softening palette and humanizing the voice.";
    reasoning = "Warmth requests approachability without losing professionalism.";
  } else if (/minimal|simple|clean|less/.test(m)) {
    direction = "minimal";
    liveChange = "Removing clutter and giving photos more room.";
    reasoning = "Minimal intent reduces noise so proof can convert.";
  } else if (/bold|energy|loud/.test(m)) {
    direction = "bold";
    liveChange = "Punching up the headline and CTA weight.";
    reasoning = "Bold intent increases visibility and urgency.";
  } else if (/membership|package/.test(m)) {
    liveChange = "Adding a memberships block near booking.";
    reasoning = "Memberships create recurring revenue surfaces.";
  } else if (/booking|book higher|move booking/.test(m)) {
    liveChange = "Moving booking higher on the homepage.";
    reasoning = "Earlier booking reduces scroll friction.";
  } else if (/color|don't like|dont like/.test(m)) {
    direction = memory.preferences.some((p) => /dark/i.test(p)) ? "luxury" : "modern";
    liveChange = "Exploring a new palette while keeping your brand orange accent.";
    reasoning = "Color dislike triggers a directed palette rewrite, not a random theme swap.";
  } else if (/about|rewrite/.test(m)) {
    liveChange = "Rewriting the About page in your voice.";
    reasoning = "About copy should sound like the owner, not a template.";
  }

  return {
    message: String(message || ""),
    direction,
    liveChange,
    reasoning,
    memoryNote: memory.line,
    pipeline: BUILDER_PIPELINE.map((p) => ({ ...p })),
  };
}

/**
 * Full Creative Workspace payload.
 */
export function orchestrateCreativeWorkspace(ctx = {}) {
  const industryKey = resolveKey(ctx);
  const direction =
    CREATIVE_DIRECTIONS.find((d) => d.id === (ctx.currentDirection || "premium")) ||
    CREATIVE_DIRECTIONS[5];
  const health = buildWebsiteHealth(ctx);
  const memory = buildCreativeMemory(ctx);
  const versions = buildVersionTimeline(ctx);
  const suggestions = buildAiSuggestions(ctx);
  const playgrounds = buildPlaygrounds(ctx);
  const compare = buildCompareAlternative(direction.id, ctx.compareTo || "minimal");
  const biz = ctx.businessName || ctx.biz || "Your Business";

  return {
    version: WORKSPACE_VERSION,
    label: WORKSPACE_LABEL,
    notAnEditor: true,
    conversationFirst: true,
    liveEditing: true,
    mobileConversationFirst: true,
    industryKey,
    businessName: biz,
    direction,
    directions: CREATIVE_DIRECTIONS.map((d) => ({ ...d })),
    starters: CONVERSATION_STARTERS.slice(),
    sectionAsks: SECTION_ASKS.slice(),
    health,
    memory,
    versions,
    suggestions,
    playgrounds,
    compare,
    advancedStudio: {
      available: true,
      controls: ADVANCED_CONTROLS.slice(),
      note: "Traditional controls live only here — conversation stays the default.",
    },
    builderTransparency: BUILDER_PIPELINE.map((p) => ({ ...p })),
    livePreview: {
      title: "Live Business",
      headline: biz,
      directionLabel: direction.label,
      updating: false,
      noRefresh: true,
      noPublish: true,
      noReload: true,
    },
    signature: [industryKey, direction.id, memory.preferences[0]?.slice(0, 24) || "none"].join("::"),
  };
}

export function workspaceExperiencesAreDistinct(a, b) {
  return a?.signature && b?.signature && a.signature !== b.signature;
}

export function evaluateWorkspaceHtml(html) {
  const h = String(html || "");
  const issues = [];
  const ok = (cond, msg) => {
    if (!cond) issues.push(msg);
    return !!cond;
  };

  const slice = (() => {
    const i = h.indexOf('id="is-step-creative-workspace"');
    if (i < 0) return "";
    const k = h.indexOf('id="is-step-vibe"', i);
    return k > i ? h.slice(i, k) : h.slice(i, i + 70000);
  })();

  const checks = {
    workspaceCanvas: ok(
      /data-creative-workspace|is-creative-workspace|id="is-step-creative-workspace"/.test(h),
      "Missing Creative Workspace canvas",
    ),
    conversationFirst: ok(
      /Conversation|is-cw-chat|Make my website feel more luxurious|conversationFirst/.test(h),
      "Missing conversation-first surface",
    ),
    livePreview: ok(/Live Business|is-cw-preview|liveEditing/.test(h), "Missing live preview"),
    sectionAsk: ok(
      /Ask Hubly|is-cw-section-ask|Why is this section here/.test(h),
      "Missing section Ask Hubly",
    ),
    directions: ok(
      /Creative Directions|Luxury|Friendly|Minimal|Premium|CREATIVE_DIRECTIONS/.test(h),
      "Missing Creative Directions",
    ),
    compareMode: ok(
      /Compare Mode|is-cw-compare|Show me another version|buildCompareAlternative/.test(h),
      "Missing Compare Mode",
    ),
    websiteHealth: ok(/Website Health|is-cw-health/.test(h), "Missing Website Health"),
    creativeMemory: ok(
      /Creative Memory|is-cw-memory|darker colors|buildCreativeMemory/.test(h),
      "Missing Creative Memory",
    ),
    versionTimeline: ok(
      /Version Timeline|is-cw-versions|Version 1|Version 8/.test(h),
      "Missing Version Timeline",
    ),
    advancedStudio: ok(
      /Advanced Studio|is-cw-advanced|Colors|Typography/.test(h),
      "Missing Advanced Studio",
    ),
    aiSuggestions: ok(
      /AI Suggestions|is-cw-suggest|hero image is hurting trust|buildAiSuggestions/.test(h),
      "Missing AI Suggestions",
    ),
    builderTransparency: ok(
      /Builder Activity|Creative Director|Website Builder|Critic|Deployment|is-cw-builder/.test(h),
      "Missing Builder Transparency",
    ),
    playgrounds: ok(
      /Explore Ideas|Creative Playgrounds|is-cw-playground|PLAYGROUND|Modern Premium/.test(h),
      "Missing Creative Playgrounds",
    ),
    mobileFirst: ok(
      /mobileConversationFirst|is-cw-mobile|conversation-first/.test(h),
      "Missing mobile conversation-first",
    ),
    homeHandoff: ok(
      /isHomeWebsiteAction[\s\S]{0,500}isRunCreativeWorkspace|Edit with Hubly[\s\S]{0,800}isRunCreativeWorkspace|function isEnterCreativeWorkspace/.test(
        h,
      ),
      "Business Home not handing off to Creative Workspace",
    ),
    wordmark: ok(/hubly-wordmark/.test(slice) || /is-cw-brand/.test(h), "Missing Hubly brand"),
  };

  return { passed: issues.length === 0, issues, checks };
}

export const HublyCreativeWorkspace = {
  version: WORKSPACE_VERSION,
  label: WORKSPACE_LABEL,
  orchestrate: orchestrateCreativeWorkspace,
  interpret: interpretCreativeIntent,
  playgrounds: buildPlaygrounds,
};
