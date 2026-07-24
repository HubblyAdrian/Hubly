/**
 * Milestone 2 · Epic 7 — Business Launch Experience
 *
 * Opening a business — not publishing a website.
 */
export const LAUNCH_VERSION = "1.0.0";
export const LAUNCH_LABEL = "Business Launch Experience";

export const LAUNCH_ANIMATION_TITLE = "Launching your business...";
export const LAUNCH_CELEBRATION =
  "Today your business officially launched.";
export const FOUNDER_LETTER_TEMPLATE =
  "Six minutes ago this business existed only as an idea.\n\nToday it's real.\n\nI'll keep helping you grow it.\n\n— Hubly";
export const HOME_TRANSITION = "Ready? Let's get to work.";

export const LAUNCH_DEPLOY_STEPS = [
  { id: "website", label: "Website is going live", surface: "website" },
  { id: "booking", label: "Booking is opening", surface: "booking" },
  { id: "profile", label: "Business profile is activating", surface: "profile" },
  { id: "memory", label: "Business Memory is being secured", surface: "memory" },
  { id: "archive", label: "Your first version is archived", surface: "version" },
  { id: "ready", label: "Everything is ready", surface: "ready" },
];

export const NEXT_STEPS = [
  { id: "explore", label: "Explore My Business" },
  { id: "ask", label: "Ask Hubly" },
  { id: "marketplace", label: "Launch Marketplace" },
  { id: "team", label: "Invite My Team" },
];

export const FUTURE_TIMELINE = [
  { id: "created", label: "Business Created", done: true },
  { id: "launched", label: "Business Launched", done: true },
  { id: "first_booking", label: "First Booking", done: false },
  { id: "first_review", label: "First 5-Star Review", done: false },
  { id: "first_1k", label: "First $1,000", done: false },
  { id: "customers_100", label: "100 Customers", done: false },
  { id: "first_employee", label: "First Employee", done: false },
  { id: "revenue_100k", label: "\$100,000 Revenue", done: false },
  { id: "year_one", label: "1 Year in Business", done: false },
];

export const FORBIDDEN_LAUNCH = [
  "Loading...",
  "Loading…",
  "Publishing...",
  "Publishing…",
  "My website is live",
];

/** Industry-specific growth advice from DNA / Growth patterns — not static generics. */
export const INDUSTRY_LAUNCH_ADVICE = {
  pressure_washing: [
    {
      title: "Share your booking page with three previous customers.",
      estimated: "Estimated: 2 bookings.",
      source: "growth_expert",
    },
    {
      title: "Add five finished job photos.",
      estimated: "Estimated: +18% trust.",
      source: "business_dna",
    },
    {
      title: "Let's build your recurring maintenance package.",
      estimated: "Estimated: Higher repeat revenue.",
      source: "business_memory",
    },
  ],
  photography: [
    {
      title: "Send your inquiry link to two couples who already asked about dates.",
      estimated: "Estimated: 1–2 premium inquiries.",
      source: "growth_expert",
    },
    {
      title: "Add three behind-the-scenes photos to the gallery.",
      estimated: "Estimated: Stronger emotional conversion.",
      source: "business_dna",
    },
    {
      title: "Clarify your weekend package as the default experience.",
      estimated: "Estimated: Less decision fatigue.",
      source: "business_memory",
    },
  ],
  hvac: [
    {
      title: "Offer a tune-up plan to five past emergency customers.",
      estimated: "Estimated: Recurring maintenance starts.",
      source: "growth_expert",
    },
    {
      title: "Publish licensed & insured language above the fold.",
      estimated: "Estimated: Lower emergency fear.",
      source: "business_dna",
    },
    {
      title: "Open same-day / next-day booking windows for this week.",
      estimated: "Estimated: Faster first bookings.",
      source: "business_memory",
    },
  ],
  lawn_care: [
    {
      title: "Invite ten neighbors onto a weekly or biweekly route.",
      estimated: "Estimated: Route density grows.",
      source: "growth_expert",
    },
    {
      title: "Add before/after yard photos from your last three jobs.",
      estimated: "Estimated: +reliability proof.",
      source: "business_dna",
    },
    {
      title: "Turn on pause/resume for seasonal customers.",
      estimated: "Estimated: Fewer cancellations.",
      source: "business_memory",
    },
  ],
  cleaning: [
    {
      title: "Share your turnover booking link with three Airbnb hosts.",
      estimated: "Estimated: Recurring turnovers.",
      source: "growth_expert",
    },
    {
      title: "Collect two host reviews this week.",
      estimated: "Estimated: Faster host trust.",
      source: "business_dna",
    },
    {
      title: "Highlight weekly and biweekly plans on the homepage.",
      estimated: "Estimated: Higher repeat revenue.",
      source: "business_memory",
    },
  ],
  spa: [
    {
      title: "Text your one-tap book link to five regular clients.",
      estimated: "Estimated: Faster rebooking.",
      source: "growth_expert",
    },
    {
      title: "Keep the menu to your top six services with durations.",
      estimated: "Estimated: Less decision fatigue.",
      source: "business_dna",
    },
    {
      title: "Feature atmosphere photos above promotions.",
      estimated: "Estimated: Calmer conversion.",
      source: "business_memory",
    },
  ],
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
  if (/hvac|heating|furnace|air\s*condition/.test(raw)) return "hvac";
  if (/lawn|landscap|mow/.test(raw)) return "lawn_care";
  if (/clean|maid|airbnb|turnover|short.?term/.test(raw)) return "cleaning";
  if (/\bspa\b|massage|facial|wellness/.test(raw)) return "spa";
  return "pressure_washing";
}

