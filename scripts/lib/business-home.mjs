/**
 * Milestone 2 · Epic 8 — Business Home
 *
 * Personalized business briefing — not a dashboard.
 * 30-Second Rule: within 30s know today, attention, focus, health, Ask Hubly.
 */
export const HOME_VERSION = "1.0.0";
export const HOME_LABEL = "Business Home";

export const FORBIDDEN_HOME = [
  "Dashboard",
  "Overview",
  "Analytics",
  "Where do I click",
];

export const MORNING_REVIEW_LINE =
  "Last night I reviewed your business.";
export const MORNING_FOCUS_LINE = "Here's what I'd focus on today.";

export const HEALTH_DIMENSIONS = [
  { id: "trust", label: "Trust" },
  { id: "bookings", label: "Bookings" },
  { id: "growth", label: "Growth" },
  { id: "operations", label: "Operations" },
  { id: "brand", label: "Brand" },
];

export const WEBSITE_ACTIONS = [
  { id: "view", label: "View Site" },
  { id: "edit", label: "Edit with Hubly" },
  { id: "preview", label: "Preview Changes" },
  { id: "recent", label: "Recent Improvements" },
];

export const SNAPSHOT_METRICS = [
  { id: "revenue", label: "Revenue" },
  { id: "bookings", label: "Bookings" },
  { id: "reviews", label: "Reviews" },
  { id: "response", label: "Response Time" },
  { id: "repeat", label: "Repeat Customers" },
  { id: "conversion", label: "Website Conversion" },
];

export const CARD_ASK_PROMPTS = [
  "Why should I care?",
  "Explain this.",
  "Improve this.",
  "What would you do?",
  "Build this.",
];

/** Industry-specific "Today's Business" panels. */
export const INDUSTRY_TODAY = {
  pressure_washing: {
    title: "Today's Business",
    panels: [
      { id: "jobs", label: "Today's Jobs", why: "Know which driveways and homes are on the route." },
      { id: "route", label: "Route", why: "Cut drive time between jobs." },
      { id: "weather", label: "Weather", why: "Wash quality depends on dry windows." },
      { id: "travel", label: "Travel", why: "Protect margins on long hops." },
    ],
  },
  photography: {
    title: "Today's Business",
    panels: [
      { id: "shoots", label: "Today's Shoots", why: "See who's in front of the camera today." },
      { id: "albums", label: "Albums", why: "Deliver finished galleries on time." },
      { id: "editing", label: "Editing Queue", why: "Clear the backlog before new shoots pile up." },
      { id: "portfolio", label: "Portfolio", why: "Keep the site converting inquiries." },
    ],
  },
  hvac: {
    title: "Today's Business",
    panels: [
      { id: "calls", label: "Service Calls", why: "Prioritize emergencies vs tune-ups." },
      { id: "parts", label: "Parts & Van", why: "Avoid a second trip mid-job." },
      { id: "sla", label: "Response Windows", why: "Same-day promises need coverage." },
      { id: "maintenance", label: "Maintenance Plans", why: "Grow recurring revenue." },
    ],
  },
  lawn_care: {
    title: "Today's Business",
    panels: [
      { id: "route", label: "Today's Route", why: "Density beats scattered one-offs." },
      { id: "weather", label: "Weather", why: "Mowing windows shift with rain." },
      { id: "pause", label: "Pause / Resume", why: "Seasonal customers churn without it." },
      { id: "crew", label: "Crew Load", why: "Balance yards across the team." },
    ],
  },
  cleaning: {
    title: "Today's Business",
    panels: [
      { id: "homes", label: "Recurring Homes", why: "Protect the weekly backbone." },
      { id: "supplies", label: "Supplies", why: "Never start a turnover short." },
      { id: "route", label: "Route", why: "Cluster cleanings by neighborhood." },
      { id: "schedule", label: "Today's Schedule", why: "Hosts expect on-time turnovers." },
    ],
  },
  spa: {
    title: "Today's Business",
    panels: [
      { id: "bookings", label: "Today's Bookings", why: "Protect chair time and atmosphere." },
      { id: "rooms", label: "Rooms", why: "Turn rooms without rushing guests." },
      { id: "retail", label: "Retail", why: "Quiet add-on revenue after treatments." },
      { id: "rebook", label: "Rebook Queue", why: "Regulars drive stability." },
    ],
  },
};

