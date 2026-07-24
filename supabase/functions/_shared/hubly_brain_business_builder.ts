/**
 * Milestone 1.5 · Epic 6 — Business Builder
 *
 * Customer-facing: we build the *business*, not a Wix-style website editor.
 * Website remains one internal canvas / module (`website_builder`).
 *
 * Creative Session + Directions + Business Score + Creative Memory.
 * Still requires Collaboration/Approval before Apply. No mutations here.
 */

import type { ChangePlan, ChangePlanEstimatedImpact } from "./hubly_brain_change_plan.ts";
import type { BuilderPreview, PreviewSurface } from "./hubly_brain_preview_engine.ts";
import type { CollaborationSession } from "./hubly_brain_collaboration.ts";
import type { BusinessVersion } from "./hubly_brain_version_engine.ts";

export const BUSINESS_BUILDER_VERSION = "1.0.0" as const;
export const BUSINESS_BUILDER_OWNER = "hubly_brain" as const;
/** Customer-facing name — never "Website Builder" in owner UX. */
export const BUSINESS_BUILDER_LABEL = "Business Builder" as const;
/** Internal module that owns website canvas work. */
export const WEBSITE_MODULE_ID = "website_builder" as const;

export type CreativeDirectionId =
  | "neighborhood_favorite"
  | "luxury_brand"
  | "modern_professional"
  | "family_owned"
  | "minimal"
  | "bold"
  | "trusted_local"
  | "friendly_premium";

export type CreativeDirection = {
  id: CreativeDirectionId;
  label: string;
  vibe: string;
  affects: PreviewSurface[];
  summary: string;
};

export type CreativeDecision = {
  id: string;
  surface: PreviewSurface | "brand" | "trust" | "cta";
  title: string;
  detail: string;
  why: string;
  moduleOwner: string;
};

export type BusinessScore = {
  trust: number;
  professionalism: number;
  clarity: number;
  bookingExperience: number;
  visualQuality: number;
  consistency: number;
  overall: number;
  note: string;
};

export type CreativePreference = {
  key: string;
  value: string;
  learnedAt: string;
  source: string;
};

export type CreativeMemory = {
  businessId: string;
  preferences: CreativePreference[];
};

export type CreativeChallenge = {
  id: string;
  ownerAsk: string;
  hublyStance: "discourage" | "compromise" | "accept";
  reason: string;
  choices: Array<{ id: string; label: string }>;
};

export type CreativeWorkspace = {
  /** Left rail — conversation with the creative director */
  conversation: Array<{ role: "hubly" | "owner"; message: string; at: string }>;
  /** Right rail — live evolving business views */
  liveViews: Array<"website" | "booking" | "packages" | "portfolio">;
  activeView: "website" | "booking" | "packages" | "portfolio";
  split: "conversation_left_preview_right";
  feeling: "co_creating_with_creative_director";
};

export type CreativeSession = {
  id: string;
  version: typeof BUSINESS_BUILDER_VERSION;
  label: typeof BUSINESS_BUILDER_LABEL;
  businessId: string;
  changePlanId: string;
  previewId: string | null;
  collaborationId: string | null;
  versionId: string | null;
  direction: CreativeDirection;
  decisions: CreativeDecision[];
  score: BusinessScore;
  memory: CreativeMemory;
  challenge: CreativeChallenge | null;
  workspace: CreativeWorkspace;
  expectedImpact: ChangePlanEstimatedImpact;
  surfacesTouched: PreviewSurface[];
  headline: string;
  whySummary: string;
  requiresApproval: true;
  /** Epic 6 invariants */
  applied: false;
  executed: false;
  waitingFor: "collaboration_or_approval";
  timestamp: string;
  missionControlReplayId: string | null;
};

export type BusinessBuilderResult = {
  session: CreativeSession;
  fromChangePlanId: string;
};

