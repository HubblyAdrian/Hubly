/**
 * Milestone 1.5 · Epic 11 — Hubly Chat OS
 *
 * Not "adding chat." This is Hubly — one conversation, one personality, one partner.
 * Every builder + trusted tools route through one thread. Conversation Canvas
 * keeps the live business on the right while the owner talks on the left.
 *
 * Voice-ready: same conversation contract for typing / voice / phone / receptionist.
 * Still no apply — builders propose; Chat OS orchestrates.
 */

import type { ChangePlan } from "./hubly_brain_change_plan.ts";
import type { BuilderIntent } from "./hubly_brain_builder_intent.ts";
import type { HublyConversationIntelligence } from "./hubly_brain_conversation_intelligence.ts";
import {
  type PersonalityExpression,
} from "./hubly_brain_personality.ts";
import {
  applyExperienceLayer,
  type ExperienceMessage,
} from "./hubly_brain_experience_layer.ts";

export const CHAT_OS_VERSION = "1.0.0" as const;
export const CHAT_OS_OWNER = "hubly_brain" as const;
export const CHAT_OS_LABEL = "Hubly Chat OS" as const;
export const ASK_HUBLY_CTA = "Ask Hubly" as const;

/** One AI. No parallel personalities. */
export const CHAT_OS_PERSONALITY = {
  id: "hubly",
  name: "Hubly",
  role: "business_partner",
  separateAIs: false as const,
  note: "There is only one AI — Hubly. Not Website AI, Booking AI, CRM AI, etc.",
};

export type ChatChannel = "typing" | "voice" | "phone" | "receptionist";

export type ChatRouteKind =
  | "business_builder"
  | "booking_intelligence"
  | "workspace_intelligence"
  | "automation_intelligence"
  | "media_intelligence"
  | "coaching"
  | "calendar"
  | "crm"
  | "revenue"
  | "weather"
  | "stripe"
  | "google_calendar"
  | "document_search"
  | "general"
  | "continue_project";

export type ChatToolUse = {
  toolId: string;
  label: string;
  source: "internal" | "external";
  why: string;
  resultSummary: string;
};

export type CanvasSurfaceId =
  | "website_preview"
  | "booking_simulation"
  | "automation_flow"
  | "portfolio_gallery"
  | "workspace_mockup"
  | "revenue_chart"
  | "calendar"
  | "recommendations"
  | "none";

export type ConversationCanvas = {
  split: "conversation_left_canvas_right";
  conversationSide: "left";
  canvasSide: "right";
  activeSurface: CanvasSurfaceId;
  surfaces: Array<{
    id: CanvasSurfaceId;
    label: string;
    active: boolean;
    summary: string;
  }>;
  note: string;
};

export type ChatMessage = {
  id: string;
  role: "owner" | "hubly";
  text: string;
  at: string;
  channel: ChatChannel;
};

export type ProactiveStarter = {
  id: string;
  title: string;
  detail: string;
  route: ChatRouteKind;
  why: string;
};

export type ChatProject = {
  id: string;
  name: string;
  status: "active" | "paused" | "complete";
  startedAt: string;
  lastActiveAt: string;
  summary: string;
};

