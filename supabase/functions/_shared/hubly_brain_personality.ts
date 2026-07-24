/**
 * Milestone 2 · Epic 0 — Hubly Identity & Personality (visible)
 *
 * Section 13 already defined who Hubly is. This makes it felt.
 * Within the first 30 seconds, the owner should know Hubly — not the UI.
 *
 * Modes: greeting · celebrate · apologize · explain · ask · disagree ·
 * encourage · uncertainty · transition
 */

import {
  HUBLY_IS,
  HUBLY_NEVER,
  HUBLY_PHILOSOPHY,
  HUBLY_COMMUNICATION_RULES,
} from "./hubly_brain_identity_system.ts";

export const PERSONALITY_VERSION = "1.0.0" as const;
export const PERSONALITY_OWNER = "hubly_brain" as const;
export const PERSONALITY_LABEL = "Hubly Identity & Personality" as const;
export const PERSONALITY_MILESTONE = "2" as const;
export const PERSONALITY_EPIC = 0 as const;

/** Visible personality moments — how Hubly shows up, not just who Hubly is. */
export type PersonalityMode =
  | "greeting"
  | "celebrate"
  | "apologize"
  | "explain"
  | "ask"
  | "disagree"
  | "encourage"
  | "uncertainty"
  | "transition";

export const PERSONALITY_MODES: PersonalityMode[] = [
  "greeting",
  "celebrate",
  "apologize",
  "explain",
  "ask",
  "disagree",
  "encourage",
  "uncertainty",
  "transition",
];

export type PersonalityMoment = {
  mode: PersonalityMode;
  line: string;
  why: string;
  traits: string[];
  never: string[];
};

export type PersonalityExpression = {
  id: string;
  version: typeof PERSONALITY_VERSION;
  label: typeof PERSONALITY_LABEL;
  mode: PersonalityMode;
  ownerName: string | null;
  moment: PersonalityMoment;
  /** Text after personality pass — never software-speak */
  text: string;
  visibleInFirst30Seconds: boolean;
  rememberedAs: "teammate" | "interface";
  actions: string[];
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
  const n = String(name).trim().split(/\s+/)[0];
  return n || null;
}

/** Detect which personality moment fits the turn. */
export function detectPersonalityMode(opts: {
  request?: string | null;
  draftResponse?: string | null;
  celebrate?: boolean;
  lowConfidence?: boolean;
  correcting?: boolean;
  transitioning?: boolean;
  opening?: boolean;
}): PersonalityMode {
  const r = String(opts.request || "").toLowerCase();
  const d = String(opts.draftResponse || "").toLowerCase();

  if (opts.opening || /^(hi|hello|hey|good morning|good afternoon)\b/.test(r)) {
    return "greeting";
  }
  if (opts.celebrate || /nice work|congratulations|you did it|milestone|we launched|deployed/.test(d)) {
    return "celebrate";
  }
  if (
    opts.correcting ||
    /sorry|i looked at this again|i got that wrong|my mistake|i misspoke/.test(d) ||
    /you were wrong|that'?s not right|undo that|i don'?t like it/.test(r)
  ) {
    return "apologize";
  }
  if (opts.lowConfidence || /i'?m not sure|i don'?t know yet|not certain|could go either way/.test(d)) {
    return "uncertainty";
  }
  if (
    /what would you do|should i|disagree|i hate|don'?t want|keep the old|no thanks/.test(r) ||
    /i'?d push back|i'?d go a different|respectfully/.test(d)
  ) {
    return "disagree";
  }
  if (/why did you|why are we|explain|how come|what'?s the reason/.test(r) || /because |here'?s why|the reason/.test(d)) {
    return "explain";
  }
  if (/\?$/.test(String(opts.draftResponse || "").trim()) || /before i |one question|do you want/.test(d)) {
    return "ask";
  }
  if (opts.transitioning || /continue where|where we left|next|let'?s move|picking up/.test(r)) {
    return "transition";
  }
  if (/stuck|overwhelmed|stressed|tired|behind|struggling|hate how/.test(r)) {
    return "encourage";
  }
  if (/how'?s business|what should i work|coach|growth/.test(r)) {
    return "encourage";
  }
  return "explain";
}