const DIRECTIONS: Record<CreativeDirectionId, CreativeDirection> = {
  neighborhood_favorite: {
    id: "neighborhood_favorite",
    label: "Neighborhood Favorite",
    vibe: "Warm, local, trusted around the block",
    affects: ["website", "booking", "portfolio", "packages"],
    summary: "Local trust cues, friendly CTAs, community proof.",
  },
  luxury_brand: {
    id: "luxury_brand",
    label: "Luxury Brand",
    vibe: "Quiet luxury, proof-first, refined type",
    affects: ["website", "booking", "portfolio", "packages"],
    summary: "Premium buyers decide fast — optimize for trust first.",
  },
  modern_professional: {
    id: "modern_professional",
    label: "Modern Professional",
    vibe: "Clean grids, bold type, crisp booking",
    affects: ["website", "booking", "packages"],
    summary: "Clarity and speed without coldness.",
  },
  family_owned: {
    id: "family_owned",
    label: "Family-Owned",
    vibe: "Personal, story-led, human photos",
    affects: ["website", "portfolio", "packages"],
    summary: "Story and people over polish theater.",
  },
  minimal: {
    id: "minimal",
    label: "Minimal",
    vibe: "Whitespace, fewer sections, sharper hierarchy",
    affects: ["website", "booking", "packages"],
    summary: "Remove friction; keep only what converts.",
  },
  bold: {
    id: "bold",
    label: "Bold",
    vibe: "Strong contrast, punchy CTAs",
    affects: ["website", "packages", "portfolio"],
    summary: "Energy and confidence without chaos.",
  },
  trusted_local: {
    id: "trusted_local",
    label: "Trusted Local",
    vibe: "Reviews forward, clear service area",
    affects: ["website", "booking", "portfolio"],
    summary: "Proof and proximity first.",
  },
  friendly_premium: {
    id: "friendly_premium",
    label: "Friendly Premium",
    vibe: "Warm tone + elevated craft",
    affects: ["website", "booking", "packages", "portfolio"],
    summary: "Combine approachability with premium positioning.",
  },
};

const MEMORY = new Map<string, CreativeMemory>();

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function getCreativeMemory(businessId: string): CreativeMemory {
  const id = businessId || "biz_default";
  let m = MEMORY.get(id);
  if (!m) {
    m = { businessId: id, preferences: [] };
    MEMORY.set(id, m);
  }
  return m;
}

export function learnCreativePreference(
  businessId: string,
  key: string,
  value: string,
  source: string,
): CreativeMemory {
  const mem = getCreativeMemory(businessId);
  const existing = mem.preferences.findIndex((p) => p.key === key);
  const pref: CreativePreference = { key, value, learnedAt: nowIso(), source };
  if (existing >= 0) mem.preferences[existing] = pref;
  else mem.preferences.push(pref);
  return mem;
}

export function clearCreativeMemoryForTests(): void {
  MEMORY.clear();
}

function pickDirection(request: string, memory: CreativeMemory): CreativeDirection {
  const req = request.toLowerCase();
  const prefs = memory.preferences;

  if (/friend|warm|approachable/.test(req) && /premium|luxury/.test(req)) {
    return DIRECTIONS.friendly_premium;
  }
  if (/friend|warm|approachable/.test(req)) return DIRECTIONS.neighborhood_favorite;
  if (/minimal|simple|clean/.test(req)) return DIRECTIONS.minimal;
  if (/bold|loud|punch/.test(req)) return DIRECTIONS.bold;
  if (/family|owned/.test(req)) return DIRECTIONS.family_owned;
  if (/local|neighborhood|trusted/.test(req)) return DIRECTIONS.trusted_local;
  if (/modern|professional/.test(req)) return DIRECTIONS.modern_professional;
  if (/premium|luxury|elevated/.test(req)) return DIRECTIONS.luxury_brand;

  const liked = prefs.find((p) => p.key === "direction")?.value as CreativeDirectionId | undefined;
  if (liked && DIRECTIONS[liked]) return DIRECTIONS[liked];

  if (prefs.some((p) => p.key === "mood" && /dark/.test(p.value))) return DIRECTIONS.luxury_brand;
  if (prefs.some((p) => p.key === "positioning" && /premium/.test(p.value))) {
    return DIRECTIONS.luxury_brand;
  }

  return DIRECTIONS.modern_professional;
}

