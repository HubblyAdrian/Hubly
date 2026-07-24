/**
 * Milestone 2 · Epic 12 — Polish & Delight
 *
 * Craftsmanship layer: motion, microinteractions, empty states,
 * smart loading, success/delight, intelligent errors, a11y,
 * performance, personality, founder walkthrough.
 * Not feature work — every interaction should feel intentional.
 */
export const POLISH_VERSION = "1.0.0";
export const POLISH_LABEL = "Polish & Delight";

/** Unified animation language — every motion has a purpose. */
export const MOTION_SYSTEM = [
  { id: "rise", label: "Cards rise", purpose: "Cards rise naturally into place.", css: "is-motion-rise" },
  { id: "fade", label: "Conversations fade", purpose: "Conversations fade smoothly between turns.", css: "is-motion-fade" },
  { id: "grow", label: "Previews grow", purpose: "Website previews grow into place.", css: "is-motion-grow" },
  { id: "flow", label: "Builder stages flow", purpose: "Builder stages flow instead of snap.", css: "is-motion-flow" },
  { id: "modal", label: "Modals ease in", purpose: "Modals never abruptly appear.", css: "is-motion-modal" },
  { id: "notify", label: "Notifications slide", purpose: "Notifications gently slide in.", css: "is-motion-notify" },
  { id: "success", label: "Success reward", purpose: "Success states feel rewarding.", css: "is-motion-success" },
];

export const MICROINTERACTIONS = [
  { id: "hover-lift", label: "Recommendation lift", when: "Hover over a recommendation", effect: "It gently lifts." },
  { id: "accept-timeline", label: "Accept → timeline", when: "Accept a recommendation", effect: "It gracefully moves into the timeline." },
  { id: "task-celebrate", label: "Quiet celebrate", when: "Complete a task", effect: "Hubly quietly celebrates." },
  { id: "portfolio-grow", label: "Portfolio grows", when: "Upload photos", effect: "The portfolio visibly grows." },
];

export const EMPTY_STATE_LIBRARY = [
  {
    id: "bookings",
    surface: "No bookings",
    teach: "Let's get your first customer.",
    cta: "Share your booking page",
  },
  {
    id: "portfolio",
    surface: "No portfolio",
    teach: "Upload a few finished jobs and I'll organize everything.",
    cta: "Add finished jobs",
  },
  {
    id: "reviews",
    surface: "No reviews",
    teach: "I'll remind you after your next completed job.",
    cta: "Set a review reminder",
  },
  {
    id: "automations",
    surface: "No automations",
    teach: "Tell me an outcome — I'll draft a workflow you can preview.",
    cta: "Describe an outcome",
  },
  {
    id: "quotes",
    surface: "No open quotes",
    teach: "When a lead comes in, I'll help you follow up fast.",
    cta: "Open follow-ups",
  },
];

export const SMART_LOADING = [
  { id: "booking", line: "I'm comparing booking strategies..." },
  { id: "headline", line: "I found a stronger headline..." },
  { id: "portfolio", line: "Looking at your portfolio..." },
  { id: "research", line: "I'm researching businesses like yours..." },
  { id: "evolve", line: "I'm reviewing what changed overnight..." },
];

export const FORBIDDEN_LOADING = ["Loading...", "Please wait...", "Generating...", "Processing..."];

export const FORBIDDEN_SAAS = [
  "Dashboard",
  "Submit form",
  "Error code",
  "Something went wrong",
  "Please try again later",
  "Invalid input",
  "Unauthorized",
  "Syncing data",
  "API failed",
];

export const SUCCESS_MOMENTS = [
  { id: "first_booking", label: "First booking", line: "First customer booked — that's the start of something real." },
  { id: "first_review", label: "First review", line: "First five-star review. Customers are noticing." },
  { id: "hundredth", label: "100th customer", line: "100th booking. You're building a machine." },
  { id: "website_accepted", label: "Website improvement accepted", line: "That improvement is live — your site just got stronger." },
  { id: "automation_deployed", label: "Automation deployed", line: "Automation is running. One less thing to chase by hand." },
];

