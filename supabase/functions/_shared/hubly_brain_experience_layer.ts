/**
 * Milestone 2 · Epic 0 — Hubly Experience Layer
 *
 * This Epic is about the customer's emotional experience, not infrastructure.
 * Reuse Hubly Brain, Experience Director, Identity System, Builder Engine, and
 * Chat OS exactly as they exist. Do not create new AI systems.
 *
 * Job: every customer-facing interaction feels like one trusted business partner.
 * No feature writes its own customer copy — everything comes through this layer.
 */

import {
  HUBLY_IS,
  HUBLY_NEVER,
  HUBLY_PHILOSOPHY,
  HUBLY_COMMUNICATION_RULES,
  applyHublyIdentity,
} from "./hubly_brain_identity_system.ts";
import {
  applyPersonalityExpression,
  detectPersonalityMode,
  personalityLine,
  PERSONALITY_MODES,
  type PersonalityExpression,
  type PersonalityMode,
} from "./hubly_brain_personality.ts";

export const EXPERIENCE_LAYER_VERSION = "1.0.0" as const;
export const EXPERIENCE_LAYER_OWNER = "hubly_brain" as const;
export const EXPERIENCE_LAYER_LABEL = "Hubly Experience Layer" as const;
export const EXPERIENCE_LAYER_MILESTONE = "2" as const;
export const EXPERIENCE_LAYER_EPIC = 0 as const;

/** Brand visual personality — Hubly navy + orange (never purple-default AI chrome). */
export const EXPERIENCE_VISUAL = {
  navy: "#141B2B",
  orange: "#D9632D",
  cream: "#F7F4F0",
  ink: "#1A1F2E",
  success: "#2F6B4F",
  caution: "#B4532A",
  motion: {
    greetingMs: 420,
    thinkingPulseMs: 900,
    revealMs: 640,
    celebrationMs: 1100,
    transitionMs: 380,
  },
  radius: "14px",
  wordmark: "assets/hubly-wordmark.png",
  wordmarkOnDark: "assets/hubly-wordmark-on-dark.png",
} as const;

export type ExperienceKind =
  | "greeting"
  | "thinking"
  | "explanation"
  | "recommendation"
  | "coaching"
  | "celebration"
  | "warning"
  | "error"
  | "question"
  | "success"
  | "empty"
  | "loading"
  | "launch"
  | "disagreement"
  | "transition";

export type GreetingContext =
  | "morning"
  | "afternoon"
  | "evening"
  | "returning"
  | "new_owner"
  | "busy_day"
  | "default";

export type ThinkingPhase =
  | "researching"
  | "found_something"
  | "comparing"
  | "changed_mind"
  | "one_more"
  | "stronger";

export type CelebrationMilestone =
  | "first_customer_booked"
  | "first_five_star"
  | "website_published"
  | "first_1000"
  | "hundredth_booking"
  | "monthly_goal";

export type EmptySurface =
  | "customers"
  | "portfolio"
  | "reviews"
  | "jobs"
  | "automations"
  | "quotes";

export type TransitionPhase =
  | "conversation"
  | "thinking"
  | "building"
  | "preview"
  | "approval"
  | "deployment"
  | "celebration";

export type EmotionalBeat =
  | "curiosity"
  | "discovery"
  | "confidence"
  | "excitement"
  | "pride"
  | "momentum"
  | "trust"
  | "partnership";

export const EMOTIONAL_TIMELINE: EmotionalBeat[] = [
  "curiosity",
  "discovery",
  "confidence",
  "excitement",
  "pride",
  "momentum",
  "trust",
  "partnership",
];

export const TRANSITION_PIPELINE: TransitionPhase[] = [
  "conversation",
  "thinking",
  "building",
  "preview",
  "approval",
  "deployment",
  "celebration",
];

export const CONVERSATION_RULES = {
  maxFollowUpQuestions: 3,
  askOnlyWhenConfidenceBelow: 70,
  explainWhyQuestionMatters: true,
  neverRepeat: true,
  neverAskKnownFacts: true,
  neverInterview: true,
  neverInterrogate: true,
} as const;