function buildDecisions(
  plan: ChangePlan,
  direction: CreativeDirection,
): CreativeDecision[] {
  const decisions: CreativeDecision[] = [];
  const req = plan.originalRequest.toLowerCase();
  const push = (d: Omit<CreativeDecision, "id">) =>
    decisions.push({ ...d, id: uid("cdec") });

  // Always think bigger than hero/colors when "business" / premium / brand
  if (/premium|luxury|business|brand|professional|friendly/.test(req) || direction.id === "luxury_brand") {
    push({
      surface: "website",
      title: "Homepage feels more premium",
      detail: "Hero rewritten, typography refined, spacing tightened.",
      why: "Premium buyers usually decide in under 10 seconds — lead with trust.",
      moduleOwner: "Website module",
    });
    push({
      surface: "trust",
      title: "Reviews moved higher",
      detail: "Proof sits before pricing.",
      why: "Reviews are often the strongest trust signal.",
      moduleOwner: "Website module",
    });
    push({
      surface: "booking",
      title: "Booking asks fewer questions",
      detail: "Simplified flow; fewer fields before confirmation.",
      why: "Friction kills premium conversion.",
      moduleOwner: "Booking Intelligence Builder",
    });
    push({
      surface: "portfolio",
      title: "Portfolio starts with luxury work",
      detail: "Hero images reordered toward elevated jobs.",
      why: "Visual proof should match the positioning.",
      moduleOwner: "Portfolio Builder",
    });
    push({
      surface: "packages",
      title: "Package names updated",
      detail: "Clearer tier language; pricing presentation strengthened.",
      why: "Premium packaging is positioning, not just a price list.",
      moduleOwner: "Packages Builder",
    });
    push({
      surface: "cta",
      title: "Button style modernized",
      detail: "Stronger primary CTA hierarchy.",
      why: "One clear next step reduces hesitation.",
      moduleOwner: "Website module",
    });
  }

  // Map plan actions into decisions
  for (const a of plan.changes) {
    const surface = (a.path.split(".")[0] || "website") as PreviewSurface;
    if (decisions.some((d) => d.detail.includes(a.path))) continue;
    push({
      surface: surface === ("automations" as string) ? "website" : (surface as CreativeDecision["surface"]),
      title: a.reason.slice(0, 72) || a.path,
      detail: `${a.path} → ${JSON.stringify(a.desired)}`,
      why: a.reason || `${a.builderOwner} proposed this for the desired state.`,
      moduleOwner: a.builderOwner,
    });
  }

  if (!decisions.length) {
    push({
      surface: "website",
      title: "Business experience refined",
      detail: "Multi-surface creative pass aligned to direction.",
      why: direction.summary,
      moduleOwner: BUSINESS_BUILDER_LABEL,
    });
  }

  return decisions;
}

function scoreFromDirection(
  direction: CreativeDirection,
  decisions: CreativeDecision[],
  memory: CreativeMemory,
): BusinessScore {
  const base = direction.id === "luxury_brand" || direction.id === "friendly_premium" ? 90 : 86;
  const bonus = Math.min(8, decisions.length);
  const prefBoost = memory.preferences.length ? 2 : 0;
  const trust = clamp(base + bonus + (decisions.some((d) => d.surface === "trust") ? 3 : 0));
  const professionalism = clamp(base + 1 + prefBoost);
  const clarity = clamp(base - 1 + (direction.id === "minimal" ? 4 : 0));
  const bookingExperience = clamp(
    base + (decisions.some((d) => d.surface === "booking") ? 5 : 0),
  );
  const visualQuality = clamp(base + (decisions.some((d) => d.surface === "portfolio" || d.surface === "website") ? 2 : 0));
  const consistency = clamp(95 + prefBoost);
  const overall = clamp(
    (trust + professionalism + clarity + bookingExperience + visualQuality + consistency) / 6,
  );
  return {
    trust,
    professionalism,
    clarity,
    bookingExperience,
    visualQuality,
    consistency,
    overall,
    note: "Business quality — not SEO, not Lighthouse.",
  };
}

function looksLikeHarmfulCreativeAsk(msg: string): boolean {
  return /\b(remove reviews|delete reviews|no reviews|hide all reviews)\b/i.test(msg);
}

/**
 * Start a Creative Session from a Change Plan (+ optional preview/collab/version).
 */
