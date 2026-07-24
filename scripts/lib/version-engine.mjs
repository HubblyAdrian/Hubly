/** Node mirror of hubly_brain_version_engine.ts — Milestone 1.5 Epic 5 (esbuild). */


// supabase/functions/_shared/hubly_brain_version_engine.ts
var VERSION_ENGINE_VERSION = "1.0.0";
var VERSION_ENGINE_OWNER = "hubly_brain";
var STORES = /* @__PURE__ */ new Map();
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function ensureStore(businessId) {
  const id = businessId || "biz_default";
  let s = STORES.get(id);
  if (!s) {
    s = {
      businessId: id,
      major: 1,
      minor: 0,
      versions: [],
      timeline: seedTimeline(id),
      currentVersionId: null
    };
    STORES.set(id, s);
  }
  return s;
}
function seedTimeline(businessId) {
  const base = Date.now() - 12 * 24 * 60 * 60 * 1e3;
  return [
    {
      id: uid("tl"),
      at: new Date(base).toISOString(),
      kind: "milestone",
      emoji: "\u{1F389}",
      title: "Website launched",
      detail: "First public Hubly site went live.",
      versionId: null,
      versionLabel: null
    },
    {
      id: uid("tl"),
      at: new Date(base + 1 * 864e5).toISOString(),
      kind: "integration",
      emoji: "\u{1F4B3}",
      title: "Stripe connected",
      detail: "Card pay on booking enabled.",
      versionId: null,
      versionLabel: null
    },
    {
      id: uid("tl"),
      at: new Date(base + 2 * 864e5).toISOString(),
      kind: "builder_change",
      emoji: "\u{1F4C5}",
      title: "Arrival windows enabled",
      detail: "Booking rules updated for clearer ETAs.",
      versionId: null,
      versionLabel: null
    },
    {
      id: uid("tl"),
      at: new Date(base + 4 * 864e5).toISOString(),
      kind: "achievement",
      emoji: "\u2B50",
      title: "First 5-star review",
      detail: "Proof that trust is compounding.",
      versionId: null,
      versionLabel: null
    },
    {
      id: uid("tl"),
      at: new Date(base + 10 * 864e5).toISOString(),
      kind: "growth",
      emoji: "\u{1F3C6}",
      title: "100th booking",
      detail: "A growth moment worth celebrating.",
      versionId: null,
      versionLabel: null
    },
    {
      id: uid("tl"),
      at: nowIso(),
      kind: "ai_recommendation",
      emoji: "\u{1F9E0}",
      title: "Hubly recommends launching memberships",
      detail: `Next chapter for ${businessId} \u2014 owner decides.`,
      versionId: null,
      versionLabel: null
    }
  ];
}
function surfaceFromPath(path) {
  if (path.startsWith("website.") || path.startsWith("branding.")) return "website";
  if (path.startsWith("booking.")) return "booking";
  if (path.startsWith("workspace.")) return "workspace";
  if (path.startsWith("crm.")) return "crm";
  if (path.startsWith("portfolio.")) return "portfolio";
  if (path.startsWith("automations.")) return "automations";
  if (path.startsWith("packages.")) return "packages";
  return "business";
}
function nextLabel(store) {
  store.minor += 1;
  return { label: `v${store.major}.${store.minor}`, major: store.major, minor: store.minor };
}
function changesFromPlan(plan, preview) {
  return plan.changes.map((a) => {
    const surface = surfaceFromPath(a.path);
    const prevChange = preview?.surfaces.flatMap((s) => s.changes).find((c) => c.path === a.path);
    return {
      path: a.path,
      surface,
      before: prevChange?.before ?? null,
      after: a.desired,
      builderOwner: a.builderOwner,
      summary: a.reason || `${a.builderOwner}: ${a.path}`
    };
  });
}
function createBusinessVersion(opts) {
  const store = ensureStore(opts.businessId);
  const { label, major, minor } = nextLabel(store);
  const changes = changesFromPlan(opts.plan, opts.preview);
  const surfaces = [...new Set(changes.map((c) => c.surface))];
  const parent = store.currentVersionId ? store.versions.find((v) => v.id === store.currentVersionId) || null : store.versions[store.versions.length - 1] || null;
  if (parent && parent.status === "approved_pending_apply") {
    parent.status = "superseded";
  }
  const version = {
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
    reason: opts.collaboration?.recommendation?.label ? `Approved direction: ${opts.collaboration.recommendation.label}` : opts.plan.description,
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
    missionControlReplayId: opts.missionControlReplayId ?? null
  };
  store.versions.push(version);
  store.currentVersionId = version.id;
  store.timeline.push({
    id: uid("tl"),
    at: version.createdAt,
    kind: "builder_change",
    emoji: "\u{1F4C8}",
    title: `${version.label} \u2014 ${version.businessGoal}`,
    detail: version.changes.map((c) => c.summary).slice(0, 3).join("; "),
    versionId: version.id,
    versionLabel: version.label
  });
  return version;
}
function proposeVersionFromPlan(businessId, plan, preview, collaboration) {
  return createBusinessVersion({
    businessId,
    plan,
    preview,
    collaboration,
    status: collaboration?.status === "ready_for_apply" || collaboration?.summary ? "approved_pending_apply" : "proposed"
  });
}
function listBusinessVersions(businessId) {
  return [...ensureStore(businessId).versions];
}
function getCurrentVersion(businessId) {
  const store = ensureStore(businessId);
  if (!store.currentVersionId) return store.versions[store.versions.length - 1] || null;
  return store.versions.find((v) => v.id === store.currentVersionId) || null;
}
function getVersion(businessId, versionId) {
  return ensureStore(businessId).versions.find((v) => v.id === versionId) || null;
}
function compareVersions(businessId, fromVersionId, toVersionId) {
  const from = getVersion(businessId, fromVersionId);
  const to = getVersion(businessId, toVersionId);
  if (!from || !to) return null;
  const fromPaths = new Map(from.changes.map((c) => [c.path, c]));
  const toPaths = new Map(to.changes.map((c) => [c.path, c]));
  const allSurfaces = /* @__PURE__ */ new Set([
    ...from.surfaces,
    ...to.surfaces
  ]);
  const surfaces = [...allSurfaces].map((surface) => {
    const added = [];
    const removed = [];
    const changed = [];
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
    summary: `Compare ${from.label} \u2192 ${to.label}: ${surfaces.reduce((n, s) => n + s.added.length + s.changed.length + s.removed.length, 0)} diff(s)`
  };
}
function createRollbackPlan(opts) {
  const store = ensureStore(opts.businessId);
  const current = getCurrentVersion(opts.businessId);
  const target = getVersion(opts.businessId, opts.targetVersionId);
  if (!current || !target) return null;
  let steps = [];
  let surfaces = [];
  let paths = [];
  if (opts.scope === "full") {
    steps = target.changes.map((c) => ({
      surface: c.surface,
      path: c.path,
      restoreTo: c.after,
      summary: `Restore ${c.path} to ${target.label}`
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
      summary: `Restore ${c.surface}: ${c.path}`
    }));
    surfaces = [...wanted];
    paths = filtered.map((c) => c.path);
  } else {
    paths = opts.paths || [];
    const filtered = target.changes.filter((c) => paths.includes(c.path));
    steps = (filtered.length ? filtered : paths.map((path) => {
      const cur = current.changes.find((c) => c.path === path);
      return {
        path,
        surface: surfaceFromPath(path),
        after: cur?.before ?? null,
        builderOwner: cur?.builderOwner || "Hubly",
        summary: `Undo ${path}`,
        before: cur?.after ?? null
      };
    })).map((c) => ({
      surface: c.surface,
      path: c.path,
      restoreTo: c.after,
      summary: `Single-change rollback: ${c.path}`
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
    reason: opts.reason || `Safe restore toward ${target.label}. Try it \u2014 you can always go back.`,
    steps,
    requiresOwnerApproval: true,
    executed: false,
    applied: false,
    status: "rollback_plan_ready",
    waitingFor: "apply_engine",
    createdAt: nowIso()
  };
}
function suggestRestore(businessId) {
  const versions = listBusinessVersions(businessId);
  if (versions.length < 2) return [];
  const current = getCurrentVersion(businessId) || versions[versions.length - 1];
  const candidates = versions.filter((v) => v.id !== current.id).sort((a, b) => (b.expectedImpact.trustPct || 0) - (a.expectedImpact.trustPct || 0));
  const best = candidates[0];
  if (!best) return [];
  const curTrust = current.expectedImpact.trustPct || 0;
  const bestTrust = best.expectedImpact.trustPct || 0;
  if (bestTrust <= curTrust && versions.length < 3) {
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
      autoApplied: false
    }
  ];
}
function getBusinessTimeline(businessId) {
  const store = ensureStore(businessId);
  const events = [...store.timeline].sort((a, b) => a.at.localeCompare(b.at));
  return {
    businessId: store.businessId,
    title: "Business Timeline",
    events,
    storyNote: "Not just what changed \u2014 how the business evolved. Builder changes, milestones, achievements, and Hubly recommendations."
  };
}
function clearVersionStoreForTests() {
  STORES.clear();
}
function markVersionApplied(businessId, versionId) {
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
    emoji: "\u2705",
    title: `${v.label} deployed`,
    detail: "Business Deployment Engine applied this version.",
    versionId: v.id,
    versionLabel: v.label
  });
  return v;
}
function markVersionRolledBack(businessId, fromVersionId, targetVersionId) {
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
    emoji: "\u21A9\uFE0F",
    title: `Restored ${target.label}`,
    detail: `Rolled back from ${from.label} via Business Deployment Engine.`,
    versionId: target.id,
    versionLabel: target.label
  });
  return target;
}
var HublyVersionEngine = {
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
  clearForTests: clearVersionStoreForTests
};
export {
  HublyVersionEngine,
  VERSION_ENGINE_OWNER,
  VERSION_ENGINE_VERSION,
  clearVersionStoreForTests,
  compareVersions,
  createBusinessVersion,
  createRollbackPlan,
  getBusinessTimeline,
  getCurrentVersion,
  getVersion,
  listBusinessVersions,
  markVersionApplied,
  markVersionRolledBack,
  proposeVersionFromPlan,
  suggestRestore
};
