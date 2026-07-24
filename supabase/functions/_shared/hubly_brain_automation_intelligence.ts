/**
 * Milestone 1.5 · Epic 9 — Automation Intelligence Builder
 *
 * Not an automation settings UI. Owners describe outcomes; Hubly builds workflows.
 * Preview → simulation → health → recommendations → approval. No execute here.
 *
 * Wow: Automation Discovery — Hubly notices manual work and proposes workflows.
 */

import type { ChangePlan, ChangePlanAction, ChangePlanEstimatedImpact } from "./hubly_brain_change_plan.ts";
import type { BuilderRisk } from "./hubly_brain_builder_intent.ts";

export const AUTOMATION_INTELLIGENCE_VERSION = "1.0.0" as const;
export const AUTOMATION_INTELLIGENCE_OWNER = "hubly_brain" as const;
export const AUTOMATION_INTELLIGENCE_LABEL = "Automation Intelligence Builder" as const;

export type AutomationOutcomeId =
  | "prep_instructions"
  | "review_request"
  | "quote_followup"
  | "weather_reschedule"
  | "membership_billing"
  | "friday_summary"
  | "recurring_customers"
  | "booking_confirmation"
  | "payment_reminder"
  | "discovery";

export type WorkflowStep = {
  id: string;
  type: "trigger" | "wait" | "send_email" | "send_sms" | "tag_crm" | "update_booking" | "charge" | "report" | "portal_message" | "upsell";
  label: string;
  config?: Record<string, unknown>;
};

export type AutomationWorkflow = {
  id: string;
  outcomeId: AutomationOutcomeId;
  title: string;
  trigger: string;
  steps: WorkflowStep[];
  systems: string[];
  why: string;
  explained: true;
  estimatedMinutesSavedPerMonth: number;
  risk: BuilderRisk;
};

export type WorkflowPreview = {
  headline: string;
  graph: Array<{ from: string; to: string; label: string }>;
  steps: string[];
  note: string;
};

export type WorkflowSimulation = {
  horizonDays: 30;
  headline: string;
  totals: {
    bookings: number;
    prepEmails: number;
    reminderTexts: number;
    reviewRequests: number;
    quoteFollowups: number;
    weatherReschedules: number;
    membershipCharges: number;
    summaries: number;
  };
  note: string;
};

export type AutomationHealth = {
  overall: number;
  coverage: number;
  reliability: number;
  failures: number;
  timeSavedHoursPerMonth: number;
  customerExperience: number;
  note: string;
};

export type AutomationRecommendation = {
  id: string;
  title: string;
  detail: string;
  why: string;
  outcomeId: AutomationOutcomeId | "general";
  estimatedMinutesSavedPerMonth: number;
  confidence: number;
  requiresOwnerApproval: true;
};

export type AutomationDiscovery = {
  id: string;
  observation: string;
  manualCount: number;
  period: string;
  proposedWorkflowTitle: string;
  why: string;
  estimatedMinutesSavedPerMonth: number;
  customerImpact: string;
  requiresOwnerApproval: true;
};

export type AutomationIntelligencePlan = {
  id: string;
  version: typeof AUTOMATION_INTELLIGENCE_VERSION;
  label: typeof AUTOMATION_INTELLIGENCE_LABEL;
  businessId: string;
  changePlanId: string;
  originalRequest: string;
  industry: string | null;
  workflows: AutomationWorkflow[];
  preview: WorkflowPreview;
  simulation: WorkflowSimulation;
  health: AutomationHealth;
  recommendations: AutomationRecommendation[];
  discovery: AutomationDiscovery[];
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
  if (/detail|ceramic|auto/.test(blob)) return "auto_detailing";
  if (/clean|maid/.test(blob)) return "cleaning";
  return industry || "service";
}