export type ExperienceMessage = {
  id: string;
  kind: ExperienceKind;
  text: string;
  why: string | null;
  emotion: EmotionalBeat;
  personalityMode: PersonalityMode | null;
  source: "experience_layer";
  visual: {
    accent: typeof EXPERIENCE_VISUAL.orange;
    navy: typeof EXPERIENCE_VISUAL.navy;
  };
  actions?: Array<{ id: string; label: string; primary?: boolean }>;
  timestamp: string;
};

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function firstName(name?: string | null): string | null {
  if (!name) return null;
  return String(name).trim().split(/\s+/)[0] || null;
}

function msg(
  kind: ExperienceKind,
  text: string,
  opts?: {
    why?: string | null;
    emotion?: EmotionalBeat;
    personalityMode?: PersonalityMode | null;
    actions?: ExperienceMessage["actions"];
  },
): ExperienceMessage {
  return {
    id: uid("exp"),
    kind,
    text: String(text || "").trim(),
    why: opts?.why ?? null,
    emotion: opts?.emotion || "partnership",
    personalityMode: opts?.personalityMode ?? null,
    source: "experience_layer",
    visual: { accent: EXPERIENCE_VISUAL.orange, navy: EXPERIENCE_VISUAL.navy },
    actions: opts?.actions,
    timestamp: nowIso(),
  };
}

/** Forbidden software-loading copy — Experience Layer never emits these. */
export const FORBIDDEN_LOADING = [
  /^loading\.?\.?\.?$/i,
  /^please wait\.?\.?\.?$/i,
  /^generating\.?\.?\.?$/i,
  /^processing\.?\.?\.?$/i,
] as const;

export function isForbiddenLoading(text: string): boolean {
  const t = String(text || "").trim();
  return FORBIDDEN_LOADING.some((re) => re.test(t));
}

// ─── 2. Greeting System ─────────────────────────────────────────────────────

export function detectGreetingContext(opts: {
  hour?: number;
  isReturning?: boolean;
  isNewOwner?: boolean;
  jobsToday?: number;
}): GreetingContext {
  if (opts.isNewOwner) return "new_owner";
  if ((opts.jobsToday || 0) >= 4) return "busy_day";
  if (opts.isReturning) return "returning";
  const h = opts.hour ?? new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "default";
}

export function buildGreeting(opts: {
  ownerName?: string | null;
  context?: GreetingContext;
  hour?: number;
  isReturning?: boolean;
  isNewOwner?: boolean;
  jobsToday?: number;
}): ExperienceMessage {
  const name = firstName(opts.ownerName);
  const context = opts.context || detectGreetingContext(opts);
  let text = "";
  let emotion: EmotionalBeat = "curiosity";

  switch (context) {
    case "morning":
      text = name
        ? `Good morning, ${name} 👋\n\nReady to build today?`
        : "Good morning 👋\n\nReady to build today?";
      emotion = "curiosity";
      break;
    case "afternoon":
      text = name
        ? `Hey ${name} — afternoon check-in. What are we building?`
        : "Hey — afternoon check-in. What are we building?";
      break;
    case "evening":
      text = name
        ? `Evening, ${name}. Want to tidy something up before tomorrow?`
        : "Evening. Want to tidy something up before tomorrow?";
      emotion = "momentum";
      break;
    case "returning":
      text = name
        ? `Welcome back, ${name}.\n\nI reviewed your business while you were away.`
        : "Welcome back.\n\nI reviewed your business while you were away.";
      emotion = "trust";
      break;
    case "new_owner":
      text =
        "Hi 👋\n\nI'm Hubly.\n\nLet's build your business together.\n\n**What are we building today?**";
      emotion = "curiosity";
      break;
    case "busy_day":
      text = name
        ? `Looks like you've got ${opts.jobsToday} jobs today, ${name}.\n\nLet's make today easier.`
        : `Looks like you've got ${opts.jobsToday} jobs today.\n\nLet's make today easier.`;
      emotion = "momentum";
      break;
    default:
      text = name
        ? `Hey ${name} — what are we building today?`
        : "Hey — what are we building today?";
  }

  return msg("greeting", text, {
    why: `Contextual greeting (${context}) — never generic.`,
    emotion,
    personalityMode: "greeting",
  });
}

