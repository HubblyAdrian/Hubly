/** Node mirror of hubly_brain_business_builder.ts — Milestone 1.5 Epic 6 (esbuild). */


// supabase/functions/_shared/hubly_brain_business_builder.ts
var BUSINESS_BUILDER_VERSION = "1.0.0";
var BUSINESS_BUILDER_OWNER = "hubly_brain";
var BUSINESS_BUILDER_LABEL = "Business Builder";
var WEBSITE_MODULE_ID = "website_builder";
var DIRECTIONS = {
  neighborhood_favorite: {
    id: "neighborhood_favorite",
    label: "Neighborhood Favorite",
    vibe: "Warm, local, trusted around the block",
    affects: ["website", "booking", "portfolio", "packages"],
    summary: "Local trust cues, friendly CTAs, community proof."
  },
  luxury_brand: {
    id: "luxury_brand",
    label: "Luxury Brand",
    vibe: "Quiet luxury, proof-first, refined type",
    affects: ["website", "booking", "portfolio", "packages"],
    summary: "Premium buyers decide fast \u2014 optimize for trust first."
  },
  modern_professional: {
    id: "modern_professional",
    label: "Modern Professional",
    vibe: "Clean grids, bold type, crisp booking",
    affects: ["website", "booking", "packages"],
    summary: "Clarity and speed without coldness."
  },
  family_owned: {
    id: "family_owned",
    label: "Family-Owned",
    vibe: "Personal, story-led, human photos",
    affects: ["website", "portfolio", "packages"],
    summary: "Story and people over polish theater."
  },
  minimal: {
    id: "minimal",
    label: "Minimal",
    vibe: "Whitespace, fewer sections, sharper hierarchy",
    affects: ["website", "booking", "packages"],
    summary: "Remove friction; keep only what converts."
  },
  bold: {
    id: "bold",
    label: "Bold",
    vibe: "Strong contrast, punchy CTAs",
    affects: ["website", "packages", "portfolio"],
    summary: "Energy and confidence without chaos."
  },
  trusted_local: {
    id: "trusted_local",
    label: "Trusted Local",
    vibe: "Reviews forward, clear service area",
    affects: ["website", "booking", "portfolio"],
    summary: "Proof and proximity first."
  },
  friendly_premium: {
    id: "friendly_premium",
    label: "Friendly Premium",
    vibe: "Warm tone + elevated craft",
    affects: ["website", "booking", "packages", "portfolio"],
    summary: "Combine approachability with premium positioning."
  }
};
var MEMORY = /* @__PURE__ */ new Map();
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function getCreativeMemory(businessId) {
  const id = businessId || "biz_default";
  let m = MEMORY.get(id);
  if (!m) {
    m = { businessId: id, preferences: [] };
    MEMORY.set(id, m);
  }
  return m;
}
function learnCreativePreference(businessId, key, value, source) {
  const mem = getCreativeMemory(businessId);
  const existing = mem.preferences.findIndex((p) => p.key === key);
  const pref = { key, value, learnedAt: nowIso(), source };
  if (existing >= 0) mem.preferences[existing] = pref;
  else mem.preferences.push(pref);
  return mem;
}
function clearCreativeMemoryForTests() {
  MEMORY.clear();
}
function pickDirection(request, memory) {
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
  const liked = prefs.find((p) => p.key === "direction")?.value;
  if (liked && DIRECTIONS[liked]) return DIRECTIONS[liked];
  if (prefs.some((p) => p.key === "mood" && /dark/.test(p.value))) return DIRECTIONS.luxury_brand;
  if (prefs.some((p) => p.key === "positioning" && /premium/.test(p.value))) {
    return DIRECTIONS.luxury_brand;
  }
  return DIRECTIONS.modern_professional;
}
function buildDecisions(plan, direction) {
  const decisions = [];
  const req = plan.originalRequest.toLowerCase();
  const push = (d) => decisions.push({ ...d, id: uid("cdec") });
  if (/premium|luxury|business|brand|professional|friendly/.test(req) || direction.id === "luxury_brand") {
    push({
      surface: "website",
      title: "Homepage feels more premium",
      detail: "Hero rewritten, typography refined, spacing tightened.",
      why: "Premium buyers usually decide in under 10 seconds \u2014 lead with trust.",
      moduleOwner: "Website module"
    });
    push({
      surface: "trust",
      title: "Reviews moved higher",
      detail: "Proof sits before pricing.",
      why: "Reviews are often the strongest trust signal.",
      moduleOwner: "Website module"
    });
    push({
      surface: "booking",
      title: "Booking asks fewer questions",
      detail: "Simplified flow; fewer fields before confirmation.",
      why: "Friction kills premium conversion.",
      moduleOwner: "Booking Builder"
    });
    push({
      surface: "portfolio",
      title: "Portfolio starts with luxury work",
      detail: "Hero images reordered toward elevated jobs.",
      why: "Visual proof should match the positioning.",
      moduleOwner: "Portfolio Builder"
    });
    push({
      surface: "packages",
      title: "Package names updated",
      detail: "Clearer tier language; pricing presentation strengthened.",
      why: "Premium packaging is positioning, not just a price list.",
      moduleOwner: "Packages Builder"
    });
    push({
      surface: "cta",
      title: "Button style modernized",
      detail: "Stronger primary CTA hierarchy.",
      why: "One clear next step reduces hesitation.",
      moduleOwner: "Website module"
    });
  }
  for (const a of plan.changes) {
    const surface = a.path.split(".")[0] || "website";
    if (decisions.some((d) => d.detail.includes(a.path))) continue;
    push({
      surface: surface === "automations" ? "website" : surface,
      title: a.reason.slice(0, 72) || a.path,
      detail: `${a.path} \u2192 ${JSON.stringify(a.desired)}`,
      why: a.reason || `${a.builderOwner} proposed this for the desired state.`,
      moduleOwner: a.builderOwner
    });
  }
  if (!decisions.length) {
    push({
      surface: "website",
      title: "Business experience refined",
      detail: "Multi-surface creative pass aligned to direction.",
      why: direction.summary,
      moduleOwner: BUSINESS_BUILDER_LABEL
    });
  }
  return decisions;
}
function scoreFromDirection(direction, decisions, memory) {
  const base = direction.id === "luxury_brand" || direction.id === "friendly_premium" ? 90 : 86;
  const bonus = Math.min(8, decisions.length);
  const prefBoost = memory.preferences.length ? 2 : 0;
  const trust = clamp(base + bonus + (decisions.some((d) => d.surface === "trust") ? 3 : 0));
  const professionalism = clamp(base + 1 + prefBoost);
  const clarity = clamp(base - 1 + (direction.id === "minimal" ? 4 : 0));
  const bookingExperience = clamp(
    base + (decisions.some((d) => d.surface === "booking") ? 5 : 0)
  );
  const visualQuality = clamp(base + (decisions.some((d) => d.surface === "portfolio" || d.surface === "website") ? 2 : 0));
  const consistency = clamp(95 + prefBoost);
  const overall = clamp(
    (trust + professionalism + clarity + bookingExperience + visualQuality + consistency) / 6
  );
  return {
    trust,
    professionalism,
    clarity,
    bookingExperience,
    visualQuality,
    consistency,
    overall,
    note: "Business quality \u2014 not SEO, not Lighthouse."
  };
}
function looksLikeHarmfulCreativeAsk(msg) {
  return /\b(remove reviews|delete reviews|no reviews|hide all reviews)\b/i.test(msg);
}
function startCreativeSession(opts) {
  const memory = getCreativeMemory(opts.businessId);
  const direction = pickDirection(opts.plan.originalRequest, memory);
  const decisions = buildDecisions(opts.plan, direction);
  const score = scoreFromDirection(direction, decisions, memory);
  const surfacesTouched = [
    ...new Set(
      decisions.map((d) => d.surface).filter(
        (s) => ["website", "booking", "workspace", "crm", "portfolio", "automations", "packages", "multi"].includes(s)
      )
    )
  ];
  const memBits = memory.preferences.slice(0, 3).map((p) => `${p.key}: ${p.value}`).join("; ");
  const session = {
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
          message: `Here's what I changed across your business \u2014 not just the website.

${decisions.slice(0, 8).map((d) => `\u2713 ${d.title}`).join("\n")}

Why?
${direction.summary}${memBits ? `

(Starting from your preferences: ${memBits})` : ""}

What do you think?`,
          at: nowIso()
        }
      ],
      liveViews: ["website", "booking", "packages", "portfolio"],
      activeView: "website",
      split: "conversation_left_preview_right",
      feeling: "co_creating_with_creative_director"
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
    missionControlReplayId: opts.missionControlReplayId ?? null
  };
  return { session, fromChangePlanId: opts.plan.id };
}
function continueCreativeSession(session, ownerMessage) {
  const msg = String(ownerMessage || "").trim();
  if (!msg) return session;
  let next = {
    ...session,
    workspace: {
      ...session.workspace,
      conversation: [
        ...session.workspace.conversation,
        { role: "owner", message: msg, at: nowIso() }
      ]
    },
    applied: false,
    executed: false,
    requiresApproval: true
  };
  if (looksLikeHarmfulCreativeAsk(msg)) {
    const challenge = {
      id: uid("cchal"),
      ownerAsk: msg,
      hublyStance: "discourage",
      reason: "Reviews are your strongest trust signal \u2014 removing them usually hurts conversion.",
      choices: [
        { id: "keep", label: "Keep reviews" },
        { id: "force", label: "Remove anyway" },
        { id: "soften", label: "See a compromise" }
      ]
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
            message: `I can do that.

I don't recommend it because ${challenge.reason}

Would you still like to continue?`,
            at: nowIso()
          }
        ]
      }
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
          why: "I think that means approachable premium \u2014 not cheap.",
          moduleOwner: BUSINESS_BUILDER_LABEL
        }
      ],
      score: scoreFromDirection(direction, session.decisions, getCreativeMemory(session.businessId)),
      workspace: {
        ...next.workspace,
        conversation: [
          ...next.workspace.conversation,
          {
            role: "hubly",
            message: "I think that means warmer language and softer proof \u2014 without dropping the craft. I updated the Creative Direction toward Friendly Premium.\n\nWhat do you think?",
            at: nowIso()
          }
        ]
      }
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
            message: "I'll combine both \u2014 friendly where it helps, premium where it converts. Preview updated.",
            at: nowIso()
          }
        ]
      }
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
          moduleOwner: "Website module"
        }
      ],
      workspace: {
        ...next.workspace,
        conversation: [
          ...next.workspace.conversation,
          {
            role: "hubly",
            message: "Got it \u2014 I updated typography and remembered that preference for next builds.",
            at: nowIso()
          }
        ]
      }
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
          moduleOwner: BUSINESS_BUILDER_LABEL
        }
      ],
      workspace: {
        ...next.workspace,
        conversation: [
          ...next.workspace.conversation,
          {
            role: "hubly",
            message: "Combined \u2014 luxury layout with brighter photography. Preferences saved.",
            at: nowIso()
          }
        ]
      }
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
          message: "Updated the live business preview. We can keep refining \u2014 nothing goes live until you approve.",
          at: nowIso()
        }
      ]
    }
  };
  return next;
}
function resolveCreativeChallenge(session, choiceId) {
  if (!session.challenge) return session;
  const choice = session.challenge.choices.find((c) => c.id === choiceId);
  if (!choice) return session;
  let reply = "We'll keep reviews \u2014 trust stays front and center.";
  if (choiceId === "force") {
    reply = "Understood \u2014 I'll preview without reviews, but I still recommend keeping them.";
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
        { role: "hubly", message: reply, at: nowIso() }
      ]
    }
  };
}
var HublyBusinessBuilder = {
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
  clearMemoryForTests: clearCreativeMemoryForTests
};
export {
  BUSINESS_BUILDER_LABEL,
  BUSINESS_BUILDER_OWNER,
  BUSINESS_BUILDER_VERSION,
  HublyBusinessBuilder,
  WEBSITE_MODULE_ID,
  clearCreativeMemoryForTests,
  continueCreativeSession,
  getCreativeMemory,
  learnCreativePreference,
  resolveCreativeChallenge,
  startCreativeSession
};