/** Extract / build workflows from Change Plan + natural language. */
export function extractAutomationWorkflows(
  plan: ChangePlan,
  opts?: { industry?: string | null },
): AutomationWorkflow[] {
  const req = plan.originalRequest.toLowerCase();
  const industry = detectIndustry(opts?.industry, plan.originalRequest);
  const workflows: AutomationWorkflow[] = [];
  const seen = new Set<string>();

  const add = (w: AutomationWorkflow) => {
    if (seen.has(w.id)) return;
    seen.add(w.id);
    workflows.push(w);
  };

  // From change plan automation actions
  for (const a of plan.changes.filter((c) => c.path.startsWith("automations."))) {
    for (const w of workflowsFromAction(a, plan.originalRequest, industry)) add(w);
  }

  if (/prep instruction|prep (email|message)|ceramic.*prep|prep.*ceramic|after ceramic/.test(req)) {
    add(workflowPrepCeramic(plan.originalRequest));
  }
  if (/review|ask for (a )?review|review request/.test(req)) {
    add(workflowReviewRequest(plan.originalRequest));
  }
  if (/quote.*(follow|5 day|five day)|follow up on quotes|haven'?t responded/.test(req)) {
    add(workflowQuoteFollowup(plan.originalRequest));
  }
  if (/rain|weather|reschedule exterior/.test(req)) {
    add(workflowWeatherReschedule(plan.originalRequest));
  }
  if (/membership|charge.*month|monthly billing|bill.*membership/.test(req)) {
    add(workflowMembershipBilling(plan.originalRequest));
  }
  if (/friday.*(summary|report)|business summary|weekly summary/.test(req)) {
    add(workflowFridaySummary(plan.originalRequest));
  }
  if (/recurring customer|automate.*recurring|repeat customer/.test(req)) {
    add(workflowRecurringCustomers(plan.originalRequest));
  }
  if (/when someone books.*ceramic|books a ceramic|ceramic coating\.\.\./.test(req)) {
    add(workflowMultiSystemCeramic(plan.originalRequest));
  }

  if (!workflows.length && (/automat|workflow|when someone|after every/.test(req))) {
    add({
      id: "auto_general",
      outcomeId: "booking_confirmation",
      title: "Customer communication workflow",
      trigger: "booking.created",
      steps: [
        { id: "t1", type: "trigger", label: "Booking Created" },
        { id: "w1", type: "wait", label: "Wait 5 Minutes", config: { minutes: 5 } },
        { id: "e1", type: "send_email", label: "Send Confirmation Email" },
      ],
      systems: ["Automations", "Booking"],
      why: "I built a confirmation workflow from your request.",
      explained: true,
      estimatedMinutesSavedPerMonth: 90,
      risk: "low",
    });
  }

  return workflows;
}

function workflowsFromAction(
  a: ChangePlanAction,
  request: string,
  _industry: string,
): AutomationWorkflow[] {
  const desired = a.desired;
  if (!Array.isArray(desired)) {
    return [{
      id: uid("wf"),
      outcomeId: "booking_confirmation",
      title: a.reason || "Automation workflow",
      trigger: "custom",
      steps: [
        { id: "t1", type: "trigger", label: "Trigger" },
        { id: "a1", type: "send_email", label: String(a.reason || "Action") },
      ],
      systems: ["Automations"],
      why: a.reason || "I built that.",
      explained: true,
      estimatedMinutesSavedPerMonth: 60,
      risk: a.risk,
    }];
  }
  return desired.map((d: Record<string, unknown>, i: number) => {
    const stepsRaw = (d.steps as Array<{ type: string; config?: Record<string, unknown> }>) || [];
    const steps: WorkflowStep[] = [
      { id: `t_${i}`, type: "trigger", label: String(d.trigger || "Trigger") },
      ...stepsRaw.map((s, j) => ({
        id: `s_${i}_${j}`,
        type: mapStepType(s.type),
        label: stepLabel(s.type, s.config),
        config: s.config,
      })),
    ];
    return {
      id: String(d.id || `wf_${i}`),
      outcomeId: inferOutcomeFromPath(a.path, request),
      title: String((d as { name?: string }).name || a.reason || "Workflow"),
      trigger: String(d.trigger || "custom"),
      steps,
      systems: ["Automations"],
      why: a.reason || "I built that.",
      explained: true as const,
      estimatedMinutesSavedPerMonth: 90,
      risk: a.risk,
    };
  });
}

function mapStepType(t: string): WorkflowStep["type"] {
  if (/wait|delay/.test(t)) return "wait";
  if (/sms|text/.test(t)) return "send_sms";
  if (/email|send/.test(t)) return "send_email";
  if (/tag|crm/.test(t)) return "tag_crm";
  if (/charge|bill|invoice/.test(t)) return "charge";
  if (/report|summary/.test(t)) return "report";
  if (/booking|reschedule/.test(t)) return "update_booking";
  if (/portal/.test(t)) return "portal_message";
  if (/upsell/.test(t)) return "upsell";
  return "send_email";
}

