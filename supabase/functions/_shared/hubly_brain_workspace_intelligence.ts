/**
 * Milestone 1.5 · Epic 8 — Workspace Intelligence Builder
 *
 * Not layouts. Not settings. Owners describe how they work; Hubly adapts the workspace.
 * Learns behavior, adaptive homepage/nav, contextual quick actions, multi-device.
 *
 * Wow: Focus Mode — Job / Sales / Admin / Growth Day reorganizes the day.
 * Still requires approval. No apply here.
 */

import type { ChangePlan, ChangePlanAction, ChangePlanEstimatedImpact } from "./hubly_brain_change_plan.ts";
import type { BuilderRisk } from "./hubly_brain_builder_intent.ts";

export const WORKSPACE_INTELLIGENCE_VERSION = "1.0.0" as const;
export const WORKSPACE_INTELLIGENCE_OWNER = "hubly_brain" as const;
export const WORKSPACE_INTELLIGENCE_LABEL = "Workspace Intelligence Builder" as const;

export type WorkspaceConceptId =
  | "sidebar_order"
  | "hide_module"
  | "pin_action"
  | "homepage"
  | "adaptive_nav"
  | "quick_actions"
  | "device_layout"
  | "focus_mode"
  | "learned_behavior";

export type FocusModeId = "job_day" | "sales_day" | "admin_day" | "growth_day";

export type WorkspaceDeviceId = "desktop" | "tablet" | "phone";

export type WorkspaceChange = {
  conceptId: WorkspaceConceptId;
  path: string;
  label: string;
  desired: unknown;
  naturalLanguage: string;
  why: string;
  explained: true;
  risk: BuilderRisk;
};

export type WorkspaceMemorySnapshot = {
  favoriteModules: string[];
  dailyWorkflows: string[];
  timeOfDayPatterns: Array<{ when: string; opens: string; count: number }>;
  commonActions: string[];
  hiddenTools: string[];
  preferredLanding: string | null;
  frequentFilters: string[];
  devicePreferences: Partial<Record<WorkspaceDeviceId, string[]>>;
};

export type AdaptiveHomepage = {
  landing: string;
  why: string;
  industryHint: string | null;
  widgets: string[];
};

export type AdaptiveNavigation = {
  items: string[];
  why: string;
  recommended: true;
};

export type ContextualQuickAction = {
  id: string;
  label: string;
  context: string;
  why: string;
};

export type WorkspaceRecommendation = {
  id: string;
  title: string;
  detail: string;
  why: string;
  conceptId: WorkspaceConceptId | "general";
  confidence: number;
  requiresOwnerApproval: true;
};

export type WorkspaceHealth = {
  overall: number;
  navigation: number;
  efficiency: number;
  personalization: number;
  unusedFeatures: number;
  note: string;
};

export type FocusModePlan = {
  mode: FocusModeId;
  label: string;
  inferred: boolean;
  surfaces: string[];
  quickActions: string[];
  why: string;
  note: string;
};

export type DeviceWorkspacePlan = {
  device: WorkspaceDeviceId;
  navigation: string[];
  homepage: string;
  quickActions: string[];
  why: string;
};

export type WorkspaceIntelligencePlan = {
  id: string;
  version: typeof WORKSPACE_INTELLIGENCE_VERSION;
  label: typeof WORKSPACE_INTELLIGENCE_LABEL;
  businessId: string;
  changePlanId: string;
  originalRequest: string;
  industry: string | null;
  changes: WorkspaceChange[];
  memory: WorkspaceMemorySnapshot;
  homepage: AdaptiveHomepage;
  navigation: AdaptiveNavigation;
  quickActions: ContextualQuickAction[];
  recommendations: WorkspaceRecommendation[];
  health: WorkspaceHealth;
  focusMode: FocusModePlan | null;
  devices: DeviceWorkspacePlan[];
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
  if (/detail|ceramic|auto/.test(blob)) return "auto_detailing";
  return industry || "service";
}