/** Stage-aware empty / emphasis states. */
export const STAGE_EMPHASIS = {
  new: {
    id: "new",
    label: "New business",
    emphasis: "Share your booking page.",
    why: "Day-one owners need first customers, not optimization.",
    emptyHint: "Your first bookings start when someone can book you.",
  },
  growing: {
    id: "growing",
    label: "Growing business",
    emphasis: "Growth.",
    why: "Momentum is here — double down on what converts.",
    emptyHint: "Keep feeding the channel that already works.",
  },
  established: {
    id: "established",
    label: "Established business",
    emphasis: "Optimization.",
    why: "Protect margins and systems while you scale.",
    emptyHint: "Fine-tune the engine — small lifts compound.",
  },
};

/** Workspace intelligence — homepage shifts with where the owner spends time. */
export const WORKSPACE_MODES = {
  jobs: {
    id: "jobs",
    label: "Jobs-first",
    highlight: "today",
    line: "You've been deep in Jobs — I led with today's route and schedule.",
  },
  sales: {
    id: "sales",
    label: "Sales-first",
    highlight: "growth",
    line: "You've been in Sales — I led with growth opportunities and conversion.",
  },
  website: {
    id: "website",
    label: "Website-first",
    highlight: "website",
    line: "You've been editing the site — I led with live website and brand health.",
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    highlight: "brief",
    line: "I balanced the briefing across attention, health, and growth.",
  },
};

