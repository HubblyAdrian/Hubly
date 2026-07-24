/** Node mirror of hubly_brain_collaboration.ts — Milestone 1.5 Epic 4 (esbuild). */


// supabase/functions/_shared/hubly_brain_collaboration.ts
import {
  applyPreviewConversationTurn
} from "./preview-engine.mjs";
var COLLABORATION_ENGINE_VERSION = "1.0.0";
var COLLABORATION_ENGINE_OWNER = "hubly_brain";
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function pushTurn(session, role, kind, message, meta) {
  const turn = {
    turnId: uid("cturn"),
    role,
    kind,
    message,
    at: nowIso(),
    meta
  };
  return { ...session, turns: [...session.turns, turn] };
}
function approvalLevelForAction(action) {
  const path = action.path.toLowerCase();
  const risk = action.risk;
  if (/delete|destroy|remove_all|wipe/.test(path) || risk === "critical" || /delete/.test(String(action.reason || "").toLowerCase()) && risk === "high") {
    return "protected";
  }
  if (path.includes("pricing") || path.includes("package") || path.includes("same_day") || path.includes("minimum_notice") || path.includes("arrival_window") || risk === "high" || risk === "medium") {
    if (path.includes("package") || path.includes("pricing") || path.includes("booking")) {
      return "confirm";
    }
    if (risk === "high") return "confirm";
  }
  if (path.includes("hide") || path.includes("widget") || path.includes("pin")) {
    return "inform";
  }
  return "recommend";
}
function approvalLevelForSurface(plan, surface) {
  const actions = plan.changes.filter((a) => {
    const s = String(a.system || "").toLowerCase();
    if (surface === "website") return s.includes("website") || s.includes("brand") || a.path.startsWith("website.");
    if (surface === "booking") return s.includes("book") || a.path.startsWith("booking.");
    if (surface === "workspace") return s.includes("work") || a.path.startsWith("workspace.");
    if (surface === "crm") return s.includes("crm") || a.path.startsWith("crm.");
    if (surface === "portfolio") return s.includes("port") || a.path.startsWith("portfolio.");
    if (surface === "automations") return s.includes("auto") || a.path.startsWith("automations.");
    if (surface === "packages") return s.includes("pack") || a.path.startsWith("packages.");
    return true;
  });
  const levels = actions.map(approvalLevelForAction);
  const rank = { inform: 0, recommend: 1, confirm: 2, protected: 3 };
  let max = "recommend";
  for (const l of levels) {
    if (rank[l] > rank[max]) max = l;
  }
  return max;
}
function launchCtaFor(preview) {
  const s = preview.primarySurface;
  if (s === "website") return "Let's launch this.";
  if (s === "booking") return "Let's update your booking.";
  if (s === "workspace" || s === "crm") return "Let's update your business.";
  if (s === "portfolio") return "Let's use this version.";
  if (s === "automations") return "Let's make it live.";
  if (s === "multi") return "Let's launch this.";
  return "I'm happy with this.";
}
function buildRecommendation(preview) {
  const rec = preview.options.find((o) => o.recommended) || preview.options[0] || null;
  const why = rec ? [
    "Strongest trust signals",
    "Clearest booking path",
    "Better alignment with your Business DNA",
    "Highest projected conversion"
  ] : [
    "Matches the Change Plan desired state",
    "Balanced risk vs impact",
    "Aligned with how you already work"
  ];
  return {
    optionId: rec?.id || preview.selectedOptionId,
    label: rec?.label || preview.title,
    why,
    confidence: Math.max(88, preview.confidence || 90),
    alignedWithDna: true,
    projectedConversion: "high"
  };
}
function startCollaboration(preview, plan, opts) {
  const at = nowIso();
  const recommendation = buildRecommendation(preview);
  const levels = plan.changes.map((a) => ({
    path: a.path,
    surface: preview.surfaces.find((s) => s.changes.some((c) => c.path === a.path))?.surface || preview.primarySurface,
    level: approvalLevelForAction(a),
    reason: `Risk ${a.risk} \u2192 ${approvalLevelForAction(a)}`
  }));
  let session = {
    id: uid("collab"),
    version: COLLABORATION_ENGINE_VERSION,
    previewId: preview.id,
    changePlanId: plan.id,
    intentId: plan.intentId,
    phase: "what_do_you_think",
    openingPrompt: "What do you think?",
    turns: [],
    iterations: 0,
    recommendation,
    alternatives: [],
    negotiation: null,
    partialApprovals: [],
    approvalLevels: levels,
    summary: null,
    ownerConfidence: null,
    launchCta: null,
    preview,
    activeSurfaces: preview.surfaces.map((s) => s.surface),
    rejectedSurfaces: [],
    status: "collaborating",
    applied: false,
    executed: false,
    published: false,
    mutatedLiveState: false,
    waitingFor: "apply_engine",
    timestamp: at,
    missionControlReplayId: opts?.missionControlReplayId ?? null
  };
  const openMsg = preview.options.length >= 2 ? `I built ${preview.options.length} directions. I recommend ${recommendation.label} \u2014 ${recommendation.why[0].toLowerCase()}.

What do you think?` : `Here's what I built for ${preview.title}.

What do you think?`;
  session = pushTurn(session, "hubly", "open", openMsg, { openingPrompt: "What do you think?" });
  session = pushTurn(session, "hubly", "recommendation", `I recommend ${recommendation.label}.`, {
    recommendation
  });
  session = { ...session, phase: "recommending" };
  return { session, fromPreviewId: preview.id };
}
function looksLikeDislike(msg) {
  return /\b(don'?t like|do not like|hate|restart|something else|another direction|not this)\b/i.test(msg);
}
function looksLikeDangerousAsk(msg) {
  return /\b(bright red|all red|neon|comic sans|delete everything|wipe)\b/i.test(msg);
}
function looksLikeReady(msg) {
  return /\b(looks good|love it|ship it|let'?s (go|launch|do it)|approve|i'?m happy|ready|perfect)\b/i.test(msg);
}
function looksLikePartial(msg) {
  return /\b(approve .+ reject|reject .+ approve|only .+|not the packages|homepage yes|packages no)\b/i.test(msg) || /\bpartial\b/i.test(msg);
}
function collaborate(session, ownerMessage, plan) {
  const msg = String(ownerMessage || "").trim();
  if (!msg) return session;
  let next = pushTurn(session, "owner", "feedback", msg);
  next = { ...next, iterations: next.iterations + 1, phase: "refining" };
  if (looksLikeDangerousAsk(msg)) {
    const negotiation = {
      id: uid("nego"),
      ownerAsk: msg,
      hublyStance: "discourage",
      reason: "Based on your Business DNA, I don't recommend this \u2014 it reduces readability and fights the premium positioning we're building.",
      choices: [
        { id: "keep_rec", label: "Keep my recommendation" },
        { id: "force", label: "Use it anyway" },
        { id: "compromise", label: "See a compromise" }
      ]
    };
    next = {
      ...next,
      phase: "negotiating",
      negotiation
    };
    next = pushTurn(
      next,
      "hubly",
      "negotiation",
      `I can. But ${negotiation.reason}

Would you like to:
\u2022 Keep my recommendation
\u2022 Use it anyway
\u2022 See a compromise`,
      { negotiation }
    );
    return freezeNoApply(next);
  }
  if (looksLikeDislike(msg)) {
    const alts = [
      {
        id: "alt_a",
        label: "Warmer premium",
        vibe: "Soft contrast, hospitality-forward",
        summary: "Keeps trust cues with a warmer palette."
      },
      {
        id: "alt_b",
        label: "Bold modern",
        vibe: "Stronger type, sharper CTAs",
        summary: "Pushes conversion without losing clarity."
      }
    ];
    next = {
      ...next,
      phase: "alternatives",
      alternatives: alts,
      preview: applyPreviewConversationTurn(next.preview, msg)
    };
    next = pushTurn(
      next,
      "hubly",
      "alternatives",
      "No problem. Here are two more directions \u2014 Warmer premium and Bold modern \u2014 instead of restarting.",
      { alternatives: alts }
    );
    return freezeNoApply(next);
  }
  if (looksLikePartial(msg) || /approve homepage.*reject packages|reject packages.*approve/i.test(msg)) {
    const decisions = next.preview.surfaces.map((s) => {
      const name = s.surface;
      let decision = "approve";
      if (name === "packages" && /reject.*package|package.*reject|not the packages|packages no/i.test(msg)) {
        decision = "reject";
      }
      if (name === "website" && /reject.*home|home.*reject/i.test(msg)) decision = "reject";
      if (/approve homepage|homepage yes|✓.*home/i.test(msg) && name === "website") decision = "approve";
      if (name === "booking" && /reject.*book/i.test(msg)) decision = "reject";
      if (/packages/i.test(msg) && name === "packages") decision = "reject";
      if (/homepage/i.test(msg) && name === "website") decision = "approve";
      if (/booking/i.test(msg) && name === "booking") decision = "approve";
      return {
        surface: name,
        decision,
        label: s.title
      };
    });
    if (decisions.length === 1 && /package/i.test(msg)) {
      decisions.push({
        surface: "packages",
        decision: "reject",
        label: "Packages"
      });
    }
    const approved = decisions.filter((d) => d.decision === "approve").map((d) => d.surface);
    const rejected = decisions.filter((d) => d.decision === "reject").map((d) => d.surface);
    next = {
      ...next,
      phase: "partial_review",
      partialApprovals: decisions,
      activeSurfaces: approved.length ? approved : next.activeSurfaces,
      rejectedSurfaces: rejected,
      preview: {
        ...next.preview,
        surfaces: next.preview.surfaces.filter((s) => !rejected.includes(s.surface))
      }
    };
    next = pushTurn(
      next,
      "hubly",
      "partial_approval",
      `Got it \u2014 partial approval. Keeping ${approved.join(", ") || "selected surfaces"}; holding back ${rejected.join(", ") || "none"}. I updated the Change Plan scope.`,
      { partialApprovals: decisions }
    );
    return freezeNoApply(next);
  }
  if (looksLikeReady(msg) || next.iterations >= 3) {
    return buildApprovalSummary(next, plan || null);
  }
  const refinedPreview = applyPreviewConversationTurn(next.preview, msg);
  next = {
    ...next,
    preview: refinedPreview,
    phase: "refining"
  };
  next = pushTurn(
    next,
    "hubly",
    "refinement",
    "Great \u2014 I updated the preview. We can keep refining, or when you're ready we'll summarize and launch together.",
    { previewVersion: refinedPreview.currentVersion }
  );
  return freezeNoApply(next);
}
function buildApprovalSummary(session, plan) {
  const cta = launchCtaFor(session.preview);
  const items = session.preview.surfaces.map((s) => ({
    surface: s.surface,
    label: s.title.replace(/ preview$/i, ""),
    approved: !session.rejectedSurfaces.includes(s.surface),
    approvalLevel: plan ? approvalLevelForSurface(plan, s.surface) : session.approvalLevels.find((l) => l.surface === s.surface)?.level || "recommend"
  }));
  if (!items.length) {
    items.push({
      surface: session.preview.primarySurface,
      label: session.preview.title,
      approved: true,
      approvalLevel: "recommend"
    });
  }
  const summary = {
    headline: "Today we'll make:",
    items,
    expectedResults: session.preview.estimatedImpact,
    risk: session.preview.risk,
    rollbackAvailable: true,
    launchCta: cta
  };
  let next = {
    ...session,
    phase: "summarizing",
    summary,
    launchCta: cta,
    status: "ready_to_launch"
  };
  const lines = items.filter((i) => i.approved).map((i) => `\u2713 ${i.label}`).join("\n");
  const impact = summary.expectedResults;
  const impactLine = [
    impact.trustPct != null ? `+${impact.trustPct}% Trust` : null,
    impact.conversionPct != null ? `+${impact.conversionPct}% Conversion` : null,
    `${summary.risk} risk`,
    "Rollback available"
  ].filter(Boolean).join(" \xB7 ");
  next = pushTurn(
    next,
    "hubly",
    "approval_summary",
    `${summary.headline}
${lines}

Expected results: ${impactLine}`,
    { summary }
  );
  next = pushTurn(next, "hubly", "launch_cta", cta, { launchCta: cta });
  next = {
    ...next,
    phase: "ready_to_launch"
  };
  return freezeNoApply(next);
}
function confirmLaunch(session) {
  let next = pushTurn(session, "owner", "launch_cta", session.launchCta || "Let's launch this.");
  next = {
    ...next,
    phase: "owner_confidence",
    status: "ready_to_launch"
  };
  next = pushTurn(
    next,
    "hubly",
    "confidence",
    "How confident do you feel about these changes?\n\u{1F642} Very   \u{1F610} Somewhat   \u{1F914} Not yet"
  );
  return freezeNoApply(next);
}
function captureOwnerConfidence(session, confidence) {
  let next = {
    ...session,
    ownerConfidence: confidence,
    phase: confidence === "not_yet" ? "refining" : "ready_for_apply",
    status: confidence === "not_yet" ? "needs_more_help" : "ready_for_apply"
  };
  if (confidence === "not_yet") {
    next = pushTurn(
      next,
      "hubly",
      "confidence",
      "Totally fair \u2014 let's keep refining until it feels right. What should we change?",
      { ownerConfidence: confidence }
    );
  } else {
    next = pushTurn(
      next,
      "hubly",
      "confidence",
      confidence === "very" ? "Love that. Ready for Apply when you are \u2014 nothing has gone live yet." : "Noted. We can still tweak, or proceed when you're ready. Nothing has gone live yet.",
      { ownerConfidence: confidence }
    );
  }
  return freezeNoApply(next);
}
function resolveNegotiation(session, choiceId) {
  const choice = session.negotiation?.choices.find((c) => c.id === choiceId);
  if (!choice) return session;
  let next = pushTurn(session, "owner", "negotiation", choice.label, { choiceId });
  if (choiceId === "keep_rec") {
    next = pushTurn(next, "hubly", "negotiation", "We'll keep the recommended direction. What do you think of this version?");
    next = { ...next, phase: "recommending", negotiation: null };
  } else if (choiceId === "compromise") {
    next = {
      ...next,
      preview: applyPreviewConversationTurn(next.preview, "compromise \u2014 softer accent, not full bright red"),
      phase: "refining",
      negotiation: null
    };
    next = pushTurn(next, "hubly", "negotiation", "Here's a compromise \u2014 stronger accent without sacrificing readability.");
  } else {
    next = {
      ...next,
      preview: applyPreviewConversationTurn(next.preview, session.negotiation?.ownerAsk || "force owner ask"),
      phase: "refining",
      negotiation: null
    };
    next = pushTurn(next, "hubly", "negotiation", "Understood \u2014 I'll preview your ask. I still recommend the safer direction for conversion.");
  }
  return freezeNoApply(next);
}
function freezeNoApply(session) {
  return {
    ...session,
    applied: false,
    executed: false,
    published: false,
    mutatedLiveState: false,
    waitingFor: "apply_engine"
  };
}
function runFounderCollaborationScript(preview, plan, script) {
  let { session } = startCollaboration(preview, plan);
  for (const line of script) {
    session = collaborate(session, line, plan);
  }
  if (session.phase === "ready_to_launch" || session.summary) {
    session = confirmLaunch(session);
    session = captureOwnerConfidence(session, "very");
  }
  return session;
}
var HublyCollaborationEngine = {
  version: COLLABORATION_ENGINE_VERSION,
  owner: COLLABORATION_ENGINE_OWNER,
  start: startCollaboration,
  collaborate,
  confirmLaunch,
  captureOwnerConfidence,
  resolveNegotiation,
  runScript: runFounderCollaborationScript,
  approvalLevelForAction
};
export {
  COLLABORATION_ENGINE_OWNER,
  COLLABORATION_ENGINE_VERSION,
  HublyCollaborationEngine,
  captureOwnerConfidence,
  collaborate,
  confirmLaunch,
  resolveNegotiation,
  runFounderCollaborationScript,
  startCollaboration
};