function stepLabel(type: string, config?: Record<string, unknown>): string {
  if (/wait/.test(type)) {
    const h = config?.hours ?? config?.days;
    if (config?.hours === 0) return "Immediate";
    if (h != null) return `Wait ${h} ${config?.days != null ? "day(s)" : "hour(s)"}`;
    return "Wait";
  }
  if (/email/.test(type) || type === "sendEmail") return `Send Email${config?.template ? ` (${config.template})` : ""}`;
  if (/reminder/.test(type)) return "Send Reminder";
  if (/createWorkflow/.test(type)) return String(config?.name || "Create Workflow");
  return type;
}

function inferOutcomeFromPath(path: string, request: string): AutomationOutcomeId {
  const r = `${path} ${request}`.toLowerCase();
  if (/prep/.test(r)) return "prep_instructions";
  if (/review/.test(r)) return "review_request";
  if (/quote/.test(r)) return "quote_followup";
  if (/weather|rain/.test(r)) return "weather_reschedule";
  if (/membership|billing/.test(r)) return "membership_billing";
  if (/friday|summary/.test(r)) return "friday_summary";
  if (/recurring/.test(r)) return "recurring_customers";
  return "booking_confirmation";
}

function workflowPrepCeramic(request: string): AutomationWorkflow {
  return {
    id: "prep_after_ceramic",
    outcomeId: "prep_instructions",
    title: "Ceramic coating prep instructions",
    trigger: "booking.created.service:ceramic_coating",
    steps: [
      { id: "t1", type: "trigger", label: "Booking Created (Ceramic Coating)" },
      { id: "w1", type: "wait", label: "Wait 5 Minutes", config: { minutes: 5 } },
      { id: "e1", type: "send_email", label: "Send Prep Email", config: { template: "prep_instructions" } },
      { id: "w2", type: "wait", label: "Wait Until Day Before", config: { until: "day_before" } },
      { id: "r1", type: "send_sms", label: "Send Reminder" },
      { id: "c1", type: "tag_crm", label: "Tag CRM: prep_sent" },
    ],
    systems: ["Automations", "Booking", "CRM"],
    why: "I added prep instructions after ceramic bookings — prep matters for coating quality.",
    explained: true,
    estimatedMinutesSavedPerMonth: 150,
    risk: "medium",
  };
}

function workflowReviewRequest(request: string): AutomationWorkflow {
  const days = /24\s*hour|1 day|one day/.test(request.toLowerCase()) ? 1 : 3;
  return {
    id: "review_after_job",
    outcomeId: "review_request",
    title: "Ask for reviews after completed jobs",
    trigger: "booking.completed",
    steps: [
      { id: "t1", type: "trigger", label: "Job Completed" },
      { id: "w1", type: "wait", label: `Wait ${days} Day(s)`, config: { days } },
      { id: "e1", type: "send_email", label: "Send Review Request" },
      { id: "s1", type: "send_sms", label: "Optional Review SMS" },
    ],
    systems: ["Automations", "Booking", "CRM"],
    why: `I built a review request ${days} day(s) after every completed job.`,
    explained: true,
    estimatedMinutesSavedPerMonth: 120,
    risk: "low",
  };
}

function workflowQuoteFollowup(request: string): AutomationWorkflow {
  return {
    id: "quote_followup_5d",
    outcomeId: "quote_followup",
    title: "Quote follow-up after 5 days",
    trigger: "quote.no_response.days:5",
    steps: [
      { id: "t1", type: "trigger", label: "Quote Unanswered 5 Days" },
      { id: "e1", type: "send_email", label: "Send Follow-Up" },
      { id: "c1", type: "tag_crm", label: "Tag: quote_followup_sent" },
    ],
    systems: ["Automations", "CRM", "Packages"],
    why: "I built a 5-day quote follow-up so silent quotes don't die.",
    explained: true,
    estimatedMinutesSavedPerMonth: 100,
    risk: "low",
  };
}

function workflowWeatherReschedule(request: string): AutomationWorkflow {
  return {
    id: "weather_exterior",
    outcomeId: "weather_reschedule",
    title: "Reschedule exterior work if it rains",
    trigger: "weather.rain.forecast",
    steps: [
      { id: "t1", type: "trigger", label: "Rain Forecast" },
      { id: "b1", type: "update_booking", label: "Reschedule Exterior Jobs" },
      { id: "e1", type: "send_email", label: "Notify Customers" },
      { id: "s1", type: "send_sms", label: "SMS Alert" },
    ],
    systems: ["Automations", "Booking"],
    why: "I built weather-aware rescheduling for exterior jobs.",
    explained: true,
    estimatedMinutesSavedPerMonth: 180,
    risk: "medium",
  };
}

