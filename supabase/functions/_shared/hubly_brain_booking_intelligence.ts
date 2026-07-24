/**
 * Milestone 1.5 · Epic 7 — Booking Intelligence Builder
 *
 * Not a settings page. Owners describe how they operate; Hubly builds scheduling.
 * Concepts: travel, arrival windows, notice, capacity, seasonal, weather, skills.
 *
 * Wow: AI Schedule Simulator — see next 7 days before committing.
 * Still requires approval. No apply here.
 */

import type { ChangePlan, ChangePlanAction, ChangePlanEstimatedImpact } from "./hubly_brain_change_plan.ts";
import type { BuilderRisk } from "./hubly_brain_builder_intent.ts";

export const BOOKING_INTELLIGENCE_VERSION = "1.0.0" as const;
export const BOOKING_INTELLIGENCE_OWNER = "hubly_brain" as const;
export const BOOKING_INTELLIGENCE_LABEL = "Booking Intelligence Builder" as const;

export type BookingConceptId =
  | "travel_buffer"
  | "arrival_window"
  | "minimum_notice"
  | "same_day"
  | "daily_capacity"
  | "service_schedule"
  | "seasonal"
  | "weather"
  | "team_skill"
  | "estimate_days"
  | "business_hours"
  | "optimize_route";

export type BookingRule = {
  conceptId: BookingConceptId;
  path: string;
  label: string;
  desired: unknown;
  naturalLanguage: string;
  why: string;
  industryHint: string | null;
  risk: BuilderRisk;
};

export type BookingHealth = {
  overall: number;
  travelEfficiency: number;
  customerFlexibility: number;
  bufferTime: number;
  automation: number;
  conflicts: number;
  note: string;
};

export type BookingRecommendation = {
  id: string;
  title: string;
  detail: string;
  conceptId: BookingConceptId | "general";
  confidence: number;
  requiresOwnerApproval: true;
};

export type ScheduleSimDay = {
  date: string;
  weekday: string;
  jobs: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    moved: boolean;
    conflictAvoided: boolean;
  }>;
  drivingMinutesSaved: number;
  slotsGained: number;
  slotsLost: number;
  revenueImpactUsd: number;
};

export type ScheduleSimulator = {
  horizonDays: 7;
  headline: string;
  days: ScheduleSimDay[];
  totals: {
    jobsMoved: number;
    drivingMinutesSaved: number;
    conflictsAvoided: number;
    slotsGained: number;
    slotsLost: number;
    estimatedRevenueImpactUsd: number;
  };
  note: string;
};