export const DELIGHT_MOMENTS = [
  { id: "anniversary", label: "Business anniversary", line: "Happy one-year business anniversary. Hubly noticed before you did." },
  { id: "thousand", label: "1,000 customers", line: "You've officially helped 1,000 customers." },
  { id: "best_month", label: "Highest revenue month", line: "This is your highest revenue month ever." },
];

export const INTELLIGENT_ERROR_SHAPE = ["what", "why", "hublyDoing", "ownerDo"];

export const A11Y_REQUIREMENTS = [
  { id: "keyboard", label: "Keyboard navigation" },
  { id: "screen-reader", label: "Screen readers" },
  { id: "contrast", label: "Color contrast" },
  { id: "reduced-motion", label: "Motion reduction" },
  { id: "focus", label: "Focus states" },
  { id: "font-scale", label: "Font scaling" },
];

export const PERFORMANCE_SURFACES = [
  { id: "home", label: "Business Home", target: "instant feel" },
  { id: "creative", label: "Creative Workspace", target: "instant feel" },
  { id: "chat", label: "Hubly Chat", target: "low AI latency feel" },
  { id: "preview", label: "Website Preview", target: "instant feel" },
  { id: "builder", label: "Builder previews", target: "flow not snap" },
  { id: "daily", label: "Daily Brief", target: "instant feel" },
];

export const CROSS_DEVICE = ["Desktop", "Tablet", "Phone"];

export const FOUNDER_WALKTHROUGH = [
  "Arrive at Hubly",
  "Describe a business",
  "Watch Hubly think",
  "Watch it build",
  "Experience the reveal",
  "Save the business",
  "Launch",
  "Enter Business Home",
  "Read Hubly Daily",
  "Edit the website",
  "Accept an evolution",
  "Return the next day",
];

function resolveKey(ctx = {}) {
  const raw = String(ctx.industryId || ctx.industryKey || ctx.industry || ctx.businessType || ctx.seed || "").toLowerCase();
  if (/pressure|power\s*wash|soft\s*wash/.test(raw)) return "pressure_washing";
  if (/photo|wedding/.test(raw)) return "photography";
  if (/hvac|heating|furnace|air\s*condition/.test(raw)) return "hvac";
  if (/lawn|landscap|mow/.test(raw)) return "lawn_care";
  if (/clean|maid|airbnb|turnover|short.?term/.test(raw)) return "cleaning";
  if (/\bspa\b|massage|facial|wellness/.test(raw)) return "spa";
  return "pressure_washing";
}

function firstNameOf(ctx = {}) {
  const owner = ctx.ownerName || ctx.firstName || (ctx.email ? String(ctx.email).split("@")[0] : null) || "there";
  return String(owner)
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
    .split(/\s+/)[0] || "there";
}

export function buildEmptyState(id, ctx = {}) {
  const entry = EMPTY_STATE_LIBRARY.find((e) => e.id === id) || EMPTY_STATE_LIBRARY[0];
  return {
    ...entry,
    teaches: true,
    noDeadEnd: true,
    voice: `${entry.surface}.\n\n${entry.teach}`,
    industryKey: resolveKey(ctx),
  };
}

export function smartLoadLine(id) {
  const hit = SMART_LOADING.find((s) => s.id === id) || SMART_LOADING[0];
  return hit.line;
}

export function isForbiddenLoading(text) {
  const t = String(text || "").trim();
  return FORBIDDEN_LOADING.some((f) => t === f || new RegExp(`^${f.replace(/\./g, "\\.")}$`, "i").test(t));
}

export function isForbiddenSaas(text) {
  const t = String(text || "");
  return FORBIDDEN_SAAS.some((f) => t.includes(f));
}

export function buildIntelligentError(opts = {}) {
  const what = opts.what || "I couldn't finish that change.";
  const why = opts.why || "A preview step failed before anything went live.";
  const hublyDoing = opts.hublyDoing || "I'm keeping your draft safe and rolling back the unfinished step.";
  const ownerDo = opts.ownerDo || "You don't need to do anything — say 'try again' when you're ready.";
  return {
    what,
    why,
    hublyDoing,
    ownerDo,
    shape: INTELLIGENT_ERROR_SHAPE,
    voice: `${what}\n\nWhy: ${why}\n\nWhat I'm doing: ${hublyDoing}\n\nWhat you can do: ${ownerDo}`,
    neverConfused: true,
  };
}