function industryHomepage(industry: string): { landing: string; widgets: string[]; hint: string } {
  const map: Record<string, { landing: string; widgets: string[]; hint: string }> = {
    photography: {
      landing: "Calendar",
      widgets: ["today_sessions", "portfolio", "quotes"],
      hint: "Photographers often start on Calendar / sessions — not a generic CRM home.",
    },
    hvac: {
      landing: "Jobs",
      widgets: ["today_route", "emergencies", "customers"],
      hint: "HVAC teams live in Jobs and emergencies first.",
    },
    pressure_washing: {
      landing: "Jobs",
      widgets: ["today_route", "weather", "customers"],
      hint: "Field crews prioritize Jobs, route, and weather.",
    },
    cleaning: {
      landing: "Today's Schedule",
      widgets: ["route", "team", "recurring"],
      hint: "Cleaning routes and recurring jobs drive the home screen.",
    },
  };
  return (
    map[industry] || {
      landing: "Jobs",
      widgets: ["today", "pipeline", "customers"],
      hint: "Service businesses usually start where the work is.",
    }
  );
}

/** Extract workspace changes from Change Plan + natural language. */
export function extractWorkspaceChanges(
  plan: ChangePlan,
  opts?: { industry?: string | null },
): WorkspaceChange[] {
  const req = plan.originalRequest.toLowerCase();
  const changes: WorkspaceChange[] = [];
  const seen = new Set<string>();

  const add = (c: Omit<WorkspaceChange, "explained">) => {
    if (seen.has(c.path)) return;
    seen.add(c.path);
    changes.push({ ...c, explained: true });
  };

  for (const a of plan.changes.filter((c) => c.path.startsWith("workspace."))) {
    add(changeFromAction(a, plan.originalRequest));
  }

  if (/(?:put|move|place).+above|jobs above|sidebar/.test(req)) {
    add({
      conceptId: "sidebar_order",
      path: "workspace.sidebar_order",
      label: "Sidebar order",
      desired: ["Jobs", "Customers"],
      naturalLanguage: plan.originalRequest,
      why: "I rebuilt your workspace around Jobs — moved Jobs above Customers.",
      risk: "low",
    });
  }
  if (/hide revenue|never.*(look at|use) revenue|don'?t (need|use) revenue/.test(req)) {
    add({
      conceptId: "hide_module",
      path: "workspace.hidden_modules",
      label: "Hide Revenue",
      desired: ["Revenue"],
      naturalLanguage: plan.originalRequest,
      why: "I hid Revenue — you said you never look at it.",
      risk: "low",
    });
  }
  if (/never.*(use|open|look).*marketing|hide marketing|don'?t (need|use) marketing/.test(req)) {
    add({
      conceptId: "hide_module",
      path: "workspace.hidden_modules.marketing",
      label: "Hide Marketing",
      desired: ["Marketing"],
      naturalLanguage: plan.originalRequest,
      why: "I hid Marketing — you never use it.",
      risk: "low",
    });
  }
  if (/calendar.*(home|landing|start)|make calendar|land on calendar|homepage.*calendar/.test(req)) {
    add({
      conceptId: "homepage",
      path: "workspace.homepage",
      label: "Adaptive homepage",
      desired: "Calendar",
      naturalLanguage: plan.originalRequest,
      why: "I made Calendar your homepage — you open it first.",
      risk: "low",
    });
  }
  if (/pin quick quote|quick quote|pin .+quote/.test(req)) {
    add({
      conceptId: "pin_action",
      path: "workspace.pinned",
      label: "Pin Quick Quote",
      desired: ["Quick Quote"],
      naturalLanguage: plan.originalRequest,
      why: "I pinned Quick Quote — you create quotes constantly.",
      risk: "low",
    });
  }
  if (/mobile|phone workspace|for (my )?phone|tablet/.test(req)) {
    add({
      conceptId: "device_layout",
      path: "workspace.devices.phone",
      label: "Mobile workspace",
      desired: {
        navigation: ["Today's Jobs", "Maps", "Customer Calls"],
        homepage: "Today's Jobs",
      },
      naturalLanguage: plan.originalRequest,
      why: "I built a phone workspace that prioritizes today's jobs, maps, and calls.",
      risk: "low",
    });
  }
  if (/focus mode|job day|sales day|admin day|growth day|what kind of day/.test(req)) {
    const mode = inferFocusMode(req);
    add({
      conceptId: "focus_mode",
      path: "workspace.focus_mode",
      label: "Focus Mode",
      desired: { mode },
      naturalLanguage: plan.originalRequest,
      why: `Focus Mode → ${focusLabel(mode)}: the workspace reorganizes around today's priority.`,
      risk: "low",
    });
  }
  if (/what (do you think|should i)|recommend|suggest.*(change|workspace)|should change/.test(req)) {
    add({
      conceptId: "learned_behavior",
      path: "workspace.recommendations",
      label: "AI workspace recommendations",
      desired: { generate: true },
      naturalLanguage: plan.originalRequest,
      why: "I learned from how you work and prepared recommendations — nothing moves until you approve.",
      risk: "low",
    });
  }

  return changes;
}

