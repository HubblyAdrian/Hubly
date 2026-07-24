/**
 * Milestone 1.5 · Epic 5 — Version & Rollback Engine
 *
 * Git for a business. Every approved change becomes a Business Version.
 * Rollback plans are generated here; Epic 12 (Business Deployment Engine) executes them.
 *
 * Also: Business Timeline — the story of the business, not just diffs.
 */

import type { ChangePlan, ChangePlanEstimatedImpact } from "./hubly_brain_change_plan.ts";
import type { BuilderRisk } from "./hubly_brain_builder_intent.ts";
import type { CollaborationSession } from "./hubly_brain_collaboration.ts";
import type { BuilderPreview, PreviewSurface } from "./hubly_brain_preview_engine.ts";

export const VERSION_ENGINE_VERSION = "1.0.0" as const;
export const VERSION_ENGINE_OWNER = "hubly_brain" as const;

export type VersionSurface =
  | "website"
  | "booking"
  | "workspace"
  | "crm"
  | "portfolio"
  | "automations"
  | "packages"
  | "business";

export type BusinessVersionStatus =
  | "proposed"
  | "approved_pending_apply"
  | "applied"
  | "rolled_back"
  | "superseded";

export type VersionChangeEntry = {
  path: string;
  surface: VersionSurface;
  before: unknown;
  after: unknown;
  builderOwner: string;
  summary: string;
};

export type BusinessVersion = {
  id: string;
  businessId: string;
  /** Human semver-ish label e.g. v1.24 */
  label: string;
  major: number;
  minor: number;
  createdAt: string;
  status: BusinessVersionStatus;
  changePlanId: string | null;
  previewId: string | null;
  collaborationId: string | null;
  intentId: string | null;
  originalRequest: string;
  reason: string;
  businessGoal: string;
  expectedImpact: ChangePlanEstimatedImpact;
  risk: BuilderRisk;
  surfaces: VersionSurface[];
  changes: VersionChangeEntry[];
  /** Snapshot of desired state at this version */
  snapshot: Record<string, unknown>;
  /** Parent version this builds on */
  parentVersionId: string | null;
  requestedBy: "owner";
  builders: string[];
  expertsContributed: string[];
  whyApproved: string;
  rollbackAvailable: true;
  /** False until Business Deployment Engine applies this version */
  applied: boolean;
  rollbackExecuted: boolean;
  missionControlReplayId: string | null;
};

export type VersionDiff = {
  fromVersionId: string;
  toVersionId: string;
  fromLabel: string;
  toLabel: string;
  surfaces: Array<{
    surface: VersionSurface;
    added: VersionChangeEntry[];
    removed: VersionChangeEntry[];
    changed: VersionChangeEntry[];
  }>;
  summary: string;
};

export type RollbackScope = "full" | "partial" | "single";

export type RollbackPlan = {
  id: string;
  scope: RollbackScope;
  targetVersionId: string;
  targetLabel: string;
  fromVersionId: string;
  surfaces: VersionSurface[];
  /** Single-change path when scope === single */
  paths: string[];
  reason: string;
  steps: Array<{ surface: VersionSurface; path: string; restoreTo: unknown; summary: string }>;
  requiresOwnerApproval: true;
  /** True after Business Deployment Engine executes the rollback */
  executed: boolean;
  applied: boolean;
  status: "rollback_plan_ready" | "rolled_back" | "failed";
  waitingFor: "apply_engine" | "none";
  createdAt: string;
};

export type RestoreSuggestion = {
  id: string;
  suggestedVersionId: string;
  suggestedLabel: string;
  currentVersionId: string;
  reason: string;
  signal: string;
  confidence: number;
  requiresOwnerApproval: true;
  autoApplied: false;
};

export type TimelineEventKind =
  | "builder_change"
  | "milestone"
  | "achievement"
  | "ai_recommendation"
  | "growth"
  | "integration";

export type BusinessTimelineEvent = {
  id: string;
  at: string;
  kind: TimelineEventKind;
  emoji: string;
  title: string;
  detail: string;
  versionId: string | null;
  versionLabel: string | null;
};

