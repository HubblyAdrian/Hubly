/**
 * Milestone 1.5 · Epic 1 — Builder Intent
 *
 * Structured understanding of what the owner wants to build.
 * No Change Plans. No apply. No database / UI mutations from Builder.
 */

export const BUILDER_INTENT_VERSION = "1.0.0" as const;

export type BuilderIntentCategory =
  | "Website"
  | "Booking"
  | "CRM"
  | "Workspace"
  | "Portfolio"
  | "Packages"
  | "Automations"
  | "Marketplace"
  | "Branding"
  | "Business Strategy"
  | "Integrations"
  | "Multiple Systems";

export type BuilderRisk = "low" | "medium" | "high";

export type BuilderAffectedSystem =
  | "Website"
  | "Booking"
  | "CRM"
  | "Workspace"
  | "Portfolio"
  | "Packages"
  | "Automations"
  | "Marketplace"
  | "Branding"
  | "Integrations"
  | "Business";

export type BuilderConfidenceExplanation = {
  /** Short bullets explaining the confidence score. */
  reasons: string[];
  /** Owner-facing paragraph (Mission Control / later “Why did you understand?”). */
  summary: string;
};

/**
 * Builder Intent Object — Epic 1 output only.
 * Must never include operations, before/after, apply, or rollback fields.
 */
export type BuilderIntent = {
  intentId: string;
  version: typeof BUILDER_INTENT_VERSION;
  originalRequest: string;
  intentCategory: BuilderIntentCategory;
  /** Short label e.g. "Website Improvement" */
  intentLabel: string;
  ownerGoal: string;
  affectedSystems: BuilderAffectedSystem[];
  requiredCapabilities: Array<{
    toolId: string;
    toolName: string;
    capabilityId: string;
    capabilityLabel: string;
  }>;
  estimatedRisk: BuilderRisk;
  confidence: number;
  confidenceExplanation: BuilderConfidenceExplanation;
  requiresChangePlan: boolean;
  reasoning: Array<{
    reason: string;
    evidence: string[];
    confidence: number;
  }>;
  timestamp: string;
  /** Epic 1 invariant — always false / intent-only. */
  applied: false;
  changePlanGenerated: false;
};

export type BuilderIntentContext = {
  businessId?: string | null;
  memory?: Record<string, unknown> | null;
  workspace?: Record<string, unknown> | null;
  conversationIntelligence?: Record<string, unknown> | null;
  dna?: Record<string, unknown> | null;
  registryCapabilities?: Array<{
    toolId: string;
    toolName: string;
    capabilityId: string;
    capabilityLabel: string;
    score?: number;
  }>;
};

const TOOL_TO_SYSTEM: Record<string, BuilderAffectedSystem> = {
  website_builder: "Website",
  booking: "Booking",
  crm: "CRM",
  workspace_builder: "Workspace",
  portfolio_builder: "Portfolio",
  packages_builder: "Packages",
  automation: "Automations",
  marketplace: "Marketplace",
  image_processor: "Portfolio",
};

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

type CategorySignal = {
  category: BuilderIntentCategory;
  system: BuilderAffectedSystem;
  label: string;
  goal: string;
  risk: BuilderRisk;
  defaultCaps: Array<{ toolId: string; toolName: string; capabilityId: string; capabilityLabel: string }>;
  weight: number;
};