function resolveKey(ctx = {}) {
  const raw = String(
    ctx.industryId ||
      ctx.industryKey ||
      ctx.industry ||
      ctx.businessType ||
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

function resolveStage(ctx = {}) {
  const raw = String(ctx.businessStage || ctx.stage || "").toLowerCase();
  if (/establish|mature|scale|optim/.test(raw)) return "established";
  if (/grow|scaling|momentum/.test(raw)) return "growing";
  if (ctx.daysSinceLaunch != null && Number(ctx.daysSinceLaunch) > 365) return "established";
  if (ctx.daysSinceLaunch != null && Number(ctx.daysSinceLaunch) > 90) return "growing";
  if (ctx.bookingCount != null && Number(ctx.bookingCount) >= 50) return "established";
  if (ctx.bookingCount != null && Number(ctx.bookingCount) >= 5) return "growing";
  return "new";
}

function resolveWorkspace(ctx = {}) {
  const raw = String(ctx.workspaceMode || ctx.recentWorkspace || ctx.focusArea || "").toLowerCase();
  if (/job|route|schedule|field/.test(raw)) return "jobs";
  if (/sale|lead|inquir|pipeline|crm/.test(raw)) return "sales";
  if (/web|site|brand|edit|design/.test(raw)) return "website";
  return "balanced";
}

function firstNameOf(ctx = {}) {
  const owner =
    ctx.ownerName ||
    ctx.firstName ||
    (ctx.email ? String(ctx.email).split("@")[0] : null) ||
    "there";
  const pretty = String(owner)
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return pretty.split(/\s+/)[0] || "there";
}

/** Industry-shaped focus + growth from Growth Expert patterns. */
export const INDUSTRY_HOME_FOCUS = {
  pressure_washing: {
    focus: {
      action: "Upload five completed job photos.",
      why: "Finished work is your strongest trust signal for driveways and homes.",
      impact: "+18% customer trust.",
      nextStep: "Add photos from your last five jobs to the gallery.",
    },
    growth: [
      {
        title: "Launch Memberships",
        why: "Neighbors buy recurring soft-wash plans when the offer is simple.",
        impact: "+$1,200/mo",
        nextStep: "Create a quarterly soft-wash membership.",
      },
      {
        title: "Upload Portfolio",
        why: "Before/after photos convert cold traffic on the booking page.",
        impact: "+16% trust",
        nextStep: "Publish five before/after pairs.",
      },
      {
        title: "Enable Arrival Windows",
        why: "Homeowners hate all-day holds — windows cut no-shows.",
        impact: "-30% scheduling conflicts",
        nextStep: "Turn on 2-hour arrival windows.",
      },
    ],
  },
  photography: {
    focus: {
      action: "Send your inquiry link to two couples who already asked about dates.",
      why: "Warm leads convert faster than cold portfolio traffic.",
      impact: "1–2 premium inquiries.",
      nextStep: "Text the inquiry link with available weekend dates.",
    },
    growth: [
      {
        title: "Clarify Weekend Packages",
        why: "Decision fatigue kills wedding inquiries.",
        impact: "Less decision fatigue",
        nextStep: "Make one weekend package the default.",
      },
      {
        title: "Deliver One Album Early",
        why: "Speed of delivery drives referrals and reviews.",
        impact: "+referral rate",
        nextStep: "Ship the oldest album in the queue today.",
      },
      {
        title: "Feature Atmosphere Shots",
        why: "Emotion converts better than gear lists.",
        impact: "+emotional conversion",
        nextStep: "Pin three atmosphere photos above the fold.",
      },
    ],
  },
  hvac: {
    focus: {
      action: "Offer a tune-up plan to five past emergency customers.",
      why: "Emergency callers already trust you — convert them to maintenance.",
      impact: "Recurring maintenance starts.",
      nextStep: "Send a one-tap tune-up offer to five past jobs.",
    },
    growth: [
      {
        title: "Publish Licensed & Insured",
        why: "Emergency fear drops when proof is above the fold.",
        impact: "Lower emergency fear",
        nextStep: "Add licensed & insured language to the hero.",
      },
      {
        title: "Open Same-Day Windows",
        why: "HVAC buyers book the first available trusted tech.",
        impact: "Faster first bookings",
        nextStep: "Open two same-day slots this week.",
      },
      {
        title: "Parts Checklist on Van",
        why: "Second trips destroy margins on service calls.",
        impact: "-return trips",
        nextStep: "Attach a parts checklist to today's jobs.",
      },
    ],
  },
  lawn_care: {
    focus: {
      action: "Invite ten neighbors onto a weekly or biweekly route.",
      why: "Route density is the difference between profit and windshield time.",
      impact: "Route density grows.",
      nextStep: "Share a neighborhood booking link on one street.",
    },
    growth: [
      {
        title: "Add Before/After Yard Photos",
        why: "Reliability proof beats generic lawn stock photos.",
        impact: "+reliability proof",
        nextStep: "Upload three recent yard transformations.",
      },
      {
        title: "Turn On Pause/Resume",
        why: "Seasonal customers cancel instead of pausing without it.",
        impact: "Fewer cancellations",
        nextStep: "Enable pause/resume on recurring plans.",
      },
      {
        title: "Cluster Today's Route",
        why: "Scattered yards burn fuel and crew time.",
        impact: "-drive time",
        nextStep: "Reorder today's stops by neighborhood.",
      },
    ],
  },
  cleaning: {
    focus: {
      action: "Share your turnover booking link with three Airbnb hosts.",
      why: "Hosts need reliable turnovers more than one-off cleans.",
      impact: "Recurring turnovers.",
      nextStep: "Text the turnover link to three local hosts.",
    },
    growth: [
      {
        title: "Collect Two Host Reviews",
        why: "Host trust compounds faster with recent reviews.",
        impact: "Faster host trust",
        nextStep: "Ask two hosts for a short review this week.",
      },
      {
        title: "Highlight Weekly Plans",
        why: "Repeat revenue beats one-time deep cleans.",
        impact: "Higher repeat revenue",
        nextStep: "Feature weekly/biweekly on the homepage.",
      },
      {
        title: "Supplies Checklist",
        why: "Starting a turnover short creates host complaints.",
        impact: "-supply misses",
        nextStep: "Attach a supplies list to today's schedule.",
      },
    ],
  },
  spa: {
    focus: {
      action: "Text your one-tap book link to five regular clients.",
      why: "Regulars rebook when the path is effortless.",
      impact: "Faster rebooking.",
      nextStep: "Send the book link to five clients due for a visit.",
    },
    growth: [
      {
        title: "Simplify the Menu",
        why: "Too many services create decision fatigue.",
        impact: "Less decision fatigue",
        nextStep: "Keep the top six services with durations.",
      },
      {
        title: "Feature Atmosphere Photos",
        why: "Calm imagery converts better than promotions.",
        impact: "Calmer conversion",
        nextStep: "Pin atmosphere photos above promos.",
      },
      {
        title: "Protect Chair Time",
        why: "Gaps between bookings erode daily revenue.",
        impact: "+utilization",
        nextStep: "Fill two open slots with waitlist clients.",
      },
    ],
  },
};

function clampScore(n, fallback = 88) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function buildBusinessHealth(ctx = {}) {
  const scores = {
    trust: clampScore(ctx.trustScore, 95),
    bookings: clampScore(ctx.bookingsScore, 90),
    growth: clampScore(ctx.growthScore, 88),
    operations: clampScore(ctx.operationsScore, 94),
    brand: clampScore(ctx.brandScore, 91),
  };
  if (ctx.stripeConnected === false) scores.bookings = Math.min(scores.bookings, 72);
  if (ctx.hasPortfolio === false) scores.trust = Math.min(scores.trust, 78);
  const values = Object.values(scores);
  const overall = clampScore(values.reduce((a, b) => a + b, 0) / values.length);
  const dimensions = HEALTH_DIMENSIONS.map((d) => ({
    ...d,
    score: scores[d.id],
    why: `Your ${d.label} score reflects how customers experience this part of the business.`,
    recommendation: `Improve ${d.label.toLowerCase()} with one focused action this week.`,
    ask: `Why is my ${d.label} Score ${scores[d.id]}?`,
  }));
  return {
    overall,
    label: "Overall Business Health",
    dimensions,
    explain: "One unified health score — every dimension is clickable and explainable.",
  };
}

export function buildMorningBrief(ctx = {}) {
  const name = firstNameOf(ctx);
  return {
    greeting: `Good morning, ${name}`,
    review: MORNING_REVIEW_LINE,
    focusLine: MORNING_FOCUS_LINE,
    thirtySecond: true,
  };
}

export function buildWeekReturnSummary(ctx = {}) {
  const days = Number(ctx.daysAway);
  if (!Number.isFinite(days) || days < 7) return null;
  return {
    headline: `Welcome back — here's what changed while you were away.`,
    bullets: [
      ctx.awayBookings != null
        ? `${ctx.awayBookings} new booking${ctx.awayBookings === 1 ? "" : "s"}.`
        : "Booking activity continued.",
      ctx.awaySiteChanges != null
        ? `${ctx.awaySiteChanges} website improvement${ctx.awaySiteChanges === 1 ? "" : "s"}.`
        : "Your site stayed live.",
      "I refreshed Today's Focus for where you are now.",
    ],
    daysAway: days,
  };
}

export function buildBusinessTimeline(ctx = {}) {
  const stage = resolveStage(ctx);
  if (stage === "new") {
    return [
      { when: "Yesterday", event: "Business launched.", why: "Day One is on the record." },
      { when: "Today", event: "Share your booking page.", why: "First customers need a path in." },
      { when: "Next Week", event: "First review push recommended.", why: "Social proof unlocks trust." },
      { when: "Next Month", event: "Membership or package design.", why: "Repeat revenue starts early." },
    ];
  }
  if (stage === "established") {
    return [
      { when: "Yesterday", event: "Operations stayed steady.", why: "Systems are carrying the load." },
      { when: "Today", event: "Optimization opportunities ready.", why: "Small lifts compound at scale." },
      { when: "Next Week", event: "Margin review recommended.", why: "Protect profit while busy." },
      { when: "Next Month", event: "Peak season capacity plan.", why: "Don't leave demand on the table." },
    ];
  }
  return [
    { when: "Yesterday", event: "Website improved.", why: "Recent edits are live for visitors." },
    {
      when: "Today",
      event: ctx.todayBookings != null ? `${ctx.todayBookings} new bookings.` : "3 new bookings.",
      why: "Demand is showing up — respond fast.",
    },
    { when: "Next Week", event: "Membership launch recommended.", why: "Lock in recurring revenue." },
    { when: "Next Month", event: "Peak season begins.", why: "Prep capacity before the rush." },
  ];
}

export function buildSnapshot(ctx = {}) {
  const stage = resolveStage(ctx);
  const defaults = {
    new: {
      revenue: "—",
      bookings: "0",
      reviews: "0",
      response: "—",
      repeat: "—",
      conversion: "—",
    },
    growing: {
      revenue: ctx.revenueLabel || "$4,200",
      bookings: String(ctx.bookingCount ?? 12),
      reviews: String(ctx.reviewCount ?? 8),
      response: ctx.responseTime || "12m",
      repeat: ctx.repeatRate || "34%",
      conversion: ctx.conversionRate || "3.2%",
    },
    established: {
      revenue: ctx.revenueLabel || "$18,400",
      bookings: String(ctx.bookingCount ?? 64),
      reviews: String(ctx.reviewCount ?? 41),
      response: ctx.responseTime || "8m",
      repeat: ctx.repeatRate || "52%",
      conversion: ctx.conversionRate || "4.1%",
    },
  };
  const vals = defaults[stage] || defaults.new;
  return SNAPSHOT_METRICS.map((m) => ({
    ...m,
    value: vals[m.id] ?? "—",
    why: `Quick pulse on ${m.label.toLowerCase()} — no clutter.`,
    ask: `Explain my ${m.label}.`,
  }));
}

export function buildLiveWebsiteCard(ctx = {}) {
  const biz = ctx.businessName || ctx.biz || "Your Business";
  return {
    title: "Live Website",
    businessName: biz,
    previewLabel: "Live preview",
    alive: true,
    actions: WEBSITE_ACTIONS.map((a) => ({ ...a })),
    recent: ctx.recentImprovement || "Homepage trust signals refreshed.",
    ask: "Improve this website.",
    why: "Your site is the front door — it should feel alive, not like a screenshot.",
  };
}

/**
 * Full Business Home briefing payload.
 */
export function orchestrateBusinessHome(ctx = {}) {
  const industryKey = resolveKey(ctx);
  const stageKey = resolveStage(ctx);
  const workspaceKey = resolveWorkspace(ctx);
  const pack = INDUSTRY_HOME_FOCUS[industryKey] || INDUSTRY_HOME_FOCUS.pressure_washing;
  const todayPack = INDUSTRY_TODAY[industryKey] || INDUSTRY_TODAY.pressure_washing;
  const stage = STAGE_EMPHASIS[stageKey];
  const workspace = WORKSPACE_MODES[workspaceKey];
  const brief = buildMorningBrief(ctx);
  const health = buildBusinessHealth(ctx);
  const focus = {
    ...pack.focus,
    label: "Today's Focus",
    impactLabel: "Expected Impact",
  };
  const growth = pack.growth.map((g) => ({
    ...g,
    source: "growth_expert",
    impactLabel: /^-/.test(g.impact) || /^\+/.test(g.impact) ? "Expected" : "Estimated",
  }));
  const timeline = buildBusinessTimeline(ctx);
  const snapshot = buildSnapshot(ctx);
  const website = buildLiveWebsiteCard(ctx);
  const weekReturn = buildWeekReturnSummary(ctx);
  const askDock = {
    label: "Ask Hubly",
    placeholder: "Ask about anything on Business Home…",
    continuous: true,
    prompts: CARD_ASK_PROMPTS.slice(),
  };

  const orderByWorkspace = {
    jobs: ["brief", "focus", "today", "health", "growth", "website", "timeline", "snapshot"],
    sales: ["brief", "focus", "growth", "health", "website", "today", "timeline", "snapshot"],
    website: ["brief", "focus", "website", "health", "growth", "today", "timeline", "snapshot"],
    balanced: ["brief", "focus", "health", "website", "today", "growth", "timeline", "snapshot"],
  };

  return {
    version: HOME_VERSION,
    label: HOME_LABEL,
    notADashboard: true,
    thirtySecondRule: true,
    industryKey,
    stageKey,
    workspaceKey,
    brief,
    focus,
    health,
    website,
    todayBusiness: {
      ...todayPack,
      industryKey,
      ask: "What should I do with today's business?",
    },
    timeline,
    growth,
    workspace,
    sectionOrder: orderByWorkspace[workspaceKey] || orderByWorkspace.balanced,
    snapshot,
    stage,
    weekReturn,
    askDock,
    cardAsk: CARD_ASK_PROMPTS.slice(),
    answersFourQuestions: [
      "What needs my attention?",
      "How is my business doing?",
      "What should I do next?",
      "What can Hubly do for me?",
    ],
    signature: [industryKey, stageKey, workspaceKey, focus.action.slice(0, 36)].join("::"),
  };
}

export function homeExperiencesAreDistinct(a, b) {
  return a?.signature && b?.signature && a.signature !== b.signature;
}

export function hasForbiddenDashboardLanguage(text) {
  const t = String(text || "");
  return FORBIDDEN_HOME.some((f) => t.includes(f));
}

export function evaluateHomeHtml(html) {
  const h = String(html || "");
  const issues = [];
  const ok = (cond, msg) => {
    if (!cond) issues.push(msg);
    return !!cond;
  };

  const slice = (() => {
    const i = h.indexOf('id="is-step-business-home"');
    if (i < 0) return "";
    const k = h.indexOf('id="is-step-vibe"', i);
    return k > i ? h.slice(i, k) : h.slice(i, i + 60000);
  })();

  const checks = {
    homeCanvas: ok(
      /data-business-home|is-business-home|id="is-step-business-home"/.test(h),
      "Missing Business Home canvas",
    ),
    notDashboard: ok(
      !/\bDashboard\b|\bOverview\b|\bAnalytics\b/.test(slice),
      "Dashboard/Overview/Analytics language in Business Home",
    ),
    morningBrief: ok(/Good morning|Last night I reviewed|is-home-brief/.test(h), "Missing Morning Brief"),
    todaysFocus: ok(/Today's Focus|is-home-focus|Expected Impact/.test(h), "Missing Today's Focus"),
    businessHealth: ok(/Overall Business Health|is-home-health/.test(h), "Missing Business Health"),
    liveWebsite: ok(/Live Website|View Site|Edit with Hubly|is-home-website/.test(h), "Missing live website card"),
    industryToday: ok(/Today's Business|is-home-today|INDUSTRY_TODAY/.test(h), "Missing industry Today's Business"),
    askHubly: ok(/Ask Hubly|is-home-ask/.test(h), "Missing Ask Hubly dock"),
    timeline: ok(/Business Timeline|is-home-timeline|Next Week/.test(h), "Missing Business Timeline"),
    growth: ok(/Growth Opportunities|is-home-growth|Estimated|Expected/.test(h), "Missing Growth Opportunities"),
    workspaceIntel: ok(/Workspace Intelligence|WORKSPACE_MODES|is-home-workspace/.test(h), "Missing Workspace Intelligence"),
    snapshot: ok(/Business Snapshot|is-home-snapshot|Website Conversion/.test(h), "Missing Business Snapshot"),
    cardAsk: ok(/Ask Hubly|Why should I care|Improve this|is-home-card-ask/.test(h), "Missing card Ask Hubly"),
    adaptiveStage: ok(/STAGE_EMPHASIS|Share your booking page|is-home-stage/.test(h), "Missing adaptive empty states"),
    thirtySecond: ok(/thirtySecond|30.Second|is-home-30s|What needs my attention/.test(h), "Missing 30-Second Rule"),
    launchHandoff: ok(
      // Hubly v3: Create exits into Operate Home (OS chassis). M2 Business Home shell may remain archived.
      /function isEnterBusinessHome[\s\S]{0,400}openOperateHome|function goDash\(\)[\s\S]{0,240}openOperateHome|isEnterBusinessHome[\s\S]{0,400}isRunBusinessHome/.test(h),
      "Launch not handing off to Operate / Business Home",
    ),
    continuousAsk: ok(/isHomeAsk|continuous|homeAskThread/.test(h), "Missing continuous Ask Hubly conversation"),
    wordmark: ok(/hubly-wordmark/.test(slice) || /is-home-brand/.test(h), "Missing Hubly brand"),
  };

  return { passed: issues.length === 0, issues, checks };
}

export const HublyBusinessHome = {
  version: HOME_VERSION,
  label: HOME_LABEL,
  orchestrate: orchestrateBusinessHome,
  health: buildBusinessHealth,
  brief: buildMorningBrief,
};