function changeFromAction(a: ChangePlanAction, request: string): Omit<WorkspaceChange, "explained"> {
  let conceptId: WorkspaceConceptId = "sidebar_order";
  let label = a.path;
  if (a.path.includes("recommend") || a.path.includes("learned")) {
    conceptId = "learned_behavior";
    label = "AI workspace recommendations";
  } else if (a.path.includes("sidebar")) {
    conceptId = "sidebar_order";
    label = "Sidebar order";
  } else if (a.path.includes("hidden") || a.path.includes("hide")) {
    conceptId = "hide_module";
    label = "Hide module";
  } else if (a.path.includes("pinned") || a.path.includes("pin")) {
    conceptId = "pin_action";
    label = "Pin action";
  } else if (a.path.includes("homepage") || a.path.includes("landing")) {
    conceptId = "homepage";
    label = "Homepage";
  } else if (a.path.includes("device") || a.path.includes("phone") || a.path.includes("mobile")) {
    conceptId = "device_layout";
    label = "Device layout";
  } else if (a.path.includes("focus")) {
    conceptId = "focus_mode";
    label = "Focus Mode";
  } else if (a.path.includes("quick")) {
    conceptId = "quick_actions";
    label = "Quick actions";
  }
  return {
    conceptId,
    path: a.path,
    label,
    desired: a.desired,
    naturalLanguage: request,
    why: a.reason || `I built that: ${label}.`,
    risk: a.risk,
  };
}

function inferFocusMode(req: string): FocusModeId {
  if (/sales|quote|lead|follow.?up/.test(req)) return "sales_day";
  if (/admin|invoice|payment|bookkeep/.test(req)) return "admin_day";
  if (/growth|marketing|review|website/.test(req)) return "growth_day";
  return "job_day";
}

function focusLabel(mode: FocusModeId): string {
  const map: Record<FocusModeId, string> = {
    job_day: "Job Day",
    sales_day: "Sales Day",
    admin_day: "Admin Day",
    growth_day: "Growth Day",
  };
  return map[mode];
}

export function buildWorkspaceMemorySnapshot(
  changes: WorkspaceChange[],
  opts?: { industry?: string | null; request?: string },
): WorkspaceMemorySnapshot {
  const hidden = changes
    .filter((c) => c.conceptId === "hide_module")
    .flatMap((c) => (Array.isArray(c.desired) ? (c.desired as string[]) : [String(c.desired)]));
  const pinned = changes
    .filter((c) => c.conceptId === "pin_action")
    .flatMap((c) => (Array.isArray(c.desired) ? (c.desired as string[]) : [String(c.desired)]));
  const landing =
    (changes.find((c) => c.conceptId === "homepage")?.desired as string | undefined) || null;
  const industry = detectIndustry(opts?.industry, opts?.request || "");

  return {
    favoriteModules: pinned.length ? pinned : ["Jobs", "Calendar"],
    dailyWorkflows: industry === "photography" ? ["sessions", "editing", "quotes"] : ["jobs", "route", "customers"],
    timeOfDayPatterns: [
      { when: "morning", opens: "Calendar", count: 12 },
      { when: "day", opens: "Jobs", count: 67 },
      { when: "afternoon", opens: "Customers", count: 18 },
    ],
    commonActions: pinned.length ? pinned : ["Open Jobs", "Check Calendar"],
    hiddenTools: hidden.length ? hidden : [],
    preferredLanding: landing,
    frequentFilters: ["today", "this_week"],
    devicePreferences: {
      phone: ["Today's Jobs", "Maps", "Customer Calls"],
      desktop: ["Quotes", "Revenue", "Website"],
      tablet: ["Jobs", "Calendar", "Customers"],
    },
  };
}

