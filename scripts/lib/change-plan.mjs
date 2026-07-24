/** Node mirror of hubly_brain_change_plan.ts — Milestone 1.5 Epic 2 (esbuild). */


// supabase/functions/_shared/hubly_brain_change_plan.ts
var CHANGE_PLAN_VERSION = "1.0.0";
var CHANGE_PLAN_OWNER = "hubly_brain";
var SUPPORTED_BUILDERS = /* @__PURE__ */ new Set([
  "website_builder",
  "booking",
  "crm",
  "workspace_builder",
  "portfolio_builder",
  "packages_builder",
  "automation",
  "marketplace",
  "multi"
]);
var SYSTEM_TO_BUILDER = {
  Website: { type: "website_builder", owner: "Website Builder" },
  Branding: { type: "website_builder", owner: "Website Builder" },
  Booking: { type: "booking", owner: "Booking Builder" },
  CRM: { type: "crm", owner: "CRM Builder" },
  Workspace: { type: "workspace_builder", owner: "Workspace Builder" },
  Portfolio: { type: "portfolio_builder", owner: "Portfolio Builder" },
  Packages: { type: "packages_builder", owner: "Packages Builder" },
  Automations: { type: "automation", owner: "Automation Builder" },
  Marketplace: { type: "marketplace", owner: "Marketplace Builder" },
  Integrations: { type: "booking", owner: "Booking Builder" },
  Business: { type: "website_builder", owner: "Website Builder" }
};
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}
function draftActionsFromIntent(intent) {
  const desiredState = {};
  const actions = [];
  const req = intent.originalRequest.toLowerCase();
  const systems = new Set(intent.affectedSystems);
  const push = (a) => {
    actions.push(a);
    setPath(desiredState, a.path, a.desired);
  };
  if (systems.has("Website") || systems.has("Branding") || /premium|luxury|homepage|website/.test(req)) {
    if (/premium|luxury|brand/.test(req)) {
      push({
        builderOwner: "Website Builder",
        builderType: "website_builder",
        system: "Website",
        path: "website.premium_feel",
        desired: true,
        reason: "Owner asked for a more premium website feel.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: {
          trustPct: 12,
          conversionPct: 4,
          complexity: "low",
          summary: "Premium branding cues tend to lift trust and conversion modestly."
        },
        confidence: Math.max(80, intent.confidence - 2),
        capabilityId: "update_homepage"
      });
      push({
        builderOwner: "Website Builder",
        builderType: "website_builder",
        system: "Website",
        path: "website.hero.headline_tone",
        desired: "premium",
        reason: "Premium feel usually starts with hero headline tone.",
        risk: "low",
        dependencies: ["website.premium_feel"],
        estimatedImpact: {
          trustPct: 8,
          conversionPct: 3,
          complexity: "low",
          summary: "Clearer premium positioning on first impression."
        },
        confidence: Math.max(78, intent.confidence - 4),
        capabilityId: "update_hero"
      });
    }
    if (/faq/.test(req)) {
      push({
        builderOwner: "Website Builder",
        builderType: "website_builder",
        system: "Website",
        path: "website.faq.enabled",
        desired: true,
        reason: "Owner wants FAQ content on the site.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { trustPct: 6, complexity: "low", summary: "FAQ reduces common objections." },
        confidence: 85,
        capabilityId: "add_sections"
      });
    }
    if (/explain.*(arrival|window)|website to explain|update my website/.test(req)) {
      push({
        builderOwner: "Website Builder",
        builderType: "website_builder",
        system: "Website",
        path: "website.explain_arrival_windows",
        desired: true,
        reason: "Website should explain arrival windows so customers know what to expect.",
        risk: "low",
        dependencies: ["booking.arrival_window.enabled"],
        estimatedImpact: {
          trustPct: 10,
          conversionPct: 3,
          complexity: "low",
          summary: "Explaining arrival windows reduces confusion and no-shows."
        },
        confidence: Math.max(82, intent.confidence - 3),
        capabilityId: "update_homepage"
      });
    }
  }
  if (systems.has("Booking") || /same-?day|arrival window|minimum notice/.test(req)) {
    if (/same-?day|no same.?day|minimum notice/.test(req)) {
      push({
        builderOwner: "Booking Builder",
        builderType: "booking",
        system: "Booking",
        path: "booking.same_day_bookings.allowed",
        desired: false,
        reason: "Owner does not want same-day bookings.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: {
          schedulingFlexibility: "medium",
          complexity: "low",
          summary: "Protects schedule; slightly less last-minute flexibility."
        },
        confidence: Math.max(88, intent.confidence - 1),
        capabilityId: "no_same_day_bookings"
      });
      push({
        builderOwner: "Booking Builder",
        builderType: "booking",
        system: "Booking",
        path: "booking.minimum_notice.hours",
        desired: 24,
        reason: "Minimum notice of 24 hours enforces no same-day bookings.",
        risk: "medium",
        dependencies: ["booking.same_day_bookings.allowed"],
        estimatedImpact: {
          schedulingFlexibility: "high",
          complexity: "low",
          summary: "24h notice improves prep time and route planning."
        },
        confidence: Math.max(86, intent.confidence - 2),
        capabilityId: "booking_rules"
      });
    }
    if (/arrival window|arrival windows/.test(req)) {
      push({
        builderOwner: "Booking Builder",
        builderType: "booking",
        system: "Booking",
        path: "booking.arrival_window",
        desired: { enabled: true, before_minutes: 60, after_minutes: 60 },
        reason: "Owner wants appointment arrival windows.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: {
          trustPct: 9,
          schedulingFlexibility: "high",
          complexity: "low",
          summary: "Arrival windows set clear expectations for customers."
        },
        confidence: Math.max(90, intent.confidence),
        capabilityId: "arrival_windows"
      });
    }
  }
  if (systems.has("Workspace") || /jobs above|sidebar|move /.test(req)) {
    push({
      builderOwner: "Workspace Builder",
      builderType: "workspace_builder",
      system: "Workspace",
      path: "workspace.sidebar_order",
      desired: ["Jobs", "Customers"],
      reason: "Owner wants Jobs above Customers in navigation.",
      risk: "low",
      dependencies: [],
      estimatedImpact: {
        complexity: "low",
        summary: "Navigation matches how the owner works day to day."
      },
      confidence: Math.max(92, intent.confidence),
      capabilityId: "sidebar_order"
    });
  }
  if (systems.has("CRM") && !systems.has("Workspace")) {
    if (/hide/.test(req)) {
      push({
        builderOwner: "CRM Builder",
        builderType: "crm",
        system: "CRM",
        path: "crm.modules.hide",
        desired: ["unused"],
        reason: "Owner wants to hide a CRM module.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "low", summary: "Less clutter in CRM." },
        confidence: 80,
        capabilityId: "update_customer"
      });
    }
    if (/pin/.test(req)) {
      push({
        builderOwner: "CRM Builder",
        builderType: "crm",
        system: "CRM",
        path: "crm.widgets.pin",
        desired: ["priority"],
        reason: "Owner wants a CRM widget pinned.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "low", summary: "Faster access to pinned work." },
        confidence: 80,
        capabilityId: "update_customer"
      });
    }
  }
  if (systems.has("Portfolio") || /portfolio|photos|gallery/.test(req)) {
    push({
      builderOwner: "Portfolio Builder",
      builderType: "portfolio_builder",
      system: "Portfolio",
      path: "portfolio.gallery.organize",
      desired: true,
      reason: "Owner wants portfolio photos organized in the gallery.",
      risk: "low",
      dependencies: [],
      estimatedImpact: {
        trustPct: 11,
        conversionPct: 5,
        complexity: "medium",
        summary: "Organized gallery strengthens proof of work."
      },
      confidence: Math.max(84, intent.confidence - 2),
      capabilityId: "upload_photos"
    });
    if (/hero|caption/.test(req) || /12 photos|photos/.test(req)) {
      push({
        builderOwner: "Portfolio Builder",
        builderType: "portfolio_builder",
        system: "Portfolio",
        path: "portfolio.hero_images.select",
        desired: true,
        reason: "Choose hero images among uploaded portfolio photos.",
        risk: "low",
        dependencies: ["portfolio.gallery.organize"],
        estimatedImpact: { trustPct: 7, conversionPct: 3, complexity: "low", summary: "Stronger first impression." },
        confidence: 82,
        capabilityId: "manage_gallery"
      });
      push({
        builderOwner: "Portfolio Builder",
        builderType: "portfolio_builder",
        system: "Portfolio",
        path: "portfolio.captions.generate",
        desired: true,
        reason: "Generate captions for portfolio images.",
        risk: "low",
        dependencies: ["portfolio.gallery.organize"],
        estimatedImpact: { trustPct: 5, complexity: "low", summary: "Captions add context for visitors." },
        confidence: 78,
        capabilityId: "manage_gallery"
      });
    }
  }
  if (systems.has("Automations") || /prep instruction|automation|workflow|reminder/.test(req)) {
    push({
      builderOwner: "Automation Builder",
      builderType: "automation",
      system: "Automations",
      path: "automations.workflows",
      desired: [
        {
          id: "prep_after_ceramic",
          trigger: "booking.completed.service:ceramic_coating",
          steps: [
            { type: "createWorkflow", config: { name: "Ceramic coating prep" } },
            { type: "sendEmail", config: { template: "prep_instructions" } },
            { type: "wait", config: { hours: 0 } },
            { type: "sendReminder", config: { channel: "email" } }
          ]
        }
      ],
      reason: "Send prep instructions after ceramic coating bookings.",
      risk: "medium",
      dependencies: [],
      estimatedImpact: {
        trustPct: 10,
        complexity: "medium",
        summary: "Automated prep instructions reduce day-of questions."
      },
      confidence: Math.max(85, intent.confidence - 3),
      capabilityId: "create_workflow"
    });
  }
  if (systems.has("Packages") || /package|membership|pricing tier/.test(req)) {
    push({
      builderOwner: "Packages Builder",
      builderType: "packages_builder",
      system: "Packages",
      path: "packages.tiers",
      desired: [{ name: "Membership", enabled: true }],
      reason: "Owner wants package / pricing tier changes.",
      risk: "medium",
      dependencies: [],
      estimatedImpact: { conversionPct: 4, complexity: "medium", summary: "Clearer offers for customers." },
      confidence: 80,
      capabilityId: "package_create"
    });
  }
  if (!actions.length) {
    for (const cap of intent.requiredCapabilities.slice(0, 3)) {
      const meta = SYSTEM_TO_BUILDER[TOOL_SYSTEM(cap.toolId)] || SYSTEM_TO_BUILDER.Website;
      const path = `${meta.type.replace(/_builder$/, "").replace("booking", "booking")}.capability.${cap.capabilityId}`;
      push({
        builderOwner: meta.owner,
        builderType: meta.type,
        system: TOOL_SYSTEM(cap.toolId) || "Business",
        path: path.includes(".") ? path : `website.capability.${cap.capabilityId}`,
        desired: true,
        reason: `Capability ${cap.capabilityLabel} required by Builder Intent.`,
        risk: intent.estimatedRisk,
        dependencies: [],
        estimatedImpact: { complexity: "medium", summary: `Plan includes ${cap.capabilityLabel}.` },
        confidence: intent.confidence,
        capabilityId: cap.capabilityId
      });
    }
  }
  return { desiredState, actions };
}
function TOOL_SYSTEM(toolId) {
  const map = {
    website_builder: "Website",
    booking: "Booking",
    crm: "CRM",
    workspace_builder: "Workspace",
    portfolio_builder: "Portfolio",
    packages_builder: "Packages",
    automation: "Automations",
    marketplace: "Marketplace",
    image_processor: "Portfolio"
  };
  return map[toolId] || "Business";
}
function validateChangePlan(plan) {
  const issues = [];
  const paths = /* @__PURE__ */ new Set();
  let noDuplicates = true;
  let noConflicts = true;
  let validCapabilities = true;
  let supportedBuilders = true;
  const validPermissions = true;
  for (const a of plan.changes) {
    if (paths.has(a.path)) {
      noDuplicates = false;
      issues.push(`Duplicate action path: ${a.path}`);
    }
    paths.add(a.path);
    if (!SUPPORTED_BUILDERS.has(a.builderType)) {
      supportedBuilders = false;
      issues.push(`Unsupported builder: ${a.builderType}`);
    }
    if (!a.builderOwner) {
      issues.push(`Action ${a.path} missing builder owner`);
      validCapabilities = false;
    }
    if (a.capabilityId === void 0) {
      validCapabilities = false;
      issues.push(`Action ${a.path} missing capability`);
    }
  }
  const sameDay = plan.changes.find((c) => c.path === "booking.same_day_bookings.allowed");
  if (sameDay && sameDay.desired === true) {
    const notice = plan.changes.find((c) => c.path === "booking.minimum_notice.hours");
    if (notice) {
      noConflicts = false;
      issues.push("Conflict: same-day allowed with minimum notice");
    }
  }
  const blob = JSON.stringify(plan.desiredState);
  if (/\b(SELECT|INSERT|UPDATE|DELETE)\s+|useEffect|setState|fetch\(/i.test(blob)) {
    issues.push("Desired state must stay declarative \u2014 no SQL/React/API payloads");
    noConflicts = false;
  }
  const ok = issues.length === 0 && noDuplicates && noConflicts && validCapabilities && supportedBuilders && plan.changes.length > 0;
  return {
    ok,
    issues,
    checked: {
      noConflicts,
      noDuplicates,
      validCapabilities,
      validPermissions,
      supportedBuilders
    }
  };
}
function aggregateImpact(actions) {
  const trust = actions.reduce((s, a) => s + (a.estimatedImpact.trustPct || 0), 0);
  const conv = actions.reduce((s, a) => s + (a.estimatedImpact.conversionPct || 0), 0);
  const flex = actions.map((a) => a.estimatedImpact.schedulingFlexibility).find(Boolean) || null;
  const complexity = actions.some((a) => a.estimatedImpact.complexity === "high") ? "high" : actions.some((a) => a.estimatedImpact.complexity === "medium") ? "medium" : "low";
  return {
    trustPct: trust || null,
    conversionPct: conv || null,
    schedulingFlexibility: flex,
    complexity,
    summary: actions.map((a) => a.estimatedImpact.summary).filter(Boolean).slice(0, 3).join(" ")
  };
}
function maxRisk(actions) {
  if (actions.some((a) => a.risk === "high")) return "high";
  if (actions.some((a) => a.risk === "medium")) return "medium";
  return "low";
}
function generateChangePlan(intent, opts = {}) {
  const { desiredState, actions: drafts } = draftActionsFromIntent(intent);
  const replayId = opts.missionControlReplayId ?? null;
  const changes = drafts.map((d) => ({
    ...d,
    actionId: uid("act"),
    missionControlReplayId: replayId
  }));
  const builders = [...new Set(changes.map((c) => c.builderType))];
  const builderType = builders.length > 1 ? "multi" : builders[0] || "multi";
  const impact = aggregateImpact(drafts);
  const risk = maxRisk(drafts);
  const confidence = clamp(
    changes.length ? changes.reduce((s, c) => s + c.confidence, 0) / changes.length : intent.confidence
  );
  const deps = [...new Set(changes.flatMap((c) => c.dependencies))];
  const draftPlan = {
    id: uid("cpl"),
    version: CHANGE_PLAN_VERSION,
    builderType,
    intentId: intent.intentId,
    title: intent.intentLabel,
    description: `Declarative Change Plan for: ${intent.ownerGoal}`,
    affectedSystems: [...intent.affectedSystems],
    requiredCapabilities: [...intent.requiredCapabilities],
    desiredState,
    changes,
    dependencies: deps,
    risk,
    confidence,
    requiresApproval: true,
    estimatedImpact: impact,
    rollbackStrategy: {
      mode: "restore_previous_desired_state",
      note: "Epic 5 will restore the prior desired-state snapshot. Epic 2 only describes desired state."
    },
    reasoning: [
      {
        reason: "Change Plan Engine mapped Builder Intent into declarative desired state (not procedural steps).",
        evidence: [
          `intent:${intent.intentId}`,
          `category:${intent.intentCategory}`,
          ...changes.map((c) => `path:${c.path}`)
        ],
        confidence
      },
      ...intent.reasoning
    ],
    status: "draft",
    applied: false,
    executed: false,
    previewGenerated: false,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    originalRequest: intent.originalRequest
  };
  const validation = validateChangePlan(draftPlan);
  const changePlan = { ...draftPlan, validation };
  return { changePlan, fromIntentId: intent.intentId };
}
var HublyChangePlanEngine = {
  version: CHANGE_PLAN_VERSION,
  owner: CHANGE_PLAN_OWNER,
  generate: generateChangePlan,
  validate: validateChangePlan
};
export {
  CHANGE_PLAN_OWNER,
  CHANGE_PLAN_VERSION,
  HublyChangePlanEngine,
  generateChangePlan,
  validateChangePlan
};