export type BusinessTimeline = {
  businessId: string;
  title: "Business Timeline";
  events: BusinessTimelineEvent[];
  storyNote: string;
};

type VersionStore = {
  businessId: string;
  major: number;
  minor: number;
  versions: BusinessVersion[];
  timeline: BusinessTimelineEvent[];
  currentVersionId: string | null;
};

const STORES = new Map<string, VersionStore>();

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureStore(businessId: string): VersionStore {
  const id = businessId || "biz_default";
  let s = STORES.get(id);
  if (!s) {
    s = {
      businessId: id,
      major: 1,
      minor: 0,
      versions: [],
      timeline: seedTimeline(id),
      currentVersionId: null,
    };
    STORES.set(id, s);
  }
  return s;
}

function seedTimeline(businessId: string): BusinessTimelineEvent[] {
  // Story anchors — emotional layer, not only builder diffs
  const base = Date.now() - 12 * 24 * 60 * 60 * 1000;
  return [
    {
      id: uid("tl"),
      at: new Date(base).toISOString(),
      kind: "milestone",
      emoji: "🎉",
      title: "Website launched",
      detail: "First public Hubly site went live.",
      versionId: null,
      versionLabel: null,
    },
    {
      id: uid("tl"),
      at: new Date(base + 1 * 86400000).toISOString(),
      kind: "integration",
      emoji: "💳",
      title: "Stripe connected",
      detail: "Card pay on booking enabled.",
      versionId: null,
      versionLabel: null,
    },
    {
      id: uid("tl"),
      at: new Date(base + 2 * 86400000).toISOString(),
      kind: "builder_change",
      emoji: "📅",
      title: "Arrival windows enabled",
      detail: "Booking rules updated for clearer ETAs.",
      versionId: null,
      versionLabel: null,
    },
    {
      id: uid("tl"),
      at: new Date(base + 4 * 86400000).toISOString(),
      kind: "achievement",
      emoji: "⭐",
      title: "First 5-star review",
      detail: "Proof that trust is compounding.",
      versionId: null,
      versionLabel: null,
    },
    {
      id: uid("tl"),
      at: new Date(base + 10 * 86400000).toISOString(),
      kind: "growth",
      emoji: "🏆",
      title: "100th booking",
      detail: "A growth moment worth celebrating.",
      versionId: null,
      versionLabel: null,
    },
    {
      id: uid("tl"),
      at: nowIso(),
      kind: "ai_recommendation",
      emoji: "🧠",
      title: "Hubly recommends launching memberships",
      detail: `Next chapter for ${businessId} — owner decides.`,
      versionId: null,
      versionLabel: null,
    },
  ];
}

function surfaceFromPath(path: string): VersionSurface {
  if (path.startsWith("website.") || path.startsWith("branding.")) return "website";
  if (path.startsWith("booking.")) return "booking";
  if (path.startsWith("workspace.")) return "workspace";
  if (path.startsWith("crm.")) return "crm";
  if (path.startsWith("portfolio.")) return "portfolio";
  if (path.startsWith("automations.")) return "automations";
  if (path.startsWith("packages.")) return "packages";
  return "business";
}

function nextLabel(store: VersionStore): { label: string; major: number; minor: number } {
  store.minor += 1;
  return { label: `v${store.major}.${store.minor}`, major: store.major, minor: store.minor };
}

function changesFromPlan(plan: ChangePlan, preview?: BuilderPreview | null): VersionChangeEntry[] {
  return plan.changes.map((a) => {
    const surface = surfaceFromPath(a.path);
    const prevChange = preview?.surfaces
      .flatMap((s) => s.changes)
      .find((c) => c.path === a.path);
    return {
      path: a.path,
      surface,
      before: prevChange?.before ?? null,
      after: a.desired,
      builderOwner: a.builderOwner,
      summary: a.reason || `${a.builderOwner}: ${a.path}`,
    };
  });
}