// ─── 3. Thinking Language ───────────────────────────────────────────────────

export function buildThinking(phase: ThinkingPhase = "researching"): ExperienceMessage {
  const lines: Record<ThinkingPhase, string> = {
    researching: "I'm researching businesses like yours.",
    found_something: "I found something interesting.",
    comparing: "I'm comparing a few ideas.",
    changed_mind: "I changed my mind.",
    one_more: "I'm making one more improvement.",
    stronger: "I think this version is stronger.",
  };
  return msg("thinking", lines[phase], {
    why: "Every delay builds confidence — never 'Loading…'.",
    emotion: "discovery",
    personalityMode: "explain",
  });
}

export function thinkingSequence(): ExperienceMessage[] {
  return (["researching", "found_something", "comparing", "one_more", "stronger"] as ThinkingPhase[])
    .map((p) => buildThinking(p));
}

// ─── 4. Conversation Rules ──────────────────────────────────────────────────

export function enforceConversationRules(opts: {
  questions: string[];
  confidence?: number | null;
  knownFacts?: string[];
  previouslyAsked?: string[];
}): {
  shown: string[];
  delayed: string[];
  withWhy: Array<{ question: string; why: string }>;
  actions: string[];
} {
  const actions: string[] = [];
  const conf = opts.confidence == null ? 80 : Number(opts.confidence);
  let qs = [...(opts.questions || [])].map((q) => String(q || "").trim()).filter(Boolean);

  // Never ask known facts
  const known = (opts.knownFacts || []).map((k) => k.toLowerCase());
  qs = qs.filter((q) => {
    const low = q.toLowerCase();
    const hitsKnown = known.some((k) => k && low.includes(k));
    if (hitsKnown) actions.push("skipped_known_fact");
    return !hitsKnown;
  });

  // Never repeat
  const prev = new Set((opts.previouslyAsked || []).map((q) => q.toLowerCase().trim()));
  qs = qs.filter((q) => {
    if (prev.has(q.toLowerCase())) {
      actions.push("skipped_repeat");
      return false;
    }
    return true;
  });

  // Only ask when confidence is low
  if (conf >= CONVERSATION_RULES.askOnlyWhenConfidenceBelow && qs.length) {
    actions.push("suppressed_questions_high_confidence");
    return { shown: [], delayed: qs, withWhy: [], actions };
  }

  const shown = qs.slice(0, CONVERSATION_RULES.maxFollowUpQuestions);
  const delayed = qs.slice(CONVERSATION_RULES.maxFollowUpQuestions);
  if (qs.length > CONVERSATION_RULES.maxFollowUpQuestions) {
    actions.push("capped_questions_at_3");
  }

  const withWhy = shown.map((question) => ({
    question,
    why: "This helps me recommend something that actually fits how you work — not a generic template.",
  }));

  return { shown, delayed, withWhy, actions };
}

export function buildQuestion(question: string, why?: string): ExperienceMessage {
  return msg("question", question, {
    why: why || "One curious question — never an interview.",
    emotion: "curiosity",
    personalityMode: "ask",
  });
}

// ─── 5. Celebration System ──────────────────────────────────────────────────

export function buildCelebration(
  milestone: CelebrationMilestone,
  ownerName?: string | null,
): ExperienceMessage {
  const name = firstName(ownerName);
  const lines: Record<CelebrationMilestone, string> = {
    first_customer_booked: name
      ? `🎉 First customer booked — that's the start of something real, ${name}.`
      : "🎉 First customer booked — that's the start of something real.",
    first_five_star: "⭐ First five-star review. Customers are noticing.",
    website_published: "🚀 Website published. Your business is live.",
    first_1000: "💰 First $1,000. Momentum is real.",
    hundredth_booking: "🏆 100th booking. You're building a machine.",
    monthly_goal: name
      ? `🎯 Monthly goal reached, ${name}. Proud of this one.`
      : "🎯 Monthly goal reached. Proud of this one.",
  };
  return msg("celebration", lines[milestone], {
    why: "Celebrate meaningful milestones — never trivial clicks.",
    emotion: "pride",
    personalityMode: "celebrate",
  });
}