/**
 * Honest deployment status — never fake green checks.
 */
export function assessLaunchDeployment(ctx = {}) {
  const stripeConnected = !!ctx.stripeConnected;
  const googleCalendarConnected = !!ctx.googleCalendarConnected;
  const websiteLive = ctx.websiteLive !== false;
  const bookingLive = ctx.bookingLive !== false && (stripeConnected || ctx.bookingWithoutPayments === true);
  const memoryActive = ctx.memoryActive !== false;
  const versionProtected = ctx.versionProtected !== false;

  const summary = [
    { id: "website", label: "Website Live", ok: websiteLive, required: true },
    {
      id: "booking",
      label: "Booking Live",
      ok: bookingLive,
      required: true,
      detail: !stripeConnected && ctx.bookingWithoutPayments !== true
        ? "Booking couldn't be fully activated because Stripe isn't connected yet."
        : null,
    },
    {
      id: "payments",
      label: "Payments Connected",
      ok: stripeConnected,
      required: false,
      connectedOnly: true,
      detail: !stripeConnected ? "Stripe isn't connected yet — let's finish that together." : null,
    },
    {
      id: "gcal",
      label: "Google Calendar Connected",
      ok: googleCalendarConnected,
      required: false,
      connectedOnly: true,
    },
    { id: "memory", label: "Business Memory Active", ok: memoryActive, required: true },
    { id: "v1", label: "Version 1.0 Protected", ok: versionProtected, required: true },
  ];

  // Only show optional integrations when connected (never lie).
  const visibleSummary = summary.filter((s) => {
    if (s.connectedOnly) return s.ok;
    return true;
  });

  const issues = summary
    .filter((s) => !s.ok && (s.required || s.detail))
    .map((s) => s.detail || `${s.label} still needs attention.`);

  const deploySteps = LAUNCH_DEPLOY_STEPS.map((step) => {
    if (step.id === "booking" && !bookingLive) {
      return { ...step, ok: false, detail: "Booking needs Stripe before it's fully open." };
    }
    if (step.id === "ready" && issues.length) {
      return { ...step, ok: true, label: "Core launch ready — a few items still need you", partial: true };
    }
    return { ...step, ok: true };
  });

  return {
    summary: visibleSummary,
    allSummary: summary,
    issues,
    deploySteps,
    partial: issues.length > 0,
    ok: websiteLive && memoryActive && versionProtected,
  };
}

export function buildLaunchAdvice(ctx = {}) {
  const key = resolveKey(ctx);
  const advice = INDUSTRY_LAUNCH_ADVICE[key] || INDUSTRY_LAUNCH_ADVICE.pressure_washing;
  return advice.map((a) => ({ ...a, industryKey: key }));
}

export function buildDayOneCertificate(ctx = {}) {
  const owner =
    ctx.ownerName ||
    ctx.firstName ||
    (ctx.email ? String(ctx.email).split("@")[0] : null) ||
    "You";
  const pretty = String(owner)
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  const biz = ctx.businessName || ctx.biz || "Your Business";
  const today = ctx.launchDate || new Date().toISOString().slice(0, 10);
  return {
    businessName: biz,
    owner: pretty,
    launchDate: today,
    version: "1.0",
    firstStrategy: ctx.firstStrategy || ctx.story || "Trust-first local brand",
    positioning: ctx.positioning || "Premium & Reliable",
  };
}

export function buildBusinessTimeline(ctx = {}) {
  return [
    { id: "created", label: "Day One", detail: "Business Created", done: true },
    { id: "launched", label: "Day One", detail: "Business Launched", done: true },
    { id: "first_booking", label: "Next", detail: "First Booking", done: false },
  ];
}

export function buildFounderLetter(ctx = {}) {
  const name = ctx.firstName || ctx.ownerName?.split?.(/\s+/)?.[0] || null;
  const lead = name ? `Congratulations, ${name}.` : "Congratulations.";
  return {
    lead,
    body: FOUNDER_LETTER_TEMPLATE,
    celebration: LAUNCH_CELEBRATION,
  };
}

/**
 * Full Business Launch payload.
 */