export function buildSuccessMoment(id, ctx = {}) {
  const hit = SUCCESS_MOMENTS.find((s) => s.id === id) || SUCCESS_MOMENTS[0];
  const name = firstNameOf(ctx);
  return {
    ...hit,
    restrained: true,
    line: name && name !== "there" ? `${hit.line.replace(/\.$/, "")}, ${name}.` : hit.line,
  };
}

export function buildDelightMoment(id, ctx = {}) {
  const hit = DELIGHT_MOMENTS.find((d) => d.id === id) || DELIGHT_MOMENTS[0];
  return {
    ...hit,
    surprise: true,
    noticedBeforeOwner: true,
    industryKey: resolveKey(ctx),
  };
}

export function personalityAudit(strings = []) {
  const hits = [];
  for (const s of strings) {
    for (const f of FORBIDDEN_SAAS) {
      if (String(s).includes(f)) hits.push({ string: s, reason: f });
    }
    if (isForbiddenLoading(s)) hits.push({ string: s, reason: "generic loading" });
  }
  return {
    reviewed: strings.length,
    violations: hits,
    passed: hits.length === 0,
    question: "Would Hubly say this?",
  };
}

export function a11yChecklist() {
  return A11Y_REQUIREMENTS.map((r) => ({ ...r, required: true }));
}

export function performancePass() {
  return PERFORMANCE_SURFACES.map((s) => ({
    ...s,
    measure: ["First contentful paint", "Time to interactive", "AI response latency"],
  }));
}

export function founderWalkthroughChecklist() {
  return FOUNDER_WALKTHROUGH.map((step, i) => ({
    step: i + 1,
    label: step,
    noJarring: true,
  }));
}

/** Full Polish & Delight orchestration for the Instant Site polish canvas. */
export function orchestratePolishDelight(ctx = {}) {
  const industryKey = resolveKey(ctx);
  const name = firstNameOf(ctx);
  const emptyStates = EMPTY_STATE_LIBRARY.map((e) => buildEmptyState(e.id, ctx));
  const smartLoading = SMART_LOADING.map((s) => ({ ...s }));
  const success = SUCCESS_MOMENTS.map((s) => buildSuccessMoment(s.id, ctx));
  const delight = DELIGHT_MOMENTS.map((d) => buildDelightMoment(d.id, ctx));
  const error = buildIntelligentError({
    what: "I couldn't publish that headline yet.",
    why: "The live preview needed one more check before customers see it.",
    hublyDoing: "I'm holding the draft and verifying the preview.",
    ownerDo: "Stay here — or say 'try again' and I'll resume.",
  });
  const motion = MOTION_SYSTEM.map((m) => ({ ...m }));
  const micros = MICROINTERACTIONS.map((m) => ({ ...m }));
  const a11y = a11yChecklist();
  const performance = performancePass();
  const walkthrough = founderWalkthroughChecklist();
  const personality = personalityAudit([
    "I'm comparing booking strategies...",
    "Let's get your first customer.",
    "Happy one-year business anniversary.",
    error.voice,
  ]);

  return {
    version: POLISH_VERSION,
    label: POLISH_LABEL,
    industryKey,
    ownerName: name,
    philosophy: "Every interaction should feel intentional.",
    motion,
    microinteractions: micros,
    emptyStates,
    smartLoading,
    forbiddenLoading: FORBIDDEN_LOADING.slice(),
    success,
    delight,
    error,
    a11y,
    performance,
    crossDevice: CROSS_DEVICE.slice(),
    conversationFirstEverywhere: true,
    personality,
    walkthrough,
    milestoneComplete: true,
    center: {
      label: "Polish & Delight",
      line: name !== "there"
        ? `${name}, this is where Hubly becomes a product people tell their friends about.`
        : "This is where Hubly becomes a product people tell their friends about.",
    },
    signature: [industryKey, POLISH_VERSION, motion.length, emptyStates.length].join("::"),
  };
}

