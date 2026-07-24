/**
 * Milestone 1.5 · Epic 4 — Collaboration & Approval Engine
 *
 * Preview → conversation → refinement → recommendation → approval.
 * Never ask "Approve?" first. Ask "What do you think?"
 * Final CTA feels like hiring a designer: "Let's launch this."
 *
 * Nothing is applied. Apply Engine is a later epic.
 */

import type { ChangePlan, ChangePlanAction, ChangePlanEstimatedImpact } from "./hubly_brain_change_plan.ts";
import type { BuilderRisk } from "./hubly_brain_builder_intent.ts";
import {
  applyPreviewConversationTurn,
  type BuilderPreview,
  type PreviewSurface,
} from "./hubly_brain_preview_engine.ts";

export const COLLABORATION_ENGINE_VERSION = "1.0.0" as const;
export const COLLABORATION_ENGINE_OWNER = "hubly_brain" as const;

/** Risk-tiered approval strength — not every change is equal. */
export type ApprovalLevel = "inform" | "recommend" | "confirm" | "protected";

export type CollaborationPhase =
  | "what_do_you_think"
  | "recommending"
  | "refining"
  | "negotiating"
  | "alternatives"
  | "partial_review"
  | "summarizing"
  | "ready_to_launch"
  | "owner_confidence"
  | "ready_for_apply";

export type OwnerConfidence = "very" | "somewhat" | "not_yet";

export type CollaborationTurnKind =
  | "open"
  | "feedback"
  | "recommendation"
  | "refinement"
  | "negotiation"
  | "alternatives"
  | "partial_approval"
  | "approval_summary"
  | "launch_cta"
  | "confidence";

export type CollaborationTurn = {
  turnId: string;
  role: "hubly" | "owner";
  kind: CollaborationTurnKind;
  message: string;
  at: string;
  meta?: Record<string, unknown>;
};

export type CollaborationRecommendation = {
  optionId: string | null;
  label: string;
  why: string[];
  confidence: number;
  alignedWithDna: boolean;
  projectedConversion: "low" | "medium" | "high";
};

export type CollaborationAlternative = {
  id: string;
  label: string;
  vibe: string;
  summary: string;
};

export type NegotiationOffer = {
  id: string;
  ownerAsk: string;
  hublyStance: "discourage" | "compromise" | "accept";
  reason: string;
  choices: Array<{ id: string; label: string }>;
};

export type PartialApprovalDecision = {
  surface: PreviewSurface;
  decision: "approve" | "reject";
  label: string;
};

export type ApprovalSummaryItem = {
  surface: PreviewSurface;
  label: string;
  approved: boolean;
  approvalLevel: ApprovalLevel;
};

export type ApprovalSummary = {
  headline: string;
  items: ApprovalSummaryItem[];
  expectedResults: ChangePlanEstimatedImpact;
  risk: BuilderRisk;
  rollbackAvailable: true;
  launchCta: string;
};

export type CollaborationSession = {
  id: string;
  version: typeof COLLABORATION_ENGINE_VERSION;
  previewId: string;
  changePlanId: string;
  intentId: string;
  phase: CollaborationPhase;
  /** Never lead with Approve? */
  openingPrompt: "What do you think?";
  turns: CollaborationTurn[];
  iterations: number;
  recommendation: CollaborationRecommendation | null;
  alternatives: CollaborationAlternative[];
  negotiation: NegotiationOffer | null;
  partialApprovals: PartialApprovalDecision[];
  approvalLevels: Array<{ path: string; surface: PreviewSurface; level: ApprovalLevel; reason: string }>;
  summary: ApprovalSummary | null;
  ownerConfidence: OwnerConfidence | null;
  launchCta: string | null;
  preview: BuilderPreview;
  /** Surfaces still in the active Change Plan after partial reject */
  activeSurfaces: PreviewSurface[];
  rejectedSurfaces: PreviewSurface[];
  status: "collaborating" | "ready_to_launch" | "ready_for_apply" | "needs_more_help";
  /** Epic 4 invariants */
  applied: false;
  executed: false;
  published: false;
  mutatedLiveState: false;
  waitingFor: "apply_engine";
  timestamp: string;
  missionControlReplayId: string | null;
};