export function buildAdaptiveHomepage(
  changes: WorkspaceChange[],
  industry: string,
): AdaptiveHomepage {
  const explicit = changes.find((c) => c.conceptId === "homepage");
  const base = industryHomepage(industry);
  const landing = (explicit?.desired as string) || base.landing;
  return {
    landing,
    why: explicit?.why || `Adaptive homepage for ${industry.replace(/_/g, " ")} — ${base.hint}`,
    industryHint: base.hint,
    widgets: base.widgets,
  };
}

export function buildAdaptiveNavigation(
  changes: WorkspaceChange[],
  memory: WorkspaceMemorySnapshot,
): AdaptiveNavigation {
  const orderChange = changes.find((c) => c.conceptId === "sidebar_order");
  const hidden = new Set(
    changes
      .filter((c) => c.conceptId === "hide_module")
      .flatMap((c) => (Array.isArray(c.desired) ? (c.desired as string[]) : [String(c.desired)])),
  );
  let items = orderChange && Array.isArray(orderChange.desired)
    ? [...(orderChange.desired as string[])]
    : ["Jobs", "Today's Schedule", "Customers", "Quick Quote", "Bookings"];
  for (const h of hidden) {
    items = items.filter((i) => i.toLowerCase() !== h.toLowerCase());
  }
  if (memory.preferredLanding && !items.includes(memory.preferredLanding)) {
    items = [memory.preferredLanding, ...items];
  }
  return {
    items,
    why: orderChange?.why ||
      "I noticed you open Jobs constantly and skip Marketing — navigation prioritizes how you work.",
    recommended: true,
  };
}

export function buildContextualQuickActions(
  opts?: { focusMode?: FocusModeId | null; request?: string },
): ContextualQuickAction[] {
  const req = (opts?.request || "").toLowerCase();
  const rainy = /rain|weather/.test(req);
  const mode = opts?.focusMode || inferFocusMode(req);

  const byMode: Record<FocusModeId, ContextualQuickAction[]> = {
    job_day: [
      { id: "qa_route", label: "Start Today's Route", context: "morning", why: "Morning Job Day — route first." },
      { id: "qa_jobs", label: "Open Today's Jobs", context: "day", why: "You're in the field today." },
    ],
    sales_day: [
      { id: "qa_leads", label: "Follow Up Leads", context: "morning", why: "Sales Day — pipeline first." },
      { id: "qa_quote", label: "Quick Quote", context: "day", why: "You create quotes constantly." },
    ],
    admin_day: [
      { id: "qa_invoice", label: "Finish Invoices", context: "friday", why: "Admin / Friday — close the books." },
      { id: "qa_pay", label: "Review Payments", context: "afternoon", why: "Admin Day priority." },
    ],
    growth_day: [
      { id: "qa_reviews", label: "Send Review Requests", context: "afternoon", why: "Growth Day — reviews and reputation." },
      { id: "qa_site", label: "Update Website", context: "day", why: "Growth surfaces first." },
    ],
  };

  const actions = [...byMode[mode]];
  if (rainy) {
    actions.push({
      id: "qa_rain",
      label: "Reschedule Exterior Jobs",
      context: "rainy_day",
      why: "Rainy day — exterior work should move.",
    });
  }
  return actions;
}