/**
 * Create (or propose) a Business Version from an approved collaboration / Change Plan.
 * Does not apply live mutations.
 */
export function createBusinessVersion(opts: {
  businessId: string;
  plan: ChangePlan;
  preview?: BuilderPreview | null;
  collaboration?: CollaborationSession | null;
  status?: BusinessVersionStatus;
  expertsContributed?: string[];
  missionControlReplayId?: string | null;
}): BusinessVersion {
  const store = ensureStore(opts.businessId);
  const { label, major, minor } = nextLabel(store);
  const changes = changesFromPlan(opts.plan, opts.preview);
  const surfaces = [...new Set(changes.map((c) => c.surface))];
  const parent = store.currentVersionId
    ? store.versions.find((v) => v.id === store.currentVersionId) || null
    : store.versions[store.versions.length - 1] || null;

  // Mark prior current as superseded (history kept)
  if (parent && parent.status === "approved_pending_apply") {
    parent.status = "superseded";
  }

  const version: BusinessVersion = {
    id: uid("bver"),
    businessId: store.businessId,
    label,
    major,
    minor,
    createdAt: nowIso(),
    status: opts.status || "approved_pending_apply",
    changePlanId: opts.plan.id,
    previewId: opts.preview?.id || opts.collaboration?.previewId || null,
    collaborationId: opts.collaboration?.id || null,
    intentId: opts.plan.intentId,
    originalRequest: opts.plan.originalRequest,
    reason: opts.collaboration?.recommendation?.label
      ? `Approved direction: ${opts.collaboration.recommendation.label}`
      : opts.plan.description,
    businessGoal: opts.plan.title,
    expectedImpact: opts.plan.estimatedImpact,
    risk: opts.plan.risk,
    surfaces,
    changes,
    snapshot: JSON.parse(JSON.stringify(opts.plan.desiredState || {})),
    parentVersionId: parent?.id || null,
    requestedBy: "owner",
    builders: [...new Set(changes.map((c) => c.builderOwner))],
    expertsContributed: opts.expertsContributed || ["builder", "experience_director"],
    whyApproved: opts.collaboration?.summary?.headline || "Owner and Hubly agreed after collaboration.",
    rollbackAvailable: true,
    applied: false,
    rollbackExecuted: false,
    missionControlReplayId: opts.missionControlReplayId ?? null,
  };

  store.versions.push(version);
  store.currentVersionId = version.id;

  store.timeline.push({
    id: uid("tl"),
    at: version.createdAt,
    kind: "builder_change",
    emoji: "📈",
    title: `${version.label} — ${version.businessGoal}`,
    detail: version.changes.map((c) => c.summary).slice(0, 3).join("; "),
    versionId: version.id,
    versionLabel: version.label,
  });

  return version;
}

/** Propose the version that would be created after approval (pre-apply). */
export function proposeVersionFromPlan(
  businessId: string,
  plan: ChangePlan,
  preview?: BuilderPreview | null,
  collaboration?: CollaborationSession | null,
): BusinessVersion {
  return createBusinessVersion({
    businessId,
    plan,
    preview,
    collaboration,
    status: collaboration?.status === "ready_for_apply" || collaboration?.summary
      ? "approved_pending_apply"
      : "proposed",
  });
}

export function listBusinessVersions(businessId: string): BusinessVersion[] {
  return [...ensureStore(businessId).versions];
}

export function getCurrentVersion(businessId: string): BusinessVersion | null {
  const store = ensureStore(businessId);
  if (!store.currentVersionId) return store.versions[store.versions.length - 1] || null;
  return store.versions.find((v) => v.id === store.currentVersionId) || null;
}

export function getVersion(businessId: string, versionId: string): BusinessVersion | null {
  return ensureStore(businessId).versions.find((v) => v.id === versionId) || null;
}