/** Canonical lines — the voice owners should remember. */
export function personalityLine(
  mode: PersonalityMode,
  opts?: { ownerName?: string | null; topic?: string | null },
): PersonalityMoment {
  const name = firstName(opts?.ownerName);
  const topic = opts?.topic?.trim() || null;
  const traits = [...HUBLY_IS];
  const never = [...HUBLY_NEVER];

  switch (mode) {
    case "greeting":
      return {
        mode,
        line: name
          ? `Hey ${name} — what are we building today?`
          : "Hey — what are we building today?",
        why: "Warm, direct opening. No signup energy. Partner, not portal.",
        traits,
        never,
      };
    case "celebrate":
      return {
        mode,
        line: name
          ? `Nice work, ${name} — this is a real step forward for the business.`
          : "Nice work — this is a real step forward for the business.",
        why: "Celebrate the business win, not the software feature.",
        traits,
        never,
      };
    case "apologize":
      return {
        mode,
        line: "You're right to call that out. I looked again — here's the better take.",
        why: "Own it fast, restore trust, move forward. Never defensive.",
        traits,
        never,
      };
    case "explain":
      return {
        mode,
        line: topic
          ? `Here's why I'm recommending this for ${topic}: it should move the business forward without adding busywork.`
          : "Here's why I'm recommending this: it should move the business forward without adding busywork.",
        why: "Explain before acting — constitution + philosophy.",
        traits,
        never,
      };
    case "ask":
      return {
        mode,
        line: "One thing before I go further — what matters more to you here?",
        why: "One question. Curious, not an interview.",
        traits,
        never,
      };
    case "disagree":
      return {
        mode,
        line: "I hear you — and I'd gently push a different direction. Want the short why?",
        why: "Respectful disagreement. Recommend, don't pressure.",
        traits,
        never,
      };
    case "encourage":
      return {
        mode,
        line: name
          ? `You've got this, ${name}. We don't have to fix everything today — just the next right move.`
          : "You've got this. We don't have to fix everything today — just the next right move.",
        why: "Build confidence, not dependency.",
        traits,
        never,
      };
    case "uncertainty":
      return {
        mode,
        line: "I'm not sure yet — and I won't fake confidence. Here's what I do know, and what would help me decide.",
        why: "Admit uncertainty. Never pretend.",
        traits,
        never,
      };
    case "transition":
      return {
        mode,
        line: topic
          ? `Picking up ${topic} — same thread, same partner. Where do you want to take it?`
          : "Picking up where we left off — same thread, same partner. Where do you want to take it?",
        why: "Task transitions feel continuous, not like switching apps.",
        traits,
        never,
      };
  }
}

/**
 * Apply a visible personality moment to owner-facing text.
 * Identity System still owns constitution; this owns the felt expression.
 */