function collectSignals(request: string): CategorySignal[] {
  const r = String(request || "").toLowerCase();
  const signals: CategorySignal[] = [];

  if (/homepage|website|premium|luxury|brand(?:ing)?|hero|layout|feel more/.test(r)) {
    const branding = /premium|luxury|brand/.test(r);
    signals.push({
      category: branding && !/homepage|website/.test(r) ? "Branding" : "Website",
      system: "Website",
      label: branding ? "Website Improvement" : "Website Change",
      goal: branding ? "Premium Branding" : "Website Update",
      risk: "medium",
      defaultCaps: [{
        toolId: "website_builder",
        toolName: "Website Builder",
        capabilityId: "update_homepage",
        capabilityLabel: "Update Homepage",
      }],
      weight: branding ? 3 : 2,
    });
  }

  if (/same-?day|no same.?day|arrival window|booking rule|minimum notice|appointments? are scheduled/.test(r)) {
    signals.push({
      category: "Booking",
      system: "Booking",
      label: "Booking Rule",
      goal: /same-?day/.test(r) ? "Minimum Notice" : (/arrival/.test(r) ? "Arrival Windows" : "Booking Rules"),
      risk: "medium",
      defaultCaps: [{
        toolId: "booking",
        toolName: "Booking",
        capabilityId: /same-?day/.test(r) ? "no_same_day_bookings" : "arrival_windows",
        capabilityLabel: /same-?day/.test(r) ? "No Same-Day Bookings" : "Arrival Windows",
      }],
      weight: 3,
    });
  }

  if (
    /move .*above|jobs above|sidebar order|workspace|dashboard layout|put .+ above/.test(r)
  ) {
    signals.push({
      category: "Workspace",
      system: "Workspace",
      label: "Workspace Layout",
      goal: "Navigation Order",
      risk: "low",
      defaultCaps: [{
        toolId: "workspace_builder",
        toolName: "Workspace Builder",
        capabilityId: "sidebar_order",
        capabilityLabel: "Sidebar Order",
      }],
      weight: 3,
    });
  }

  if (/portfolio|upload.*(photo|image)|these \d+ photos|gallery/.test(r)) {
    signals.push({
      category: "Portfolio",
      system: "Portfolio",
      label: "Portfolio Update",
      goal: "Gallery Organization",
      risk: "low",
      defaultCaps: [
        {
          toolId: "portfolio_builder",
          toolName: "Portfolio Builder",
          capabilityId: "upload_photos",
          capabilityLabel: "Upload Photos",
        },
        {
          toolId: "image_processor",
          toolName: "Image Processor",
          capabilityId: "process_images",
          capabilityLabel: "Process Images",
        },
        {
          toolId: "website_builder",
          toolName: "Website Builder",
          capabilityId: "update_homepage",
          capabilityLabel: "Update Homepage",
        },
      ],
      weight: 3,
    });
  }

  if (/prep instruction|after .+ booking|send .+ after|automation|workflow|reminder/.test(r)) {
    signals.push({
      category: "Automations",
      system: "Automations",
      label: "Automation Setup",
      goal: /prep/.test(r) ? "Post-Booking Prep Instructions" : "Automated Workflow",
      risk: "medium",
      defaultCaps: [{
        toolId: "automation",
        toolName: "Automation",
        capabilityId: "create_workflow",
        capabilityLabel: "Create Workflow",
      }],
      weight: 3,
    });
  }

  if (/crm|pipeline|lead|customer record|hide module|pin widget|pin the/.test(r) && !/jobs above/.test(r)) {
    signals.push({
      category: "CRM",
      system: "CRM",
      label: "CRM Change",
      goal: /hide/.test(r) ? "Hide Module" : (/pin/.test(r) ? "Pin Widget" : "CRM Update"),
      risk: "low",
      defaultCaps: [{
        toolId: "crm",
        toolName: "CRM",
        capabilityId: "update_customer",
        capabilityLabel: "Update Customer",
      }],
      weight: 3,
    });
  }

  if (/package|pricing tier|membership/.test(r)) {
    signals.push({
      category: "Packages",
      system: "Packages",
      label: "Package Change",
      goal: "Package / Pricing Update",
      risk: "medium",
      defaultCaps: [{
        toolId: "packages_builder",
        toolName: "Packages Builder",
        capabilityId: "package_create",
        capabilityLabel: "Create Package",
      }],
      weight: 2,
    });
  }

  if (/marketplace|service radius/.test(r)) {
    signals.push({
      category: "Marketplace",
      system: "Marketplace",
      label: "Marketplace Change",
      goal: "Marketplace Settings",
      risk: "medium",
      defaultCaps: [{
        toolId: "marketplace",
        toolName: "Marketplace",
        capabilityId: "marketplace_radius",
        capabilityLabel: "Radius",
      }],
      weight: 2,
    });
  }

  if (/integrat|stripe|google calendar|connect /.test(r)) {
    signals.push({
      category: "Integrations",
      system: "Integrations",
      label: "Integration Change",
      goal: "Connect Integration",
      risk: "high",
      defaultCaps: [{
        toolId: "booking",
        toolName: "Booking",
        capabilityId: "calendar_sync",
        capabilityLabel: "Calendar Sync",
      }],
      weight: 2,
    });
  }

  return signals;
}

