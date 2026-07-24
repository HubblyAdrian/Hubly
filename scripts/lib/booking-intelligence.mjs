/** Node mirror of hubly_brain_booking_intelligence.ts — Milestone 1.5 Epic 7 (esbuild). */


// supabase/functions/_shared/hubly_brain_booking_intelligence.ts
var BOOKING_INTELLIGENCE_VERSION = "1.0.0";
var BOOKING_INTELLIGENCE_OWNER = "hubly_brain";
var BOOKING_INTELLIGENCE_LABEL = "Booking Intelligence Builder";
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function detectIndustry(industry, request) {
  const blob = `${industry || ""} ${request}`.toLowerCase();
  if (/pressure|wash|soft.?wash/.test(blob)) return "pressure_washing";
  if (/photo|portrait|wedding/.test(blob)) return "photography";
  if (/hvac|heat|air.?cond/.test(blob)) return "hvac";
  if (/clean|maid|janitor/.test(blob)) return "cleaning";
  if (/lawn|landscap|mow/.test(blob)) return "lawn";
  if (/spa|massage|salon/.test(blob)) return "spa";
  if (/ceramic|detail|auto/.test(blob)) return "auto_detailing";
  return industry || "service";
}
function industryHint(concept, industry) {
  const map = {
    pressure_washing: {
      arrival_window: "Exterior crews often run arrival windows with travel between sites.",
      weather: "Rain should delay exterior wash work.",
      travel_buffer: "Cross-town routes need drive buffers."
    },
    photography: {
      arrival_window: "Sessions often need golden-hour windows, not fixed clocks.",
      minimum_notice: "Editing time benefits from notice policies.",
      service_schedule: "Session lengths and edit buffers vary by package."
    },
    hvac: {
      same_day: "Emergency / on-call jobs may need a separate same-day lane.",
      service_schedule: "Priority and on-call rotation matter.",
      daily_capacity: "Cap routine jobs so emergencies still fit."
    },
    cleaning: {
      daily_capacity: "Recurring routes need capacity per day.",
      team_skill: "Skill routing for interiors vs deep cleans.",
      travel_buffer: "Clustered neighborhoods save drive time."
    },
    auto_detailing: {
      service_schedule: "Ceramic coatings often need longer Friday blocks.",
      minimum_notice: "Prep and cure windows need notice."
    }
  };
  return map[industry]?.[concept] || null;
}
function extractBookingRules(plan, opts) {
  const req = plan.originalRequest.toLowerCase();
  const industry = detectIndustry(opts?.industry, plan.originalRequest);
  const rules = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (rule) => {
    if (seen.has(rule.path)) return;
    seen.add(rule.path);
    rules.push({
      ...rule,
      industryHint: rule.industryHint ?? industryHint(rule.conceptId, industry)
    });
  };
  for (const a of plan.changes.filter((c) => c.path.startsWith("booking."))) {
    add(ruleFromAction(a, plan.originalRequest, industry));
  }
  if (/travel|drive between|buffer between|minutes to drive|30.?minute travel|45.?minute/.test(req)) {
    const mins = /45/.test(req) ? 45 : /20/.test(req) ? 20 : 30;
    add({
      conceptId: "travel_buffer",
      path: "booking.travel_buffer.minutes",
      label: "Travel buffer",
      desired: { enabled: true, minutes: mins },
      naturalLanguage: plan.originalRequest,
      why: `I added ${mins}-minute travel buffers between jobs.`,
      risk: "low"
    });
  }
  if (/two jobs|2 jobs|only two|maximum per day|daily capacity|capacity/.test(req)) {
    add({
      conceptId: "daily_capacity",
      path: "booking.daily_capacity.max_jobs",
      label: "Daily capacity",
      desired: { max_jobs: 2 },
      naturalLanguage: plan.originalRequest,
      why: "Only two jobs per day \u2014 protects quality and travel.",
      risk: "medium"
    });
  }
  if (/ceramic.*(friday|only|after 2)|fridays? (are|only).*ceramic|coating.?only|fridays? only|only (on )?fridays?/.test(req)) {
    add({
      conceptId: "service_schedule",
      path: "booking.service_rules.ceramic_coating",
      label: "Ceramic coating schedule",
      desired: {
        service: "ceramic_coating",
        days: ["friday"],
        latest_start: /after 2|after 14|2\s*pm/.test(req) ? "14:00" : null
      },
      naturalLanguage: plan.originalRequest,
      why: "Ceramic coatings reserved for Fridays (and late-day blocked when asked).",
      risk: "medium"
    });
  }
  if (/after 2\s*pm|never.*after 2|no ceramic.*after/.test(req)) {
    add({
      conceptId: "service_schedule",
      path: "booking.service_rules.ceramic_coating.latest_start",
      label: "Ceramic latest start",
      desired: "14:00",
      naturalLanguage: plan.originalRequest,
      why: "Service-specific rule: no ceramic coating bookings after 2 PM.",
      risk: "medium"
    });
  }
  if (/weather|raining|rain|reschedule exterior/.test(req)) {
    add({
      conceptId: "weather",
      path: "booking.weather.exterior_delay",
      label: "Weather-aware exterior work",
      desired: { enabled: true, condition: "rain", action: "reschedule_exterior" },
      naturalLanguage: plan.originalRequest,
      why: "If it's raining, exterior work reschedules automatically.",
      risk: "medium"
    });
  }
  if (/winter|seasonal|snow removal|summer only/.test(req)) {
    add({
      conceptId: "seasonal",
      path: "booking.seasonal.rules",
      label: "Seasonal availability",
      desired: { service: "snow_removal", seasons: ["winter"] },
      naturalLanguage: plan.originalRequest,
      why: "Seasonal availability \u2014 snow removal only in winter.",
      risk: "low"
    });
  }
  if (/estimate.?only|estimates on tuesday|tuesdays? are estimate/.test(req)) {
    add({
      conceptId: "estimate_days",
      path: "booking.estimate_days",
      label: "Estimate-only days",
      desired: { days: ["tuesday"], mode: "estimates_only" },
      naturalLanguage: plan.originalRequest,
      why: "Tuesdays are estimate-only availability.",
      risk: "low"
    });
  }
  if (/employee|skill|interiors|team/.test(req)) {
    add({
      conceptId: "team_skill",
      path: "booking.team.skill_routing",
      label: "Skill routing",
      desired: { skill: "interiors", assignee: "employee" },
      naturalLanguage: plan.originalRequest,
      why: "Skill routing \u2014 interiors go to the right teammate.",
      risk: "medium"
    });
  }
  if (/sunset|dynamic hours|until dark/.test(req)) {
    add({
      conceptId: "business_hours",
      path: "booking.hours.dynamic_sunset",
      label: "Dynamic hours",
      desired: { mode: "until_sunset" },
      naturalLanguage: plan.originalRequest,
      why: "Hours follow sunset \u2014 seasonal daylight awareness.",
      risk: "low"
    });
  }
  if (/emergency.?only|saturdays? are emergency/.test(req)) {
    add({
      conceptId: "service_schedule",
      path: "booking.service_rules.saturday_emergency",
      label: "Saturday emergency-only",
      desired: { day: "saturday", mode: "emergency_only" },
      naturalLanguage: plan.originalRequest,
      why: "Saturdays are emergency-only.",
      risk: "medium"
    });
  }
  if (/optimiz(e|ing).*schedule|route|driving across town/.test(req)) {
    add({
      conceptId: "optimize_route",
      path: "booking.optimization.route",
      label: "Route optimization",
      desired: { enabled: true, horizon_days: 1 },
      naturalLanguage: plan.originalRequest,
      why: "Optimize tomorrow's schedule to cut cross-town driving.",
      risk: "low"
    });
  }
  return rules;
}
function ruleFromAction(a, request, industry) {
  let conceptId = "minimum_notice";
  let label = a.path;
  if (a.path.includes("arrival_window")) {
    conceptId = "arrival_window";
    label = "Arrival window";
  } else if (a.path.includes("same_day")) {
    conceptId = "same_day";
    label = "No same-day bookings";
  } else if (a.path.includes("minimum_notice")) {
    conceptId = "minimum_notice";
    label = "Minimum notice";
  } else if (a.path.includes("travel")) {
    conceptId = "travel_buffer";
    label = "Travel buffer";
  } else if (a.path.includes("daily_capacity") || a.path.includes("capacity")) {
    conceptId = "daily_capacity";
    label = "Daily capacity";
  } else if (a.path.includes("weather")) {
    conceptId = "weather";
    label = "Weather-aware scheduling";
  } else if (a.path.includes("seasonal")) {
    conceptId = "seasonal";
    label = "Seasonal availability";
  } else if (a.path.includes("service_rules") || a.path.includes("ceramic")) {
    conceptId = "service_schedule";
    label = "Service-specific schedule";
  } else if (a.path.includes("estimate")) {
    conceptId = "estimate_days";
    label = "Estimate-only days";
  } else if (a.path.includes("skill") || a.path.includes("team")) {
    conceptId = "team_skill";
    label = "Skill routing";
  } else if (a.path.includes("sunset") || a.path.includes("hours")) {
    conceptId = "business_hours";
    label = "Dynamic hours";
  } else if (a.path.includes("optim")) {
    conceptId = "optimize_route";
    label = "Route optimization";
  }
  return {
    conceptId,
    path: a.path,
    label,
    desired: a.desired,
    naturalLanguage: request,
    why: a.reason || `I built that: ${label}.`,
    industryHint: industryHint(conceptId, industry),
    risk: a.risk
  };
}
function scoreBookingHealth(rules) {
  const has = (c) => rules.some((r) => r.conceptId === c);
  const travelEfficiency = clamp(70 + (has("travel_buffer") ? 18 : 0) + (has("optimize_route") ? 8 : 0));
  const customerFlexibility = clamp(
    65 + (has("arrival_window") ? 20 : 0) + (has("same_day") ? -5 : 5)
  );
  const bufferTime = clamp(60 + (has("travel_buffer") ? 25 : 0) + (has("minimum_notice") ? 10 : 0));
  const automation = clamp(
    70 + (has("weather") ? 12 : 0) + (has("seasonal") ? 8 : 0) + (has("service_schedule") ? 6 : 0)
  );
  const conflicts = has("daily_capacity") || has("travel_buffer") ? 0 : 1;
  const overall = clamp(
    (travelEfficiency + customerFlexibility + bufferTime + automation + (conflicts === 0 ? 100 : 70)) / 5
  );
  return {
    overall,
    travelEfficiency,
    customerFlexibility,
    bufferTime,
    automation,
    conflicts,
    note: "Booking Health \u2014 how well scheduling matches how you actually work."
  };
}
function buildBookingRecommendations(rules, industry) {
  const recs = [];
  const has = (c) => rules.some((r) => r.conceptId === c);
  if (!has("travel_buffer")) {
    recs.push({
      id: uid("brec"),
      title: "Add travel buffers",
      detail: "You don't have travel buffers. I recommend adding 20 minutes between jobs.",
      conceptId: "travel_buffer",
      confidence: 88,
      requiresOwnerApproval: true
    });
  }
  if (!has("minimum_notice") && !has("same_day")) {
    recs.push({
      id: uid("brec"),
      title: "Consider 24-hour notice",
      detail: "Customers may be booking too late. A 24-hour notice policy protects prep time.",
      conceptId: "minimum_notice",
      confidence: 84,
      requiresOwnerApproval: true
    });
  }
  if (industry === "pressure_washing" && !has("weather")) {
    recs.push({
      id: uid("brec"),
      title: "Weather-aware exterior work",
      detail: "For exterior work, I recommend rain \u2192 reschedule automation.",
      conceptId: "weather",
      confidence: 90,
      requiresOwnerApproval: true
    });
  }
  if (!has("optimize_route")) {
    recs.push({
      id: uid("brec"),
      title: "Optimize tomorrow's route",
      detail: "You're driving across town multiple times. Want me to optimize the route?",
      conceptId: "optimize_route",
      confidence: 82,
      requiresOwnerApproval: true
    });
  }
  if (!recs.length) {
    recs.push({
      id: uid("brec"),
      title: "Scheduling looks solid",
      detail: "Rules cover the core concepts. We can still simulate next week before you approve.",
      conceptId: "general",
      confidence: 78,
      requiresOwnerApproval: true
    });
  }
  return recs;
}
function simulateSchedule(rules, opts) {
  const start = opts?.startDate ? new Date(opts.startDate) : /* @__PURE__ */ new Date();
  const days = [];
  let jobsMoved = 0;
  let drivingMinutesSaved = 0;
  let conflictsAvoided = 0;
  let slotsGained = 0;
  let slotsLost = 0;
  let revenue = 0;
  const hasTravel = rules.some((r) => r.conceptId === "travel_buffer");
  const hasArrival = rules.some((r) => r.conceptId === "arrival_window");
  const hasCapacity = rules.some((r) => r.conceptId === "daily_capacity");
  const hasNotice = rules.some((r) => r.conceptId === "minimum_notice" || r.conceptId === "same_day");
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const weekday = weekdays[d.getDay()];
    const moved = hasTravel && i % 2 === 0;
    const avoid = hasArrival || hasCapacity;
    const driveSaved = hasTravel ? 18 + i % 3 * 4 : 0;
    const gained = hasArrival ? 1 : 0;
    const lost = hasNotice ? i === 0 ? 1 : 0 : 0;
    const rev = hasTravel ? 40 : hasArrival ? 25 : 10;
    if (moved) jobsMoved += 1;
    if (avoid) conflictsAvoided += 1;
    drivingMinutesSaved += driveSaved;
    slotsGained += gained;
    slotsLost += lost;
    revenue += rev;
    days.push({
      date: d.toISOString().slice(0, 10),
      weekday,
      jobs: [
        {
          id: `job_${i}_a`,
          title: i % 2 === 0 ? "Exterior wash" : "Interior detail",
          start: "09:00",
          end: "11:00",
          moved: !!moved,
          conflictAvoided: !!avoid
        },
        {
          id: `job_${i}_b`,
          title: "Follow-up",
          start: hasTravel ? "11:45" : "11:15",
          end: "13:00",
          moved: !!hasTravel,
          conflictAvoided: false
        }
      ],
      drivingMinutesSaved: driveSaved,
      slotsGained: gained,
      slotsLost: lost,
      revenueImpactUsd: rev
    });
  }
  return {
    horizonDays: 7,
    headline: "Here's how next week would look if we enabled these booking rules.",
    days,
    totals: {
      jobsMoved,
      drivingMinutesSaved,
      conflictsAvoided,
      slotsGained,
      slotsLost,
      estimatedRevenueImpactUsd: revenue
    },
    note: "Simulation only \u2014 nothing is applied until you approve."
  };
}
function buildBookingIntelligence(opts) {
  const industry = detectIndustry(opts.industry, opts.plan.originalRequest);
  const rules = extractBookingRules(opts.plan, { industry });
  const health = scoreBookingHealth(rules);
  const recommendations = buildBookingRecommendations(rules, industry);
  const simulator = simulateSchedule(rules);
  return {
    id: uid("bintel"),
    version: BOOKING_INTELLIGENCE_VERSION,
    label: BOOKING_INTELLIGENCE_LABEL,
    businessId: opts.businessId,
    changePlanId: opts.plan.id,
    originalRequest: opts.plan.originalRequest,
    industry,
    rules,
    health,
    recommendations,
    simulator,
    expectedImpact: opts.plan.estimatedImpact,
    timeline: [
      {
        at: nowIso(),
        event: "rule_plan_created",
        detail: `${rules.length} booking intelligence rule(s) from: ${opts.plan.originalRequest}`
      },
      {
        at: nowIso(),
        event: "health_scored",
        detail: `Booking Health ${health.overall}`
      },
      {
        at: nowIso(),
        event: "simulation_ready",
        detail: simulator.headline
      },
      {
        at: nowIso(),
        event: "awaiting_approval",
        detail: "Rollback available after apply (later epic)."
      }
    ],
    requiresApproval: true,
    applied: false,
    executed: false,
    waitingFor: "collaboration_or_approval",
    timestamp: nowIso(),
    missionControlReplayId: opts.missionControlReplayId ?? null
  };
}
var HublyBookingIntelligence = {
  version: BOOKING_INTELLIGENCE_VERSION,
  owner: BOOKING_INTELLIGENCE_OWNER,
  label: BOOKING_INTELLIGENCE_LABEL,
  build: buildBookingIntelligence,
  extractRules: extractBookingRules,
  scoreHealth: scoreBookingHealth,
  recommend: buildBookingRecommendations,
  simulate: simulateSchedule
};
export {
  BOOKING_INTELLIGENCE_LABEL,
  BOOKING_INTELLIGENCE_OWNER,
  BOOKING_INTELLIGENCE_VERSION,
  HublyBookingIntelligence,
  buildBookingIntelligence,
  buildBookingRecommendations,
  extractBookingRules,
  scoreBookingHealth,
  simulateSchedule
};