export function polishExperiencesAreDistinct(a, b) {
  return a?.signature && b?.signature && a.signature !== b.signature;
}

export function evaluatePolishHtml(html) {
  const h = String(html || "");
  const issues = [];
  const ok = (cond, msg) => {
    if (!cond) issues.push(msg);
    return !!cond;
  };
  const slice = (() => {
    const i = h.indexOf('id="is-step-polish"');
    if (i < 0) return "";
    const k = h.indexOf('id="is-step-vibe"', i);
    return k > i ? h.slice(i, k) : h.slice(i, i + 80000);
  })();

  const checks = {
    polishCanvas: ok(/data-polish-delight|is-polish-delight|id="is-step-polish"/.test(h), "Missing Polish & Delight canvas"),
    motionSystem: ok(/MOTION_SYSTEM|is-motion-rise|is-polish-motion|Cards rise/.test(h), "Missing Motion System"),
    microinteractions: ok(/MICROINTERACTIONS|is-polish-micro|gently lifts|Quietly celebrates|portfolio visibly grows/i.test(h), "Missing Microinteractions"),
    emptyLibrary: ok(/EMPTY_STATE|is-polish-empty|Let's get your first customer|Upload a few finished jobs|I'll remind you after/i.test(h), "Missing Empty State Library"),
    smartLoading: ok(/SMART_LOADING|is-polish-smart|I'm comparing booking strategies|I found a stronger headline|Looking at your portfolio/i.test(h), "Missing Smart Loading"),
    noGenericLoad: ok(!/id="is-step-polish"[\s\S]{0,80000}\bLoading\.\.\./.test(h) && !/id="is-step-polish"[\s\S]{0,80000}Please wait\.\.\./.test(h), "Generic Loading in polish surface"),
    successMoments: ok(/SUCCESS_MOMENTS|is-polish-success|First booking|First review|100th customer|Automation deployed/i.test(h), "Missing Success Moments"),
    delightMoments: ok(/DELIGHT_MOMENTS|is-polish-delight-moments|one-year business anniversary|1,000 customers|highest revenue month/i.test(h), "Missing Delight Moments"),
    intelligentErrors: ok(/INTELLIGENT_ERROR|is-polish-error|What I'm doing|What you can do|buildIntelligentError/i.test(h), "Missing Intelligent Errors"),
    a11y: ok(/prefers-reduced-motion|is-polish-a11y|Keyboard navigation|Focus states|aria-|tabindex/i.test(h), "Missing Accessibility Pass"),
    performance: ok(/PERFORMANCE_SURFACES|is-polish-perf|Business Home|Creative Workspace|Daily Brief|Time to interactive/i.test(h), "Missing Performance Pass"),
    crossDevice: ok(/CROSS_DEVICE|is-polish-device|Desktop|Tablet|Phone|conversation-first/i.test(h), "Missing Cross-Device Consistency"),
    personality: ok(/personalityAudit|FORBIDDEN_SAAS|is-polish-voice|Would Hubly say this/i.test(h), "Missing Personality Audit"),
    walkthrough: ok(/FOUNDER_WALKTHROUGH|is-polish-walk|Arrive at Hubly|Accept an evolution|Return the next day/i.test(h), "Missing Founder Walkthrough"),
    reducedMotion: ok(/prefers-reduced-motion[\s\S]{0,400}is-motion|prefers-reduced-motion[\s\S]{0,400}animation:\s*none/i.test(h), "Missing reduced-motion for polish motions"),
    wordmark: ok(/hubly-wordmark/.test(slice) || /is-polish-brand/.test(h), "Missing Hubly brand"),
    entry: ok(/isEnterPolishDelight|isRunPolishDelight/.test(h), "Missing polish entry functions"),
  };
  return { passed: issues.length === 0, issues, checks };
}

export const HublyPolishDelight = {
  version: POLISH_VERSION,
  label: POLISH_LABEL,
  orchestrate: orchestratePolishDelight,
  empty: buildEmptyState,
  smartLoad: smartLoadLine,
  error: buildIntelligentError,
  success: buildSuccessMoment,
  delight: buildDelightMoment,
  personality: personalityAudit,
};