function workflowMembershipBilling(request: string): AutomationWorkflow {
  return {
    id: "membership_monthly",
    outcomeId: "membership_billing",
    title: "Charge memberships every month",
    trigger: "schedule.monthly",
    steps: [
      { id: "t1", type: "trigger", label: "Monthly Billing Day" },
      { id: "c1", type: "charge", label: "Charge Memberships" },
      { id: "e1", type: "send_email", label: "Send Receipt" },
    ],
    systems: ["Automations", "Packages", "CRM"],
    why: "I built monthly membership billing so renewals run without manual charges.",
    explained: true,
    estimatedMinutesSavedPerMonth: 200,
    risk: "high",
  };
}

function workflowFridaySummary(request: string): AutomationWorkflow {
  return {
    id: "friday_summary",
    outcomeId: "friday_summary",
    title: "Friday business summary",
    trigger: "schedule.friday",
    steps: [
      { id: "t1", type: "trigger", label: "Friday Morning" },
      { id: "r1", type: "report", label: "Compile Weekly Summary" },
      { id: "e1", type: "send_email", label: "Send Summary to Owner" },
    ],
    systems: ["Automations"],
    why: "I built a Friday business summary so you start the weekend knowing the week.",
    explained: true,
    estimatedMinutesSavedPerMonth: 80,
    risk: "low",
  };
}

function workflowRecurringCustomers(request: string): AutomationWorkflow {
  return {
    id: "recurring_customers",
    outcomeId: "recurring_customers",
    title: "Automate recurring customers",
    trigger: "customer.recurring.due",
    steps: [
      { id: "t1", type: "trigger", label: "Recurring Due" },
      { id: "b1", type: "update_booking", label: "Propose Next Booking" },
      { id: "e1", type: "send_email", label: "Confirm with Customer" },
      { id: "u1", type: "upsell", label: "Optional Upsell Reminder" },
    ],
    systems: ["Automations", "Booking", "CRM"],
    why: "I built recurring-customer automation so repeats book themselves.",
    explained: true,
    estimatedMinutesSavedPerMonth: 160,
    risk: "medium",
  };
}

function workflowMultiSystemCeramic(request: string): AutomationWorkflow {
  return {
    id: "multisystem_ceramic",
    outcomeId: "prep_instructions",
    title: "Ceramic booking — multi-system workflow",
    trigger: "booking.created.service:ceramic_coating",
    steps: [
      { id: "t1", type: "trigger", label: "Ceramic Booking Created" },
      { id: "b1", type: "update_booking", label: "Booking Rule + Calendar Reminder" },
      { id: "e1", type: "send_email", label: "Prep Email" },
      { id: "c1", type: "tag_crm", label: "CRM Tag: ceramic" },
      { id: "p1", type: "portal_message", label: "Website Customer Portal Message" },
      { id: "w1", type: "wait", label: "Wait Until After Service", config: { days: 1 } },
      { id: "r1", type: "send_email", label: "Review Request" },
      { id: "u1", type: "upsell", label: "Upsell Reminder" },
    ],
    systems: ["Automations", "Booking", "CRM", "Website", "Packages"],
    why: "One conversation → booking, calendar, prep, CRM, portal, review, and upsell.",
    explained: true,
    estimatedMinutesSavedPerMonth: 240,
    risk: "medium",
  };
}

export function buildWorkflowPreview(workflows: AutomationWorkflow[]): WorkflowPreview {
  const primary = workflows[0];
  const steps = primary
    ? primary.steps.map((s) => s.label)
    : ["Trigger", "Action"];
  const graph: WorkflowPreview["graph"] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    graph.push({ from: steps[i], to: steps[i + 1], label: "then" });
  }
  return {
    headline: primary
      ? `Preview: ${primary.title}`
      : "Workflow preview",
    graph,
    steps,
    note: "Nothing has been activated — preview only until you approve.",
  };
}

