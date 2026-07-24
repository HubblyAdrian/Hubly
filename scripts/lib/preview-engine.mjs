/** Node mirror of hubly_brain_preview_engine.ts — Milestone 1.5 Epic 3 (esbuild). */


// supabase/functions/_shared/hubly_brain_preview_engine.ts
var PREVIEW_ENGINE_VERSION = "1.0.0";
var PREVIEW_ENGINE_OWNER = "hubly_brain";
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function surfaceFromSystem(system) {
  const s = String(system || "").toLowerCase();
  if (s.includes("website") || s.includes("brand")) return "website";
  if (s.includes("book")) return "booking";
  if (s.includes("crm")) return "crm";
  if (s.includes("work")) return "workspace";
  if (s.includes("port")) return "portfolio";
  if (s.includes("auto")) return "automations";
  if (s.includes("pack")) return "packages";
  return "multi";
}
function surfaceFromBuilderType(t) {
  switch (t) {
    case "website_builder":
      return "website";
    case "booking":
      return "booking";
    case "crm":
      return "crm";
    case "workspace_builder":
      return "workspace";
    case "portfolio_builder":
      return "portfolio";
    case "packages_builder":
      return "packages";
    case "automation":
      return "automations";
    case "multi":
      return "multi";
    default:
      return "multi";
  }
}
function compareModeFor(surface) {
  if (surface === "website" || surface === "portfolio") return "slider";
  if (surface === "automations") return "diff";
  if (surface === "booking" || surface === "crm" || surface === "workspace" || surface === "packages") {
    return "side_by_side";
  }
  return "before_after";
}
function defaultBeforeForPath(path) {
  if (path.includes("premium_feel")) return false;
  if (path.includes("headline_tone")) return "clear";
  if (path.includes("same_day")) return { allowed: true };
  if (path.includes("minimum_notice")) return { hours: 0 };
  if (path.includes("arrival_window")) {
    return { enabled: false, before_minutes: 0, after_minutes: 0 };
  }
  if (path.includes("sidebar_order")) return ["Customers", "Jobs", "Calendar"];
  if (path.includes("crm.modules.hide")) return [];
  if (path.includes("crm.widgets.pin")) return [];
  if (path.includes("gallery.organize")) return false;
  if (path.includes("hero_images")) return false;
  if (path.includes("captions")) return false;
  if (path.includes("workflows")) return [];
  if (path.includes("explain_arrival")) return false;
  if (path.includes("faq")) return { enabled: false };
  return null;
}
function humanBeforeLabel(path, before) {
  if (path.startsWith("booking.")) {
    return {
      appointments: "Fixed 2:00 PM slots",
      sameDay: "Allowed",
      minimumNotice: "None",
      arrivalWindow: "Off",
      snapshot: before
    };
  }
  if (path.startsWith("website.")) {
    return {
      hero: "Default headline",
      feel: "Standard",
      sections: ["Services", "Pricing", "Reviews"],
      snapshot: before
    };
  }
  if (path.startsWith("workspace.") || path.startsWith("crm.")) {
    return {
      sidebar: ["Customers", "Jobs", "Calendar"],
      modules: "All visible",
      snapshot: before
    };
  }
  if (path.startsWith("portfolio.")) {
    return {
      gallery: "Unsorted uploads",
      hero: "First photo",
      captions: "Missing",
      snapshot: before
    };
  }
  if (path.startsWith("automations.")) {
    return {
      workflow: "None",
      steps: [],
      snapshot: before
    };
  }
  if (path.startsWith("packages.")) {
    return {
      packages: ["Basic", "Standard"],
      snapshot: before
    };
  }
  return { snapshot: before };
}
function humanAfterLabel(path, desired, action) {
  if (path.startsWith("booking.arrival_window") || path.includes("arrival_window")) {
    const aw = desired;
    return {
      appointments: "Arrival window",
      window: `${aw?.before_minutes ?? 60}\u2013${aw?.after_minutes ?? 60} min around start`,
      example: "1:00 PM \u2013 3:00 PM",
      snapshot: desired
    };
  }
  if (path.includes("same_day")) {
    return {
      sameDay: "Disabled",
      note: "No same-day booking",
      snapshot: desired
    };
  }
  if (path.includes("minimum_notice")) {
    const h = desired?.hours ?? desired;
    return {
      minimumNotice: `${h} Hours`,
      snapshot: desired
    };
  }
  if (path.startsWith("website.")) {
    return {
      hero: action.path.includes("headline") ? "Premium headline tone" : "Refined hero",
      feel: "Premium",
      sections: ["Hero", "Proof", "Services", "Booking"],
      colors: "Deeper contrast",
      typography: "Stronger hierarchy",
      snapshot: desired
    };
  }
  if (path.includes("sidebar_order")) {
    return {
      sidebar: desired,
      animation: "Drag highlight Jobs above Customers",
      snapshot: desired
    };
  }
  if (path.startsWith("crm.")) {
    return {
      sidebar: "Updated CRM chrome",
      modules: desired,
      snapshot: desired
    };
  }
  if (path.startsWith("portfolio.")) {
    return {
      gallery: "Organized categories",
      hero: "Selected hero images",
      captions: "Generated captions",
      order: "Story-first",
      snapshot: desired
    };
  }
  if (path.startsWith("automations.")) {
    const flows = Array.isArray(desired) ? desired : [desired];
    const first = flows[0];
    return {
      workflow: "Booked \u2192 Prep Email \u2192 Wait \u2192 Reminder",
      steps: first?.steps || [{ type: "send_prep_email" }, { type: "wait" }, { type: "reminder" }],
      snapshot: desired
    };
  }
  if (path.startsWith("packages.")) {
    return {
      packages: desired,
      highlights: ["Added", "Renamed", "Repriced"],
      snapshot: desired
    };
  }
  return { snapshot: desired, path };
}
function whyForAction(action) {
  if (action.reason && action.reason.trim()) return action.reason;
  if (action.path.includes("premium") || action.path.includes("headline")) {
    return "I moved proof and premium cues higher because homeowners usually look for trust before pricing.";
  }
  if (action.path.includes("arrival_window")) {
    return "Arrival windows reduce missed jobs and set clearer expectations than a single clock time.";
  }
  if (action.path.includes("same_day") || action.path.includes("minimum_notice")) {
    return "Buffer time protects your day so last-minute bookings don\u2019t crowd real work.";
  }
  if (action.path.includes("sidebar") || action.path.includes("Jobs")) {
    return "Jobs above Customers puts today\u2019s work first \u2014 the screen matches how you actually operate.";
  }
  if (action.path.includes("portfolio") || action.path.includes("gallery")) {
    return "Organized galleries help homeowners imagine the finish before they book.";
  }
  if (action.path.includes("workflow") || action.path.includes("automations")) {
    return "Prep instructions after booking cut day-of confusion and no-shows.";
  }
  return `Proposed by ${action.builderOwner} to reach the desired state at ${action.path}.`;
}
function buildExplain(action) {
  const before = defaultBeforeForPath(action.path);
  return {
    actionId: action.actionId,
    path: action.path,
    builderOwner: action.builderOwner,
    builderType: action.builderType,
    why: whyForAction(action),
    expectedImpact: action.estimatedImpact,
    risk: action.risk,
    before,
    after: action.desired
  };
}
function groupActionsBySurface(plan) {
  const map = /* @__PURE__ */ new Map();
  for (const action of plan.changes) {
    const surface = surfaceFromSystem(action.system) !== "multi" ? surfaceFromSystem(action.system) : surfaceFromBuilderType(action.builderType);
    const list = map.get(surface) || [];
    list.push(action);
    map.set(surface, list);
  }
  return map;
}
function buildSurfaceBlock(surface, actions) {
  const explains = actions.map(buildExplain);
  const owner = actions[0]?.builderOwner || "Hubly Builder";
  const before = {};
  const after = {};
  const highlights = [];
  for (const a of actions) {
    Object.assign(before, humanBeforeLabel(a.path, defaultBeforeForPath(a.path)));
    Object.assign(after, humanAfterLabel(a.path, a.desired, a));
    highlights.push(`${a.builderOwner}: ${a.path}`);
  }
  if (surface === "booking") {
    before.appointments = before.appointments || "2:00 PM";
    after.minimumNotice = after.minimumNotice || after.snapshot;
  }
  return {
    surface,
    title: surfaceTitle(surface),
    compareMode: compareModeFor(surface),
    builderOwner: owner,
    before,
    after,
    highlights,
    changes: explains
  };
}
function surfaceTitle(surface) {
  switch (surface) {
    case "website":
      return "Website preview";
    case "booking":
      return "Booking preview";
    case "workspace":
      return "Workspace preview";
    case "crm":
      return "CRM preview";
    case "portfolio":
      return "Portfolio preview";
    case "automations":
      return "Automation preview";
    case "packages":
      return "Packages preview";
    default:
      return "Unified preview";
  }
}
function wantsMultipleOptions(plan) {
  const req = String(plan.originalRequest || "").toLowerCase();
  return plan.builderType === "website_builder" && /premium|luxury|modern|minimal|feel|brand|homepage|website/.test(req);
}
function buildWebsiteOptions(base) {
  const website = base.find((b) => b.surface === "website") || base[0];
  if (!website) return [];
  const mk = (id, label, vibe, recommended, tweak) => ({
    id,
    label,
    vibe,
    recommended,
    summary: `${label} direction \u2014 ${vibe}`,
    surfaces: [
      {
        ...website,
        after: { ...website.after, ...tweak, option: label },
        highlights: [...website.highlights, `Option ${label}`]
      },
      ...base.filter((b) => b !== website)
    ]
  });
  return [
    mk("opt_a", "Luxury", "Deep contrast, quiet luxury, proof-first", true, {
      feel: "Luxury",
      typography: "Editorial serif accents",
      colors: "Ink + warm gold"
    }),
    mk("opt_b", "Modern", "Clean grids, bold type, crisp CTAs", false, {
      feel: "Modern",
      typography: "Geometric sans",
      colors: "Navy + brand orange"
    }),
    mk("opt_c", "Minimal", "Whitespace, fewer sections, sharper hierarchy", false, {
      feel: "Minimal",
      typography: "Light weight headings",
      colors: "Near-monochrome",
      sections: ["Hero", "Proof", "Book"]
    })
  ];
}
function buildProgressiveStages(plan, surfaces) {
  const stages = [
    {
      id: "research",
      label: "Researching how the best service businesses present this\u2026",
      status: "complete",
      surface: null,
      completedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  ];
  for (const surface of surfaces) {
    stages.push({
      id: `build_${surface}`,
      label: progressiveLabel(surface),
      status: "complete",
      surface,
      completedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  stages.push({
    id: "review",
    label: "Reviewing everything\u2026",
    status: "complete",
    surface: null,
    completedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  stages.push({
    id: "recommend",
    label: "I think this version is stronger.",
    status: "complete",
    surface: null,
    completedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return stages;
}
function progressiveLabel(surface) {
  switch (surface) {
    case "website":
      return "Building homepage\u2026";
    case "booking":
      return "Updating booking experience\u2026";
    case "packages":
      return "Repositioning your packages\u2026";
    case "portfolio":
      return "Organizing portfolio photos\u2026";
    case "automations":
      return "Sketching the automation flow\u2026";
    case "workspace":
    case "crm":
      return "Adjusting workspace layout\u2026";
    default:
      return "Building preview\u2026";
  }
}
function cloneSurfaces(surfaces) {
  return JSON.parse(JSON.stringify(surfaces));
}
function generatePreview(plan, opts) {
  const grouped = groupActionsBySurface(plan);
  const surfaceKeys = [...grouped.keys()];
  if (surfaceKeys.length === 0) {
    surfaceKeys.push(surfaceFromBuilderType(plan.builderType));
    grouped.set(surfaceKeys[0], []);
  }
  const surfaces = surfaceKeys.map((s) => buildSurfaceBlock(s, grouped.get(s) || []));
  const primarySurface = surfaces.length > 1 ? "multi" : surfaces[0]?.surface || surfaceFromBuilderType(plan.builderType);
  const options = wantsMultipleOptions(plan) ? buildWebsiteOptions(surfaces) : [];
  const recommendedOptionId = options.find((o) => o.recommended)?.id || null;
  const selectedOptionId = recommendedOptionId;
  const activeSurfaces = selectedOptionId ? options.find((o) => o.id === selectedOptionId)?.surfaces || surfaces : surfaces;
  const stages = buildProgressiveStages(plan, surfaceKeys);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const version1 = {
    version: 1,
    at: now,
    summary: "Initial preview from Change Plan",
    selectedOptionId,
    conversationTurnId: null,
    surfaces: cloneSurfaces(activeSurfaces)
  };
  const preview = {
    id: uid("prv"),
    version: PREVIEW_ENGINE_VERSION,
    changePlanId: plan.id,
    intentId: plan.intentId,
    title: plan.title,
    headline: "Here's what I built.",
    voice: "heres_what_i_built",
    originalRequest: plan.originalRequest,
    primarySurface,
    surfaces: cloneSurfaces(activeSurfaces),
    options,
    selectedOptionId,
    recommendedOptionId,
    stages,
    progressiveComplete: true,
    versions: [version1],
    currentVersion: 1,
    conversation: [],
    lifecycle: "waiting_for_approval",
    lifecycleLog: [
      { at: now, state: "created", note: "Preview created from Change Plan" },
      { at: now, state: "waiting_for_approval", note: "Waiting for Approval Engine (Epic 4)" }
    ],
    risk: plan.risk,
    confidence: plan.confidence,
    estimatedImpact: plan.estimatedImpact,
    applied: false,
    executed: false,
    published: false,
    mutatedLiveState: false,
    status: "preview_ready",
    waitingFor: "approval_engine",
    timestamp: now,
    missionControlReplayId: opts?.missionControlReplayId ?? null
  };
  return { preview, fromChangePlanId: plan.id };
}
function markPreviewViewed(preview) {
  const at = (/* @__PURE__ */ new Date()).toISOString();
  return {
    ...preview,
    lifecycle: preview.lifecycle === "waiting_for_approval" ? "viewed" : preview.lifecycle,
    lifecycleLog: [
      ...preview.lifecycleLog,
      { at, state: "viewed", note: "Owner viewed preview" }
    ]
  };
}
function applyPreviewConversationTurn(preview, ownerMessage) {
  const msg = String(ownerMessage || "").trim();
  if (!msg) return preview;
  const at = (/* @__PURE__ */ new Date()).toISOString();
  const turnId = uid("pturn");
  const nextVersion = preview.currentVersion + 1;
  let surfaces = cloneSurfaces(preview.surfaces);
  let selectedOptionId = preview.selectedOptionId;
  let hublyReply = "Got it \u2014 I updated the preview.";
  const optMatch = msg.match(/option\s*([abc123])/i);
  if (optMatch && preview.options.length) {
    const token = optMatch[1].toLowerCase();
    const map = { a: 0, "1": 0, b: 1, "2": 1, c: 2, "3": 2 };
    const idx = map[token] ?? 0;
    const opt = preview.options[idx] || preview.options[0];
    selectedOptionId = opt.id;
    surfaces = cloneSurfaces(opt.surfaces);
    hublyReply = `I switched to Option ${opt.label}. Here's the updated preview.`;
  } else if (/darker|dark mode|deeper/i.test(msg)) {
    surfaces = surfaces.map((s) => ({
      ...s,
      after: { ...s.after, colors: "Darker contrast", mood: "Deeper" },
      highlights: [...s.highlights, "Darker palette"]
    }));
    hublyReply = "Made it darker \u2014 preview updated.";
  } else if (/bigger button|larger cta|bigger cta/i.test(msg)) {
    surfaces = surfaces.map((s) => ({
      ...s,
      after: { ...s.after, cta: "Larger primary buttons" },
      highlights: [...s.highlights, "Bigger buttons"]
    }));
    hublyReply = "Buttons are bigger in the preview.";
  } else {
    surfaces = surfaces.map((s) => ({
      ...s,
      after: { ...s.after, ownerNote: msg.slice(0, 120) },
      highlights: [...s.highlights, "Owner tweak"]
    }));
  }
  const ownerTurn = {
    turnId,
    role: "owner",
    message: msg,
    at,
    resultingVersion: nextVersion
  };
  const hublyTurn = {
    turnId: uid("pturn"),
    role: "hubly",
    message: hublyReply,
    at,
    resultingVersion: nextVersion
  };
  const versionEntry = {
    version: nextVersion,
    at,
    summary: hublyReply,
    selectedOptionId,
    conversationTurnId: turnId,
    surfaces: cloneSurfaces(surfaces)
  };
  return {
    ...preview,
    surfaces,
    selectedOptionId,
    currentVersion: nextVersion,
    versions: [...preview.versions, versionEntry],
    conversation: [...preview.conversation, ownerTurn, hublyTurn],
    lifecycle: "modified",
    lifecycleLog: [
      ...preview.lifecycleLog,
      { at, state: "modified", note: `Conversation turn: ${msg.slice(0, 80)}` },
      { at, state: "waiting_for_approval", note: "Still waiting for Approval Engine \u2014 not applied" }
    ],
    // Never flip execution flags
    applied: false,
    executed: false,
    published: false,
    mutatedLiveState: false,
    status: "preview_ready",
    waitingFor: "approval_engine"
  };
}
function previewDesiredState(plan) {
  return plan.desiredState;
}
var HublyPreviewEngine = {
  version: PREVIEW_ENGINE_VERSION,
  owner: PREVIEW_ENGINE_OWNER,
  generate: generatePreview,
  markViewed: markPreviewViewed,
  converse: applyPreviewConversationTurn
};
export {
  HublyPreviewEngine,
  PREVIEW_ENGINE_OWNER,
  PREVIEW_ENGINE_VERSION,
  applyPreviewConversationTurn,
  generatePreview,
  markPreviewViewed,
  previewDesiredState
};