export function startCreativeSession(opts: {
  businessId: string;
  plan: ChangePlan;
  preview?: BuilderPreview | null;
  collaboration?: CollaborationSession | null;
  businessVersion?: BusinessVersion | null;
  missionControlReplayId?: string | null;
}): BusinessBuilderResult {
  const memory = getCreativeMemory(opts.businessId);
  const direction = pickDirection(opts.plan.originalRequest, memory);
  const decisions = buildDecisions(opts.plan, direction);
  const score = scoreFromDirection(direction, decisions, memory);
  const surfacesTouched = [
    ...new Set(
      decisions
        .map((d) => d.surface)
        .filter((s): s is PreviewSurface =>
          ["website", "booking", "workspace", "crm", "portfolio", "automations", "packages", "multi"].includes(s),
        ),
    ),
  ];

  // Apply memory hints into opening copy
  const memBits = memory.preferences
    .slice(0, 3)
    .map((p) => `${p.key}: ${p.value}`)
    .join("; ");

  const session: CreativeSession = {
    id: uid("csess"),
    version: BUSINESS_BUILDER_VERSION,
    label: BUSINESS_BUILDER_LABEL,
    businessId: opts.businessId,
    changePlanId: opts.plan.id,
    previewId: opts.preview?.id || null,
    collaborationId: opts.collaboration?.id || null,
    versionId: opts.businessVersion?.id || null,
    direction,
    decisions,
    score,
    memory,
    challenge: null,
    workspace: {
      conversation: [
        {
          role: "hubly",
          message: `Here's what I changed across your business — not just the website.\n\n${decisions
            .slice(0, 8)
            .map((d) => `✓ ${d.title}`)
            .join("\n")}\n\nWhy?\n${direction.summary}${memBits ? `\n\n(Starting from your preferences: ${memBits})` : ""}\n\nWhat do you think?`,
          at: nowIso(),
        },
      ],
      liveViews: ["website", "booking", "packages", "portfolio"],
      activeView: "website",
      split: "conversation_left_preview_right",
      feeling: "co_creating_with_creative_director",
    },
    expectedImpact: opts.plan.estimatedImpact,
    surfacesTouched: surfacesTouched.length ? surfacesTouched : ["website", "booking", "packages", "portfolio"],
    headline: "Here's what I changed",
    whySummary: direction.summary,
    requiresApproval: true,
    applied: false,
    executed: false,
    waitingFor: "collaboration_or_approval",
    timestamp: nowIso(),
    missionControlReplayId: opts.missionControlReplayId ?? null,
  };

  return { session, fromChangePlanId: opts.plan.id };
}

/**
 * Live creative conversation — updates session + creative memory. No apply.
 */