export function isTrivialCelebration(action: string): boolean {
  return /clicked|opened|scrolled|hovered|toggled dark mode|saved draft/i.test(action);
}

// ─── 6. Coaching Language ───────────────────────────────────────────────────

export function buildCoaching(opts: {
  observation: string;
  recommendation: string;
  why: string;
}): ExperienceMessage {
  const text =
    `I noticed something.\n\n${opts.observation}\n\nIf this were my business, I'd recommend ${opts.recommendation}.\n\nHere's why: ${opts.why}`;
  return msg("coaching", text, {
    why: "Never lecture. Never shame. Always explain why.",
    emotion: "confidence",
    personalityMode: "encourage",
  });
}

// ─── 7. Honest Feedback ─────────────────────────────────────────────────────

export function buildHonestDisagreement(opts: {
  ownerAsk: string;
  canDo: boolean;
  whyNotRecommended: string;
}): ExperienceMessage {
  const text =
    `I can absolutely do that.\n\nI don't recommend it because ${opts.whyNotRecommended}\n\nWould you still like me to continue?`;
  return msg("disagreement", text, {
    why: "Partner, not a yes-machine.",
    emotion: "trust",
    personalityMode: "disagree",
    actions: [
      { id: "continue_anyway", label: "Yes, continue", primary: false },
      { id: "keep_as_is", label: "Keep it as is", primary: true },
    ],
  });
}

// ─── 8. Error Experience ────────────────────────────────────────────────────

export function buildError(opts: {
  blockedBy: string;
  nextStep: string;
  resumeNote?: string;
}): ExperienceMessage {
  const resume = opts.resumeNote || "then I'll continue exactly where we left off.";
  const text =
    `I couldn't finish that because ${opts.blockedBy}.\n\nLet's ${opts.nextStep}, ${resume}`;
  return msg("error", text, {
    why: "Failures feel calm. Context never disappears.",
    emotion: "trust",
    personalityMode: "apologize",
  });
}