export function compareVersions(
  businessId: string,
  fromVersionId: string,
  toVersionId: string,
): VersionDiff | null {
  const from = getVersion(businessId, fromVersionId);
  const to = getVersion(businessId, toVersionId);
  if (!from || !to) return null;

  const fromPaths = new Map(from.changes.map((c) => [c.path, c]));
  const toPaths = new Map(to.changes.map((c) => [c.path, c]));
  const allSurfaces = new Set<VersionSurface>([
    ...from.surfaces,
    ...to.surfaces,
  ]);

  const surfaces = [...allSurfaces].map((surface) => {
    const added: VersionChangeEntry[] = [];
    const removed: VersionChangeEntry[] = [];
    const changed: VersionChangeEntry[] = [];
    for (const [path, entry] of toPaths) {
      if (entry.surface !== surface) continue;
      const prev = fromPaths.get(path);
      if (!prev) added.push(entry);
      else if (JSON.stringify(prev.after) !== JSON.stringify(entry.after)) {
        changed.push({ ...entry, before: prev.after, after: entry.after });
      }
    }
    for (const [path, entry] of fromPaths) {
      if (entry.surface !== surface) continue;
      if (!toPaths.has(path)) removed.push(entry);
    }
    return { surface, added, removed, changed };
  });

  return {
    fromVersionId: from.id,
    toVersionId: to.id,
    fromLabel: from.label,
    toLabel: to.label,
    surfaces,
    summary: `Compare ${from.label} → ${to.label}: ${surfaces.reduce((n, s) => n + s.added.length + s.changed.length + s.removed.length, 0)} diff(s)`,
  };
}

export function createRollbackPlan(opts: {
  businessId: string;
  targetVersionId: string;
  scope: RollbackScope;
  surfaces?: VersionSurface[];
  paths?: string[];
  reason?: string;
}): RollbackPlan | null {
  const store = ensureStore(opts.businessId);
  const current = getCurrentVersion(opts.businessId);
  const target = getVersion(opts.businessId, opts.targetVersionId);
  if (!current || !target) return null;

  let steps: RollbackPlan["steps"] = [];
  let surfaces: VersionSurface[] = [];
  let paths: string[] = [];

  if (opts.scope === "full") {
    steps = target.changes.map((c) => ({
      surface: c.surface,
      path: c.path,
      restoreTo: c.after,
      summary: `Restore ${c.path} to ${target.label}`,
    }));
    surfaces = [...target.surfaces];
    paths = target.changes.map((c) => c.path);
  } else if (opts.scope === "partial") {
    const wanted = new Set(opts.surfaces || []);
    const filtered = target.changes.filter((c) => wanted.has(c.surface));
    steps = filtered.map((c) => ({
      surface: c.surface,
      path: c.path,
      restoreTo: c.after,
      summary: `Restore ${c.surface}: ${c.path}`,
    }));
    surfaces = [...wanted];
    paths = filtered.map((c) => c.path);
  } else {
    paths = opts.paths || [];
    const filtered = target.changes.filter((c) => paths.includes(c.path));
    // If path only exists on current, restore to target's before/parent snapshot path
    steps = (filtered.length ? filtered : paths.map((path) => {
      const cur = current.changes.find((c) => c.path === path);
      return {
        path,
        surface: surfaceFromPath(path),
        after: cur?.before ?? null,
        builderOwner: cur?.builderOwner || "Hubly",
        summary: `Undo ${path}`,
        before: cur?.after ?? null,
      } as VersionChangeEntry;
    })).map((c) => ({
      surface: c.surface,
      path: c.path,
      restoreTo: c.after,
      summary: `Single-change rollback: ${c.path}`,
    }));
    surfaces = [...new Set(steps.map((s) => s.surface))];
  }

  return {
    id: uid("rb"),
    scope: opts.scope,
    targetVersionId: target.id,
    targetLabel: target.label,
    fromVersionId: current.id,
    surfaces,
    paths,
    reason: opts.reason || `Safe restore toward ${target.label}. Try it — you can always go back.`,
    steps,
    requiresOwnerApproval: true,
    executed: false,
    applied: false,
    status: "rollback_plan_ready",
    waitingFor: "apply_engine",
    createdAt: nowIso(),
  };
}