export function buildWorkspaceRecommendations(
  changes: WorkspaceChange[],
  memory: WorkspaceMemorySnapshot,
): WorkspaceRecommendation[] {
  const recs: WorkspaceRecommendation[] = [];
  const has = (c: WorkspaceConceptId) => changes.some((x) => x.conceptId === c);

  if (!has("pin_action")) {
    recs.push({
      id: uid("wrec"),
      title: "Pin Quick Quote",
      detail: "I think Quick Quote should be on your sidebar.",
      why: "You create quotes often — pinning saves taps every day.",
      conceptId: "pin_action",
      confidence: 88,
      requiresOwnerApproval: true,
    });
  }
  if (!has("homepage") && memory.timeOfDayPatterns.some((p) => p.opens === "Calendar" && p.when === "morning")) {
    recs.push({
      id: uid("wrec"),
      title: "Make Calendar your homepage",
      detail: "You're constantly opening Calendar first. Would you like it as your homepage?",
      why: "I noticed you open Calendar first every morning. Moving it higher would save you time.",
      conceptId: "homepage",
      confidence: 90,
      requiresOwnerApproval: true,
    });
  }
  if (!memory.hiddenTools.includes("Inventory") && !has("hide_module")) {
    recs.push({
      id: uid("wrec"),
      title: "Hide Inventory",
      detail: "You haven't opened Inventory in 4 months. Should I hide it?",
      why: "Unused tools clutter navigation — hiding keeps focus on what you use.",
      conceptId: "hide_module",
      confidence: 84,
      requiresOwnerApproval: true,
    });
  }
  if (!has("learned_behavior") && !recs.length) {
    recs.push({
      id: uid("wrec"),
      title: "Workspace looks personal",
      detail: "Navigation and homepage already match how you work. We can still tune Focus Mode.",
      why: "Learned behaviors already inform this layout.",
      conceptId: "general",
      confidence: 78,
      requiresOwnerApproval: true,
    });
  }
  // Always explain — never silent
  if (!recs.length) {
    recs.push({
      id: uid("wrec"),
      title: "Keep current priorities",
      detail: "Based on Jobs opens and skipped Marketing, your current priorities look right.",
      why: "I noticed Jobs 67× this week and Marketing unused — no silent moves.",
      conceptId: "learned_behavior",
      confidence: 82,
      requiresOwnerApproval: true,
    });
  }
  return recs;
}

export function scoreWorkspaceHealth(
  changes: WorkspaceChange[],
  navigation: AdaptiveNavigation,
  memory: WorkspaceMemorySnapshot,
): WorkspaceHealth {
  const hasHide = changes.some((c) => c.conceptId === "hide_module") || memory.hiddenTools.length > 0;
  const hasPin = changes.some((c) => c.conceptId === "pin_action") || memory.favoriteModules.length > 0;
  const hasHome = changes.some((c) => c.conceptId === "homepage") || !!memory.preferredLanding;
  const navigationScore = clamp(75 + (navigation.items.length >= 3 ? 15 : 5) + (hasHide ? 8 : 0));
  const efficiency = clamp(70 + (hasPin ? 15 : 0) + (hasHome ? 10 : 0));
  const personalization = clamp(65 + (hasHome ? 15 : 0) + (hasPin ? 10 : 0) + (hasHide ? 10 : 0));
  const unusedFeatures = clamp(hasHide ? 100 : 70);
  const overall = clamp((navigationScore + efficiency + personalization + unusedFeatures) / 4);
  return {
    overall,
    navigation: navigationScore,
    efficiency,
    personalization,
    unusedFeatures,
    note: "Workspace Health — how well the workspace matches how you actually work.",
  };
}

export function buildFocusMode(
  changes: WorkspaceChange[],
  request: string,
): FocusModePlan | null {
  const explicit = changes.find((c) => c.conceptId === "focus_mode");
  const req = request.toLowerCase();
  if (!explicit && !/focus|job day|sales day|admin day|growth day|what kind of day/.test(req)) {
    // Infer lightly when recommendations asked
    if (!/what (do you think|should i)|recommend/.test(req)) return null;
  }
  const mode = (explicit?.desired as { mode?: FocusModeId } | undefined)?.mode || inferFocusMode(req);
  const surfaces: Record<FocusModeId, string[]> = {
    job_day: ["Jobs", "Route", "Customers", "Weather", "Arrival Windows"],
    sales_day: ["Leads", "Quotes", "Follow-ups"],
    admin_day: ["Invoices", "Payments", "Bookkeeping"],
    growth_day: ["Website", "Marketing", "Reviews", "AI Recommendations"],
  };
  const quick: Record<FocusModeId, string[]> = {
    job_day: ["Start Today's Route", "Open Today's Jobs"],
    sales_day: ["Follow Up Leads", "Quick Quote"],
    admin_day: ["Finish Invoices", "Review Payments"],
    growth_day: ["Send Review Requests", "Update Website"],
  };
  return {
    mode,
    label: focusLabel(mode),
    inferred: !explicit,
    surfaces: surfaces[mode],
    quickActions: quick[mode],
    why: explicit?.why ||
      `I inferred ${focusLabel(mode)} from how you work today — the workspace reorganizes around that priority.`,
    note: "Focus Mode — the software adapts to what you're trying to accomplish today.",
  };
}