export type BookingIntelligencePlan = {
  id: string;
  version: typeof BOOKING_INTELLIGENCE_VERSION;
  label: typeof BOOKING_INTELLIGENCE_LABEL;
  businessId: string;
  changePlanId: string;
  originalRequest: string;
  industry: string | null;
  rules: BookingRule[];
  health: BookingHealth;
  recommendations: BookingRecommendation[];
  simulator: ScheduleSimulator;
  expectedImpact: ChangePlanEstimatedImpact;
  timeline: Array<{ at: string; event: string; detail: string }>;
  requiresApproval: true;
  applied: false;
  executed: false;
  waitingFor: "collaboration_or_approval";
  timestamp: string;
  missionControlReplayId: string | null;
};

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function detectIndustry(industry: string | null | undefined, request: string): string {
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

function industryHint(concept: BookingConceptId, industry: string): string | null {
  const map: Record<string, Partial<Record<BookingConceptId, string>>> = {
    pressure_washing: {
      arrival_window: "Exterior crews often run arrival windows with travel between sites.",
      weather: "Rain should delay exterior wash work.",
      travel_buffer: "Cross-town routes need drive buffers.",
    },
    photography: {
      arrival_window: "Sessions often need golden-hour windows, not fixed clocks.",
      minimum_notice: "Editing time benefits from notice policies.",
      service_schedule: "Session lengths and edit buffers vary by package.",
    },
    hvac: {
      same_day: "Emergency / on-call jobs may need a separate same-day lane.",
      service_schedule: "Priority and on-call rotation matter.",
      daily_capacity: "Cap routine jobs so emergencies still fit.",
    },
    cleaning: {
      daily_capacity: "Recurring routes need capacity per day.",
      team_skill: "Skill routing for interiors vs deep cleans.",
      travel_buffer: "Clustered neighborhoods save drive time.",
    },
    auto_detailing: {
      service_schedule: "Ceramic coatings often need longer Friday blocks.",
      minimum_notice: "Prep and cure windows need notice.",
    },
  };
  return map[industry]?.[concept] || null;
}

/** Extract / enrich booking rules from Change Plan + natural language. */
export function extractBookingRules(
  plan: ChangePlan,
  opts?: { industry?: string | null },
): BookingRule[] {
  const req = plan.originalRequest.toLowerCase();
  const industry = detectIndustry(opts?.industry, plan.originalRequest);
  const rules: BookingRule[] = [];
  const seen = new Set<string>();

  const add = (rule: Omit<BookingRule, "industryHint"> & { industryHint?: string | null }) => {
    if (seen.has(rule.path)) return;
    seen.add(rule.path);
    rules.push({
      ...rule,
      industryHint: rule.industryHint ?? industryHint(rule.conceptId, industry),
    });
  };

  for (const a of plan.changes.filter((c) => c.path.startsWith("booking."))) {
    add(ruleFromAction(a, plan.originalRequest, industry));
  }

  // Concept detection beyond what Change Plan already drafted
  if (/travel|drive between|buffer between|minutes to drive|30.?minute travel|45.?minute/.test(req)) {
    const mins = /45/.test(req) ? 45 : /20/.test(req) ? 20 : 30;
    add({
      conceptId: "travel_buffer",
      path: "booking.travel_buffer.minutes",
      label: "Travel buffer",
      desired: { enabled: true, minutes: mins },
      naturalLanguage: plan.originalRequest,
      why: `I added ${mins}-minute travel buffers between jobs.`,
      risk: "low",
    });
  }
  if (/two jobs|2 jobs|only two|maximum per day|daily capacity|capacity/.test(req)) {
    add({
      conceptId: "daily_capacity",
      path: "booking.daily_capacity.max_jobs",
      label: "Daily capacity",
      desired: { max_jobs: 2 },
      naturalLanguage: plan.originalRequest,
      why: "Only two jobs per day — protects quality and travel.",
      risk: "medium",
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
        latest_start: /after 2|after 14|2\s*pm/.test(req) ? "14:00" : null,
      },
      naturalLanguage: plan.originalRequest,
      why: "Ceramic coatings reserved for Fridays (and late-day blocked when asked).",
      risk: "medium",
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
      risk: "medium",
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
      risk: "medium",
    });
  }
  if (/winter|seasonal|snow removal|summer only/.test(req)) {
    add({
      conceptId: "seasonal",
      path: "booking.seasonal.rules",
      label: "Seasonal availability",
      desired: { service: "snow_removal", seasons: ["winter"] },
      naturalLanguage: plan.originalRequest,
      why: "Seasonal availability — snow removal only in winter.",
      risk: "low",
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
      risk: "low",
    });
  }
  if (/employee|skill|interiors|team/.test(req)) {
    add({
      conceptId: "team_skill",
      path: "booking.team.skill_routing",
      label: "Skill routing",
      desired: { skill: "interiors", assignee: "employee" },
      naturalLanguage: plan.originalRequest,
      why: "Skill routing — interiors go to the right teammate.",
      risk: "medium",
    });
  }
  if (/sunset|dynamic hours|until dark/.test(req)) {
    add({
      conceptId: "business_hours",
      path: "booking.hours.dynamic_sunset",
      label: "Dynamic hours",
      desired: { mode: "until_sunset" },
      naturalLanguage: plan.originalRequest,
      why: "Hours follow sunset — seasonal daylight awareness.",
      risk: "low",
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
      risk: "medium",
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
      risk: "low",
    });
  }

  return rules;
}

function ruleFromAction(a: ChangePlanAction, request: string, industry: string): BookingRule {
  let conceptId: BookingConceptId = "minimum_notice";
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
    risk: a.risk,
  };
}

export function scoreBookingHealth(rules: BookingRule[]): BookingHealth {
  const has = (c: BookingConceptId) => rules.some((r) => r.conceptId === c);
  const travelEfficiency = clamp(70 + (has("travel_buffer") ? 18 : 0) + (has("optimize_route") ? 8 : 0));
  const customerFlexibility = clamp(
    65 + (has("arrival_window") ? 20 : 0) + (has("same_day") ? -5 : 5),
  );
  const bufferTime = clamp(60 + (has("travel_buffer") ? 25 : 0) + (has("minimum_notice") ? 10 : 0));
  const automation = clamp(
    70 +
      (has("weather") ? 12 : 0) +
      (has("seasonal") ? 8 : 0) +
      (has("service_schedule") ? 6 : 0),
  );
  const conflicts = has("daily_capacity") || has("travel_buffer") ? 0 : 1;
  const overall = clamp(
    (travelEfficiency + customerFlexibility + bufferTime + automation + (conflicts === 0 ? 100 : 70)) /
      5,
  );
  return {
    overall,
    travelEfficiency,
    customerFlexibility,
    bufferTime,
    automation,
    conflicts,
    note: "Booking Health — how well scheduling matches how you actually work.",
  };
}