/**
 * AI restore suggestion — never auto-applied.
 * Heuristic: if a newer version changed website and an older one had higher trust impact, suggest compare.
 */
export function suggestRestore(businessId: string): RestoreSuggestion[] {
  const versions = listBusinessVersions(businessId);
  if (versions.length < 2) return [];
  const current = getCurrentVersion(businessId) || versions[versions.length - 1];
  const candidates = versions
    .filter((v) => v.id !== current.id)
    .sort((a, b) => (b.expectedImpact.trustPct || 0) - (a.expectedImpact.trustPct || 0));
  const best = candidates[0];
  if (!best) return [];
  const curTrust = current.expectedImpact.trustPct || 0;
  const bestTrust = best.expectedImpact.trustPct || 0;
  if (bestTrust <= curTrust && versions.length < 3) {
    // Still offer a gentle suggestion for demos when history exists
  }
  return [
    {
      id: uid("restore"),
      suggestedVersionId: best.id,
      suggestedLabel: best.label,
      currentVersionId: current.id,
      reason: `I think ${best.label} may have performed better for trust signals.`,
      signal: "Conversions / trust may have softened after the latest homepage change.",
      confidence: Math.min(92, 70 + Math.abs(bestTrust - curTrust)),
      requiresOwnerApproval: true,
      autoApplied: false,
    },
  ];
}

export function getBusinessTimeline(businessId: string): BusinessTimeline {
  const store = ensureStore(businessId);
  const events = [...store.timeline].sort((a, b) => a.at.localeCompare(b.at));
  return {
    businessId: store.businessId,
    title: "Business Timeline",
    events,
    storyNote:
      "Not just what changed — how the business evolved. Builder changes, milestones, achievements, and Hubly recommendations.",
  };
}

export function clearVersionStoreForTests(): void {
  STORES.clear();
}

/** Epic 12 — mark a version as live after successful deployment. */
export function markVersionApplied(businessId: string, versionId: string): BusinessVersion | null {
  const v = getVersion(businessId, versionId);
  if (!v) return null;
  v.applied = true;
  v.status = "applied";
  v.rollbackExecuted = false;
  const store = ensureStore(businessId);
  store.currentVersionId = v.id;
  store.timeline.push({
    id: uid("tl"),
    at: nowIso(),
    kind: "builder_change",
    emoji: "✅",
    title: `${v.label} deployed`,
    detail: "Business Deployment Engine applied this version.",
    versionId: v.id,
    versionLabel: v.label,
  });
  return v;
}

/** Epic 12 — mark current as rolled back and restore target as current. */
export function markVersionRolledBack(
  businessId: string,
  fromVersionId: string,
  targetVersionId: string,
): BusinessVersion | null {
  const from = getVersion(businessId, fromVersionId);
  const target = getVersion(businessId, targetVersionId);
  if (!from || !target) return null;
  from.status = "rolled_back";
  from.rollbackExecuted = true;
  from.applied = false;
  target.status = "applied";
  target.applied = true;
  target.rollbackExecuted = false;
  const store = ensureStore(businessId);
  store.currentVersionId = target.id;
  store.timeline.push({
    id: uid("tl"),
    at: nowIso(),
    kind: "builder_change",
    emoji: "↩️",
    title: `Restored ${target.label}`,
    detail: `Rolled back from ${from.label} via Business Deployment Engine.`,
    versionId: target.id,
    versionLabel: target.label,
  });
  return target;
}

export const HublyVersionEngine = {
  version: VERSION_ENGINE_VERSION,
  owner: VERSION_ENGINE_OWNER,
  create: createBusinessVersion,
  propose: proposeVersionFromPlan,
  list: listBusinessVersions,
  current: getCurrentVersion,
  get: getVersion,
  compare: compareVersions,
  rollbackPlan: createRollbackPlan,
  suggestRestore,
  timeline: getBusinessTimeline,
  markApplied: markVersionApplied,
  markRolledBack: markVersionRolledBack,
  clearForTests: clearVersionStoreForTests,
};