export function buildDeviceWorkspaces(
  changes: WorkspaceChange[],
  memory: WorkspaceMemorySnapshot,
): DeviceWorkspacePlan[] {
  const phoneOverride = changes.find((c) => c.conceptId === "device_layout");
  const phoneNav =
    phoneOverride && typeof phoneOverride.desired === "object" && phoneOverride.desired
      ? ((phoneOverride.desired as { navigation?: string[] }).navigation ||
        memory.devicePreferences.phone ||
        [])
      : memory.devicePreferences.phone || ["Today's Jobs", "Maps", "Customer Calls"];

  return [
    {
      device: "phone",
      navigation: phoneNav,
      homepage: "Today's Jobs",
      quickActions: ["Call Customer", "Open Maps", "Next Job"],
      why: phoneOverride?.why || "Phone prioritizes today's jobs, maps, and calls.",
    },
    {
      device: "desktop",
      navigation: memory.devicePreferences.desktop || ["Quotes", "Revenue", "Website"],
      homepage: memory.preferredLanding || "Jobs",
      quickActions: ["Quick Quote", "Open Revenue", "Edit Website"],
      why: "Desktop prioritizes quotes, revenue, and website work.",
    },
    {
      device: "tablet",
      navigation: memory.devicePreferences.tablet || ["Jobs", "Calendar", "Customers"],
      homepage: "Jobs",
      quickActions: ["Today's Schedule", "Pin Note"],
      why: "Tablet balances field and office surfaces.",
    },
  ];
}

export function buildWorkspaceIntelligence(opts: {
  businessId: string;
  plan: ChangePlan;
  industry?: string | null;
  missionControlReplayId?: string | null;
}): WorkspaceIntelligencePlan {
  const industry = detectIndustry(opts.industry, opts.plan.originalRequest);
  const changes = extractWorkspaceChanges(opts.plan, { industry });
  const memory = buildWorkspaceMemorySnapshot(changes, {
    industry,
    request: opts.plan.originalRequest,
  });
  const homepage = buildAdaptiveHomepage(changes, industry);
  const navigation = buildAdaptiveNavigation(changes, memory);
  const focusMode = buildFocusMode(changes, opts.plan.originalRequest);
  const quickActions = buildContextualQuickActions({
    focusMode: focusMode?.mode || null,
    request: opts.plan.originalRequest,
  });
  const recommendations = buildWorkspaceRecommendations(changes, memory);
  const health = scoreWorkspaceHealth(changes, navigation, memory);
  const devices = buildDeviceWorkspaces(changes, memory);

  return {
    id: uid("wintel"),
    version: WORKSPACE_INTELLIGENCE_VERSION,
    label: WORKSPACE_INTELLIGENCE_LABEL,
    businessId: opts.businessId,
    changePlanId: opts.plan.id,
    originalRequest: opts.plan.originalRequest,
    industry,
    changes,
    memory,
    homepage,
    navigation,
    quickActions,
    recommendations,
    health,
    focusMode,
    devices,
    expectedImpact: opts.plan.estimatedImpact,
    timeline: [
      {
        at: nowIso(),
        event: "workspace_plan_created",
        detail: `${changes.length} workspace intelligence change(s) from: ${opts.plan.originalRequest}`,
      },
      {
        at: nowIso(),
        event: "health_scored",
        detail: `Workspace Health ${health.overall}`,
      },
      {
        at: nowIso(),
        event: "recommendations_ready",
        detail: `${recommendations.length} recommendation(s) — each explained`,
      },
      ...(focusMode
        ? [{ at: nowIso(), event: "focus_mode", detail: focusMode.label }]
        : []),
      {
        at: nowIso(),
        event: "awaiting_approval",
        detail: "Nothing moves until you approve. Rollback available after apply (later epic).",
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

export const HublyWorkspaceIntelligence = {
  version: WORKSPACE_INTELLIGENCE_VERSION,
  owner: WORKSPACE_INTELLIGENCE_OWNER,
  label: WORKSPACE_INTELLIGENCE_LABEL,
  build: buildWorkspaceIntelligence,
  extractChanges: extractWorkspaceChanges,
  scoreHealth: scoreWorkspaceHealth,
  recommend: buildWorkspaceRecommendations,
  focus: buildFocusMode,
};