function mergeCapabilities(
  signals: CategorySignal[],
  registry: BuilderIntentContext["registryCapabilities"],
): BuilderIntent["requiredCapabilities"] {
  const out: BuilderIntent["requiredCapabilities"] = [];
  const seen = new Set<string>();

  const push = (c: BuilderIntent["requiredCapabilities"][0]) => {
    const k = `${c.toolId}:${c.capabilityId}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(c);
  };

  for (const s of signals) {
    for (const c of s.defaultCaps) push(c);
  }

  for (const c of registry || []) {
    // Only keep registry caps that relate to signaled systems / tools
    const sys = TOOL_TO_SYSTEM[c.toolId];
    const relevant =
      !signals.length ||
      signals.some((s) => s.system === sys || s.defaultCaps.some((d) => d.toolId === c.toolId));
    if (relevant) {
      push({
        toolId: c.toolId,
        toolName: c.toolName,
        capabilityId: c.capabilityId,
        capabilityLabel: c.capabilityLabel,
      });
    }
  }

  return out;
}

function buildConfidenceExplanation(opts: {
  request: string;
  category: BuilderIntentCategory;
  caps: BuilderIntent["requiredCapabilities"];
  memory: Record<string, unknown> | null | undefined;
  confidence: number;
}): BuilderConfidenceExplanation {
  const reasons: string[] = [];
  const r = opts.request.toLowerCase();

  if (/premium|same-?day|arrival|jobs above|portfolio|prep instruction/.test(r)) {
    reasons.push("I've seen this request pattern before.");
  } else {
    reasons.push("The request maps cleanly to a known builder category.");
  }

  const builders = [...new Set(opts.caps.map((c) => c.toolName))];
  if (builders.length) {
    reasons.push(
      builders.length === 1
        ? `${builders[0]} supports it.`
        : `${builders.join(", ")} support it.`,
    );
  }

  reasons.push("No conflicting rules exist in this Intent-only pass.");

  const industry = opts.memory && (opts.memory.industry || (opts.memory.business as { industry?: string } | undefined)?.industry);
  if (industry) {
    reasons.push(`Business Memory aligns with this change (${String(industry)}).`);
  } else {
    reasons.push("Business Memory does not conflict with this change.");
  }

  reasons.push("No additional clarification is required.");

  const summary = reasons.join(" ");

  return { reasons, summary };
}

/**
 * Convert natural language → Builder Intent (understand only).
 */
export function createBuilderIntent(
  request: string,
  ctx: BuilderIntentContext = {},
): BuilderIntent {
  const signals = collectSignals(request);
  const systems = [...new Set(signals.map((s) => s.system))];
  const multi = systems.length > 1;

  const primary = signals.sort((a, b) => b.weight - a.weight)[0] || {
    category: "Business Strategy" as BuilderIntentCategory,
    system: "Business" as BuilderAffectedSystem,
    label: "Business Change",
    goal: "Understand Owner Request",
    risk: "low" as BuilderRisk,
    defaultCaps: [] as CategorySignal["defaultCaps"],
    weight: 1,
  };

  const intentCategory: BuilderIntentCategory = multi ? "Multiple Systems" : primary.category;
  const caps = mergeCapabilities(signals, ctx.registryCapabilities);

  let confidence = 78;
  if (signals.length) confidence += 8;
  if (caps.length) confidence += 6;
  if (multi && caps.length >= 2) confidence += 4;
  if (ctx.memory && (ctx.memory.industry || ctx.memory.name)) confidence += 3;
  confidence = clamp(confidence);

  const risk: BuilderRisk = multi
    ? "medium"
    : signals.reduce<BuilderRisk>((acc, s) => {
      if (s.risk === "high" || acc === "high") return "high";
      if (s.risk === "medium" || acc === "medium") return "medium";
      return "low";
    }, "low");

  const confidenceExplanation = buildConfidenceExplanation({
    request,
    category: intentCategory,
    caps,
    memory: ctx.memory,
    confidence,
  });

  const evidence = [
    `category:${intentCategory}`,
    ...systems.map((s) => `system:${s}`),
    ...caps.map((c) => `cap:${c.toolId}/${c.capabilityId}`),
  ];

  return {
    intentId: uid("bint"),
    version: BUILDER_INTENT_VERSION,
    originalRequest: String(request || "").trim(),
    intentCategory,
    intentLabel: multi
      ? `Multi-System: ${systems.join(" + ")}`
      : primary.label,
    ownerGoal: multi
      ? signals.map((s) => s.goal).join(" · ")
      : primary.goal,
    affectedSystems: systems.length ? systems : ["Business"],
    requiredCapabilities: caps,
    estimatedRisk: risk,
    confidence,
    confidenceExplanation,
    requiresChangePlan: true,
    reasoning: [{
      reason: multi
        ? "Owner described changes spanning multiple systems — kept as one Builder Intent (not split)."
        : `Classified as ${primary.label} toward ${primary.goal}.`,
      evidence,
      confidence,
    }],
    timestamp: new Date().toISOString(),
    applied: false,
    changePlanGenerated: false,
  };
}

/** True when the owner request looks like a build / change request. */
export function isBuilderRequest(request: string): boolean {
  return collectSignals(request).length > 0;
}