export function buildBookingRecommendations(
  rules: BookingRule[],
  industry: string,
): BookingRecommendation[] {
  const recs: BookingRecommendation[] = [];
  const has = (c: BookingConceptId) => rules.some((r) => r.conceptId === c);

  if (!has("travel_buffer")) {
    recs.push({
      id: uid("brec"),
      title: "Add travel buffers",
      detail: "You don't have travel buffers. I recommend adding 20 minutes between jobs.",
      conceptId: "travel_buffer",
      confidence: 88,
      requiresOwnerApproval: true,
    });
  }
  if (!has("minimum_notice") && !has("same_day")) {
    recs.push({
      id: uid("brec"),
      title: "Consider 24-hour notice",
      detail: "Customers may be booking too late. A 24-hour notice policy protects prep time.",
      conceptId: "minimum_notice",
      confidence: 84,
      requiresOwnerApproval: true,
    });
  }
  if (industry === "pressure_washing" && !has("weather")) {
    recs.push({
      id: uid("brec"),
      title: "Weather-aware exterior work",
      detail: "For exterior work, I recommend rain → reschedule automation.",
      conceptId: "weather",
      confidence: 90,
      requiresOwnerApproval: true,
    });
  }
  if (!has("optimize_route")) {
    recs.push({
      id: uid("brec"),
      title: "Optimize tomorrow's route",
      detail: "You're driving across town multiple times. Want me to optimize the route?",
      conceptId: "optimize_route",
      confidence: 82,
      requiresOwnerApproval: true,
    });
  }
  if (!recs.length) {
    recs.push({
      id: uid("brec"),
      title: "Scheduling looks solid",
      detail: "Rules cover the core concepts. We can still simulate next week before you approve.",
      conceptId: "general",
      confidence: 78,
      requiresOwnerApproval: true,
    });
  }
  return recs;
}

/** AI Schedule Simulator — next 7 days under proposed rules (preview only). */
export function simulateSchedule(
  rules: BookingRule[],
  opts?: { startDate?: Date },
): ScheduleSimulator {
  const start = opts?.startDate ? new Date(opts.startDate) : new Date();
  const days: ScheduleSimDay[] = [];
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
    const driveSaved = hasTravel ? 18 + (i % 3) * 4 : 0;
    const gained = hasArrival ? 1 : 0;
    const lost = hasNotice ? (i === 0 ? 1 : 0) : 0;
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
          conflictAvoided: !!avoid,
        },
        {
          id: `job_${i}_b`,
          title: "Follow-up",
          start: hasTravel ? "11:45" : "11:15",
          end: "13:00",
          moved: !!hasTravel,
          conflictAvoided: false,
        },
      ],
      drivingMinutesSaved: driveSaved,
      slotsGained: gained,
      slotsLost: lost,
      revenueImpactUsd: rev,
    });
  }

  return {
    horizonDays: 7,
    headline:
      "Here's how next week would look if we enabled these booking rules.",
    days,
    totals: {
      jobsMoved,
      drivingMinutesSaved,
      conflictsAvoided,
      slotsGained,
      slotsLost,
      estimatedRevenueImpactUsd: revenue,
    },
    note: "Simulation only — nothing is applied until you approve.",
  };
}

export function buildBookingIntelligence(opts: {
  businessId: string;
  plan: ChangePlan;
  industry?: string | null;
  missionControlReplayId?: string | null;
}): BookingIntelligencePlan {
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
        detail: `${rules.length} booking intelligence rule(s) from: ${opts.plan.originalRequest}`,
      },
      {
        at: nowIso(),
        event: "health_scored",
        detail: `Booking Health ${health.overall}`,
      },
      {
        at: nowIso(),
        event: "simulation_ready",
        detail: simulator.headline,
      },
      {
        at: nowIso(),
        event: "awaiting_approval",
        detail: "Rollback available after apply (later epic).",
      },
    ],
    requiresApproval: true,
    applied: false,
    executed: false,
    waitingFor: "collaboration_or_approval",
    timestamp: nowIso(),
    missionControlReplayId: opts.missionControlReplayId ?? null,
  };
}

export const HublyBookingIntelligence = {
  version: BOOKING_INTELLIGENCE_VERSION,
  owner: BOOKING_INTELLIGENCE_OWNER,
  label: BOOKING_INTELLIGENCE_LABEL,
  build: buildBookingIntelligence,
  extractRules: extractBookingRules,
  scoreHealth: scoreBookingHealth,
  recommend: buildBookingRecommendations,
  simulate: simulateSchedule,
};