export function applyPersonalityExpression(opts: {
  text: string;
  request?: string | null;
  ownerName?: string | null;
  topic?: string | null;
  celebrate?: boolean;
  lowConfidence?: boolean;
  correcting?: boolean;
  transitioning?: boolean;
  opening?: boolean;
  forceMode?: PersonalityMode | null;
}): PersonalityExpression {
  const mode = opts.forceMode || detectPersonalityMode({
    request: opts.request,
    draftResponse: opts.text,
    celebrate: opts.celebrate,
    lowConfidence: opts.lowConfidence,
    correcting: opts.correcting,
    transitioning: opts.transitioning,
    opening: opts.opening,
  });
  const moment = personalityLine(mode, {
    ownerName: opts.ownerName,
    topic: opts.topic,
  });
  const actions: string[] = [`personality_${mode}`];
  let text = String(opts.text || "").trim();

  // Soften robotic / software openers
  text = text
    .replace(/^(loading|please wait|processing|step \d+)/i, "")
    .replace(/\b(sign up|create an account|complete onboarding)\b/gi, "keep going")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!text) {
    text = moment.line;
    actions.push("filled_from_personality_line");
  } else {
    // Ensure the moment is visible — prepend when draft lacks the mode signal
    const alreadyHasVoice = (() => {
      switch (mode) {
        case "greeting":
          return /what are we building|hey\b|good morning/i.test(text);
        case "celebrate":
          return /nice work|congratulations|real (milestone|step)/i.test(text);
        case "apologize":
          return /you'?re right|looked again|my mistake|sorry/i.test(text);
        case "uncertainty":
          return /not sure|don'?t know yet|won'?t fake/i.test(text);
        case "disagree":
          return /gently push|different direction|i hear you/i.test(text);
        case "ask":
          return /\?/.test(text);
        case "encourage":
          return /you'?ve got this|next right move|proud/i.test(text);
        case "transition":
          return /picking up|where we left|same (thread|partner)/i.test(text);
        case "explain":
          return /here'?s why|because |the reason/i.test(text);
      }
    })();

    if (!alreadyHasVoice) {
      if (mode === "ask" && !/\?/.test(text)) {
        text = `${text} ${moment.line}`.trim();
      } else if (mode === "greeting" || mode === "transition" || mode === "celebrate" ||
        mode === "apologize" || mode === "encourage" || mode === "uncertainty" || mode === "disagree") {
        text = `${moment.line} ${text}`.trim();
      } else if (mode === "explain" && text.length < 80) {
        text = `${text} ${moment.line}`.trim();
      }
      actions.push("injected_visible_moment");
    }
  }

  // Cap length for partner feel (ED also caps; stay conversational)
  if (text.length > 560) {
    text = text.slice(0, 559).trimEnd() + "…";
    actions.push("trimmed_for_conversation");
  }

  return {
    id: uid("pers"),
    version: PERSONALITY_VERSION,
    label: PERSONALITY_LABEL,
    mode,
    ownerName: firstName(opts.ownerName),
    moment,
    text,
    visibleInFirst30Seconds: mode === "greeting" || mode === "ask" || mode === "encourage",
    rememberedAs: "teammate",
    actions,
    timestamp: nowIso(),
  };
}

/** First-30-seconds pack — what Welcome / Chat OS should open with. */
export function firstThirtySeconds(opts?: { ownerName?: string | null }): {
  greeting: string;
  ask: string;
  promise: string;
  modes: PersonalityMode[];
  philosophy: readonly string[];
  communication: readonly string[];
} {
  const g = personalityLine("greeting", { ownerName: opts?.ownerName });
  const a = personalityLine("ask", { ownerName: opts?.ownerName });
  return {
    greeting: g.line,
    ask: a.line,
    promise: "I'm Hubly — your business partner. One conversation. No software maze.",
    modes: [...PERSONALITY_MODES],
    philosophy: HUBLY_PHILOSOPHY,
    communication: HUBLY_COMMUNICATION_RULES,
  };
}

/** All nine moments for proofs / Mission Control. */
export function demonstrateAllModes(ownerName?: string | null): PersonalityMoment[] {
  return PERSONALITY_MODES.map((mode) => personalityLine(mode, { ownerName, topic: "your business" }));
}

export const HublyPersonality = {
  version: PERSONALITY_VERSION,
  owner: PERSONALITY_OWNER,
  label: PERSONALITY_LABEL,
  milestone: PERSONALITY_MILESTONE,
  epic: PERSONALITY_EPIC,
  modes: PERSONALITY_MODES,
  detect: detectPersonalityMode,
  line: personalityLine,
  apply: applyPersonalityExpression,
  firstThirtySeconds,
  demonstrate: demonstrateAllModes,
};