export type ChatOsSession = {
  id: string;
  version: typeof CHAT_OS_VERSION;
  label: typeof CHAT_OS_LABEL;
  businessId: string;
  personality: typeof CHAT_OS_PERSONALITY;
  askHublyCta: typeof ASK_HUBLY_CTA;
  channel: ChatChannel;
  voiceReady: true;
  messages: ChatMessage[];
  routes: ChatRouteKind[];
  buildersInvoked: string[];
  toolsUsed: ChatToolUse[];
  memoriesRead: string[];
  canvas: ConversationCanvas;
  activeProject: ChatProject | null;
  projects: ChatProject[];
  proactiveStarters: ProactiveStarter[];
  coachingNote: string | null;
  /** Milestone 2 · Epic 0 — visible personality for this turn. */
  personalityExpression: PersonalityExpression | null;
  /** Milestone 2 · Epic 0 — Experience Layer message. */
  experienceMessage: ExperienceMessage | null;
  continuity: {
    resumed: boolean;
    resumeLine: string | null;
    projectName: string | null;
  };
  singlePersonality: true;
  requiresApproval: true;
  applied: false;
  executed: false;
  waitingFor: "collaboration_or_approval" | "owner_reply" | "none";
  timestamp: string;
  missionControlReplayId: string | null;
};

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function detectChatRoutes(request: string): ChatRouteKind[] {
  const r = request.toLowerCase();
  const routes: ChatRouteKind[] = [];

  if (/continue where|where we left|pick up|resume/.test(r)) routes.push("continue_project");
  if (/premium|homepage|about page|website|redesign|feel more expensive/.test(r)) {
    routes.push("business_builder");
  }
  if (/same-?day|arrival window|travel buffer|booking/.test(r)) routes.push("booking_intelligence");
  if (/jobs above|sidebar|workspace|hide revenue|pin quick|calendar.*(home|landing)/.test(r)) {
    routes.push("workspace_intelligence");
  }
  if (/prep instruction|automat|workflow|review request|membership.*month/.test(r)) {
    routes.push("automation_intelligence");
  }
  if (/photo|upload|gallery|portfolio|instagram|before.?after/.test(r)) {
    routes.push("media_intelligence");
  }
  if (/how (are we|is business|'s business)|this month|how's business|what should i work/.test(r)) {
    routes.push("coaching");
  }
  if (/what would you do|if this were your|kind of want|i hate how|customers always complain/.test(r)) {
    routes.push("coaching");
  }
  if (/tomorrow|calendar|scheduled this week|what'?s tomorrow/.test(r)) routes.push("calendar");
  if (/quote|follow-?up|haven'?t been contacted|which customers/.test(r)) routes.push("crm");
  if (/revenue|stripe/.test(r)) routes.push("revenue");
  if (/weather|reschedule friday/.test(r)) routes.push("weather");
  if (/google calendar/.test(r)) routes.push("google_calendar");
  if (/contract|document search|uploaded contracts/.test(r)) routes.push("document_search");
  if (/memberships?/.test(r) && !routes.includes("automation_intelligence")) {
    routes.push("business_builder");
  }

  if (!routes.length) routes.push("general");
  return [...new Set(routes)];
}

export function routeExternalTools(request: string): ChatToolUse[] {
  const r = request.toLowerCase();
  const tools: ChatToolUse[] = [];

  if (/weather|reschedule friday/.test(r)) {
    tools.push({
      toolId: "weather",
      label: "Weather",
      source: "external",
      why: "Owner asked about weather / outdoor scheduling.",
      resultSummary: "Tomorrow: partly cloudy, low rain risk — Friday may need exterior caution.",
    });
  }
  if (/stripe|summarize.*revenue|revenue this month/.test(r)) {
    tools.push({
      toolId: "stripe",
      label: "Stripe",
      source: "external",
      why: "Owner asked about Stripe / revenue numbers.",
      resultSummary: "Stripe summary ready (trusted integration) — figures pending live credentials in apply era.",
    });
  }
  if (/google calendar|show me my (google )?calendar/.test(r)) {
    tools.push({
      toolId: "google_calendar",
      label: "Google Calendar",
      source: "external",
      why: "Owner asked for Google Calendar.",
      resultSummary: "Calendar view proposed in Conversation Canvas.",
    });
  }
  if (/jobs? (are )?scheduled|this week|tomorrow look/.test(r)) {
    tools.push({
      toolId: "crm_jobs",
      label: "CRM / Jobs",
      source: "internal",
      why: "Owner asked about scheduled jobs.",
      resultSummary: "This week: 14 jobs scheduled across 5 days (from business systems).",
    });
  }
  if (/contract|document|search my uploaded/.test(r)) {
    tools.push({
      toolId: "document_search",
      label: "Document search",
      source: "internal",
      why: "Owner asked to search uploaded contracts/documents.",
      resultSummary: "Matched contracts indexed via Media / document intelligence.",
    });
  }
  if (/quote|follow-?up/.test(r)) {
    tools.push({
      toolId: "crm_quotes",
      label: "CRM Quotes",
      source: "internal",
      why: "Owner asked which quotes need follow-up.",
      resultSummary: "3 quotes unanswered >5 days — follow-up candidates ready.",
    });
  }
  return tools;
}

export function buildConversationCanvas(opts: {
  routes: ChatRouteKind[];
  hasPreview?: boolean;
  hasBooking?: boolean;
  hasAutomation?: boolean;
  hasMedia?: boolean;
  hasWorkspace?: boolean;
  hasCoaching?: boolean;
}): ConversationCanvas {
  const pick = (): CanvasSurfaceId => {
    if (opts.hasMedia || opts.routes.includes("media_intelligence")) return "portfolio_gallery";
    if (opts.hasBooking || opts.routes.includes("booking_intelligence")) return "booking_simulation";
    if (opts.hasAutomation || opts.routes.includes("automation_intelligence")) return "automation_flow";
    if (opts.hasWorkspace || opts.routes.includes("workspace_intelligence")) return "workspace_mockup";
    if (opts.routes.includes("calendar") || opts.routes.includes("google_calendar")) return "calendar";
    if (opts.routes.includes("revenue") || opts.routes.includes("stripe")) return "revenue_chart";
    if (opts.hasPreview || opts.routes.includes("business_builder")) return "website_preview";
    if (opts.hasCoaching || opts.routes.includes("coaching")) return "recommendations";
    return "recommendations";
  };
  const active = pick();
  const all: Array<{ id: CanvasSurfaceId; label: string; summary: string }> = [
    { id: "website_preview", label: "Website preview", summary: "Living Business Builder preview" },
    { id: "booking_simulation", label: "Booking simulation", summary: "Scheduling intelligence preview" },
    { id: "automation_flow", label: "Automation flow", summary: "Workflow graph preview" },
    { id: "portfolio_gallery", label: "Portfolio gallery", summary: "Media Intelligence canvas" },
    { id: "workspace_mockup", label: "Workspace mockup", summary: "Adaptive workspace preview" },
    { id: "revenue_chart", label: "Revenue chart", summary: "Business performance" },
    { id: "calendar", label: "Calendar", summary: "Jobs and schedule" },
    { id: "recommendations", label: "Recommendations", summary: "Proactive business ideas" },
  ];
  return {
    split: "conversation_left_canvas_right",
    conversationSide: "left",
    canvasSide: "right",
    activeSurface: active,
    surfaces: all.map((s) => ({
      ...s,
      active: s.id === active,
    })),
    note: "Conversation Canvas — talk on the left; the live business updates on the right. Never leave the chat to hunt menus.",
  };
}

export function buildProactiveStarters(opts?: {
  ownerName?: string | null;
  industry?: string | null;
}): ProactiveStarter[] {
  const name = opts?.ownerName || "there";
  return [
    {
      id: uid("ps"),
      title: `Good morning ${name}`,
      detail: "I reviewed your business. I have four ideas.",
      route: "coaching",
      why: "Proactive conversation starter — not a notification dump.",
    },
    {
      id: uid("ps"),
      title: "Optimize tomorrow's route",
      detail: "You're driving across town more than needed.",
      route: "booking_intelligence",
      why: "Booking Intelligence pattern detected.",
    },
    {
      id: uid("ps"),
      title: "Replace your homepage hero",
      detail: "Media Intelligence found stronger trust shots.",
      route: "media_intelligence",
      why: "Fresh media outscores current hero.",
    },
    {
      id: uid("ps"),
      title: "Add arrival windows",
      detail: "Customers will know when to expect you.",
      route: "booking_intelligence",
      why: "Common service-business win.",
    },
    {
      id: uid("ps"),
      title: "Follow up with three quotes",
      detail: "Silent quotes older than five days.",
      route: "crm",
      why: "CRM opportunity recovery.",
    },
  ];
}

function projectFromRequest(request: string, existing?: HublyConversationIntelligence | null): ChatProject {
  const r = request.toLowerCase();
  let name = existing?.currentProject || "General";
  if (/website|homepage|premium|about|redesign/.test(r)) name = "Website Redesign";
  else if (/booking|arrival|same-?day|route/.test(r)) name = "Booking Improvements";
  else if (/automat|prep|workflow|review request/.test(r)) name = "Operations";
  else if (/photo|gallery|instagram|portfolio|media/.test(r)) name = "Marketing";
  else if (/grow|coach|how'?s business|what should i/.test(r)) name = "Business Growth";
  else if (/membership/.test(r)) name = "Memberships";
  else if (existing?.currentProject) name = existing.currentProject;

  return {
    id: uid("proj"),
    name,
    status: "active",
    startedAt: nowIso(),
    lastActiveAt: nowIso(),
    summary: `Active project from conversation: ${name}`,
  };
}

function buildersFromRoutes(routes: ChatRouteKind[], opts: {
  builderIntent?: BuilderIntent | null;
  changePlan?: ChangePlan | null;
  creativeSession?: { label?: string } | null;
  bookingIntelligence?: { label?: string } | null;
  workspaceIntelligence?: { label?: string } | null;
  automationIntelligence?: { label?: string } | null;
  mediaIntelligence?: { label?: string } | null;
}): string[] {
  const out: string[] = [];
  if (opts.creativeSession?.label) out.push(opts.creativeSession.label);
  if (opts.bookingIntelligence?.label) out.push(opts.bookingIntelligence.label);
  if (opts.workspaceIntelligence?.label) out.push(opts.workspaceIntelligence.label);
  if (opts.automationIntelligence?.label) out.push(opts.automationIntelligence.label);
  if (opts.mediaIntelligence?.label) out.push(opts.mediaIntelligence.label);
  if (opts.builderIntent && !out.length) out.push("Builder Expert");
  if (opts.changePlan && !out.includes("Change Plan")) out.push("Change Plan");
  for (const r of routes) {
    if (r === "business_builder" && !out.some((x) => /Business/.test(x))) out.push("Business Builder");
    if (r === "booking_intelligence" && !out.some((x) => /Booking/.test(x))) out.push("Booking Intelligence Builder");
    if (r === "workspace_intelligence" && !out.some((x) => /Workspace/.test(x))) out.push("Workspace Intelligence Builder");
    if (r === "automation_intelligence" && !out.some((x) => /Automation/.test(x))) out.push("Automation Intelligence Builder");
    if (r === "media_intelligence" && !out.some((x) => /Media/.test(x))) out.push("Media Intelligence Engine");
  }
  return [...new Set(out)];
}

function hublyReply(request: string, routes: ChatRouteKind[], tools: ChatToolUse[]): string {
  const r = request.toLowerCase();
  if (/continue where|where we left|resume/.test(r)) {
    return "Picking up where we left off — I've still got the project context. What do you want to change next?";
  }
  if (/what would you do|if this were your/.test(r)) {
    return "If this were my business, I'd tighten the homepage hero, add arrival windows, and follow the quiet quotes first. Want me to show a preview of that plan?";
  }
  if (/kind of want|feel more expensive|i hate how|customers always complain|i liked something/.test(r)) {
    return "I hear you — talk to me like that. I'll translate it into a plan you can preview before anything changes.";
  }
  if (routes.includes("weather") || tools.some((t) => t.toolId === "weather")) {
    return "I checked the weather. Friday looks riskier for exterior work — want me to draft a reschedule plan?";
  }
  if (routes.includes("crm") || tools.some((t) => t.toolId === "crm_quotes")) {
    return "Three quotes are sitting quiet past five days. I can draft follow-ups — want to see them?";
  }
  if (routes.includes("media_intelligence")) {
    return "I've got the photos in Media Intelligence — organized with a multi-surface proposal ready when you are.";
  }
  if (routes.includes("business_builder") || routes.includes("coaching")) {
    return "I'm on it — one conversation, one plan. I'll show the live canvas on the right so you can see the business change while we talk.";
  }
  if (tools.length) {
    return `I used ${tools.map((t) => t.label).join(", ")} for that — you shouldn't have to care where the answer came from.`;
  }
  return "Got it. I'm your business partner here — tell me more, or I can show what I'd do next.";
}

export function buildChatOsSession(opts: {
  businessId: string;
  request: string;
  response?: string | null;
  channel?: ChatChannel;
  ownerName?: string | null;
  industry?: string | null;
  conversationIntelligence?: HublyConversationIntelligence | null;
  builderIntent?: BuilderIntent | null;
  changePlan?: ChangePlan | null;
  preview?: { id?: string } | null;
  creativeSession?: { label?: string } | null;
  bookingIntelligence?: { label?: string } | null;
  workspaceIntelligence?: { label?: string } | null;
  automationIntelligence?: { label?: string } | null;
  mediaIntelligence?: { label?: string } | null;
  memoriesLoaded?: string[];
  missionControlReplayId?: string | null;
}): ChatOsSession {
  const channel = opts.channel || "typing";
  const routes = detectChatRoutes(opts.request);
  const tools = routeExternalTools(opts.request);
  const resumed = routes.includes("continue_project") ||
    /continue where|where we left|resume/.test(opts.request.toLowerCase());
  const project = projectFromRequest(opts.request, opts.conversationIntelligence);
  const canvas = buildConversationCanvas({
    routes,
    hasPreview: !!opts.preview,
    hasBooking: !!opts.bookingIntelligence,
    hasAutomation: !!opts.automationIntelligence,
    hasMedia: !!opts.mediaIntelligence,
    hasWorkspace: !!opts.workspaceIntelligence,
    hasCoaching: routes.includes("coaching"),
  });
  const rawReply = opts.response?.trim() || hublyReply(opts.request, routes, tools);
  const experience = applyExperienceLayer({
    text: rawReply,
    request: opts.request,
    ownerName: opts.ownerName,
    celebrate: /nice work|launched|deployed|milestone/i.test(rawReply),
    transitioning: resumed,
    opening: /^(hi|hello|hey|good morning)\b/i.test(opts.request.trim()),
    correcting: /don'?t like|wrong|undo/i.test(opts.request),
  });
  const personalityExpression = experience.personality;
  const reply = experience.text;
  const starters = buildProactiveStarters({
    ownerName: opts.ownerName,
    industry: opts.industry,
  });
  const buildersInvoked = buildersFromRoutes(routes, opts);
  const memoriesRead = opts.memoriesLoaded?.length
    ? [...opts.memoriesLoaded]
    : [
      "business_memory",
      "workspace_memory",
      "conversation_intelligence",
      "business_dna",
    ];

  const knownProjects: ChatProject[] = [
    project,
    {
      id: uid("proj"),
      name: "Website Redesign",
      status: project.name === "Website Redesign" ? "active" : "paused",
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
      summary: "Persistent project — return weeks later.",
    },
    {
      id: uid("proj"),
      name: "Business Growth",
      status: project.name === "Business Growth" ? "active" : "paused",
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
      summary: "Coaching and growth thread.",
    },
    {
      id: uid("proj"),
      name: "Booking Improvements",
      status: project.name === "Booking Improvements" ? "active" : "paused",
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
      summary: "Scheduling intelligence thread.",
    },
    {
      id: uid("proj"),
      name: "Marketing",
      status: project.name === "Marketing" ? "active" : "paused",
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
      summary: "Media and social thread.",
    },
    {
      id: uid("proj"),
      name: "Operations",
      status: project.name === "Operations" ? "active" : "paused",
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
      summary: "Automations and ops thread.",
    },
  ];

  return {
    id: uid("chatos"),
    version: CHAT_OS_VERSION,
    label: CHAT_OS_LABEL,
    businessId: opts.businessId,
    personality: CHAT_OS_PERSONALITY,
    askHublyCta: ASK_HUBLY_CTA,
    channel,
    voiceReady: true,
    messages: [
      {
        id: uid("msg"),
        role: "owner",
        text: opts.request,
        at: nowIso(),
        channel,
      },
      {
        id: uid("msg"),
        role: "hubly",
        text: reply,
        at: nowIso(),
        channel,
      },
    ],
    routes,
    buildersInvoked,
    toolsUsed: tools,
    memoriesRead,
    canvas,
    activeProject: project,
    projects: knownProjects,
    proactiveStarters: starters,
    coachingNote: routes.includes("coaching")
      ? "Business coaching is in the same conversation — not a separate coach bot."
      : null,
    personalityExpression,
    experienceMessage: experience.message,
    continuity: {
      resumed,
      resumeLine: resumed
        ? (opts.conversationIntelligence?.currentProject
          ? `Continuing: ${opts.conversationIntelligence.currentProject}`
          : "Continuing your active project.")
        : null,
      projectName: project.name,
    },
    singlePersonality: true,
    requiresApproval: true,
    applied: false,
    executed: false,
    waitingFor: opts.changePlan ? "collaboration_or_approval" : "owner_reply",
    timestamp: nowIso(),
    missionControlReplayId: opts.missionControlReplayId ?? null,
  };
}

/** Voice-ready: same session builder for every channel. */
export function buildChatOsForChannel(
  channel: ChatChannel,
  opts: Omit<Parameters<typeof buildChatOsSession>[0], "channel">,
): ChatOsSession {
  return buildChatOsSession({ ...opts, channel });
}

export const HublyChatOs = {
  version: CHAT_OS_VERSION,
  owner: CHAT_OS_OWNER,
  label: CHAT_OS_LABEL,
  askHublyCta: ASK_HUBLY_CTA,
  personality: CHAT_OS_PERSONALITY,
  build: buildChatOsSession,
  forChannel: buildChatOsForChannel,
  detectRoutes: detectChatRoutes,
  routeTools: routeExternalTools,
  canvas: buildConversationCanvas,
  proactive: buildProactiveStarters,
};