export function simulateWorkflows(workflows: AutomationWorkflow[]): WorkflowSimulation {
  const has = (o: AutomationOutcomeId) => workflows.some((w) => w.outcomeId === o);
  const bookings = 112;
  return {
    horizonDays: 30,
    headline: "Here's how next month would look if these automations ran.",
    totals: {
      bookings,
      prepEmails: has("prep_instructions") ? bookings : 0,
      reminderTexts: has("prep_instructions") || has("review_request") ? Math.round(bookings * 0.86) : 0,
      reviewRequests: has("review_request") ? Math.round(bookings * 0.93) : 0,
      quoteFollowups: has("quote_followup") ? 12 : 0,
      weatherReschedules: has("weather_reschedule") ? 4 : 0,
      membershipCharges: has("membership_billing") ? 28 : 0,
      summaries: has("friday_summary") ? 4 : 0,
    },
    note: "Simulation only — nothing has been sent yet.",
  };
}

export function scoreAutomationHealth(workflows: AutomationWorkflow[]): AutomationHealth {
  const coverage = clamp(60 + workflows.length * 8 + (workflows.some((w) => w.systems.length > 2) ? 10 : 0));
  const reliability = clamp(90 + (workflows.every((w) => w.explained) ? 10 : 0));
  const failures = 0;
  const minutes = workflows.reduce((s, w) => s + w.estimatedMinutesSavedPerMonth, 0);
  const timeSavedHoursPerMonth = Math.round((minutes / 60) * 10) / 10;
  const customerExperience = clamp(
    70 +
      (workflows.some((w) => w.outcomeId === "prep_instructions") ? 10 : 0) +
      (workflows.some((w) => w.outcomeId === "review_request") ? 8 : 0) +
      (workflows.some((w) => w.outcomeId === "quote_followup") ? 6 : 0),
  );
  const overall = clamp((coverage + reliability + customerExperience + (failures === 0 ? 100 : 70)) / 4);
  return {
    overall,
    coverage,
    reliability,
    failures,
    timeSavedHoursPerMonth,
    customerExperience,
    note: "Automation Health — coverage, reliability, time saved, and customer experience.",
  };
}

export function buildAutomationRecommendations(
  workflows: AutomationWorkflow[],
  industry: string,
): AutomationRecommendation[] {
  const recs: AutomationRecommendation[] = [];
  const has = (o: AutomationOutcomeId) => workflows.some((w) => w.outcomeId === o);

  if (!has("review_request")) {
    recs.push({
      id: uid("arec"),
      title: "Automate review requests",
      detail: "I noticed you're manually sending review requests. I can automate that.",
      why: "Estimated time saved: ~2.5 hours per month. Businesses like yours get more reviews sending after 24 hours (+18% expected).",
      outcomeId: "review_request",
      estimatedMinutesSavedPerMonth: 150,
      confidence: 90,
      requiresOwnerApproval: true,
    });
  } else {
    recs.push({
      id: uid("arec"),
      title: "Optimize review timing",
      detail: "Your review request may be better at 24 hours than 3 days.",
      why: "Businesses like yours get more reviews sending after 24 hours. Expected increase: +18%.",
      outcomeId: "review_request",
      estimatedMinutesSavedPerMonth: 0,
      confidence: 86,
      requiresOwnerApproval: true,
    });
  }
  if (!has("prep_instructions") && (industry === "auto_detailing" || industry === "pressure_washing")) {
    recs.push({
      id: uid("arec"),
      title: "Automate prep instructions",
      detail: "You've sent the same prep message repeatedly. Would you like me to automate it?",
      why: "Prep instructions reduce day-of questions for exterior / coating work.",
      outcomeId: "prep_instructions",
      estimatedMinutesSavedPerMonth: 150,
      confidence: 88,
      requiresOwnerApproval: true,
    });
  }
  if (!has("quote_followup")) {
    recs.push({
      id: uid("arec"),
      title: "Quote follow-up automation",
      detail: "Silent quotes lose deals. A 5-day follow-up recovers opportunity.",
      why: "Sales outcome — lost opportunity recovery without manual chasing.",
      outcomeId: "quote_followup",
      estimatedMinutesSavedPerMonth: 100,
      confidence: 84,
      requiresOwnerApproval: true,
    });
  }
  if (!recs.length) {
    recs.push({
      id: uid("arec"),
      title: "Automations look solid",
      detail: "Core outcomes are covered. We can still simulate next month before you approve.",
      why: "Coverage is strong; nothing executes until approval.",
      outcomeId: "general",
      estimatedMinutesSavedPerMonth: 0,
      confidence: 78,
      requiresOwnerApproval: true,
    });
  }
  return recs;
}