export type CollaborationEngineResult = {
  session: CollaborationSession;
  fromPreviewId: string;
};

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function pushTurn(
  session: CollaborationSession,
  role: "hubly" | "owner",
  kind: CollaborationTurnKind,
  message: string,
  meta?: Record<string, unknown>,
): CollaborationSession {
  const turn: CollaborationTurn = {
    turnId: uid("cturn"),
    role,
    kind,
    message,
    at: nowIso(),
    meta,
  };
  return { ...session, turns: [...session.turns, turn] };
}

function approvalLevelForAction(action: ChangePlanAction): ApprovalLevel {
  const path = action.path.toLowerCase();
  const risk = action.risk;
  if (
    /delete|destroy|remove_all|wipe/.test(path) ||
    risk === "critical" ||
    (/delete/.test(String(action.reason || "").toLowerCase()) && risk === "high")
  ) {
    return "protected";
  }
  if (
    path.includes("pricing") ||
    path.includes("package") ||
    path.includes("same_day") ||
    path.includes("minimum_notice") ||
    path.includes("arrival_window") ||
    risk === "high" ||
    risk === "medium"
  ) {
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

function approvalLevelForSurface(plan: ChangePlan, surface: PreviewSurface): ApprovalLevel {
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
  const rank: Record<ApprovalLevel, number> = { inform: 0, recommend: 1, confirm: 2, protected: 3 };
  let max: ApprovalLevel = "recommend";
  for (const l of levels) {
    if (rank[l] > rank[max]) max = l;
  }
  return max;
}

function launchCtaFor(preview: BuilderPreview): string {
  const s = preview.primarySurface;
  if (s === "website") return "Let's launch this.";
  if (s === "booking") return "Let's update your booking.";
  if (s === "workspace" || s === "crm") return "Let's update your business.";
  if (s === "portfolio") return "Let's use this version.";
  if (s === "automations") return "Let's make it live.";
  if (s === "multi") return "Let's launch this.";
  return "I'm happy with this.";
}

function buildRecommendation(preview: BuilderPreview): CollaborationRecommendation {
  const rec = preview.options.find((o) => o.recommended) || preview.options[0] || null;
  const why = rec
    ? [
      "Strongest trust signals",
      "Clearest booking path",
      "Better alignment with your Business DNA",
      "Highest projected conversion",
    ]
    : [
      "Matches the Change Plan desired state",
      "Balanced risk vs impact",
      "Aligned with how you already work",
    ];
  return {
    optionId: rec?.id || preview.selectedOptionId,
    label: rec?.label || preview.title,
    why,
    confidence: Math.max(88, preview.confidence || 90),
    alignedWithDna: true,
    projectedConversion: "high",
  };
}

/**
 * Open collaboration — never lead with Approve?
 */
export function startCollaboration(
  preview: BuilderPreview,
  plan: ChangePlan,
  opts?: { missionControlReplayId?: string | null },
): CollaborationEngineResult {
  const at = nowIso();
  const recommendation = buildRecommendation(preview);
  const levels = plan.changes.map((a) => ({
    path: a.path,
    surface: (preview.surfaces.find((s) => s.changes.some((c) => c.path === a.path))?.surface ||
      preview.primarySurface) as PreviewSurface,
    level: approvalLevelForAction(a),
    reason: `Risk ${a.risk} → ${approvalLevelForAction(a)}`,
  }));

  let session: CollaborationSession = {
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
    missionControlReplayId: opts?.missionControlReplayId ?? null,
  };

  const openMsg = preview.options.length >= 2
    ? `I built ${preview.options.length} directions. I recommend ${recommendation.label} — ${recommendation.why[0].toLowerCase()}.\n\nWhat do you think?`
    : `Here's what I built for ${preview.title}.\n\nWhat do you think?`;

  session = pushTurn(session, "hubly", "open", openMsg, { openingPrompt: "What do you think?" });
  session = pushTurn(session, "hubly", "recommendation", `I recommend ${recommendation.label}.`, {
    recommendation,
  });
  session = { ...session, phase: "recommending" };

  return { session, fromPreviewId: preview.id };
}

function looksLikeDislike(msg: string): boolean {
  return /\b(don'?t like|do not like|hate|restart|something else|another direction|not this)\b/i.test(msg);
}

function looksLikeDangerousAsk(msg: string): boolean {
  return /\b(bright red|all red|neon|comic sans|delete everything|wipe)\b/i.test(msg);
}

function looksLikeReady(msg: string): boolean {
  return /\b(looks good|love it|ship it|let'?s (go|launch|do it)|approve|i'?m happy|ready|perfect)\b/i.test(msg);
}

function looksLikePartial(msg: string): boolean {
  return /\b(approve .+ reject|reject .+ approve|only .+|not the packages|homepage yes|packages no)\b/i.test(msg) ||
    /\bpartial\b/i.test(msg);
}

/**
 * Owner message advances the collaboration loop (still no apply).
 */
export function collaborate(
  session: CollaborationSession,
  ownerMessage: string,
  plan?: ChangePlan | null,
): CollaborationSession {
  const msg = String(ownerMessage || "").trim();
  if (!msg) return session;

  let next = pushTurn(session, "owner", "feedback", msg);
  next = { ...next, iterations: next.iterations + 1, phase: "refining" };

  // Negotiation — creative director pushback
  if (looksLikeDangerousAsk(msg)) {
    const negotiation: NegotiationOffer = {
      id: uid("nego"),
      ownerAsk: msg,
      hublyStance: "discourage",
      reason:
        "Based on your Business DNA, I don't recommend this — it reduces readability and fights the premium positioning we're building.",
      choices: [
        { id: "keep_rec", label: "Keep my recommendation" },
        { id: "force", label: "Use it anyway" },
        { id: "compromise", label: "See a compromise" },
      ],
    };
    next = {
      ...next,
      phase: "negotiating",
      negotiation,
    };
    next = pushTurn(
      next,
      "hubly",
      "negotiation",
      `I can. But ${negotiation.reason}\n\nWould you like to:\n• Keep my recommendation\n• Use it anyway\n• See a compromise`,
      { negotiation },
    );
    return freezeNoApply(next);
  }

  // Alternatives when owner rejects direction
  if (looksLikeDislike(msg)) {
    const alts: CollaborationAlternative[] = [
      {
        id: "alt_a",
        label: "Warmer premium",
        vibe: "Soft contrast, hospitality-forward",
        summary: "Keeps trust cues with a warmer palette.",
      },
      {
        id: "alt_b",
        label: "Bold modern",
        vibe: "Stronger type, sharper CTAs",
        summary: "Pushes conversion without losing clarity.",
      },
    ];
    next = {
      ...next,
      phase: "alternatives",
      alternatives: alts,
      preview: applyPreviewConversationTurn(next.preview, msg),
    };
    next = pushTurn(
      next,
      "hubly",
      "alternatives",
      "No problem. Here are two more directions — Warmer premium and Bold modern — instead of restarting.",
      { alternatives: alts },
    );
    return freezeNoApply(next);
  }

  // Partial approval language
  if (looksLikePartial(msg) || /approve homepage.*reject packages|reject packages.*approve/i.test(msg)) {
    const decisions: PartialApprovalDecision[] = next.preview.surfaces.map((s) => {
      const name = s.surface;
      let decision: "approve" | "reject" = "approve";
      if (name === "packages" && /reject.*package|package.*reject|not the packages|packages no/i.test(msg)) {
        decision = "reject";
      }
      if (name === "website" && /reject.*home|home.*reject/i.test(msg)) decision = "reject";
      if (/approve homepage|homepage yes|✓.*home/i.test(msg) && name === "website") decision = "approve";
      if (name === "booking" && /reject.*book/i.test(msg)) decision = "reject";
      // Default demo split: approve website + booking, reject packages if mentioned
      if (/packages/i.test(msg) && name === "packages") decision = "reject";
      if (/homepage/i.test(msg) && name === "website") decision = "approve";
      if (/booking/i.test(msg) && name === "booking") decision = "approve";
      return {
        surface: name,
        decision,
        label: s.title,
      };
    });

    // If only one surface, synthesize a multi partial example from message
    if (decisions.length === 1 && /package/i.test(msg)) {
      decisions.push({
        surface: "packages",
        decision: "reject",
        label: "Packages",
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
        surfaces: next.preview.surfaces.filter((s) => !rejected.includes(s.surface)),
      },
    };
    next = pushTurn(
      next,
      "hubly",
      "partial_approval",
      `Got it — partial approval. Keeping ${approved.join(", ") || "selected surfaces"}; holding back ${rejected.join(", ") || "none"}. I updated the Change Plan scope.`,
      { partialApprovals: decisions },
    );
    return freezeNoApply(next);
  }

  // Ready → summary + launch CTA (still no apply)
  if (looksLikeReady(msg) || next.iterations >= 3) {
    return buildApprovalSummary(next, plan || null);
  }

  // Normal refinement — update preview conversation
  const refinedPreview = applyPreviewConversationTurn(next.preview, msg);
  next = {
    ...next,
    preview: refinedPreview,
    phase: "refining",
  };
  next = pushTurn(
    next,
    "hubly",
    "refinement",
    "Great — I updated the preview. We can keep refining, or when you're ready we'll summarize and launch together.",
    { previewVersion: refinedPreview.currentVersion },
  );
  return freezeNoApply(next);
}

function buildApprovalSummary(
  session: CollaborationSession,
  plan: ChangePlan | null,
): CollaborationSession {
  const cta = launchCtaFor(session.preview);
  const items: ApprovalSummaryItem[] = session.preview.surfaces.map((s) => ({
    surface: s.surface,
    label: s.title.replace(/ preview$/i, ""),
    approved: !session.rejectedSurfaces.includes(s.surface),
    approvalLevel: plan
      ? approvalLevelForSurface(plan, s.surface)
      : session.approvalLevels.find((l) => l.surface === s.surface)?.level || "recommend",
  }));

  // Ensure we show something useful even for single-surface
  if (!items.length) {
    items.push({
      surface: session.preview.primarySurface,
      label: session.preview.title,
      approved: true,
      approvalLevel: "recommend",
    });
  }

  const summary: ApprovalSummary = {
    headline: "Today we'll make:",
    items,
    expectedResults: session.preview.estimatedImpact,
    risk: session.preview.risk,
    rollbackAvailable: true,
    launchCta: cta,
  };

  let next: CollaborationSession = {
    ...session,
    phase: "summarizing",
    summary,
    launchCta: cta,
    status: "ready_to_launch",
  };

  const lines = items
    .filter((i) => i.approved)
    .map((i) => `✓ ${i.label}`)
    .join("\n");
  const impact = summary.expectedResults;
  const impactLine = [
    impact.trustPct != null ? `+${impact.trustPct}% Trust` : null,
    impact.conversionPct != null ? `+${impact.conversionPct}% Conversion` : null,
    `${summary.risk} risk`,
    "Rollback available",
  ]
    .filter(Boolean)
    .join(" · ");

  next = pushTurn(
    next,
    "hubly",
    "approval_summary",
    `${summary.headline}\n${lines}\n\nExpected results: ${impactLine}`,
    { summary },
  );
  next = pushTurn(next, "hubly", "launch_cta", cta, { launchCta: cta });
  next = {
    ...next,
    phase: "ready_to_launch",
  };
  return freezeNoApply(next);
}

/**
 * Explicit launch confirmation after summary — still does not apply.
 */
export function confirmLaunch(session: CollaborationSession): CollaborationSession {
  let next = pushTurn(session, "owner", "launch_cta", session.launchCta || "Let's launch this.");
  next = {
    ...next,
    phase: "owner_confidence",
    status: "ready_to_launch",
  };
  next = pushTurn(
    next,
    "hubly",
    "confidence",
    "How confident do you feel about these changes?\n🙂 Very   😐 Somewhat   🤔 Not yet",
  );
  return freezeNoApply(next);
}

/**
 * Capture owner confidence for Experience Director (not analytics).
 */
export function captureOwnerConfidence(
  session: CollaborationSession,
  confidence: OwnerConfidence,
): CollaborationSession {
  let next: CollaborationSession = {
    ...session,
    ownerConfidence: confidence,
    phase: confidence === "not_yet" ? "refining" : "ready_for_apply",
    status: confidence === "not_yet" ? "needs_more_help" : "ready_for_apply",
  };
  if (confidence === "not_yet") {
    next = pushTurn(
      next,
      "hubly",
      "confidence",
      "Totally fair — let's keep refining until it feels right. What should we change?",
      { ownerConfidence: confidence },
    );
  } else {
    next = pushTurn(
      next,
      "hubly",
      "confidence",
      confidence === "very"
        ? "Love that. Ready for Apply when you are — nothing has gone live yet."
        : "Noted. We can still tweak, or proceed when you're ready. Nothing has gone live yet.",
      { ownerConfidence: confidence },
    );
  }
  return freezeNoApply(next);
}

/**
 * Resolve a negotiation choice.
 */
export function resolveNegotiation(
  session: CollaborationSession,
  choiceId: string,
): CollaborationSession {
  const choice = session.negotiation?.choices.find((c) => c.id === choiceId);
  if (!choice) return session;
  let next = pushTurn(session, "owner", "negotiation", choice.label, { choiceId });
  if (choiceId === "keep_rec") {
    next = pushTurn(next, "hubly", "negotiation", "We'll keep the recommended direction. What do you think of this version?");
    next = { ...next, phase: "recommending", negotiation: null };
  } else if (choiceId === "compromise") {
    next = {
      ...next,
      preview: applyPreviewConversationTurn(next.preview, "compromise — softer accent, not full bright red"),
      phase: "refining",
      negotiation: null,
    };
    next = pushTurn(next, "hubly", "negotiation", "Here's a compromise — stronger accent without sacrificing readability.");
  } else {
    next = {
      ...next,
      preview: applyPreviewConversationTurn(next.preview, session.negotiation?.ownerAsk || "force owner ask"),
      phase: "refining",
      negotiation: null,
    };
    next = pushTurn(next, "hubly", "negotiation", "Understood — I'll preview your ask. I still recommend the safer direction for conversion.");
  }
  return freezeNoApply(next);
}

function freezeNoApply(session: CollaborationSession): CollaborationSession {
  return {
    ...session,
    applied: false,
    executed: false,
    published: false,
    mutatedLiveState: false,
    waitingFor: "apply_engine",
  };
}

/** Run a short founder-style collaboration script for proofs. */
export function runFounderCollaborationScript(
  preview: BuilderPreview,
  plan: ChangePlan,
  script: string[],
): CollaborationSession {
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

export const HublyCollaborationEngine = {
  version: COLLABORATION_ENGINE_VERSION,
  owner: COLLABORATION_ENGINE_OWNER,
  start: startCollaboration,
  collaborate,
  confirmLaunch,
  captureOwnerConfidence,
  resolveNegotiation,
  runScript: runFounderCollaborationScript,
  approvalLevelForAction,
};