export function continueCreativeSession(
  session: CreativeSession,
  ownerMessage: string,
): CreativeSession {
  const msg = String(ownerMessage || "").trim();
  if (!msg) return session;

  let next: CreativeSession = {
    ...session,
    workspace: {
      ...session.workspace,
      conversation: [
        ...session.workspace.conversation,
        { role: "owner", message: msg, at: nowIso() },
      ],
    },
    applied: false,
    executed: false,
    requiresApproval: true,
  };

  // Creative challenge — don't blindly remove trust
  if (looksLikeHarmfulCreativeAsk(msg)) {
    const challenge: CreativeChallenge = {
      id: uid("cchal"),
      ownerAsk: msg,
      hublyStance: "discourage",
      reason: "Reviews are your strongest trust signal — removing them usually hurts conversion.",
      choices: [
        { id: "keep", label: "Keep reviews" },
        { id: "force", label: "Remove anyway" },
        { id: "soften", label: "See a compromise" },
      ],
    };
    next = {
      ...next,
      challenge,
      workspace: {
        ...next.workspace,
        conversation: [
          ...next.workspace.conversation,
          {
            role: "hubly",
            message: `I can do that.\n\nI don't recommend it because ${challenge.reason}\n\nWould you still like to continue?`,
            at: nowIso(),
          },
        ],
      },
    };
    return next;
  }

  if (/friend|warm|approachable/.test(msg)) {
    learnCreativePreference(session.businessId, "tone", "friendlier", msg);
    learnCreativePreference(session.businessId, "direction", "neighborhood_favorite", msg);
    const direction = DIRECTIONS.friendly_premium;
    next = {
      ...next,
      direction,
      memory: getCreativeMemory(session.businessId),
      decisions: [
        ...session.decisions,
        {
          id: uid("cdec"),
          surface: "brand",
          title: "Tone friendlier while keeping craft",
          detail: "Warmer copy + still-elevated layout.",
          why: "I think that means approachable premium — not cheap.",
          moduleOwner: BUSINESS_BUILDER_LABEL,
        },
      ],
      score: scoreFromDirection(direction, session.decisions, getCreativeMemory(session.businessId)),
      workspace: {
        ...next.workspace,
        conversation: [
          ...next.workspace.conversation,
          {
            role: "hubly",
            message:
              'I think that means warmer language and softer proof — without dropping the craft. I updated the Creative Direction toward Friendly Premium.\n\nWhat do you think?',
            at: nowIso(),
          },
        ],
      },
    };
    return next;
  }

  if (/keep.*premium|actually.*premium|prefer premium/.test(msg)) {
    learnCreativePreference(session.businessId, "positioning", "premium", msg);
    next = {
      ...next,
      direction: DIRECTIONS.luxury_brand,
      memory: getCreativeMemory(session.businessId),
      workspace: {
        ...next.workspace,
        conversation: [
          ...next.workspace.conversation,
          {
            role: "hubly",
            message: "I'll combine both — friendly where it helps, premium where it converts. Preview updated.",
            at: nowIso(),
          },
        ],
      },
    };
    return next;
  }

  if (/don'?t like.*typograph|hate.*font|new typography/.test(msg)) {
    learnCreativePreference(session.businessId, "typography", "avoid_last_proposal", msg);
    next = {
      ...next,
      memory: getCreativeMemory(session.businessId),
      decisions: [
        ...session.decisions,
        {
          id: uid("cdec"),
          surface: "website",
          title: "Typography revised",
          detail: "Swapped to a cleaner premium stack.",
          why: "Creative Memory logged your typography preference.",
          moduleOwner: "Website module",
        },
      ],
      workspace: {
        ...next.workspace,
        conversation: [
          ...next.workspace.conversation,
          {
            role: "hubly",
            message: "Got it — I updated typography and remembered that preference for next builds.",
            at: nowIso(),
          },
        ],
      },
    };
    return next;
  }

  if (/luxury layout|brighter photo|keep the luxury/.test(msg)) {
    learnCreativePreference(session.businessId, "layout", "luxury", msg);
    learnCreativePreference(session.businessId, "photography", "brighter", msg);
    next = {
      ...next,
      memory: getCreativeMemory(session.businessId),
      direction: DIRECTIONS.friendly_premium,
      decisions: [
        ...session.decisions,
        {
          id: uid("cdec"),
          surface: "portfolio",
          title: "Luxury layout + brighter photography",
          detail: "Kept elevated structure; brightened hero/portfolio set.",
          why: "Combined your preferences instead of forcing a restart.",
          moduleOwner: BUSINESS_BUILDER_LABEL,
        },
      ],
      workspace: {
        ...next.workspace,
        conversation: [
          ...next.workspace.conversation,
          {
            role: "hubly",
            message: "Combined — luxury layout with brighter photography. Preferences saved.",
            at: nowIso(),
          },
        ],
      },
    };
    return next;
  }

  if (/darker|dark/.test(msg)) {
    learnCreativePreference(session.businessId, "mood", "darker", msg);
  }
  if (/bold typograph|bold type/.test(msg)) {
    learnCreativePreference(session.businessId, "typography", "bold", msg);
  }

  next = {
    ...next,
    memory: getCreativeMemory(session.businessId),
    workspace: {
      ...next.workspace,
      conversation: [
        ...next.workspace.conversation,
        {
          role: "hubly",
          message: "Updated the live business preview. We can keep refining — nothing goes live until you approve.",
          at: nowIso(),
        },
      ],
    },
  };
  return next;
}

export function resolveCreativeChallenge(
  session: CreativeSession,
  choiceId: string,
): CreativeSession {
  if (!session.challenge) return session;
  const choice = session.challenge.choices.find((c) => c.id === choiceId);
  if (!choice) return session;

  let reply = "We'll keep reviews — trust stays front and center.";
  if (choiceId === "force") {
    reply = "Understood — I'll preview without reviews, but I still recommend keeping them.";
  } else if (choiceId === "soften") {
    reply = "Compromise: keep reviews, make them quieter and secondary to the hero.";
  }

  return {
    ...session,
    challenge: null,
    applied: false,
    executed: false,
    workspace: {
      ...session.workspace,
      conversation: [
        ...session.workspace.conversation,
        { role: "owner", message: choice.label, at: nowIso() },
        { role: "hubly", message: reply, at: nowIso() },
      ],
    },
  };
}

export const HublyBusinessBuilder = {
  version: BUSINESS_BUILDER_VERSION,
  owner: BUSINESS_BUILDER_OWNER,
  label: BUSINESS_BUILDER_LABEL,
  websiteModuleId: WEBSITE_MODULE_ID,
  start: startCreativeSession,
  continue: continueCreativeSession,
  resolveChallenge: resolveCreativeChallenge,
  getMemory: getCreativeMemory,
  learn: learnCreativePreference,
  directions: DIRECTIONS,
  clearMemoryForTests: clearCreativeMemoryForTests,
};