/** Automation Discovery — proactive weekly-style observations. */
export function buildAutomationDiscovery(
  workflows: AutomationWorkflow[],
): AutomationDiscovery[] {
  const discoveries: AutomationDiscovery[] = [];
  const has = (o: AutomationOutcomeId) => workflows.some((w) => w.outcomeId === o);

  if (!has("review_request")) {
    discoveries.push({
      id: uid("disc"),
      observation: "I noticed you've done this manually 14 times this week.",
      manualCount: 14,
      period: "this_week",
      proposedWorkflowTitle: "Ask for reviews after completed jobs",
      why: "Manual review asks are repetitive and easy to miss.",
      estimatedMinutesSavedPerMonth: 150,
      customerImpact: "More consistent review volume; customers hear from you while the job is fresh.",
      requiresOwnerApproval: true,
    });
  }
  if (!has("prep_instructions")) {
    discoveries.push({
      id: uid("disc"),
      observation: "You've sent the same prep message 18 times this month.",
      manualCount: 18,
      period: "this_month",
      proposedWorkflowTitle: "Ceramic coating prep instructions",
      why: "Identical prep messages are a perfect automation candidate.",
      estimatedMinutesSavedPerMonth: 150,
      customerImpact: "Every coating customer gets prep on time — fewer day-of issues.",
      requiresOwnerApproval: true,
    });
  }
  if (!discoveries.length) {
    discoveries.push({
      id: uid("disc"),
      observation: "No new manual patterns this week beyond what we've already proposed.",
      manualCount: 0,
      period: "this_week",
      proposedWorkflowTitle: "Keep current automations",
      why: "Discovery found no additional high-frequency manual work.",
      estimatedMinutesSavedPerMonth: 0,
      customerImpact: "Existing workflows already cover the hotspots.",
      requiresOwnerApproval: true,
    });
  }
  return discoveries;
}

export function buildAutomationIntelligence(opts: {
  businessId: string;
  plan: ChangePlan;
  industry?: string | null;
  missionControlReplayId?: string | null;
}): AutomationIntelligencePlan {
  const industry = detectIndustry(opts.industry, opts.plan.originalRequest);
  const workflows = extractAutomationWorkflows(opts.plan, { industry });
  const preview = buildWorkflowPreview(workflows);
  const simulation = simulateWorkflows(workflows);
  const health = scoreAutomationHealth(workflows);
  const recommendations = buildAutomationRecommendations(workflows, industry);
  const discovery = buildAutomationDiscovery(workflows);
  const minutes = workflows.reduce((s, w) => s + w.estimatedMinutesSavedPerMonth, 0);

  return {
    id: uid("aintel"),
    version: AUTOMATION_INTELLIGENCE_VERSION,
    label: AUTOMATION_INTELLIGENCE_LABEL,
    businessId: opts.businessId,
    changePlanId: opts.plan.id,
    originalRequest: opts.plan.originalRequest,
    industry,
    workflows,
    preview,
    simulation,
    health,
    recommendations,
    discovery,
    expectedImpact: opts.plan.estimatedImpact,
    timeline: [
      {
        at: nowIso(),
        event: "workflow_plan_created",
        detail: `${workflows.length} workflow(s) from: ${opts.plan.originalRequest}`,
      },
      {
        at: nowIso(),
        event: "preview_ready",
        detail: preview.headline,
      },
      {
        at: nowIso(),
        event: "simulation_ready",
        detail: `30-day sim · ~${Math.round(minutes / 60 * 10) / 10}h/mo saved`,
      },
      {
        at: nowIso(),
        event: "health_scored",
        detail: `Automation Health ${health.overall}`,
      },
      {
        at: nowIso(),
        event: "discovery_ready",
        detail: `${discovery.length} discovery insight(s)`,
      },
      {
        at: nowIso(),
        event: "awaiting_approval",
        detail: "No automation executes until you approve.",
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

export const HublyAutomationIntelligence = {
  version: AUTOMATION_INTELLIGENCE_VERSION,
  owner: AUTOMATION_INTELLIGENCE_OWNER,
  label: AUTOMATION_INTELLIGENCE_LABEL,
  build: buildAutomationIntelligence,
  extractWorkflows: extractAutomationWorkflows,
  preview: buildWorkflowPreview,
  simulate: simulateWorkflows,
  scoreHealth: scoreAutomationHealth,
  recommend: buildAutomationRecommendations,
  discover: buildAutomationDiscovery,
};
