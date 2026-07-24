/** Node mirror of hubly_brain_chat_os.ts — Milestone 1.5 Epic 11 (esbuild). */


// supabase/functions/_shared/hubly_brain_chat_os.ts
import {
  applyPersonalityExpression
} from "./personality.mjs";
var CHAT_OS_VERSION = "1.0.0";
var CHAT_OS_OWNER = "hubly_brain";
var CHAT_OS_LABEL = "Hubly Chat OS";
var ASK_HUBLY_CTA = "Ask Hubly";
var CHAT_OS_PERSONALITY = {
  id: "hubly",
  name: "Hubly",
  role: "business_partner",
  separateAIs: false,
  note: "There is only one AI \u2014 Hubly. Not Website AI, Booking AI, CRM AI, etc."
};
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function detectChatRoutes(request) {
  const r = request.toLowerCase();
  const routes = [];
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
function routeExternalTools(request) {
  const r = request.toLowerCase();
  const tools = [];
  if (/weather|reschedule friday/.test(r)) {
    tools.push({
      toolId: "weather",
      label: "Weather",
      source: "external",
      why: "Owner asked about weather / outdoor scheduling.",
      resultSummary: "Tomorrow: partly cloudy, low rain risk \u2014 Friday may need exterior caution."
    });
  }
  if (/stripe|summarize.*revenue|revenue this month/.test(r)) {
    tools.push({
      toolId: "stripe",
      label: "Stripe",
      source: "external",
      why: "Owner asked about Stripe / revenue numbers.",
      resultSummary: "Stripe summary ready (trusted integration) \u2014 figures pending live credentials in apply era."
    });
  }
  if (/google calendar|show me my (google )?calendar/.test(r)) {
    tools.push({
      toolId: "google_calendar",
      label: "Google Calendar",
      source: "external",
      why: "Owner asked for Google Calendar.",
      resultSummary: "Calendar view proposed in Conversation Canvas."
    });
  }
  if (/jobs? (are )?scheduled|this week|tomorrow look/.test(r)) {
    tools.push({
      toolId: "crm_jobs",
      label: "CRM / Jobs",
      source: "internal",
      why: "Owner asked about scheduled jobs.",
      resultSummary: "This week: 14 jobs scheduled across 5 days (from business systems)."
    });
  }
  if (/contract|document|search my uploaded/.test(r)) {
    tools.push({
      toolId: "document_search",
      label: "Document search",
      source: "internal",
      why: "Owner asked to search uploaded contracts/documents.",
      resultSummary: "Matched contracts indexed via Media / document intelligence."
    });
  }
  if (/quote|follow-?up/.test(r)) {
    tools.push({
      toolId: "crm_quotes",
      label: "CRM Quotes",
      source: "internal",
      why: "Owner asked which quotes need follow-up.",
      resultSummary: "3 quotes unanswered >5 days \u2014 follow-up candidates ready."
    });
  }
  return tools;
}
function buildConversationCanvas(opts) {
  const pick = () => {
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
  const all = [
    { id: "website_preview", label: "Website preview", summary: "Living Business Builder preview" },
    { id: "booking_simulation", label: "Booking simulation", summary: "Scheduling intelligence preview" },
    { id: "automation_flow", label: "Automation flow", summary: "Workflow graph preview" },
    { id: "portfolio_gallery", label: "Portfolio gallery", summary: "Media Intelligence canvas" },
    { id: "workspace_mockup", label: "Workspace mockup", summary: "Adaptive workspace preview" },
    { id: "revenue_chart", label: "Revenue chart", summary: "Business performance" },
    { id: "calendar", label: "Calendar", summary: "Jobs and schedule" },
    { id: "recommendations", label: "Recommendations", summary: "Proactive business ideas" }
  ];
  return {
    split: "conversation_left_canvas_right",
    conversationSide: "left",
    canvasSide: "right",
    activeSurface: active,
    surfaces: all.map((s) => ({
      ...s,
      active: s.id === active
    })),
    note: "Conversation Canvas \u2014 talk on the left; the live business updates on the right. Never leave the chat to hunt menus."
  };
}
function buildProactiveStarters(opts) {
  const name = opts?.ownerName || "there";
  return [
    {
      id: uid("ps"),
      title: `Good morning ${name}`,
      detail: "I reviewed your business. I have four ideas.",
      route: "coaching",
      why: "Proactive conversation starter \u2014 not a notification dump."
    },
    {
      id: uid("ps"),
      title: "Optimize tomorrow's route",
      detail: "You're driving across town more than needed.",
      route: "booking_intelligence",
      why: "Booking Intelligence pattern detected."
    },
    {
      id: uid("ps"),
      title: "Replace your homepage hero",
      detail: "Media Intelligence found stronger trust shots.",
      route: "media_intelligence",
      why: "Fresh media outscores current hero."
    },
    {
      id: uid("ps"),
      title: "Add arrival windows",
      detail: "Customers will know when to expect you.",
      route: "booking_intelligence",
      why: "Common service-business win."
    },
    {
      id: uid("ps"),
      title: "Follow up with three quotes",
      detail: "Silent quotes older than five days.",
      route: "crm",
      why: "CRM opportunity recovery."
    }
  ];
}
function projectFromRequest(request, existing) {
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
    summary: `Active project from conversation: ${name}`
  };
}
function buildersFromRoutes(routes, opts) {
  const out = [];
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
function hublyReply(request, routes, tools) {
  const r = request.toLowerCase();
  if (/continue where|where we left|resume/.test(r)) {
    return "Picking up where we left off \u2014 I've still got the project context. What do you want to change next?";
  }
  if (/what would you do|if this were your/.test(r)) {
    return "If this were my business, I'd tighten the homepage hero, add arrival windows, and follow the quiet quotes first. Want me to show a preview of that plan?";
  }
  if (/kind of want|feel more expensive|i hate how|customers always complain|i liked something/.test(r)) {
    return "I hear you \u2014 talk to me like that. I'll translate it into a plan you can preview before anything changes.";
  }
  if (routes.includes("weather") || tools.some((t) => t.toolId === "weather")) {
    return "I checked the weather. Friday looks riskier for exterior work \u2014 want me to draft a reschedule plan?";
  }
  if (routes.includes("crm") || tools.some((t) => t.toolId === "crm_quotes")) {
    return "Three quotes are sitting quiet past five days. I can draft follow-ups \u2014 want to see them?";
  }
  if (routes.includes("media_intelligence")) {
    return "I've got the photos in Media Intelligence \u2014 organized with a multi-surface proposal ready when you are.";
  }
  if (routes.includes("business_builder") || routes.includes("coaching")) {
    return "I'm on it \u2014 one conversation, one plan. I'll show the live canvas on the right so you can see the business change while we talk.";
  }
  if (tools.length) {
    return `I used ${tools.map((t) => t.label).join(", ")} for that \u2014 you shouldn't have to care where the answer came from.`;
  }
  return "Got it. I'm your business partner here \u2014 tell me more, or I can show what I'd do next.";
}
function buildChatOsSession(opts) {
  const channel = opts.channel || "typing";
  const routes = detectChatRoutes(opts.request);
  const tools = routeExternalTools(opts.request);
  const resumed = routes.includes("continue_project") || /continue where|where we left|resume/.test(opts.request.toLowerCase());
  const project = projectFromRequest(opts.request, opts.conversationIntelligence);
  const canvas = buildConversationCanvas({
    routes,
    hasPreview: !!opts.preview,
    hasBooking: !!opts.bookingIntelligence,
    hasAutomation: !!opts.automationIntelligence,
    hasMedia: !!opts.mediaIntelligence,
    hasWorkspace: !!opts.workspaceIntelligence,
    hasCoaching: routes.includes("coaching")
  });
  const rawReply = opts.response?.trim() || hublyReply(opts.request, routes, tools);
  const personalityExpression = applyPersonalityExpression({
    text: rawReply,
    request: opts.request,
    ownerName: opts.ownerName,
    topic: opts.conversationIntelligence?.currentProject || null,
    celebrate: /nice work|launched|deployed|milestone/i.test(rawReply),
    transitioning: resumed,
    opening: /^(hi|hello|hey)\b/i.test(opts.request.trim()),
    correcting: /don'?t like|wrong|undo/i.test(opts.request)
  });
  const reply = personalityExpression.text;
  const starters = buildProactiveStarters({
    ownerName: opts.ownerName,
    industry: opts.industry
  });
  const buildersInvoked = buildersFromRoutes(routes, opts);
  const memoriesRead = opts.memoriesLoaded?.length ? [...opts.memoriesLoaded] : [
    "business_memory",
    "workspace_memory",
    "conversation_intelligence",
    "business_dna"
  ];
  const knownProjects = [
    project,
    {
      id: uid("proj"),
      name: "Website Redesign",
      status: project.name === "Website Redesign" ? "active" : "paused",
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
      summary: "Persistent project \u2014 return weeks later."
    },
    {
      id: uid("proj"),
      name: "Business Growth",
      status: project.name === "Business Growth" ? "active" : "paused",
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
      summary: "Coaching and growth thread."
    },
    {
      id: uid("proj"),
      name: "Booking Improvements",
      status: project.name === "Booking Improvements" ? "active" : "paused",
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
      summary: "Scheduling intelligence thread."
    },
    {
      id: uid("proj"),
      name: "Marketing",
      status: project.name === "Marketing" ? "active" : "paused",
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
      summary: "Media and social thread."
    },
    {
      id: uid("proj"),
      name: "Operations",
      status: project.name === "Operations" ? "active" : "paused",
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
      summary: "Automations and ops thread."
    }
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
        channel
      },
      {
        id: uid("msg"),
        role: "hubly",
        text: reply,
        at: nowIso(),
        channel
      }
    ],
    routes,
    buildersInvoked,
    toolsUsed: tools,
    memoriesRead,
    canvas,
    activeProject: project,
    projects: knownProjects,
    proactiveStarters: starters,
    coachingNote: routes.includes("coaching") ? "Business coaching is in the same conversation \u2014 not a separate coach bot." : null,
    personalityExpression,
    continuity: {
      resumed,
      resumeLine: resumed ? opts.conversationIntelligence?.currentProject ? `Continuing: ${opts.conversationIntelligence.currentProject}` : "Continuing your active project." : null,
      projectName: project.name
    },
    singlePersonality: true,
    requiresApproval: true,
    applied: false,
    executed: false,
    waitingFor: opts.changePlan ? "collaboration_or_approval" : "owner_reply",
    timestamp: nowIso(),
    missionControlReplayId: opts.missionControlReplayId ?? null
  };
}
function buildChatOsForChannel(channel, opts) {
  return buildChatOsSession({ ...opts, channel });
}
var HublyChatOs = {
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
  proactive: buildProactiveStarters
};
export {
  ASK_HUBLY_CTA,
  CHAT_OS_LABEL,
  CHAT_OS_OWNER,
  CHAT_OS_PERSONALITY,
  CHAT_OS_VERSION,
  HublyChatOs,
  buildChatOsForChannel,
  buildChatOsSession,
  buildConversationCanvas,
  buildProactiveStarters,
  detectChatRoutes,
  routeExternalTools
};