export function buildWarning(text: string, why?: string): ExperienceMessage {
  const body = String(text || "").trim();
  const voiced = /\bI\b|I(?:'m)|here'?s why|let'?s /i.test(body)
    ? body
    : `I noticed something worth flagging.\n\n${body}\n\nI'd adjust before it costs you a day.`;
  return msg("warning", voiced, {
    why: why || "Honest caution without alarmism.",
    emotion: "confidence",
    personalityMode: "explain",
  });
}

// ─── 9. Empty States ────────────────────────────────────────────────────────

export function buildEmptyState(surface: EmptySurface): ExperienceMessage {
  const lines: Record<EmptySurface, string> = {
    customers: "No customers yet.\n\nLet's get your first booking.",
    portfolio: "No portfolio.\n\nUpload a few finished jobs and I'll organize everything.",
    reviews: "No reviews.\n\nI'll remind you after your next completed job.",
    jobs: "No jobs on the board yet.\n\nWant me to help fill the week?",
    automations: "No automations yet.\n\nTell me an outcome — I'll draft a workflow you can preview.",
    quotes: "No open quotes.\n\nWhen a lead comes in, I'll help you follow up fast.",
  };
  return msg("empty", lines[surface], {
    why: "Every empty state teaches and guides.",
    emotion: "curiosity",
    personalityMode: "encourage",
  });
}

// ─── 10. Transition System ──────────────────────────────────────────────────

export function buildTransition(phase: TransitionPhase): ExperienceMessage {
  const lines: Record<TransitionPhase, string> = {
    conversation: "I'm with you — keep talking.",
    thinking: "Give me a moment — I'm thinking this through.",
    building: "I'm building this live so you can watch it take shape.",
    preview: "Here's a preview before anything changes.",
    approval: "When you're ready, say the word and we'll launch.",
    deployment: "Deploying carefully — I'll verify every step.",
    celebration: "It's live. This is a real moment for the business.",
  };
  return msg("transition", lines[phase], {
    why: "Major moments feel intentional — never abrupt.",
    emotion: phase === "celebration" ? "pride" : phase === "thinking" ? "discovery" : "partnership",
    personalityMode: "transition",
  });
}

export function transitionNarration(): ExperienceMessage[] {
  return TRANSITION_PIPELINE.map((p) => buildTransition(p));
}

// ─── Success / Launch / Recommendation ──────────────────────────────────────

export function buildSuccess(text: string): ExperienceMessage {
  return msg("success", text, {
    why: "Success states sound like Hubly, not a toast notification.",
    emotion: "pride",
    personalityMode: "celebrate",
  });
}

export function buildLaunch(ownerName?: string | null): ExperienceMessage {
  const name = firstName(ownerName);
  return msg(
    "launch",
    name
      ? `Your business is live, ${name}. Website, booking, and the next steps are ready — this is the opening day feeling.`
      : "Your business is live. Website, booking, and the next steps are ready — this is the opening day feeling.",
    {
      why: "Launch moments create pride and momentum.",
      emotion: "excitement",
      personalityMode: "celebrate",
    },
  );
}

export function buildRecommendation(opts: {
  recommendation: string;
  why: string;
}): ExperienceMessage {
  return msg(
    "recommendation",
    `I'd recommend ${opts.recommendation}.\n\nHere's why: ${opts.why}`,
    {
      why: "Recommend with impact — never pressure.",
      emotion: "confidence",
      personalityMode: "explain",
      actions: [
        { id: "yes", label: "Yes, let's do it", primary: true },
        { id: "more", label: "Tell me more", primary: false },
      ],
    },
  );
}

export function buildExplanation(why: string): ExperienceMessage {
  return msg("explanation", `Here's why: ${why}`, {
    why: "Always explain thinking.",
    emotion: "confidence",
    personalityMode: "explain",
  });
}

// ─── Emotional timeline helper ──────────────────────────────────────────────

export function emotionForKind(kind: ExperienceKind): EmotionalBeat {
  const map: Record<ExperienceKind, EmotionalBeat> = {
    greeting: "curiosity",
    thinking: "discovery",
    explanation: "confidence",
    recommendation: "confidence",
    coaching: "confidence",
    celebration: "pride",
    warning: "trust",
    error: "trust",
    question: "curiosity",
    success: "pride",
    empty: "curiosity",
    loading: "discovery",
    launch: "excitement",
    disagreement: "trust",
    transition: "partnership",
  };
  return map[kind];
}

export function emotionalProgression(): Array<{ beat: EmotionalBeat; supports: ExperienceKind[] }> {
  return [
    { beat: "curiosity", supports: ["greeting", "question", "empty"] },
    { beat: "discovery", supports: ["thinking", "loading"] },
    { beat: "confidence", supports: ["explanation", "recommendation", "coaching"] },
    { beat: "excitement", supports: ["launch"] },
    { beat: "pride", supports: ["celebration", "success"] },
    { beat: "momentum", supports: ["transition"] },
    { beat: "trust", supports: ["error", "warning", "disagreement"] },
    { beat: "partnership", supports: ["transition", "coaching"] },
  ];
}

// ─── Unified voice pass (sole customer-copy gate) ───────────────────────────

export type ExperienceLayerInput = {
  text: string;
  kind?: ExperienceKind;
  request?: string | null;
  ownerName?: string | null;
  celebrate?: boolean;
  lowConfidence?: boolean;
  correcting?: boolean;
  transitioning?: boolean;
  opening?: boolean;
};

export type ExperienceLayerResult = {
  message: ExperienceMessage;
  personality: PersonalityExpression;
  identityApplied: boolean;
  forbiddenLoadingRemoved: boolean;
  text: string;
  actions: string[];
};

/**
 * Sole path for customer-facing copy.
 * Identity (constitution) → Personality (moment) → Experience Layer (kind + emotion).
 */
export function applyExperienceLayer(input: ExperienceLayerInput): ExperienceLayerResult {
  const actions: string[] = ["experience_layer"];
  let text = String(input.text || "").trim();
  let forbiddenLoadingRemoved = false;

  if (isForbiddenLoading(text)) {
    text = buildThinking("researching").text;
    forbiddenLoadingRemoved = true;
    actions.push("replaced_forbidden_loading");
  }

  // Strip software-speak leftovers
  text = text
    .replace(/\b(please wait|generating|processing)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const identity = applyHublyIdentity(text, {
    request: input.request,
    celebrate: !!input.celebrate,
  });
  text = identity.text;
  actions.push(...identity.actions.map((a) => `identity_${a}`));

  const personality = applyPersonalityExpression({
    text,
    request: input.request,
    ownerName: input.ownerName,
    celebrate: input.celebrate,
    lowConfidence: input.lowConfidence,
    correcting: input.correcting,
    transitioning: input.transitioning,
    opening: input.opening,
  });
  text = personality.text;
  actions.push(...personality.actions);

  const kind = input.kind || kindFromPersonality(personality.mode);
  const message = msg(kind, text, {
    why: personality.moment.why,
    emotion: emotionForKind(kind),
    personalityMode: personality.mode,
  });

  return {
    message,
    personality,
    identityApplied: true,
    forbiddenLoadingRemoved,
    text: message.text,
    actions,
  };
}

function kindFromPersonality(mode: PersonalityMode): ExperienceKind {
  const map: Record<PersonalityMode, ExperienceKind> = {
    greeting: "greeting",
    celebrate: "celebration",
    apologize: "error",
    explain: "explanation",
    ask: "question",
    disagree: "disagreement",
    encourage: "coaching",
    uncertainty: "warning",
    transition: "transition",
  };
  return map[mode];
}

/** Founder Test 3 helper — text-only fingerprint that reads as Hubly. */
export function soundsLikeHubly(text: string): boolean {
  const t = String(text || "");
  if (!t.trim()) return false;
  if (isForbiddenLoading(t)) return false;
  if (/\b(LLM|OpenAI|Claude|GPT|Gemini|our AI agents|As an AI)\b/i.test(t)) return false;
  if (/\berror code\b|\bnull pointer\b|\bstack trace\b|something went wrong/i.test(t)) return false;
  // Invested partner signals (contractions I'm counts)
  return (
    /\bI(?:'m| am| can| think| recommend| noticed| heard| looked| checked| found| changed| couldn'?t)\b/i.test(t) ||
    /here'?s why|what are we building|if this were my business|would you still|let'?s /i.test(t) ||
    /nice work|welcome back|good morning|your business is live|first (customer|five-star|\$1,000)|website published/i.test(t) ||
    /I(?:'m)? (researching|comparing|making|found)|changed my mind|version is stronger/i.test(t) ||
    /don'?t recommend|proud of this|momentum is real/i.test(t)
  );
}

export const HublyExperienceLayer = {
  version: EXPERIENCE_LAYER_VERSION,
  owner: EXPERIENCE_LAYER_OWNER,
  label: EXPERIENCE_LAYER_LABEL,
  milestone: EXPERIENCE_LAYER_MILESTONE,
  epic: EXPERIENCE_LAYER_EPIC,
  visual: EXPERIENCE_VISUAL,
  traits: [...HUBLY_IS],
  never: [...HUBLY_NEVER],
  philosophy: HUBLY_PHILOSOPHY,
  communication: HUBLY_COMMUNICATION_RULES,
  conversationRules: CONVERSATION_RULES,
  emotionalTimeline: EMOTIONAL_TIMELINE,
  transitionPipeline: TRANSITION_PIPELINE,
  personalityModes: PERSONALITY_MODES,
  apply: applyExperienceLayer,
  greeting: buildGreeting,
  thinking: buildThinking,
  thinkingSequence,
  celebration: buildCelebration,
  coaching: buildCoaching,
  disagree: buildHonestDisagreement,
  error: buildError,
  warning: buildWarning,
  empty: buildEmptyState,
  transition: buildTransition,
  transitionNarration,
  success: buildSuccess,
  launch: buildLaunch,
  recommendation: buildRecommendation,
  explanation: buildExplanation,
  question: buildQuestion,
  enforceQuestions: enforceConversationRules,
  soundsLikeHubly,
  isForbiddenLoading,
  isTrivialCelebration,
  detectGreetingContext,
  detectPersonalityMode,
  personalityLine,
};
