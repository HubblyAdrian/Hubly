/** Node mirror of hubly_brain_experience_layer.ts — Milestone 2 Epic 0 (esbuild). */


// supabase/functions/_shared/hubly_brain_experience_layer.ts
import {
  HUBLY_IS,
  HUBLY_NEVER,
  HUBLY_PHILOSOPHY,
  HUBLY_COMMUNICATION_RULES,
  applyHublyIdentity
} from "./identity-system.mjs";
import {
  applyPersonalityExpression,
  detectPersonalityMode,
  personalityLine,
  PERSONALITY_MODES
} from "./personality.mjs";
var EXPERIENCE_LAYER_VERSION = "1.0.0";
var EXPERIENCE_LAYER_OWNER = "hubly_brain";
var EXPERIENCE_LAYER_LABEL = "Hubly Experience Layer";
var EXPERIENCE_LAYER_MILESTONE = "2";
var EXPERIENCE_LAYER_EPIC = 0;
var EXPERIENCE_VISUAL = {
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
    transitionMs: 380
  },
  radius: "14px",
  wordmark: "assets/hubly-wordmark.png",
  wordmarkOnDark: "assets/hubly-wordmark-on-dark.png"
};
var EMOTIONAL_TIMELINE = [
  "curiosity",
  "discovery",
  "confidence",
  "excitement",
  "pride",
  "momentum",
  "trust",
  "partnership"
];
var TRANSITION_PIPELINE = [
  "conversation",
  "thinking",
  "building",
  "preview",
  "approval",
  "deployment",
  "celebration"
];
var CONVERSATION_RULES = {
  maxFollowUpQuestions: 3,
  askOnlyWhenConfidenceBelow: 70,
  explainWhyQuestionMatters: true,
  neverRepeat: true,
  neverAskKnownFacts: true,
  neverInterview: true,
  neverInterrogate: true
};
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function firstName(name) {
  if (!name) return null;
  return String(name).trim().split(/\s+/)[0] || null;
}
function msg(kind, text, opts) {
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
    timestamp: nowIso()
  };
}
var FORBIDDEN_LOADING = [
  /^loading\.?\.?\.?$/i,
  /^please wait\.?\.?\.?$/i,
  /^generating\.?\.?\.?$/i,
  /^processing\.?\.?\.?$/i
];
function isForbiddenLoading(text) {
  const t = String(text || "").trim();
  return FORBIDDEN_LOADING.some((re) => re.test(t));
}
function detectGreetingContext(opts) {
  if (opts.isNewOwner) return "new_owner";
  if ((opts.jobsToday || 0) >= 4) return "busy_day";
  if (opts.isReturning) return "returning";
  const h = opts.hour ?? (/* @__PURE__ */ new Date()).getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "default";
}
function buildGreeting(opts) {
  const name = firstName(opts.ownerName);
  const context = opts.context || detectGreetingContext(opts);
  let text = "";
  let emotion = "curiosity";
  switch (context) {
    case "morning":
      text = name ? `Good morning, ${name} \u{1F44B}

Ready to build today?` : "Good morning \u{1F44B}\n\nReady to build today?";
      emotion = "curiosity";
      break;
    case "afternoon":
      text = name ? `Hey ${name} \u2014 afternoon check-in. What are we building?` : "Hey \u2014 afternoon check-in. What are we building?";
      break;
    case "evening":
      text = name ? `Evening, ${name}. Want to tidy something up before tomorrow?` : "Evening. Want to tidy something up before tomorrow?";
      emotion = "momentum";
      break;
    case "returning":
      text = name ? `Welcome back, ${name}.

I reviewed your business while you were away.` : "Welcome back.\n\nI reviewed your business while you were away.";
      emotion = "trust";
      break;
    case "new_owner":
      text = "Hi \u{1F44B}\n\nI'm Hubly.\n\nLet's build your business together.\n\n**What are we building today?**";
      emotion = "curiosity";
      break;
    case "busy_day":
      text = name ? `Looks like you've got ${opts.jobsToday} jobs today, ${name}.

Let's make today easier.` : `Looks like you've got ${opts.jobsToday} jobs today.

Let's make today easier.`;
      emotion = "momentum";
      break;
    default:
      text = name ? `Hey ${name} \u2014 what are we building today?` : "Hey \u2014 what are we building today?";
  }
  return msg("greeting", text, {
    why: `Contextual greeting (${context}) \u2014 never generic.`,
    emotion,
    personalityMode: "greeting"
  });
}
function buildThinking(phase = "researching") {
  const lines = {
    researching: "I'm researching businesses like yours.",
    found_something: "I found something interesting.",
    comparing: "I'm comparing a few ideas.",
    changed_mind: "I changed my mind.",
    one_more: "I'm making one more improvement.",
    stronger: "I think this version is stronger."
  };
  return msg("thinking", lines[phase], {
    why: "Every delay builds confidence \u2014 never 'Loading\u2026'.",
    emotion: "discovery",
    personalityMode: "explain"
  });
}
function thinkingSequence() {
  return ["researching", "found_something", "comparing", "one_more", "stronger"].map((p) => buildThinking(p));
}
function enforceConversationRules(opts) {
  const actions = [];
  const conf = opts.confidence == null ? 80 : Number(opts.confidence);
  let qs = [...opts.questions || []].map((q) => String(q || "").trim()).filter(Boolean);
  const known = (opts.knownFacts || []).map((k) => k.toLowerCase());
  qs = qs.filter((q) => {
    const low = q.toLowerCase();
    const hitsKnown = known.some((k) => k && low.includes(k));
    if (hitsKnown) actions.push("skipped_known_fact");
    return !hitsKnown;
  });
  const prev = new Set((opts.previouslyAsked || []).map((q) => q.toLowerCase().trim()));
  qs = qs.filter((q) => {
    if (prev.has(q.toLowerCase())) {
      actions.push("skipped_repeat");
      return false;
    }
    return true;
  });
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
    why: "This helps me recommend something that actually fits how you work \u2014 not a generic template."
  }));
  return { shown, delayed, withWhy, actions };
}
function buildQuestion(question, why) {
  return msg("question", question, {
    why: why || "One curious question \u2014 never an interview.",
    emotion: "curiosity",
    personalityMode: "ask"
  });
}
function buildCelebration(milestone, ownerName) {
  const name = firstName(ownerName);
  const lines = {
    first_customer_booked: name ? `\u{1F389} First customer booked \u2014 that's the start of something real, ${name}.` : "\u{1F389} First customer booked \u2014 that's the start of something real.",
    first_five_star: "\u2B50 First five-star review. Customers are noticing.",
    website_published: "\u{1F680} Website published. Your business is live.",
    first_1000: "\u{1F4B0} First $1,000. Momentum is real.",
    hundredth_booking: "\u{1F3C6} 100th booking. You're building a machine.",
    monthly_goal: name ? `\u{1F3AF} Monthly goal reached, ${name}. Proud of this one.` : "\u{1F3AF} Monthly goal reached. Proud of this one."
  };
  return msg("celebration", lines[milestone], {
    why: "Celebrate meaningful milestones \u2014 never trivial clicks.",
    emotion: "pride",
    personalityMode: "celebrate"
  });
}
function isTrivialCelebration(action) {
  return /clicked|opened|scrolled|hovered|toggled dark mode|saved draft/i.test(action);
}
function buildCoaching(opts) {
  const text = `I noticed something.

${opts.observation}

If this were my business, I'd recommend ${opts.recommendation}.

Here's why: ${opts.why}`;
  return msg("coaching", text, {
    why: "Never lecture. Never shame. Always explain why.",
    emotion: "confidence",
    personalityMode: "encourage"
  });
}
function buildHonestDisagreement(opts) {
  const text = `I can absolutely do that.

I don't recommend it because ${opts.whyNotRecommended}

Would you still like me to continue?`;
  return msg("disagreement", text, {
    why: "Partner, not a yes-machine.",
    emotion: "trust",
    personalityMode: "disagree",
    actions: [
      { id: "continue_anyway", label: "Yes, continue", primary: false },
      { id: "keep_as_is", label: "Keep it as is", primary: true }
    ]
  });
}
function buildError(opts) {
  const resume = opts.resumeNote || "then I'll continue exactly where we left off.";
  const text = `I couldn't finish that because ${opts.blockedBy}.

Let's ${opts.nextStep}, ${resume}`;
  return msg("error", text, {
    why: "Failures feel calm. Context never disappears.",
    emotion: "trust",
    personalityMode: "apologize"
  });
}
function buildWarning(text, why) {
  const body = String(text || "").trim();
  const voiced = /\bI\b|I(?:'m)|here'?s why|let'?s /i.test(body) ? body : `I noticed something worth flagging.

${body}

I'd adjust before it costs you a day.`;
  return msg("warning", voiced, {
    why: why || "Honest caution without alarmism.",
    emotion: "confidence",
    personalityMode: "explain"
  });
}
function buildEmptyState(surface) {
  const lines = {
    customers: "No customers yet.\n\nLet's get your first booking.",
    portfolio: "No portfolio.\n\nUpload a few finished jobs and I'll organize everything.",
    reviews: "No reviews.\n\nI'll remind you after your next completed job.",
    jobs: "No jobs on the board yet.\n\nWant me to help fill the week?",
    automations: "No automations yet.\n\nTell me an outcome \u2014 I'll draft a workflow you can preview.",
    quotes: "No open quotes.\n\nWhen a lead comes in, I'll help you follow up fast."
  };
  return msg("empty", lines[surface], {
    why: "Every empty state teaches and guides.",
    emotion: "curiosity",
    personalityMode: "encourage"
  });
}
function buildTransition(phase) {
  const lines = {
    conversation: "I'm with you \u2014 keep talking.",
    thinking: "Give me a moment \u2014 I'm thinking this through.",
    building: "I'm building this live so you can watch it take shape.",
    preview: "Here's a preview before anything changes.",
    approval: "When you're ready, say the word and we'll launch.",
    deployment: "Deploying carefully \u2014 I'll verify every step.",
    celebration: "It's live. This is a real moment for the business."
  };
  return msg("transition", lines[phase], {
    why: "Major moments feel intentional \u2014 never abrupt.",
    emotion: phase === "celebration" ? "pride" : phase === "thinking" ? "discovery" : "partnership",
    personalityMode: "transition"
  });
}
function transitionNarration() {
  return TRANSITION_PIPELINE.map((p) => buildTransition(p));
}
function buildSuccess(text) {
  return msg("success", text, {
    why: "Success states sound like Hubly, not a toast notification.",
    emotion: "pride",
    personalityMode: "celebrate"
  });
}
function buildLaunch(ownerName) {
  const name = firstName(ownerName);
  return msg(
    "launch",
    name ? `Your business is live, ${name}. Website, booking, and the next steps are ready \u2014 this is the opening day feeling.` : "Your business is live. Website, booking, and the next steps are ready \u2014 this is the opening day feeling.",
    {
      why: "Launch moments create pride and momentum.",
      emotion: "excitement",
      personalityMode: "celebrate"
    }
  );
}
function buildRecommendation(opts) {
  return msg(
    "recommendation",
    `I'd recommend ${opts.recommendation}.

Here's why: ${opts.why}`,
    {
      why: "Recommend with impact \u2014 never pressure.",
      emotion: "confidence",
      personalityMode: "explain",
      actions: [
        { id: "yes", label: "Yes, let's do it", primary: true },
        { id: "more", label: "Tell me more", primary: false }
      ]
    }
  );
}
function buildExplanation(why) {
  return msg("explanation", `Here's why: ${why}`, {
    why: "Always explain thinking.",
    emotion: "confidence",
    personalityMode: "explain"
  });
}
function emotionForKind(kind) {
  const map = {
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
    transition: "partnership"
  };
  return map[kind];
}
function emotionalProgression() {
  return [
    { beat: "curiosity", supports: ["greeting", "question", "empty"] },
    { beat: "discovery", supports: ["thinking", "loading"] },
    { beat: "confidence", supports: ["explanation", "recommendation", "coaching"] },
    { beat: "excitement", supports: ["launch"] },
    { beat: "pride", supports: ["celebration", "success"] },
    { beat: "momentum", supports: ["transition"] },
    { beat: "trust", supports: ["error", "warning", "disagreement"] },
    { beat: "partnership", supports: ["transition", "coaching"] }
  ];
}
function applyExperienceLayer(input) {
  const actions = ["experience_layer"];
  let text = String(input.text || "").trim();
  let forbiddenLoadingRemoved = false;
  if (isForbiddenLoading(text)) {
    text = buildThinking("researching").text;
    forbiddenLoadingRemoved = true;
    actions.push("replaced_forbidden_loading");
  }
  text = text.replace(/\b(please wait|generating|processing)\b/gi, "").replace(/\s{2,}/g, " ").trim();
  const identity = applyHublyIdentity(text, {
    request: input.request,
    celebrate: !!input.celebrate
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
    opening: input.opening
  });
  text = personality.text;
  actions.push(...personality.actions);
  const kind = input.kind || kindFromPersonality(personality.mode);
  const message = msg(kind, text, {
    why: personality.moment.why,
    emotion: emotionForKind(kind),
    personalityMode: personality.mode
  });
  return {
    message,
    personality,
    identityApplied: true,
    forbiddenLoadingRemoved,
    text: message.text,
    actions
  };
}
function kindFromPersonality(mode) {
  const map = {
    greeting: "greeting",
    celebrate: "celebration",
    apologize: "error",
    explain: "explanation",
    ask: "question",
    disagree: "disagreement",
    encourage: "coaching",
    uncertainty: "warning",
    transition: "transition"
  };
  return map[mode];
}
function soundsLikeHubly(text) {
  const t = String(text || "");
  if (!t.trim()) return false;
  if (isForbiddenLoading(t)) return false;
  if (/\b(LLM|OpenAI|Claude|GPT|Gemini|our AI agents|As an AI)\b/i.test(t)) return false;
  if (/\berror code\b|\bnull pointer\b|\bstack trace\b|something went wrong/i.test(t)) return false;
  return /\bI(?:'m| am| can| think| recommend| noticed| heard| looked| checked| found| changed| couldn'?t)\b/i.test(t) || /here'?s why|what are we building|if this were my business|would you still|let'?s /i.test(t) || /nice work|welcome back|good morning|your business is live|first (customer|five-star|\$1,000)|website published/i.test(t) || /I(?:'m)? (researching|comparing|making|found)|changed my mind|version is stronger/i.test(t) || /don'?t recommend|proud of this|momentum is real/i.test(t);
}
var HublyExperienceLayer = {
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
  personalityLine
};
export {
  CONVERSATION_RULES,
  EMOTIONAL_TIMELINE,
  EXPERIENCE_LAYER_EPIC,
  EXPERIENCE_LAYER_LABEL,
  EXPERIENCE_LAYER_MILESTONE,
  EXPERIENCE_LAYER_OWNER,
  EXPERIENCE_LAYER_VERSION,
  EXPERIENCE_VISUAL,
  FORBIDDEN_LOADING,
  HublyExperienceLayer,
  TRANSITION_PIPELINE,
  applyExperienceLayer,
  buildCelebration,
  buildCoaching,
  buildEmptyState,
  buildError,
  buildExplanation,
  buildGreeting,
  buildHonestDisagreement,
  buildLaunch,
  buildQuestion,
  buildRecommendation,
  buildSuccess,
  buildThinking,
  buildTransition,
  buildWarning,
  detectGreetingContext,
  emotionForKind,
  emotionalProgression,
  enforceConversationRules,
  isForbiddenLoading,
  isTrivialCelebration,
  soundsLikeHubly,
  thinkingSequence,
  transitionNarration
};
