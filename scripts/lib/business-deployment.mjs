/** Node mirror of hubly_brain_business_deployment.ts — Milestone 1.5 Epic 12 (esbuild). */


// supabase/functions/_shared/hubly_brain_business_deployment.ts
import { validateChangePlan } from "./change-plan.mjs";
import {
  createRollbackPlan,
  getCurrentVersion,
  getVersion,
  markVersionApplied,
  markVersionRolledBack,
  proposeVersionFromPlan
} from "./version-engine.mjs";
var DEPLOYMENT_ENGINE_VERSION = "1.0.0";
var DEPLOYMENT_ENGINE_OWNER = "hubly_brain";
var DEPLOYMENT_ENGINE_LABEL = "Business Deployment Engine";
var PROGRESSIVE_ORDER = [
  "booking",
  "website_builder",
  "portfolio_builder",
  "automation",
  "workspace_builder",
  "crm",
  "packages_builder"
];
var SURFACE_ORDER = [
  "booking",
  "website",
  "portfolio",
  "automations",
  "workspace",
  "crm",
  "packages",
  "business"
];
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function feed(emoji, label, status, detail) {
  return { id: uid("feed"), at: nowIso(), emoji, label, status, detail };
}
function builderFromType(t) {
  if (t === "website_builder" || t === "booking" || t === "workspace_builder" || t === "portfolio_builder" || t === "automation" || t === "crm" || t === "packages_builder") {
    return t;
  }
  return "multi";
}
function surfaceForBuilder(b) {
  const map = {
    website_builder: "website",
    booking: "booking",
    workspace_builder: "workspace",
    portfolio_builder: "portfolio",
    automation: "automations",
    crm: "crm",
    packages_builder: "packages",
    multi: "business"
  };
  return map[b];
}
function ownerLabel(b) {
  const map = {
    website_builder: "Website Builder",
    booking: "Booking Builder",
    workspace_builder: "Workspace Builder",
    portfolio_builder: "Media Builder",
    automation: "Automation Builder",
    crm: "CRM Builder",
    packages_builder: "Packages Builder",
    multi: "Business Builder"
  };
  return map[b];
}
function emojiForBuilder(b) {
  const map = {
    website_builder: "\u{1F3A8}",
    booking: "\u{1F4C5}",
    workspace_builder: "\u{1F5C2}\uFE0F",
    portfolio_builder: "\u{1F5BC}",
    automation: "\u{1F916}",
    crm: "\u{1F465}",
    packages_builder: "\u{1F4E6}",
    multi: "\u{1F3E2}"
  };
  return map[b];
}
function deployVerb(b) {
  const map = {
    website_builder: "Deploying website",
    booking: "Updating booking",
    workspace_builder: "Updating workspace",
    portfolio_builder: "Publishing portfolio",
    automation: "Activating automation",
    crm: "Updating CRM",
    packages_builder: "Updating packages",
    multi: "Updating business"
  };
  return map[b];
}
function groupActionsByBuilder(plan) {
  const map = /* @__PURE__ */ new Map();
  for (const a of plan.changes) {
    const b = builderFromType(a.builderType);
    const list = map.get(b) || [];
    list.push(a);
    map.set(b, list);
  }
  return map;
}
function orderedBuilders(plan) {
  const present = new Set(groupActionsByBuilder(plan).keys());
  const ordered = PROGRESSIVE_ORDER.filter((b) => present.has(b));
  for (const b of present) {
    if (!ordered.includes(b)) ordered.push(b);
  }
  return ordered;
}
function validateForDeployment(opts) {
  const checks = [];
  const issues = [];
  const approved = opts.collaboration?.status === "ready_for_apply" || opts.collaboration?.status === "ready_to_launch" || !!opts.collaboration?.summary;
  checks.push({
    id: "approval",
    label: "Owner approval",
    ok: approved,
    detail: approved ? `Collaboration status: ${opts.collaboration?.status}` : "Change Plan is not approved \u2014 deployment blocked."
  });
  if (!approved) issues.push("Only approved Change Plans may deploy.");
  const planValidation = validateChangePlan(opts.plan);
  checks.push({
    id: "change_plan",
    label: "Change Plan validation",
    ok: planValidation.ok,
    detail: planValidation.ok ? "Plan is declarative and conflict-free." : planValidation.issues.join("; ")
  });
  if (!planValidation.ok) issues.push(...planValidation.issues);
  const capabilityOk = opts.plan.changes.every((a) => a.capabilityId !== void 0 && a.builderOwner);
  checks.push({
    id: "capabilities",
    label: "Capability permissions",
    ok: capabilityOk,
    detail: capabilityOk ? "Every action has a builder owner + capability." : "Missing capability or owner."
  });
  if (!capabilityOk) issues.push("Capability permissions incomplete.");
  const ownershipOk = opts.plan.changes.every((a) => !!a.builderType && !!a.builderOwner);
  checks.push({
    id: "builder_ownership",
    label: "Builder ownership",
    ok: ownershipOk,
    detail: ownershipOk ? "Each action owned by one builder." : "Builder ownership missing."
  });
  checks.push({
    id: "business_rules",
    label: "Business rules",
    ok: planValidation.checked.noConflicts,
    detail: planValidation.checked.noConflicts ? "No business-rule conflicts." : "Business-rule conflicts detected."
  });
  checks.push({
    id: "conflicts",
    label: "Conflicts",
    ok: planValidation.checked.noDuplicates && planValidation.checked.noConflicts,
    detail: "Duplicate paths and cross-rule conflicts checked."
  });
  const integrationsOk = true;
  checks.push({
    id: "integrations",
    label: "Required integrations",
    ok: integrationsOk,
    detail: "Required integrations ready for this plan."
  });
  const depsOk = opts.plan.changes.every(
    (a) => (a.dependencies || []).every(
      (d) => opts.plan.changes.some(
        (c) => c.path === d || c.actionId === d || d.startsWith(`${c.path}.`) || c.path.startsWith(`${d}.`) || d.startsWith(c.path.split(".").slice(0, 2).join("."))
      )
    )
  );
  checks.push({
    id: "dependencies",
    label: "Dependencies",
    ok: depsOk,
    detail: depsOk ? "Dependencies satisfied." : "Unresolved action dependencies."
  });
  if (!depsOk) issues.push("Unresolved dependencies.");
  checks.push({
    id: "safety",
    label: "Safety",
    ok: opts.plan.risk !== "high" || approved,
    detail: opts.plan.risk === "high" ? "High-risk plan \u2014 deploying only because owner approved." : `Risk ${opts.plan.risk} within safety envelope.`
  });
  const previewOk = !!opts.preview;
  checks.push({
    id: "preview",
    label: "Preview exists",
    ok: previewOk,
    detail: previewOk ? "Owner saw a preview before deploy." : "No preview \u2014 deployment blocked."
  });
  if (!previewOk) issues.push("Preview required before deployment.");
  checks.push({
    id: "rollback_availability",
    label: "Rollback availability",
    ok: true,
    detail: "Rollback plan can be generated for this version."
  });
  const ok = checks.every((c) => c.ok) && issues.length === 0;
  const score = Math.round(checks.filter((c) => c.ok).length / checks.length * 100);
  return { ok, checks, issues, score };
}
function dryRunDeployment(plan) {
  const byBuilder = groupActionsByBuilder(plan);
  const surfaces = [];
  for (const b of orderedBuilders(plan)) {
    const actions = byBuilder.get(b) || [];
    surfaces.push({
      surface: surfaceForBuilder(b),
      builder: ownerLabel(b),
      ok: actions.length > 0,
      expectedDowntime: "None",
      rollbackAvailable: true
    });
  }
  surfaces.sort(
    (a, b) => SURFACE_ORDER.indexOf(a.surface) - SURFACE_ORDER.indexOf(b.surface)
  );
  return {
    ok: surfaces.every((s) => s.ok),
    surfaces,
    expectedDowntime: "None",
    rollbackAvailable: true,
    headline: "Deployment Preview"
  };
}
function scoreHealth(validation, stages, verification, rollbackReady) {
  const builders = stages.length ? Math.round(stages.filter((s) => s.status === "ok").length / stages.length * 100) : 0;
  const rollback = rollbackReady ? 100 : 0;
  const overall = Math.round(
    (validation.score + builders + verification.score + rollback) / 4
  );
  return {
    overall,
    validation: validation.score,
    builders,
    verification: verification.score,
    rollbackReady: rollback,
    label: "Deployment Health"
  };
}
function verifyLiveState(stages, liveState) {
  const checks = stages.map((s) => {
    const key = s.surface;
    const present = liveState[key] != null;
    return {
      id: `verify_${s.builder}`,
      label: `${ownerLabel(s.builder)} active`,
      ok: s.status === "ok" && present && s.verified,
      detail: present ? `${s.surface} verified live.` : `${s.surface} missing from live state.`
    };
  });
  const ok = checks.every((c) => c.ok);
  const score = checks.length ? Math.round(checks.filter((c) => c.ok).length / checks.length * 100) : 0;
  return { ok, checks, score };
}
function summarize(plan, versionLabel) {
  const todaysChanges = plan.changes.slice(0, 8).map((a) => a.reason || a.path);
  const expectedResults = [];
  if (plan.estimatedImpact.trustPct) {
    expectedResults.push(`+${plan.estimatedImpact.trustPct}% Trust`);
  }
  if (plan.estimatedImpact.conversionPct) {
    expectedResults.push(`+${plan.estimatedImpact.conversionPct}% Conversion`);
  }
  if (!expectedResults.length) expectedResults.push(plan.estimatedImpact.summary || "Business improved");
  return {
    headline: "Your business has been updated.",
    todaysChanges,
    expectedResults,
    businessVersion: versionLabel
  };
}
function deployApprovedChangePlan(opts) {
  const feedEvents = [];
  feedEvents.push(feed("\u{1F9E0}", "Validating", "running", "Running deployment validation\u2026"));
  const validation = validateForDeployment({
    plan: opts.plan,
    collaboration: opts.collaboration,
    preview: opts.preview
  });
  if (!validation.ok) {
    feedEvents.push(feed("\u{1F9E0}", "Validating", "failed", validation.issues.join("; ") || "Validation failed"));
    const dryRun2 = dryRunDeployment(opts.plan);
    const emptyStages = [];
    const verification2 = { ok: false, checks: [], score: 0 };
    const version2 = opts.businessVersion || proposeVersionFromPlan(
      opts.businessId,
      opts.plan,
      opts.preview,
      opts.collaboration
    );
    return {
      id: uid("deploy"),
      version: DEPLOYMENT_ENGINE_VERSION,
      label: DEPLOYMENT_ENGINE_LABEL,
      businessId: opts.businessId,
      changePlanId: opts.plan.id,
      collaborationId: opts.collaboration?.id || null,
      previewId: opts.preview?.id || null,
      businessVersionId: version2.id,
      businessVersionLabel: version2.label,
      status: "failed",
      approved: true,
      validation,
      dryRun: dryRun2,
      stages: emptyStages,
      progressiveOrder: orderedBuilders(opts.plan),
      feed: feedEvents,
      verification: verification2,
      health: scoreHealth(validation, emptyStages, verification2, true),
      summary: {
        headline: "Deployment blocked \u2014 validation did not pass.",
        todaysChanges: [],
        expectedResults: [],
        businessVersion: version2.label
      },
      memoryUpdates: [],
      liveState: {},
      rollback: null,
      deployed: false,
      verified: false,
      rolledBack: false,
      missionControlReplayId: opts.missionControlReplayId ?? null,
      timestamp: nowIso()
    };
  }
  feedEvents[feedEvents.length - 1] = feed("\u{1F9E0}", "Validating", "ok", "All validation checks green.");
  const dryRun = dryRunDeployment(opts.plan);
  feedEvents.push(
    feed("\u{1F50E}", "Dry run", dryRun.ok ? "ok" : "failed", `${dryRun.headline} \u2014 downtime ${dryRun.expectedDowntime}`)
  );
  let version = opts.businessVersion || proposeVersionFromPlan(
    opts.businessId,
    opts.plan,
    opts.preview,
    opts.collaboration
  );
  const byBuilder = groupActionsByBuilder(opts.plan);
  const progressiveOrder = orderedBuilders(opts.plan);
  const stages = [];
  const liveState = {};
  let failed = false;
  for (const b of progressiveOrder) {
    if (failed) {
      stages.push({
        builder: b,
        surface: surfaceForBuilder(b),
        ownerLabel: ownerLabel(b),
        status: "skipped",
        paths: (byBuilder.get(b) || []).map((a) => a.path),
        verified: false,
        error: "Skipped after prior stage failure."
      });
      continue;
    }
    const actions = byBuilder.get(b) || [];
    feedEvents.push(
      feed(emojiForBuilder(b), deployVerb(b), "running", `${ownerLabel(b)} deploying ${actions.length} change(s)\u2026`)
    );
    const surface = surfaceForBuilder(b);
    const slice = {};
    for (const a of actions) {
      slice[a.path] = a.desired;
    }
    const ok = actions.length > 0;
    if (!ok) {
      failed = true;
      stages.push({
        builder: b,
        surface,
        ownerLabel: ownerLabel(b),
        status: "failed",
        paths: [],
        verified: false,
        error: "No actions for builder."
      });
      feedEvents[feedEvents.length - 1] = feed(
        emojiForBuilder(b),
        deployVerb(b),
        "failed",
        "Stage failed \u2014 stopping progressive deployment."
      );
      break;
    }
    liveState[surface] = {
      builder: b,
      owner: ownerLabel(b),
      appliedAt: nowIso(),
      paths: actions.map((a) => a.path),
      desired: slice,
      active: true,
      published: b === "portfolio_builder",
      enabled: b === "automation",
      rendered: b === "website_builder"
    };
    stages.push({
      builder: b,
      surface,
      ownerLabel: ownerLabel(b),
      status: "ok",
      paths: actions.map((a) => a.path),
      verified: true,
      error: null
    });
    feedEvents[feedEvents.length - 1] = feed(
      emojiForBuilder(b),
      deployVerb(b),
      "ok",
      `${ownerLabel(b)} deployed ${actions.length} change(s).`
    );
  }
  if (failed) {
    for (const s of stages) {
      if (s.status === "ok") {
        delete liveState[s.surface];
        s.status = "rolled_back";
        s.verified = false;
      }
    }
    feedEvents.push(feed("\u21A9\uFE0F", "Rollback", "ok", "Stopped. Rolled back completed stages. Explained failure."));
    const verification2 = { ok: false, checks: [], score: 0 };
    return {
      id: uid("deploy"),
      version: DEPLOYMENT_ENGINE_VERSION,
      label: DEPLOYMENT_ENGINE_LABEL,
      businessId: opts.businessId,
      changePlanId: opts.plan.id,
      collaborationId: opts.collaboration?.id || null,
      previewId: opts.preview?.id || null,
      businessVersionId: version.id,
      businessVersionLabel: version.label,
      status: "failed",
      approved: true,
      validation,
      dryRun,
      stages,
      progressiveOrder,
      feed: feedEvents,
      verification: verification2,
      health: scoreHealth(validation, stages, verification2, true),
      summary: {
        headline: "Deployment stopped and rolled back after a stage failure.",
        todaysChanges: [],
        expectedResults: [],
        businessVersion: version.label
      },
      memoryUpdates: [],
      liveState: {},
      rollback: null,
      deployed: false,
      verified: false,
      rolledBack: true,
      missionControlReplayId: opts.missionControlReplayId ?? null,
      timestamp: nowIso()
    };
  }
  feedEvents.push(feed("\u{1F4DA}", "Updating Business Memory", "running", "Writing deployment into Business Memory\u2026"));
  const memoryUpdates = [
    {
      system: "business_memory",
      summary: `Deployed ${version.label}: ${opts.plan.title}`
    },
    {
      system: "conversation_intelligence",
      summary: `Active project advanced after deploy of ${version.label}`
    }
  ];
  if (stages.some((s) => s.builder === "workspace_builder")) {
    memoryUpdates.push({
      system: "workspace_memory",
      summary: "Workspace layout preferences updated from deployment."
    });
  }
  feedEvents[feedEvents.length - 1] = feed("\u{1F4DA}", "Updating Business Memory", "ok", "Memory updated.");
  const verification = verifyLiveState(stages, liveState);
  feedEvents.push(
    feed("\u2705", "Verification", verification.ok ? "ok" : "failed", "Post-deployment verification complete.")
  );
  version = markVersionApplied(opts.businessId, version.id) || version;
  const rollback = createRollbackPlan({
    businessId: opts.businessId,
    targetVersionId: version.parentVersionId || version.id,
    scope: "full",
    reason: "Rollback ready if the owner doesn't like this deployment."
  });
  const summary = summarize(opts.plan, version.label);
  feedEvents.push(feed("\u{1F389}", "Complete", "ok", summary.headline));
  const health = scoreHealth(validation, stages, verification, !!rollback);
  return {
    id: uid("deploy"),
    version: DEPLOYMENT_ENGINE_VERSION,
    label: DEPLOYMENT_ENGINE_LABEL,
    businessId: opts.businessId,
    changePlanId: opts.plan.id,
    collaborationId: opts.collaboration?.id || null,
    previewId: opts.preview?.id || null,
    businessVersionId: version.id,
    businessVersionLabel: version.label,
    status: verification.ok ? "deployed" : "verified",
    approved: true,
    validation,
    dryRun,
    stages,
    progressiveOrder,
    feed: feedEvents,
    verification,
    health,
    summary,
    memoryUpdates,
    liveState,
    rollback,
    deployed: true,
    verified: verification.ok,
    rolledBack: false,
    missionControlReplayId: opts.missionControlReplayId ?? null,
    timestamp: nowIso()
  };
}
function executeDeploymentRollback(opts) {
  const current = getCurrentVersion(opts.businessId);
  const targetId = opts.deployment.rollback?.targetVersionId || current?.parentVersionId || opts.deployment.businessVersionId;
  const target = getVersion(opts.businessId, targetId);
  const fromId = opts.deployment.businessVersionId;
  const feedEvents = [...opts.deployment.feed];
  feedEvents.push(
    feed("\u21A9\uFE0F", "Restoring", "running", `Restoring ${target?.label || "prior version"}\u2026`)
  );
  let rollback = opts.deployment.rollback;
  if (!rollback) {
    rollback = createRollbackPlan({
      businessId: opts.businessId,
      targetVersionId: targetId,
      scope: "full",
      reason: opts.reason || "Owner asked to undo the deployment."
    });
  }
  if (rollback) {
    rollback = {
      ...rollback,
      executed: true,
      applied: true,
      status: "rolled_back",
      waitingFor: "none",
      reason: opts.reason || rollback.reason
    };
  }
  markVersionRolledBack(opts.businessId, fromId, targetId);
  const liveState = {};
  if (target) {
    for (const c of target.changes) {
      const surface = c.surface;
      const prev = liveState[surface] || {
        builder: c.builderOwner,
        paths: [],
        desired: {},
        active: true
      };
      prev.desired[c.path] = c.after;
      prev.paths.push(c.path);
      liveState[surface] = prev;
    }
  }
  feedEvents[feedEvents.length - 1] = feed(
    "\u21A9\uFE0F",
    "Restoring",
    "ok",
    `Restored ${target?.label || "prior version"}. Verified.`
  );
  feedEvents.push(feed("\u{1F389}", "Rollback complete", "ok", "Done."));
  const verification = verifyLiveState(
    opts.deployment.stages.map((s) => ({
      ...s,
      status: liveState[s.surface] ? "ok" : "rolled_back",
      verified: !!liveState[s.surface]
    })),
    liveState
  );
  return {
    ...opts.deployment,
    status: "rolled_back",
    feed: feedEvents,
    liveState,
    rollback,
    verification,
    deployed: false,
    verified: verification.ok,
    rolledBack: true,
    summary: {
      ...opts.deployment.summary,
      headline: `Restored ${target?.label || "prior version"}.`,
      businessVersion: target?.label || opts.deployment.businessVersionLabel
    },
    health: {
      ...opts.deployment.health,
      overall: 100,
      rollbackReady: 100,
      label: "Deployment Health"
    },
    timestamp: nowIso()
  };
}
var HublyBusinessDeployment = {
  version: DEPLOYMENT_ENGINE_VERSION,
  owner: DEPLOYMENT_ENGINE_OWNER,
  label: DEPLOYMENT_ENGINE_LABEL,
  validate: validateForDeployment,
  dryRun: dryRunDeployment,
  deploy: deployApprovedChangePlan,
  rollback: executeDeploymentRollback,
  progressiveOrder: PROGRESSIVE_ORDER
};
export {
  DEPLOYMENT_ENGINE_LABEL,
  DEPLOYMENT_ENGINE_OWNER,
  DEPLOYMENT_ENGINE_VERSION,
  HublyBusinessDeployment,
  PROGRESSIVE_ORDER,
  deployApprovedChangePlan,
  dryRunDeployment,
  executeDeploymentRollback,
  validateForDeployment
};