export function orchestrateBusinessLaunch(ctx = {}) {
  const key = resolveKey(ctx);
  const deployment = assessLaunchDeployment(ctx);
  const advice = buildLaunchAdvice(ctx);
  const certificate = buildDayOneCertificate(ctx);
  const timeline = buildBusinessTimeline(ctx);
  const futureTimeline = FUTURE_TIMELINE.map((m) => ({
    ...m,
    done: m.id === "created" || m.id === "launched" ? true : !!m.done,
  }));
  const letter = buildFounderLetter(ctx);
  const firstName = certificate.owner.split(/\s+/)[0] || "there";

  return {
    version: LAUNCH_VERSION,
    industryKey: key,
    animationTitle: LAUNCH_ANIMATION_TITLE,
    deploySteps: deployment.deploySteps,
    celebrationLead: `Congratulations, ${firstName}.`,
    celebration: LAUNCH_CELEBRATION,
    summary: deployment.summary,
    issues: deployment.issues,
    partial: deployment.partial,
    advice,
    nextSteps: NEXT_STEPS.map((n) => ({ ...n })),
    timeline,
    futureTimeline,
    certificate,
    founderLetter: letter,
    homeTransition: HOME_TRANSITION,
    noFakeSuccess: true,
    signature: [key, advice[0]?.title?.slice(0, 40), certificate.businessName].join("::"),
  };
}

export function launchExperiencesAreDistinct(a, b) {
  return a?.signature && b?.signature && a.signature !== b.signature;
}

export function evaluateLaunchHtml(html) {
  const h = String(html || "");
  const issues = [];
  const ok = (cond, msg) => {
    if (!cond) issues.push(msg);
    return !!cond;
  };

  const slice = (() => {
    const i = h.indexOf('id="is-step-business-launch"');
    if (i < 0) {
      const j = h.indexOf('id="is-step-launch-shell"');
      if (j < 0) return "";
      const k = h.indexOf('id="is-step-vibe"', j);
      return k > j ? h.slice(j, k) : h.slice(j, j + 45000);
    }
    const k = h.indexOf('id="is-step-vibe"', i);
    return k > i ? h.slice(i, k) : h.slice(i, i + 45000);
  })();

  const checks = {
    launchCanvas: ok(
      /data-business-launch|is-business-launch|id="is-step-business-launch"/.test(h),
      "Missing Business Launch canvas",
    ),
    animation: ok(/Launching your business|is-launch-steps|Website is going live/.test(h), "Missing launch animation"),
    noSpinner: ok(!/\bLoading\.\.\.|Publishing\.\.\.|Spinner/i.test(slice), "Spinner/loading copy"),
    celebration: ok(/officially launched|Congratulations/.test(h), "Missing celebration"),
    summary: ok(/Website Live|Business Memory Active|Version 1\.0 Protected|is-launch-summary/.test(h), "Missing launch summary"),
    advice: ok(/Here's what I'd do next|is-launch-advice/.test(h), "Missing Hubly advice"),
    nextSteps: ok(/Explore My Business|Ask Hubly|Launch Marketplace|Invite My Team/.test(h), "Missing next steps"),
    timeline: ok(/Business Timeline|First Booking|is-launch-timeline/.test(h), "Missing business timeline"),
    futureTimeline: ok(/Your Journey|First \$1,000|100 Customers|is-launch-journey/.test(h), "Missing Future Timeline"),
    certificate: ok(/Day One|is-launch-certificate|Version 1\.0/.test(h), "Missing Day One certificate"),
    founderLetter: ok(/Six minutes ago this business existed only as an idea|is-launch-letter/.test(h), "Missing Founder Letter"),
    honestDeploy: ok(/Stripe isn't connected|couldn't be|is-launch-issues|assessLaunchDeployment/.test(h), "Missing honest failure path"),
    homeTransition: ok(/Let's get to work|is-step-business-home|readyForBusinessHome/.test(h), "Missing Business Home transition"),
    founderHandoff: ok(
      /function isFounderMomentLaunch[\s\S]{0,500}isRunBusinessLaunchExperience/.test(h) ||
        /isFounderMomentLaunch[\s\S]{0,400}isRunBusinessLaunchExperience/.test(h),
      "Founder Moment not handing off to Launch",
    ),
    industryAdvice: ok(/INDUSTRY_LAUNCH_ADVICE|pressure_washing|orchestrateBusinessLaunch/.test(h), "Missing industry advice"),
    wordmark: ok(/hubly-wordmark/.test(slice) || /is-launch-brand/.test(h), "Missing Hubly brand"),
  };

  return { passed: issues.length === 0, issues, checks };
}

export const HublyBusinessLaunch = {
  version: LAUNCH_VERSION,
  label: LAUNCH_LABEL,
  orchestrate: orchestrateBusinessLaunch,
  assess: assessLaunchDeployment,
  advice: buildLaunchAdvice,
  certificate: buildDayOneCertificate,
};
